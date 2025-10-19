import React, { useEffect, useState } from 'react';
import api from '../utils/api';

// Small helper for human-friendly times
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
  } catch (e) { return iso; }
}

// Visual star component (read-only)
const Stars = ({ n = 0 }) => (
  <span style={{ color: '#FFD700', fontWeight: 800, letterSpacing: 1 }}>{'★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))}</span>
);

// Analytics bar shows simple metrics fetched from backend
function AnalyticsBar() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let mounted = true;
    api.get('/admin/feedback/stats').then(r => { if (!mounted) return; setStats(r.data || null); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!stats) return null;
  const fiveCount = stats.counts?.['5'] ?? stats.counts?.[5] ?? 0;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      <div style={{ flex: 1, background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 12, color: '#666' }}>Total feedback</div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{stats.total}</div>
      </div>
      <div style={{ flex: 1, background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 12, color: '#666' }}>Average rating</div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{stats.avg_rating} <span style={{ fontSize: 14, color: '#FFD700' }}>★</span></div>
      </div>
      <div style={{ flex: 1, background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 12, color: '#666' }}>5-star count</div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{fiveCount}</div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersCache, setUsersCache] = useState({});
  const [openIds, setOpenIds] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const candidates = ['/admin/feedback', '/admin/feedback/list', '/feedback/list'];
      let res = null;
      for (const p of candidates) {
        try { res = await api.get(p); if (res) break; } catch (e) { /* try next */ }
      }
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      const rows = Array.isArray(data) ? data : (data.data ?? data);
      setItems(rows || []);

      const ids = Array.from(new Set((rows || []).map(r => r.user_id).filter(Boolean)));
      const missing = ids.filter(id => !usersCache[id]);
      await Promise.all(missing.map(async id => {
        try {
          const r = await api.get(`/users/${id}`);
          const u = r.data?.data ?? r.data ?? r;
          setUsersCache(prev => ({ ...prev, [id]: u?.name || u?.full_name || u?.email || `#${id}` }));
        } catch (e) { setUsersCache(prev => ({ ...prev, [id]: `#${id}` })); }
      }));
    } catch (e) {
      console.error('Failed to load feedback', e);
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontWeight: 900, margin: 0 }}>Feedback</h2>
        <div>
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, background: '#1976D2', color: '#fff', border: 'none' }}>Refresh</button>
        </div>
      </div>

      <AnalyticsBar />

      <div style={{ display: 'grid', gap: 14 }}>
        {loading ? (
          [1,2,3].map(i => (
            <div key={`ph-${i}`} style={{ position: 'relative', background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)', minHeight: 120 }}>
              <div style={{ width: '50%', height: 16, background: '#eee', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ width: '30%', height: 12, background: '#f3f3f3', borderRadius: 6 }} />
            </div>
          ))
        ) : (
          items.length === 0 ? (
            <div style={{ color: '#666' }}>No feedback.</div>
          ) : (
            items.map(f => {
              const isOpen = !!openIds[f.id];
              return (
                <div key={f.id || JSON.stringify(f)} style={{ position: 'relative', background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{f.title ?? `Feedback #${f.id}`}</div>
                      <div style={{ marginTop: 8, color: '#555' }}>
                        From: <strong>{f.user_id ? (usersCache[f.user_id] || `#${f.user_id}`) : 'Anonymous'}</strong>
                        <span style={{ marginLeft: 12 }}><Stars n={f.rating ?? 0} /></span>
                      </div>
                      <div style={{ marginTop: 8, color: '#444' }}>{f.comments || f.message || ''}</div>
                      <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>{timeAgo(f.date_time ?? f.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button type="button" onClick={() => setOpenIds(prev => ({ ...prev, [f.id]: !prev[f.id] }))} aria-label="Toggle details" title="Details" style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #eee', background: isOpen ? '#f7f7f7' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#666" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fafafa', color: '#444' }}>
                      <div style={{ marginBottom: 8 }}>
                        <div><strong>Rating:</strong> <Stars n={f.rating ?? 0} /></div>
                        <div style={{ marginTop: 6 }}><strong>Comments:</strong> {f.comments ?? f.message ?? '—'}</div>
                        <div style={{ marginTop: 6 }}><strong>User:</strong> {f.user_id ? (usersCache[f.user_id] || `#${f.user_id}`) : 'Anonymous'}</div>
                      </div>
                      <details style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #eee' }}>
                        <summary style={{ cursor: 'pointer', color: '#666', fontSize: 13 }}>Raw JSON</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(f, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
