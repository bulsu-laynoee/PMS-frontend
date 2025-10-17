import React, { useEffect, useState, useRef, useMemo } from 'react';
import api from '../utils/api';
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
  useEffect(() => { loadConversations(); }, []);
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name..."
                style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: 'none', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '14px',
                }}
                />
            </div>
            {/* Conversation List */}
            <div style={{ color: '#000', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {conversations.length > 0 ? (
                    conversations.map(c => {
                        const isActive = activeConv?.id === c.id;
                        const displayName = getDisplayNameForConversation(c);
                        return (
                            <div key={c.id} onClick={() => openConversation(c)}
                                style={{
                                    backgroundColor: isActive ? '#9b3e3e' : '#fff',
                                    color: isActive ? '#fff' : '#334155',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease, box-shadow 0.2s ease',
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
