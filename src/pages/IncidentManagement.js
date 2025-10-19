import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

// small human-friendly relative time helper
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

function IconSearch({ size = 16, color = '#666' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="11" r="6" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function IconUser({ size = 18, color = '#1976D2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function IconClock({ size = 16, color = '#999' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <path d="M12 7v6l4 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo({ size = 16, color = '#1976D2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <path d="M12 10h.01M11 16h2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status }) {
  const s = (status || 'open').toLowerCase();
  let bg = '#E3F2FD';
  let color = '#0D47A1';
  let label = 'Open';
  if (s === 'acknowledged') { bg = '#FFF8E1'; color = '#FF8F00'; label = 'Acknowledged'; }
  if (s === 'closed') { bg = '#E8F5E9'; color = '#2E7D32'; label = 'Closed'; }
  return (
    <div style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: bg, color, fontWeight: 800, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
      {label}
    </div>
  );
}

function CircleNumber({ n, bg = '#1976D2', size = 44 }) {
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    background: bg,
    fontWeight: 800,
    boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
    fontSize: 16,
  };
  return <div style={style}>{n}</div>;
}

function StatCard({ title, value, color, icon }) {
  return (
    <div style={{ flex: 1, minWidth: 160, margin: 8, padding: 16, borderRadius: 12, background: '#fff', color: '#222', boxShadow: '0 6px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircleNumber n={value} bg={color || '#1976D2'} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: '#666', fontWeight: 700 }}>{icon}</div>
      </div>
    </div>
  );
}

function Badge({ count }) {
  let bg = '#f0f0f0';
  if (count >= 3) bg = '#D32F2F';
  else if (count === 2) bg = '#F57C00';
  else if (count === 1) bg = '#FBC02D';
  return (
    <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: bg, color: '#fff', fontWeight: 600 }}>
      {count}
    </span>
  );
}

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [usersCache, setUsersCache] = useState({});
  const [hoveredId, setHoveredId] = useState(null);
  const [openIds, setOpenIds] = useState({});

  // available tabs
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'acknowledged', label: 'Acknowledged' },
    { key: 'closed', label: 'Closed' },
    { key: 'reported', label: 'Reported' },
  ];

  const counts = useMemo(() => {
    const c = { all: incidents.length, open: 0, acknowledged: 0, closed: 0, reported: 0 };
    for (const it of incidents) {
      if (!it.status || it.status === 'open') c.open++;
      else if (it.status === 'acknowledged') c.acknowledged++;
      else if (it.status === 'closed') c.closed++;
      if (it.status === 'reported') c.reported++;
    }
    return c;
  }, [incidents]);

  useEffect(() => { loadIncidents(); }, []);
  useEffect(() => {
    console.info('IncidentManagement mounted');
    try { console.info('Auth token present?', !!localStorage.getItem('authData') || !!sessionStorage.getItem('authData')); } catch (e) {}
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/incidents');
      const payload = res.data?.data ?? res.data ?? res;
      const items = Array.isArray(payload) ? payload : (payload.data ?? payload);
      setIncidents(items || []);

      // fetch reported users for caching
      const ids = Array.from(new Set((items || []).map(i => i.reported_user_id).filter(Boolean)));
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
      console.error('Failed to load incidents', e);
      window.alert('Failed to load incidents; check console');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = incidents.length;
    const reportedWithUser = incidents.filter(i => i.reported_user_id).length;
    const bySeverity = incidents.reduce((acc, it) => { acc[it.severity] = (acc[it.severity] || 0) + 1; return acc; }, {});
    return { total, reportedWithUser, bySeverity };
  }, [incidents]);

  const filtered = useMemo(() => {
    let list = incidents;
    if (statusFilter && statusFilter !== 'all') {
      // treat undefined status as 'open'
      list = list.filter(i => (i.status || 'open') === statusFilter);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(i => (i.title || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || ((i.meta && i.meta.reported_plate) || '').toLowerCase().includes(q));
    }
    return list;
  }, [incidents, query, statusFilter]);

  const normalIncidents = filtered.filter(i => !i.reported_user_id);
  const userReports = filtered.filter(i => i.reported_user_id);

  const resolveIncident = async (id, newStatus = 'acknowledged') => {
    if (!window.confirm(`Mark incident #${id} as ${newStatus}?`)) return;
    console.log('resolveIncident called', { id, newStatus });
    setLoading(true);
    const now = new Date().toISOString();
    try {
      // optimistic UI: update local state immediately so item moves tabs
      setIncidents(prev => prev.map(it => it.id === id ? { ...it, status: newStatus, resolved_at: now } : it));
      console.log('optimistic update applied for', id);

      console.log('sending patch to API', `/incidents/${id}`, { status: newStatus, resolved_at: now });
      const res = await api.patch(`/incidents/${id}`, { status: newStatus, resolved_at: now });
      console.log('patch response', res && res.status, res && res.data);
      // ensure server state refreshed (in case other fields changed)
      await loadIncidents();
    } catch (e) {
      console.error('Failed to update incident', e);
      window.alert('Failed to update incident; see console');
      // revert optimistic change by reloading
      try { await loadIncidents(); } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: 'linear-gradient(90deg,#c34c4d,#e14b4b)', color: '#fff', padding: 24, borderRadius: 12, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>Incident Dashboard</h1>
        <div style={{ marginTop: 8, opacity: 0.95, fontWeight: 700 }}>Overview of incidents and reports</div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tabs.map(t => (
            <button type="button" key={t.key} onClick={() => setStatusFilter(t.key)} style={{ padding: '8px 12px', borderRadius: 10, border: statusFilter === t.key ? '2px solid #1976D2' : '1px solid #eee', background: statusFilter === t.key ? '#eef6ff' : '#fff', fontWeight: 800, cursor: 'pointer' }}>
              {t.label} <span style={{ marginLeft: 8, fontWeight: 900 }}>{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <StatCard title="Total incidents" value={stats.total} color="#424242" icon={<IconUser/>} />
        <StatCard title="User Reports" value={stats.reportedWithUser} color="#1976D2" icon={<IconUser/>} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input placeholder="Search title, description" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 42px', borderRadius: 10, border: '1px solid #eee', boxShadow: '0 4px 18px rgba(0,0,0,0.04)' }} />
          <div style={{ position: 'absolute', left: 12, top: 8 }}><IconSearch color="#999" /></div>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="closed">Closed</option>
          <option value="reported">Reported</option>
        </select>
        <button onClick={loadIncidents} style={{ padding: '10px 16px', borderRadius: 8, background: '#C34C4D', color: '#fff', border: 'none', boxShadow: '0 6px 18px rgba(195,76,77,0.18)' }}>Refresh</button>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontWeight: 800 }}>User Reports</h3>
        {userReports.length === 0 ? <div style={{ padding: 12, color: '#666' }}>No reports linked to users.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
            {userReports.map(it => {
              const isOpen = !!openIds[it.id];
              const status = (it.status || 'open');
              // card background by status
              let cardBg = '#fff';
              if (status === 'acknowledged') cardBg = '#FFF8E1'; // light amber
              if (status === 'closed') cardBg = '#F4F6F8'; // muted grey
              return (
                <div key={it.id} onMouseEnter={() => setHoveredId(it.id)} onMouseLeave={() => setHoveredId(null)} style={{ position: 'relative', background: cardBg, padding: 16, borderRadius: 12, boxShadow: hoveredId === it.id ? '0 12px 30px rgba(0,0,0,0.12)' : '0 6px 18px rgba(0,0,0,0.06)', transition: 'transform 160ms ease, box-shadow 160ms ease', transform: hoveredId === it.id ? 'translateY(-4px)' : 'none' }}>
                  <div style={{ position: 'absolute', left: 12, top: -10 }}><StatusPill status={status} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900 }}>{it.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 8 }}><IconClock /> <span style={{ fontWeight: 700 }}>{timeAgo(it.created_at)}</span></div>
                      <div><CircleNumber n={it.report_count ?? 0} bg={it.report_count >= 3 ? '#D32F2F' : it.report_count === 2 ? '#F57C00' : '#1976D2'} size={40} /></div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, color: '#555', fontWeight: 700 }}>{it.description?.slice(0,160) || '—'}</div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: '#666' }}><IconUser /> <strong style={{ marginLeft: 8 }}>{usersCache[it.reported_user_id] || `#${it.reported_user_id}`}</strong></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Actions: Open -> Acknowledge + Close + Details; Acknowledged -> Close + Details; Closed -> no buttons, show green check */}
                      {status !== 'closed' ? (
                        <>
                          {status === 'open' && (
                            <button type="button" title="Acknowledge" onClick={() => resolveIncident(it.id, 'acknowledged')} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: '#1976D2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <IconCheck />
                            </button>
                          )}
                          <button type="button" title="Close" onClick={() => resolveIncident(it.id, 'closed')} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: '#D32F2F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <IconX />
                          </button>
                          <button type="button" title="Details" onClick={() => setOpenIds(prev => ({ ...prev, [it.id]: !prev[it.id] }))} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #eee', background: isOpen ? '#f7f7f7' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <IconInfo />
                          </button>
                        </>
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#2E7D32', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Closed">
                            <IconCheck color="#fff" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fafafa', color: '#444' }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Full description</div>
                      <div style={{ color: '#444' }}>{it.description || '—'}</div>
                      {it.attachments && it.attachments.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 800 }}>Attachments</div>
                          <ul>
                            {it.attachments.map(a => (<li key={a.id}><a href={a.path} target="_blank" rel="noreferrer">{a.original_name || a.path}</a></li>))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontWeight: 800 }}>General Incidents</h3>
        {normalIncidents.length === 0 ? <div style={{ padding: 12, color: '#666' }}>No incidents.</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {normalIncidents.map(it => {
              const isOpen = !!openIds[it.id];
              const status = (it.status || 'open');
              let cardBg = '#fff';
              if (status === 'acknowledged') cardBg = '#FFF8E1';
              if (status === 'closed') cardBg = '#F4F6F8';
              return (
                <div key={it.id} onMouseEnter={() => setHoveredId(it.id)} onMouseLeave={() => setHoveredId(null)} style={{ position: 'relative', display: 'flex', gap: 12, background: cardBg, padding: 14, borderRadius: 12, alignItems: 'center', boxShadow: hoveredId === it.id ? '0 12px 30px rgba(0,0,0,0.12)' : '0 6px 18px rgba(0,0,0,0.06)', transition: 'transform 160ms ease, box-shadow 160ms ease', transform: hoveredId === it.id ? 'translateY(-4px)' : 'none' }}>
                  <div style={{ position: 'absolute', left: 12, top: -10 }}><StatusPill status={status} /></div>
                  <div style={{ width: 78, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#999', fontWeight: 800 }}>Severity</div>
                    <div style={{ marginTop: 6, fontWeight: 900 }}>{it.severity}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>{it.title}</div>
                    <div style={{ color: '#555', marginTop: 6, fontWeight: 700 }}>{it.description?.slice(0,200) || ''}</div>
                      <div style={{ marginTop: 10, fontSize: 13, color: '#777', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ color: '#666', display: 'flex', gap: 8, alignItems: 'center' }}><IconClock /> <span style={{ fontWeight: 700 }}>{timeAgo(it.created_at)}</span></div>
                      </div>
                  </div>
                  <div style={{ width: 160, textAlign: 'right' }}>
                    <div style={{ marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {status !== 'closed' ? (
                        <>
                          {status === 'open' && (
                            <button type="button" title="Acknowledge" onClick={() => resolveIncident(it.id, 'acknowledged')} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: '#1976D2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <IconCheck />
                            </button>
                          )}
                          <button type="button" title="Close" onClick={() => resolveIncident(it.id, 'closed')} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: '#D32F2F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <IconX />
                          </button>
                          <button type="button" title="Details" onClick={() => setOpenIds(prev => ({ ...prev, [it.id]: !prev[it.id] }))} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #eee', background: isOpen ? '#f7f7f7' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <IconInfo />
                          </button>
                        </>
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#2E7D32', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Closed">
                            <IconCheck color="#fff" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 8, background: '#fafafa', color: '#444' }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Full description</div>
                      <div style={{ color: '#444' }}>{it.description || '—'}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
