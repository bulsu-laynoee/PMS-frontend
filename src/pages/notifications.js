import React, { useEffect, useState } from 'react';
import api from '../utils/api';
// Import our new CSS Module
import styles from 'assets/notifications.module.css';

// --- (Helper Functions: timeAgo is unchanged) ---
function timeAgo(iso) {
  if (!iso) return '';
  try {
    const then = new Date(iso);
    const diff = Math.floor((Date.now() - then.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return then.toLocaleString();
  } catch (e) {
    return iso;
  }
}

// --- Icons ---
const IconParking = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 16H6v-4h4a2 2 0 012 2v0a2 2 0 01-2 2zM13 3l6 6h-6V3z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFeedback = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" />
  </svg>
);
const IconIncident = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconGeneral = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// --- Sub-Components ---

function StatusPill({ status }) {
  const s = (status || 'unread').toLowerCase();
  const statusClass = s === 'read' ? styles.statusRead : styles.statusUnread;
  return (
    <div className={`${styles.statusPill} ${statusClass}`}>
      {s === 'read' ? 'Read' : 'Unread'}
    </div>
  );
}

const Stars = ({ n = 0 }) => (
  <span style={{ color: '#f59e0b', fontWeight: 800, letterSpacing: 1 }}>
    {'★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))}
  </span>
);

function NotificationIcon({ type }) {
  const t = (type || '').toLowerCase();
  
  if (t.includes('parking')) {
    return <div className={`${styles.iconWrapper} ${styles.iconParking}`}><IconParking /></div>;
  }
  if (t.includes('feedback')) {
    return <div className={`${styles.iconWrapper} ${styles.iconFeedback}`}><IconFeedback /></div>;
  }
  if (t.includes('incident')) {
    return <div className={`${styles.iconWrapper} ${styles.iconIncident}`}><IconIncident /></div>;
  }
  // Fallback
  return <div className={`${styles.iconWrapper} ${styles.iconDefault}`}><IconGeneral /></div>;
}

function NotificationSummary({ item, usersCache }) {
  const n = item;
  const d = n.data || {};
  const t = (n.type || (d && d.type) || '').toLowerCase();

  if (t.includes('parking') || d.type === 'parking_assignment' || d.type === 'parking_assigned') {
    const parts = [];
    if (d.parking_slot_id) parts.push(`Slot ${d.parking_slot_id}`);
    if (d.assignment_id) parts.push(`Assignment ${d.assignment_id}`);
    if (d.user_id) parts.push(`For: <strong>${usersCache[d.user_id] || `#${d.user_id}`}</strong>`);
    return (
      <>
        <div className={styles.summaryTitle}>{d.message || 'A parking slot was assigned'}</div>
        <div className={styles.summaryDetails} dangerouslySetInnerHTML={{ __html: parts.join(' · ') }} />
      </>
    );
  }

  if (t.includes('feedback') || d.type === 'feedback') {
    const author = d.user_id ? (usersCache[d.user_id] || `#${d.user_id}`) : 'Anonymous';
    return (
      <>
        <div className={styles.summaryTitle}>{d.message || 'New feedback submitted'}</div>
        <div className={styles.summaryDetails}>
          From: <strong>{author}</strong>
          {d.rating ? <span style={{ marginLeft: 8 }}><Stars n={d.rating} /></span> : null}
        </div>
        {d.message_body ? <div style={{ marginTop: 8, color: '#444' }}>{d.message_body}</div> : null}
      </>
    );
  }

  if (t.includes('incident') || d.type === 'incident_report' || d.type === 'incident') {
    const parts = [];
    if (d.incident_id) parts.push(`Incident ${d.incident_id}`);
    if (d.reported_user_id) parts.push(`Reported: <strong>${usersCache[d.reported_user_id] || `#${d.reported_user_id}`}</strong>`);
    if (d.reported_plate) parts.push(`Plate: ${d.reported_plate}`);
    return (
      <>
        <div className={styles.summaryTitle}>{d.message || 'A new incident was reported'}</div>
        <div className={styles.summaryDetails} dangerouslySetInnerHTML={{ __html: parts.join(' · ') }} />
        {d.notes ? <div style={{ marginTop: 8, color: '#444' }}>{d.notes}</div> : null}
      </>
    );
  }

  // fallback
  return (
    <>
      <div className={styles.summaryTitle}>{d.message || 'Notification'}</div>
      <div className={styles.summaryDetails}>
        {d.message_body || 'No details provided.'}
      </div>
    </>
  );
}

const SkeletonCard = () => (
  <div className={styles.skeletonCard}>
    <div className={`${styles.skeletonIcon} ${styles.skeletonAnimate}`} />
    <div className={styles.skeletonContent}>
      <div className={`${styles.skeletonBar} ${styles.skeletonAnimate}`} style={{ width: '30%', height: 16, marginBottom: 12 }} />
      <div className={`${styles.skeletonBar} ${styles.skeletonAnimate}`} style={{ width: '90%', height: 14, marginBottom: 8 }} />
      <div className={`${styles.skeletonBar} ${styles.skeletonAnimate}`} style={{ width: '60%', height: 14 }} />
    </div>
  </div>
);

function NotificationItem({ item, usersCache, onMarkRead }) {
  const unread = !item.read_at;
  const cardClasses = `${styles.card} ${unread ? styles.cardUnread : styles.cardRead}`;

  return (
    <div className={cardClasses}>
      <NotificationIcon type={item.type || item.data?.type} />
      
      <div className={styles.content}>
        <div className={styles.meta}>
          <StatusPill status={unread ? 'unread' : 'read'} />
          <div className={styles.time}>{timeAgo(item.created_at)}</div>
        </div>
        <NotificationSummary item={item} usersCache={usersCache} />
      </div>

      <div className={styles.actionsWrapper}>
        {unread ? (
          <button
            type="button"
            onClick={() => onMarkRead(item.id)}
            aria-label="Mark read"
            title="Mark read"
            className={styles.markReadButton}
          >
            <IconCheck />
          </button>
        ) : (
          <div title="Already read" className={styles.readCheck}>
            ✓
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersCache, setUsersCache] = useState({});
  // `openIds` state is removed as we are no longer showing the raw JSON toggle

  // --- (normalize function is unchanged from your original) ---
  const normalize = (row) => {
    // row may be a Laravel Notification model (polymorphic) or legacy DB row.
    const base = { raw: row };
    // id may be uuid string or numeric
    base.id = row.id;
    base.read_at = row.read_at ?? row.readAt ?? row.readAt ?? row.readAt ?? row.read_at ?? row.readAt ?? null;
    // data may be string or object
    let payload = row.data || row.Data || {};
    try { if (typeof payload === 'string') payload = JSON.parse(payload); } catch (e) {}
    base.data = payload || {};
    // type classname may be in row.type (legacy) or row.type (polymorphic) or raw.type
    base.type = row.type || (row.type ? row.type : null) || (base.data.type ? base.data.type : null);
    base.created_at = row.created_at || row.createdAt || base.data.created_at || null;
    return base;
  };

  // --- (load function is unchanged from your original, including filtering) ---
  const load = async () => {
    setLoading(true);
    try {
      // backend provides /notifications (auth required). Try admin-prefixed then common routes.
      const candidates = ['/notifications', '/admin/notifications'];
      let res = null;
      for (const p of candidates) {
        try {
          res = await api.get(p);
          if (res) break;
        } catch (e) { /* try next */ }
      }
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      const rows = Array.isArray(data) ? data : (data.data ?? data);
      
      // --- This is your original filtering logic, preserved ---
      const normalized = (rows || []).map(normalize).filter(n => {
        // legacy DB row may have sent_via column
        const legacySentVia = n.raw && (n.raw.sent_via || n.raw.sentVia || n.raw.sentVia);
        if (legacySentVia && String(legacySentVia).toLowerCase() === 'in-app') return false;
        // modern/polymorphic notification: payload data may include sent_via
        const payloadSentVia = n.data && (n.data.sent_via || n.data.sentVia || n.data.sentVia);
        if (payloadSentVia && String(payloadSentVia).toLowerCase() === 'in-app') return false;
        // Also exclude explicit in-app message notification types. Some deployments
        // nest the payload differently (data.data, data.payload) so check several places.
        const typeCandidates = [];
        if (n.type) typeCandidates.push(String(n.type));
        if (n.data && n.data.type) typeCandidates.push(String(n.data.type));
        if (n.data && n.data.data && n.data.data.type) typeCandidates.push(String(n.data.data.type));
        if (n.data && n.data.payload && n.data.payload.type) typeCandidates.push(String(n.data.payload.type));
        // legacy raw type/classname may hint it's an in-app notification
        if (n.raw && n.raw.type) typeCandidates.push(String(n.raw.type));
        const typeStr = typeCandidates.map(t => t.toLowerCase()).find(Boolean) || '';
        if (['in_app_message','in-app-message','in-app','inappmessage','inapp_message'].includes(typeStr)) return false;
        // Also filter by message text heuristics: exact or contains 'in-app message'
        const msgText = (n.data && (n.data.message || n.data.message_body)) || (n.raw && n.raw.message) || '';
        if (String(msgText).toLowerCase().includes('in-app message') || String(msgText).toLowerCase().includes('in app message')) return false;
        return true;
      });
      // --- End of filtering logic ---
      
      setItems(normalized);

      // Fetch any user IDs referenced in notifications (reported_user_id, user_id)
      const ids = Array.from(new Set(normalized.flatMap(n => {
        const arr = [];
        if (n.data && n.data.reported_user_id) arr.push(n.data.reported_user_id);
        if (n.data && n.data.user_id) arr.push(n.data.user_id);
        return arr;
      }).filter(Boolean)));
      
      const missing = ids.filter(id => !usersCache[id]);
      await Promise.all(missing.map(async id => {
        try {
          const r = await api.get(`/users/${id}`);
          const u = r.data?.data ?? r.data ?? r;
          setUsersCache(prev => ({ ...prev, [id]: u?.name || u?.full_name || u?.email || `#${id}` }));
        } catch (e) {
          setUsersCache(prev => ({ ...prev, [id]: `#${id}` }));
        }
      }));
    } catch (e) {
      console.error('Failed to load notifications', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // --- (markRead function updated to remove window.confirm) ---
  const markRead = async (id) => {
    try {
      // optimistic
      setItems(prev => prev.map(it => it.id === id ? { ...it, read_at: new Date().toISOString() } : it));
      await api.post(`/notifications/${id}/mark-read`);
      // refresh to get server state
      await load();
    } catch (e) {
      console.error('Failed to mark read', e);
      await load();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notifications</h2>
        <button onClick={load} className={styles.refreshButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 4V10H17M1 20V14H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9A9 9 0 0121.5 14.49" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 15A9 9 0 012.5 9.51" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Refresh
        </button>
      </div>

      <div className={styles.notificationList}>
        {loading ? (
          // show a few skeleton loaders
          [1, 2, 3, 4].map(i => <SkeletonCard key={`ph-${i}`} />)
        ) : (
          items.length === 0 ? (
            <div className={styles.noItems}>You're all caught up! No new notifications.</div>
          ) : (
            items.map(n => (
              <NotificationItem
                key={n.id}
                item={n}
                usersCache={usersCache}
                onMarkRead={markRead}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}