import React, { useEffect, useState } from 'react';
import api from '../utils/api';

// small human-friendly relative time helper (copied from IncidentManagement)
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

// removed IconNotification (mail/message glyph) per request — avatar/user glyph will be used instead

function StatusPill({ status }) {
  const s = (status || 'unread').toLowerCase();
  if (s === 'read') return <div style={{ padding: '4px 8px', borderRadius: 999, background: '#E8F5E9', color: '#2E7D32', fontWeight: 800, fontSize: 12 }}>Read</div>;
  return <div style={{ padding: '4px 8px', borderRadius: 999, background: '#FFF8E1', color: '#FF8F00', fontWeight: 800, fontSize: 12 }}>Unread</div>;
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersCache, setUsersCache] = useState({});
  const [openIds, setOpenIds] = useState({});

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
      const normalized = (rows || []).map(normalize);
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

  const markRead = async (id) => {
    if (!window.confirm('Mark this notification as read?')) return;
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

  const IconUser = ({ size = 14, color = '#1976D2' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.6" />
    </svg>
  );

  const IconClock = ({ size = 14, color = '#999' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <path d="M12 7v6l4 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const Stars = ({ n = 0 }) => (
    <span style={{ color: '#FFD700', fontWeight: 800, letterSpacing: 1 }}>{'★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))}</span>
  );

  const renderSummary = (n) => {
    const d = n.data || {};
    const t = (n.type || (d && d.type) || '').toLowerCase();

    if (t.includes('parking') || d.type === 'parking_assignment' || d.type === 'parking_assigned') {
      const parts = [];
      if (d.parking_slot_id) parts.push(`Slot ${d.parking_slot_id}`);
      if (d.assignment_id) parts.push(`Assignment ${d.assignment_id}`);
      if (d.user_id) parts.push(`For: ${usersCache[d.user_id] || `#${d.user_id}`}`);
      return (
        <div>
          <div style={{ fontWeight: 900 }}>{d.message || 'A parking slot was assigned'}</div>
          <div style={{ marginTop: 6, color: '#555' }}>{parts.join(' · ')}</div>
        </div>
      );
    }

    if (t.includes('feedback') || d.type === 'feedback') {
      const author = d.user_id ? (usersCache[d.user_id] || `#${d.user_id}`) : 'Anonymous';
      return (
        <div>
          <div style={{ fontWeight: 900 }}>{d.message || 'New feedback submitted'}</div>
          <div style={{ marginTop: 6, color: '#555' }}>
            From: <strong>{author}</strong>
            {d.rating ? <span style={{ marginLeft: 8 }}><Stars n={d.rating} /></span> : null}
          </div>
          {d.message_body ? <div style={{ marginTop: 8, color: '#444' }}>{d.message_body}</div> : null}
        </div>
      );
    }

    if (t.includes('incident') || d.type === 'incident_report' || d.type === 'incident') {
      const parts = [];
      if (d.incident_id) parts.push(`Incident ${d.incident_id}`);
      if (d.reported_user_id) parts.push(`Reported user: ${usersCache[d.reported_user_id] || `#${d.reported_user_id}`}`);
      if (d.reported_plate) parts.push(`Plate: ${d.reported_plate}`);
      return (
        <div>
          <div style={{ fontWeight: 900 }}>{d.message || 'A new incident was reported'}</div>
          <div style={{ marginTop: 6, color: '#555' }}>{parts.join(' · ')}</div>
          {d.notes ? <div style={{ marginTop: 8, color: '#444' }}>{d.notes}</div> : null}
        </div>
      );
    }

    // fallback: show readable key: value pairs (first 6 keys)
    const keys = Object.keys(d || {}).slice(0, 6);
    return (
      <div>
        <div style={{ fontWeight: 900 }}>{d.message || 'Notification'}</div>
        <div style={{ marginTop: 6, color: '#555' }}>
          {keys.length === 0 ? <span style={{ color: '#777' }}>No details</span> : keys.map(k => (<div key={k}><strong>{k}:</strong> {String(d[k])}</div>))}
        </div>
      </div>
    );
  };

  const PlaceholderCard = () => (
    <div style={{ position: 'relative', background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)', minHeight: 84 }}>
      <div style={{ width: '60%', height: 16, background: '#eee', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ width: '40%', height: 12, background: '#f3f3f3', borderRadius: 6 }} />
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontWeight: 900, margin: 0 }}>Notifications</h2>
        <div>
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, background: '#C34C4D', color: '#fff', border: 'none' }}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {loading ? (
          // show a few placeholders while loading so the UI feels immediate
          [1,2,3,4].map(i => <PlaceholderCard key={`ph-${i}`} />)
        ) : (
          items.length === 0 ? <div style={{ color: '#666' }}>No notifications.</div> : items.map(n => {
            const isOpen = !!openIds[n.id];
            const unread = !n.read_at;
            const cardBg = unread ? '#fff' : '#F7F9FB';
            return (
              <div key={n.id || JSON.stringify(n)} style={{ position: 'relative', background: cardBg, padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                <div style={{ position: 'absolute', left: 12, top: -10 }}><StatusPill status={n.read_at ? 'read' : 'unread'} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{renderSummary(n)}</div>
                    <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {unread ? (
                      <button type="button" onClick={() => markRead(n.id)} aria-label="Mark read" title="Mark read" style={{ width: 44, height: 44, borderRadius: 10, background: '#1976D2', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* check icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    ) : (
                      <div title="Already read" style={{ width: 44, height: 44, borderRadius: 10, background: '#E8F5E9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                    )}

                    <button type="button" onClick={() => setOpenIds(prev => ({ ...prev, [n.id]: !prev[n.id] }))} aria-label="Toggle details" title="Details" style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #eee', background: isOpen ? '#f7f7f7' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#666" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fafafa', color: '#444' }}>
                    {/* Friendly detail rendering: print common fields first, then raw JSON collapsed */}
                    <div style={{ marginBottom: 8 }}>
                      {(() => {
                        const d = n.data || {};
                        const entries = [];
                        if (d.message) entries.push(<div key="m"><strong>Message:</strong> {d.message}</div>);
                        if (d.message_body) entries.push(<div key="mb"><strong>Details:</strong> {d.message_body}</div>);
                        if (d.rating) entries.push(<div key="r"><strong>Rating:</strong> <Stars n={d.rating} /></div>);
                        if (d.parking_slot_id) entries.push(<div key="ps"><strong>Slot:</strong> #{d.parking_slot_id}</div>);
                        if (d.assignment_id) entries.push(<div key="a"><strong>Assignment:</strong> {d.assignment_id}</div>);
                        if (d.incident_id) entries.push(<div key="i"><strong>Incident:</strong> #{d.incident_id}</div>);
                        if (d.reported_user_id) entries.push(<div key="ru"><strong>Reported user:</strong> {usersCache[d.reported_user_id] || `#${d.reported_user_id}`}</div>);
                        if (d.reported_plate) entries.push(<div key="rp"><strong>Plate:</strong> {d.reported_plate}</div>);
                        if (entries.length > 0) return entries;
                        return <div style={{ color: '#666' }}>No friendly details available.</div>;
                      })()}
                    </div>
                    <details style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #eee' }}>
                      <summary style={{ cursor: 'pointer', color: '#666', fontSize: 13 }}>Raw JSON</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(n.data, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
