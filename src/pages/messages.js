import React, { useEffect, useState, useRef, useMemo } from 'react';
import api from '../utils/api';
import { getUserEmail } from '../utils/auth';
import '../services/echo';

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [query, setQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const echoSubscription = useRef(null);
  const messagesEndRef = useRef(null);

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

  // Loads conversations (simple pageless search)
  const loadConversations = async () => {
    try {
      const res = await api.get('/conversations', { params: { q: query } });
      const data = res.data.data || res.data;
      const conversations = data.data || data;
      console.log('DEBUG: Loaded conversations:', conversations);
      console.log('DEBUG: Current user detection:', {
        currentUser,
        globalCurrentUser,
        globalCurrentUserId,
        globalCurrentUserEmail
      });
      setConversations(conversations);
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  };

  // Open conversation and subscribe
  const openConversation = async (conv) => {
    try {
      const res = await api.get(`/conversations/${conv.id}`);
      const payload = res.data.data || res.data;
      const fetchedConv = payload.conversation ? payload.conversation : payload;
      const msgs = payload.messages?.data || payload.messages || [];
      setActiveConv({ ...fetchedConv, messages: msgs });

      // manage echo subscription
      if (echoSubscription.current) {
        try { echoSubscription.current.stopListening('MessageSent'); } catch {}
        try { window.Echo.leave(`private:conversation.${echoSubscription.currentConvId}`); } catch {}
      }
      if (window.Echo && typeof window.Echo.private === 'function') {
        echoSubscription.current = window.Echo.private(`conversation.${fetchedConv.id}`);
        echoSubscription.currentConvId = fetchedConv.id;
        echoSubscription.current.listen('MessageSent', (e) => {
          setActiveConv(prev => ({ ...prev, messages: [...(prev.messages || []), e.message] }));
        });
      }
    } catch (e) {
      console.error('Failed to open conversation', e);
    }
  };

  const sendMessage = async () => {
    if (!activeConv || !messageText.trim()) return;
    try {
      await api.post(`/conversations/${activeConv.id}/message`, { body: messageText });
      setMessageText('');
      loadConversations();
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);
  
  useEffect(() => { loadConversations(); }, [query]);
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

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
  const filteredConversations = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => {
      const label = getDisplayNameForConversation(c).toLowerCase();
      return label.includes(q);
    });
  }, [conversations, query]);

  // Render
  return (
    <div style={{
      display: 'flex',
      height: '98vh',
      marginTop: '5px',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#fff',
      boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      marginLeft: '10px'
    }}>
      {/* Sidebar */}
      <div style={{
        width: 340,
        backgroundColor: '#4A0E0E',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '3px solid #C9A94A'
      }}>
        <div style={{ padding: '18px 20px', fontSize: 20, fontWeight: 700, backgroundColor: '#610C0C', borderBottom: '1px solid #C9A94A' }}>
          Conversations
        </div>

        <div style={{ padding: '12px 16px', background: '#4A0E0E', borderBottom: '1px solid #C9A94A' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name..."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid #C9A94A', outline: 'none', backgroundColor: '#fff', color: '#4A0E0E', fontSize: 14
            }}
          />
        </div>

        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
          {filteredConversations.length === 0 && (
            <div style={{ color: '#C9A94A', textAlign: 'center', marginTop: 20 }}>No conversations</div>
          )}

          {filteredConversations.map(c => {
            const displayName = getDisplayNameForConversation(c);
            const duplicate = nameCounts[displayName] > 1;
            const firstDate = getFirstMessageDate(c);
            const label = duplicate && firstDate ? `${displayName} (${firstDate.toLocaleDateString()})` : displayName;

            const isActive = activeConv?.id === c.id;
            return (
              <div key={c.id}
                   onClick={() => openConversation(c)}
                   style={{
                     backgroundColor: isActive ? '#C9A94A' : '#fff',
                     color: isActive ? '#4A0E0E' : '#333',
                     borderRadius: 10, marginBottom: 10, padding: '12px 14px',
                     cursor: 'pointer', transition: 'transform .12s ease',
                     boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                   }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 12, color: isActive ? '#4A0E0E' : '#666' }}>
                  {(c.messages_count ?? 0)} messages • {c.last_message_at || ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 18, borderBottom: '2px solid #C9A94A', color: '#4A0E0E', backgroundColor: '#F8F3E7' }}>
          {activeConv ? (() => {
            const name = getDisplayNameForConversation(activeConv);
            const dup = nameCounts[name] > 1;
            const fd = getFirstMessageDate(activeConv);
            return dup && fd ? `${name} (${fd.toLocaleDateString()})` : name;
          })() : 'Chat'}
        </div>

        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777' }}>
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#FBFBFB' }}>
              {(activeConv.messages || []).map((m, idx) => {
                // Determine "isOwn" using robust checks:
                // - message-level flags (is_self, mine, is_mine)
                // - sender id matches conv.current_user_id or global current user id
                // - sender email matches global email
                const sender = m.sender || m.user || (m.from ? m.from : null);
                const senderId = sender?.id || m.sender_id || m.user_id || m.from_id || null;
                const senderEmail = sender?.email || m.sender_email || null;

                const currentId = activeConv.current_user_id || globalCurrentUserId;
                const currentEmail = globalCurrentUserEmail;

                const isOwn =
                  Boolean(m.is_mine || m.mine || m.isMine || sender?.is_self || sender?.isCurrent) ||
                  (senderId && currentId && String(senderId) === String(currentId)) ||
                  (senderEmail && currentEmail && senderEmail === currentEmail);

                console.log('DEBUG: Message ownership for message', m.id, {
                  message: m,
                  sender,
                  senderId,
                  senderEmail,
                  currentId,
                  currentEmail,
                  isOwn
                });

                // message bubble styles
                const containerStyle = {
                  display: 'flex',
                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                  marginBottom: 12,
                  paddingLeft: isOwn ? 40 : 0,
                  paddingRight: isOwn ? 0 : 40
                };
                const bubbleStyle = {
                  maxWidth: '72%',
                  backgroundColor: isOwn ? '#4A0E0E' : '#F4F4F4',
                  color: isOwn ? '#fff' : '#222',
                  borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  textAlign: isOwn ? 'right' : 'left',
                  wordBreak: 'break-word'
                };

                return (
                  <div key={m.id ?? idx} style={containerStyle}>
                    <div style={bubbleStyle}>
                      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>
                        {pickParticipantName(sender) || 'System'} • {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{m.body}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* input */}
            <div style={{ display: 'flex', padding: '12px 16px', borderTop: '2px solid #C9A94A', background: '#fff' }}>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #C9A94A', outline: 'none', fontSize: 15 }}
              />
              <button onClick={sendMessage}
                      style={{ marginLeft: 10, padding: '10px 18px', background: '#4A0E0E', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
