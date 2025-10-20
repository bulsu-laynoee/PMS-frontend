import React, { useEffect, useState, useRef, useMemo } from 'react';
import api from '../utils/api';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getUserEmail } from '../utils/auth';
import '../services/echo';

const MessageSquareText = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M13 8H7" />
    <path d="M17 12H7" />
  </svg>
);
const SendIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg>
);

const UserAvatar = ({ name }) => {
    const style = {
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        backgroundColor: '#4A0E0E',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    };
    return <div style={style}>{name ? name.charAt(0) : ''}</div>;
};

export default function Messages() {
  // Notes: realtime improvements and search enhancements
  // - Subscribes to `conversation.{id}` channels so sidebar and open convo update live
  // - Search now matches participant names and emails, plus conversation title/name
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const echoSubscription = useRef(null);
  const messagesEndRef = useRef(null);
  const lastAutoOpenRef = useRef({ id: null, ts: 0 });
  const activeConvRef = useRef(null);
  const conversationsRef = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Reliable global current user detection (many fallbacks)
  const globalCurrentUser = typeof window !== 'undefined'
    ? (window.Laravel?.user || window.currentUser || (window.APP_CURRENT_USER ? { id: window.APP_CURRENT_USER_ID, email: window.APP_CURRENT_USER_EMAIL } : null))
    : null;
  const globalCurrentUserId = currentUser?.id || globalCurrentUser?.id || globalCurrentUser?.user_id || null;
  const globalCurrentUserEmail = currentUser?.email || globalCurrentUser?.email || getUserEmail();

  // Load current user information
  const loadCurrentUser = async () => {
    try {
      const res = await api.get('/user');
      const user = res.data.data || res.data;
      console.log('DEBUG: Loaded current user:', user);
      setCurrentUser(user);
    } catch (e) {
      console.error('Failed to load current user', e);
    }
  };

  // If URL contains a conversation or user query param, open that conversation
  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const convId = sp.get('conversation') || sp.get('conversation_id') || sp.get('conv') || sp.get('id') || params.conversationId;
    const userId = sp.get('user');
    if (!convId && !userId) return;

    if (convId) {
      // If the conversation is already in the list, open it; otherwise try to fetch it by id
      const existing = (conversations || []).find(c => String(c.id) === String(convId));
      if (existing) {
        openConversation(existing).catch(() => {});
      } else {
        openConversation({ id: convId }).catch(() => {});
      }
      // keep the conversation id in the URL so links are shareable
      return;
    }

    if (userId) {
      (async () => {
        try {
          const res = await api.post('/conversations', { user_ids: [Number(userId)] });
          const conv = res.data.data || res.data || null;
          const convObj = conv && (conv.conversation || conv);
          if (convObj && convObj.id) {
            openConversation(convObj).catch(() => {});
            // navigate to a stable URL that includes the conversation id
            try { navigate(`/home/messages?conversation=${convObj.id}`, { replace: true }); } catch (e) {}
          }
        } catch (e) {
          console.error('Failed to create/get conversation from query param', e);
        }
      })();
    }
  }, [location.search, conversations]);

  // Loads conversations (simple pageless search)
  // Accepts an optional `qOverride` so callers can request results for a
  // different query without changing the debounced `query` state.
  const loadConversations = async (qOverride) => {
    try {
      const qParam = (typeof qOverride !== 'undefined') ? qOverride : query;
      const res = await api.get('/conversations', { params: { q: qParam } });
      const data = res.data.data || res.data;
      const conversations = data.data || data;
      console.debug('DEBUG: Loaded conversations (API):', conversations);
      console.log('DEBUG: Current user detection:', {
        currentUser,
        globalCurrentUser,
        globalCurrentUserId,
        globalCurrentUserEmail
      });
      setConversations(conversations);
      // keep ref in sync immediately
      try { conversationsRef.current = conversations; } catch (err) {}
      // If user typed a query (or we specifically requested qOverride) and the
      // returned items lack participant data, fetch details for a small batch
      // so client-side search can match names/emails.
      const effectiveQ = (qOverride !== undefined) ? qOverride : query;
      if ((effectiveQ || '').trim().length > 0) {
        enrichConversations(conversations).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  };

  // When searching, the list endpoint may return lightweight conversation objects
  // without `users`/participants. To allow client-side matching on participant
  // names/emails, fetch details for up to N conversations that are missing users.
  const enrichConversations = async (convs) => {
    try {
      if (!Array.isArray(convs) || convs.length === 0) return;
      const missing = convs.filter(c => !(c.users && c.users.length > 0));
      if (missing.length === 0) return;
      // limit how many we fetch to avoid thundering herd
      const limit = 10;
      const toFetch = missing.slice(0, limit);
      const results = await Promise.allSettled(toFetch.map(c => api.get(`/conversations/${c.id}`)));
      let mutated = false;
      const copy = convs.slice();
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const payload = r.value.data.data || r.value.data;
          const fetched = payload.conversation ? payload.conversation : payload;
          const msgs = payload.messages?.data || payload.messages || [];
          const users = fetched.users || fetched.participants || fetched.members || [];
          // find in copy and merge
          const id = toFetch[idx].id;
          const pos = copy.findIndex(x => x.id === id);
          if (pos > -1) {
            copy[pos] = { ...copy[pos], ...fetched, users, messages: msgs };
            mutated = true;
          }
        }
      });
      if (mutated) {
        setConversations(copy);
        conversationsRef.current = copy;
      }
    } catch (err) {
      // ignore enrichment errors
    }
  };

  // ======= THIS IS THE UPDATED FUNCTION =======
  // Open conversation and subscribe
  const openConversation = async (conv) => {
    try {
      const res = await api.get(`/conversations/${conv.id}`);
      const payload = res.data.data || res.data;
      const fetchedConv = payload.conversation ? payload.conversation : payload;
      const msgs = payload.messages?.data || payload.messages || [];
      setActiveConv({ ...fetchedConv, messages: msgs });

      // --- START: MODIFIED ECHO LOGIC ---

      // First, clean up any previous subscription
      if (echoSubscription.current) {
        try { echoSubscription.current.stopListening('MessageSent'); } catch {}
        try { window.Echo.leave(`private:conversation.${echoSubscription.currentConvId}`); } catch {}
      }

      // Then, set up the new subscription
      if (window.Echo && typeof window.Echo.private === 'function') {
        const conversationId = fetchedConv.id; // Capture the ID for use in the listener
        const channel = window.Echo.private(`conversation.${conversationId}`);
        
        echoSubscription.current = channel; // Store the channel reference
        echoSubscription.currentConvId = conversationId; // Store the ID for cleanup

        channel.listen('MessageSent', (e) => {
        // DEBUG: incoming event (openConversation-level listener)
        try { console.debug('Echo MessageSent (open) received for conv', fetchedConv.id, e); } catch (err) {}
        // normalize message payload (backend may send different shapes)
        const newMessage = e?.message || e?.data?.message || e?.data || e || null;

          // 1. Update the main conversation list (for the sidebar)
          setConversations(prevConvs =>
            prevConvs.map(c => {
              if (c.id === conversationId) {
                // Increment message count and update timestamp
                return { 
                    ...c, 
                    last_message_at: new Date(newMessage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    messages_count: (c.messages_count || 0) + 1 
                };
              }
              return c;
            })
          );

          // 2. Update the active conversation window's messages
          setActiveConv(prevActiveConv => {
            // CRITICAL CHECK: Only update if the message is for the currently active conversation
            if (prevActiveConv && prevActiveConv.id === conversationId) {
              // Prevent adding duplicate messages
              if (prevActiveConv.messages.some(msg => msg.id === newMessage.id)) {
                return prevActiveConv;
              }
              // Add the new message
              return {
                ...prevActiveConv,
                messages: [...prevActiveConv.messages, newMessage]
              };
            }
            // If not the active conversation, don't change the window
            return prevActiveConv;
          });

          // Ensure we refresh the conversation list and load messages if admin
          // doesn't have any active conversation open. This forces the UI to
          // show the incoming message without a manual refresh.
          try {
            // refresh sidebar list (debounced by lastAutoOpenRef)
            loadConversations().catch(() => {});
            if (!activeConvRef.current) {
              const now = Date.now();
              if (!(lastAutoOpenRef.current.id === fetchedConv.id && (now - lastAutoOpenRef.current.ts) < 3000)) {
                lastAutoOpenRef.current = { id: fetchedConv.id, ts: now };
                const convObj = (conversationsRef.current || []).find(c => c.id === fetchedConv.id) || fetchedConv;
                if (convObj && typeof openConversation === 'function') openConversation(convObj).catch(() => {});
              }
            }
          } catch (err) {}
        });
      }

        // Also ensure global per-conversation subscriptions map is updated so the sidebar
        // receives events even when a conversation is not actively opened. We'll create
        // a lightweight subscription for this conversation id if not present.
        try {
          if (window.Echo && typeof window.Echo.private === 'function') {
            const sidebarChannelName = `conversation.${fetchedConv.id}`;
            // store in a map for cleanup
            if (!echoSubscription.map) echoSubscription.map = {};
            if (!echoSubscription.map[fetchedConv.id]) {
              const ch = window.Echo.private(sidebarChannelName);
              ch.listen('MessageSent', (e) => {
                try { console.debug('Echo MessageSent (map) received for conv', fetchedConv.id, e); } catch (err) {}
                const m = e?.message || e?.data?.message || e?.data || e || null;
                // Update sidebar item timestamp/count
                setConversations(prev => prev.map(c => c.id === fetchedConv.id ? ({
                  ...c,
                  last_message_at: m && m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : c.last_message_at,
                  messages_count: (c.messages_count || 0) + 1
                }) : c));
                // Refresh conversations list and possibly auto-open
                try {
                  loadConversations().catch(() => {});
                  if (!activeConvRef.current) {
                    const now = Date.now();
                    if (!(lastAutoOpenRef.current.id === fetchedConv.id && (now - lastAutoOpenRef.current.ts) < 3000)) {
                      lastAutoOpenRef.current = { id: fetchedConv.id, ts: now };
                      const convObj = (conversationsRef.current || []).find(c => c.id === fetchedConv.id) || fetchedConv;
                      if (convObj && typeof openConversation === 'function') openConversation(convObj).catch(() => {});
                    }
                  }
                } catch (err) {}
              });
              echoSubscription.map[fetchedConv.id] = ch;
            }
          }
        } catch (err) {
          console.warn('Failed to create sidebar subscription', err);
        }
      // --- END: MODIFIED ECHO LOGIC ---

    } catch (e) {
      console.error('Failed to open conversation', e);
    }
  };
  // ============================================

  const sendMessage = async () => {
    if (!activeConv || !messageText.trim()) return;

    const textToSend = messageText; // Store the message text
    setMessageText(''); // Clear the input immediately for a responsive feel

    try {
      // 1. Wait for the API response
      const res = await api.post(`/conversations/${activeConv.id}/message`, { body: textToSend });
      
      // 2. Get the new message object from the response
      //    (Adjust 'res.data.message' if your API returns it differently)
      const newMessage = res.data.message || res.data.data || res.data;

      // 3. Add the new message to your active conversation's state
      //    This makes YOUR sent message appear instantly
      if (newMessage && newMessage.id) {
        setActiveConv(prev => ({
          ...prev,
          messages: [...(prev.messages || []), newMessage]
        }));
      }

      // 4. Refresh the conversation list (which you already do)
      loadConversations();

    } catch (e) {
      console.error('Failed to send message', e);
      // If it fails, put the message back in the input box
      setMessageText(textToSend);
    }
  };


  useEffect(() => {
    loadCurrentUser();
  }, []);
  
  useEffect(() => { loadConversations(); }, [query]);
  // Debounce searchTerm -> query to avoid excessive API calls while typing
  useEffect(() => {
    const id = setTimeout(() => setQuery(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);
  // Also trigger an immediate server fetch while typing so server-side
  // matches appear quickly (we still debounce `query` for regular load logic).
  useEffect(() => {
    if ((searchTerm || '').trim().length === 0) return;
    // fire-and-forget: request server results for this searchTerm
    loadConversations(searchTerm).catch(() => {});
  }, [searchTerm]);
  useEffect(() => { loadConversations(); }, []);
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // Keep refs in sync to avoid stale closures inside Echo listeners
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ======= NAME RESOLUTION: use same logic everywhere =======
  // Try many possible fields commonly returned by backends
  const pickParticipantName = (user) => {
    if (!user) return null;
    return user.display_name || user.name || user.full_name || user.username || user.email || null;
  };

  // Given a conversation object, attempt to return the "other" participant object (not the current user)
  const getOtherParticipant = (conv) => {
    if (!conv) return null;
    // possible collections
    const candidateLists = [conv.users, conv.participants, conv.members, conv.memberships];
    const users = candidateLists.find(arr => Array.isArray(arr) && arr.length > 0) || [];
    // If conv has explicit "other" or "with" fields, prefer them
    if (conv.other) return conv.other;
    if (conv.with) return conv.with;
    // If there are messages, try to infer from first message sender that's not current user
    if ((!users || users.length === 0) && Array.isArray(conv.messages) && conv.messages.length > 0) {
      const msgUser = conv.messages.find(m => m.sender) || conv.messages[0];
      if (msgUser && msgUser.sender) return msgUser.sender;
    }
    if (users.length === 0) return null;

    // use current id/email to filter (prefer conversation's current_user_id)
    const curId = conv.current_user_id || globalCurrentUserId;
    const curEmail = globalCurrentUserEmail;

    let other = null;
    if (curId) {
      other = users.find(u => (u.id || u.user_id) && String(u.id || u.user_id) !== String(curId));
    }
    if (!other && curEmail) {
      other = users.find(u => (u.email && u.email !== curEmail));
    }
    if (!other) {
      // prefer non-self flagged user
      other = users.find(u => !u.is_self && !u.isCurrent) || users[0];
    }
    return other || null;
  };

  const getDisplayNameForConversation = (conv) => {
    // Mirror how you said you display names: pick other participant name first,
    // fallback to conv.title, fallback to Conversation #id
    const other = getOtherParticipant(conv);
    const otherName = pickParticipantName(other);
    console.log('DEBUG: getDisplayNameForConversation for conv', conv.id, {
      conv,
      convUsers: conv.users,
      other,
      otherName,
      currentUserId: globalCurrentUserId,
      convCurrentUserId: conv.current_user_id
    });
    if (otherName) return otherName;
    if (conv.title) return conv.title;
    if (conv.name) return conv.name;
    return `Conversation #${conv.id}`;
  };

  const getFirstMessageDate = (conv) => {
    const dateStr = conv.first_message_at || conv.created_at || (conv.messages && conv.messages[0] && conv.messages[0].created_at) || null;
    return dateStr ? new Date(dateStr) : null;
  };

  // Duplicate name detection
  const nameCounts = useMemo(() => {
    const counts = {};
    conversations.forEach(c => {
      const name = getDisplayNameForConversation(c);
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [conversations]);

  // filter conversations by search query (searching display name)
  // Use the live `searchTerm` for immediate client-side filtering so typing
  // gives instant results. `query` is still used for server-side searches
  // (debounced). Prefer `searchTerm` when present.
  const filteredConversations = useMemo(() => {
    const activeQ = (searchTerm && String(searchTerm).trim().length > 0) ? searchTerm : query;
    const q = (activeQ || '').trim().toLowerCase();
    if (!q) return conversations;

    const searchableText = (c) => {
      const parts = [];
      try {
        const display = getDisplayNameForConversation(c);
        if (display) parts.push(display);
        if (c.title) parts.push(c.title);
        if (c.name) parts.push(c.name);
        if (c.id) parts.push(String(c.id));
        // include users' names and emails
        const users = c.users || c.participants || c.members || [];
        (users || []).forEach(u => {
          if (!u) return;
          if (u.display_name) parts.push(u.display_name);
          if (u.name) parts.push(u.name);
          if (u.full_name) parts.push(u.full_name);
          if (u.first_name) parts.push(u.first_name);
          if (u.last_name) parts.push(u.last_name);
          if (u.email) parts.push(u.email);
          if (u.username) parts.push(u.username);
          if (u.phone) parts.push(u.phone);
          if (u.mobile) parts.push(u.mobile);
        });
      } catch (err) {
        // ignore
      }
      return parts.join(' ').toLowerCase();
    };

    // Support simple tokenized matching: split query into tokens and require every token to match somewhere
    const tokens = q.split(/\s+/).filter(Boolean);
    return conversations.filter(c => {
      const hay = searchableText(c);
      return tokens.every(t => hay.includes(t));
    });
  }, [conversations, query, searchTerm]);

  // Subscribe to conversation channels for realtime updates (sidebar + active convo)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Echo) return;
    if (!echoSubscription.map) echoSubscription.map = {};

    const subscribe = (convId) => {
      if (!convId) return;
      if (echoSubscription.map[convId]) return;
      try {
        const ch = window.Echo.private(`conversation.${convId}`);
        ch.listen('MessageSent', (e) => {
          const m = e.message;
          // update sidebar list
          setConversations(prev => prev.map(c => c.id === convId ? ({
            ...c,
            last_message_at: m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : c.last_message_at,
            messages_count: (c.messages_count || 0) + 1
          }) : c));
          // update active convo if open
          setActiveConv(prev => {
            if (prev && prev.id === convId) {
              if (prev.messages && prev.messages.some(msg => msg.id === m.id)) return prev;
              return { ...prev, messages: [...(prev.messages || []), m] };
            }
            return prev;
          });

          // If there's no active conversation open, auto-open this one so admin
          // immediately sees the incoming message. Avoid forcing open if admin
          // is already viewing another conversation. Also debounce auto-open to
          // prevent repeated opens when multiple messages arrive quickly.
          try {
            if (!activeConv) {
              const now = Date.now();
              if (lastAutoOpenRef.current.id === convId && (now - lastAutoOpenRef.current.ts) < 3000) {
                // recently auto-opened this conv, skip
              } else {
                lastAutoOpenRef.current = { id: convId, ts: now };
                const convObj = conversations.find(c => c.id === convId);
                if (convObj && typeof openConversation === 'function') {
                  openConversation(convObj).catch(() => {});
                }
              }
            }
          } catch (err) {
            // ignore
          }
        });
        echoSubscription.map[convId] = ch;
      } catch (err) {
        console.warn('subscribe error', convId, err);
      }
    };

    conversations.forEach(c => subscribe(c.id));

    return () => {
      try {
        Object.keys(echoSubscription.map || {}).forEach(id => {
          try { echoSubscription.map[id].stopListening('MessageSent'); } catch (e) {}
          try { window.Echo.leave(`private:conversation.${id}`); } catch (e) {}
        });
      } catch (err) {}
      echoSubscription.map = {};
    };
  }, [conversations]);

  // Polling fallback: if Echo is not connected, poll the API for updates.
  useEffect(() => {
    let interval = null;
    let isRunning = false;
    const shouldPoll = () => {
      try {
        if (!window.Echo) return true;
        // if Echo exists check connector state if possible
        const conn = window.Echo && window.Echo.connector && window.Echo.connector.socket;
        if (!conn) return true;
        // if socket has connected property, use it
        if (conn.connected === false) return true;
        return false;
      } catch (err) {
        return true;
      }
    };

    const poll = async () => {
      if (isRunning) return;
      if (!shouldPoll()) return;
      isRunning = true;
      try {
        await loadConversations();
        // if active conversation open, reload its messages
        if (activeConvRef.current && activeConvRef.current.id) {
          try {
            const res = await api.get(`/conversations/${activeConvRef.current.id}`);
            const payload = res.data.data || res.data;
            const fetchedConv = payload.conversation ? payload.conversation : payload;
            const msgs = payload.messages?.data || payload.messages || [];
            // update active conv state/ref
            setActiveConv(prev => ({ ...fetchedConv, messages: msgs }));
            activeConvRef.current = { ...fetchedConv, messages: msgs };
          } catch (err) {
            // ignore per-interval errors
          }
        }
      } catch (err) {
        // ignore
      } finally {
        isRunning = false;
      }
    };

    // Start interval if polling is needed
    if (shouldPoll()) {
      interval = setInterval(poll, 3000);
      // run once immediately
      poll();
      console.debug('Messages: polling fallback started');
    }

    return () => { if (interval) clearInterval(interval); };
  }, [/* no deps: rely on refs and loadConversations */]);

  // Render
return (
    <div style={{
      display: 'flex',
      height: '98vh',
      marginTop: '5px',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#f1f5f9', // Lighter background for the whole app
      boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      marginLeft: '10px'
    }}>
      {/* Sidebar */}
      <div style={{
        width: 340,
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(100deg, #8f2b2b, #ec4545)',
          color: 'white',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <MessageSquareText style={{width: 28, height: 28}} />
          <h3 style={{fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em'}}>Conversations</h3>
          </div>
        </div>

        {/* --- Card-Based Design --- */}
        <div style={{padding: '16px', flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column'}}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
        <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: 'none', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '14px',
              }}
              />
          </div>
      {/* Conversation List */}
      <div style={{ color: '#000', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredConversations.length > 0 ? (
          filteredConversations.map(c => {
                      const isActive = activeConv?.id === c.id;
                      const displayName = getDisplayNameForConversation(c);
                      return (
                          <div key={c.id} onClick={() => openConversation(c)}
                              style={{
                                  backgroundColor: isActive ? '#cc4d17ff' : '#fff',
                                  color: isActive ? '#fff' : '#334155',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s ease, box-shadow 0.5s ease',
                                  boxShadow: isActive ? '0 4px 12px rgba(155, 62, 62, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '12px'
                              }}>
                              <UserAvatar name={displayName} />
                              <div style={{flex: 1, minWidth: 0}}>
                                  <div style={{ fontSize: '15px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                                  <div style={{ fontSize: '12px', color: isActive ? '#fecaca' : '#64748b' }}>
                                      {c.messages_count ?? 0} messages
                                  </div>
                              </div>
                              <div style={{fontSize: '11px', color: isActive ? '#fecaca' : '#94a3b8', marginLeft: 'auto', flexShrink: 0}}>{c.last_message_at || ''}</div>
                          </div>
                      );
                  })
        ) : (
                  <div style={{textAlign: 'center', color: '#64748b', marginTop: '40px'}}>
                      No conversations found.
                  </div>
              )}
          </div>
        </div>

      </div>
      {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', flexDirection: 'column', gap: '10px' }}>
            <MessageSquareText style={{width: 50, height: 50, color: '#cbd5e1'}}/>
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div style={{ padding: '20.5px 20px', fontWeight: 700, fontSize: 20, borderBottom: '1px solid #f1f5f9', color: '#334155', backgroundColor: '#fff' }}>
                {getDisplayNameForConversation(activeConv)}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#fff' }}>
              {(activeConv.messages || []).map((m, idx) => {
                const sender = m.sender || m.user || (m.from ? m.from : null);
                const isOwn = sender?.is_self || String(sender?.id) === String(globalCurrentUserId);

                const bubbleBaseStyle = {
                    maxWidth: '72%', padding: '12px 16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', wordBreak: 'break-word',
                    lineHeight: 1.5
                };
                
                const ownMessageBubble = { backgroundColor: '#a13b3bff', color: '#fff', borderRadius: '20px 20px 4px 20px' };
                const otherMessageBubble = { backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '20px 20px 20px 4px' };

                return (
                  <div key={m.id ?? idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, color: '#64748b', padding: '0 8px' }}>
                        {pickParticipantName(sender) || 'System'} • {m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </div>
                    <div style={{ ...bubbleBaseStyle, ...(isOwn ? ownMessageBubble : otherMessageBubble) }}>
                      {m.body}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ display: 'flex', padding: '12px 20px', background: '#fff', borderTop: '1px solid #f1f5f9', gap: '12px', alignItems: 'center' }}>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                style={{ flex: 1, fontSize: 15, padding: '12px 16px', borderRadius: '9999px', border: 'none', backgroundColor: '#f1f5f9', outline: 'none' }}
              />
              <button type="submit" style={{ background: 'linear-gradient(270deg, #8f2b2b, #ec4545)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: '12px', flexShrink: 0 }}>
                <SendIcon style={{width: 20, height: 20}}/>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}