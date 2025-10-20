import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
// Import our new CSS Module
import styles from 'assets/incident.management.module.css';

// --- Helper Functions ---
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
const IconSearch = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="11" cy="11" r="6" stroke={color} strokeWidth="2" />
  </svg>
);
const IconUser = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" />
  </svg>
);
const IconClock = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M12 7v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconInfo = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
// --- Icons: New for Tabs & Stats ---
const IconList = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconFolderOpen = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 17V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconEye = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconCheckCircle = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconFlag = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12zM4 21v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconAlert = ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// --- Sub-Components ---

function StatusPill({ status }) {
  const s = (status || 'open').toLowerCase();
  let statusClass = styles.statusOpen;
  let label = 'Open';
  let icon = <IconFolderOpen size={12} />;

  if (s === 'acknowledged') {
    statusClass = styles.statusAcknowledged;
    label = 'Acknowledged';
    icon = <IconEye size={12} />;
  } else if (s === 'closed') {
    statusClass = styles.statusClosed;
    label = 'Closed';
    icon = <IconCheckCircle size={12} />;
  } else if (s === 'reported') {
    statusClass = styles.statusReported;
    label = 'Reported';
    icon = <IconFlag size={12} />;
  }

  return (
    <div className={`${styles.statusPill} ${statusClass}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({ title, value, icon, color = '#1976D2' }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statTitle}>{title}</div>
      </div>
    </div>
  );
}

function IncidentActions({ status, onAcknowledge, onClose, onToggleDetails, isOpen }) {
  if (status === 'closed') {
    return (
      <div className={styles.closedBadge} title="Closed">
        <IconCheck size={20} />
      </div>
    );
  }

  return (
    <>
      {status === 'open' && (
        <button
          type="button"
          title="Acknowledge"
          onClick={onAcknowledge}
          className={`${styles.iconButton} ${styles.iconButtonAcknowledge}`}
        >
          <IconCheck />
        </button>
      )}
      <button
        type="button"
        title="Close"
        onClick={onClose}
        className={`${styles.iconButton} ${styles.iconButtonClose}`}
      >
        <IconX />
      </button>
      <button
        type="button"
        title="Details"
        onClick={onToggleDetails}
        className={`${styles.iconButton} ${styles.iconButtonDetails} ${isOpen ? styles.iconButtonDetailsActive : ''
          }`}
      >
        <IconInfo />
      </button>
    </>
  );
}

function DetailsPane({ incident }) {
  return (
    <div className={styles.detailsPane}>
      <div className={styles.detailsTitle}>Full Description</div>
      <p style={{ margin: 0 }}>{incident.description || '—'}</p>
      {incident.attachments && incident.attachments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className={styles.detailsTitle}>Attachments</div>
          <ul>
            {incident.attachments.map(a => (
              <li key={a.id}><a href={a.path} target="_blank" rel="noreferrer">{a.original_name || a.path}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportCountCircle({ count }) {
  const countNum = count || 0;
  let countClass = styles.reportCount;
  if (countNum >= 3) {
    countClass = `${styles.reportCount} ${styles.reportCountHigh}`;
  } else if (countNum === 2) {
    countClass = `${styles.reportCount} ${styles.reportCountMedium}`;
  }

  // Don't render a circle if count is 0
  if (countNum === 0) return null;

  return (
    <div className={countClass} title={`${countNum} previous report(s)`}>
      {countNum}
    </div>
  );
}

function UserReportCard({ incident, usersCache, onResolve, onToggleDetails, isOpen }) {
  const status = incident.status || 'open';
  return (
    <div className={styles.card}>
      <StatusPill status={status} />
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>{incident.title}</div>
          <div className={styles.cardMeta} style={{ alignItems: 'center' }}>
            <IconClock />
            <span>{timeAgo(incident.created_at)}</span>
            <ReportCountCircle count={incident.report_count} />
          </div>
        </div>
        <div className={styles.cardDescription}>
          {incident.description?.slice(0, 160) || '—'}...
        </div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardUser}>
          <IconUser />
          <strong>{usersCache[incident.reported_user_id] || `#${incident.reported_user_id}`}</strong>
        </div>
        <div className={styles.cardActions}>
          <IncidentActions
            status={status}
            isOpen={isOpen}
            onAcknowledge={() => onResolve(incident.id, 'acknowledged')}
            onClose={() => onResolve(incident.id, 'closed')}
            onToggleDetails={onToggleDetails}
          />
        </div>
      </div>
      {isOpen && <DetailsPane incident={incident} />}
    </div>
  );
}

function GeneralIncidentCard({ incident, onResolve, onToggleDetails, isOpen }) {
  const status = incident.status || 'open';
  return (
    <div className={`${styles.card} ${styles.cardList} ${isOpen ? styles.detailsOpen : ''}`}>
      <StatusPill status={status} />
      
      {/* --- SEVERITY BLOCK REMOVED --- */}

      <div className={styles.cardListMain}>
        <div className={styles.cardHeader} style={{ marginBottom: 4 }}>
          <div className={styles.cardTitle}>{incident.title}</div>
          <div className={styles.cardMeta}>
            <IconClock /> <span>{timeAgo(incident.created_at)}</span>
          </div>
        </div>
        <div className={styles.cardDescription} style={{ marginTop: 0 }}>
          {incident.description?.slice(0, 200) || ''}...
        </div>
      </div>
      <div className={`${styles.cardActions} ${styles.cardListActions}`}>
        <IncidentActions
          status={status}
          isOpen={isOpen}
          onAcknowledge={() => onResolve(incident.id, 'acknowledged')}
          onClose={() => onResolve(incident.id, 'closed')}
          onToggleDetails={onToggleDetails}
        />
      </div>
      {isOpen && <DetailsPane incident={incident} className={styles.detailsPaneList} />}
    </div>
  );
}

// --- Skeleton Loader Components ---

const SkeletonCard = () => (
  <div className={styles.skeletonCard}>
    <div className={styles.skeletonBody}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {/* Title */}
        <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '50%', height: 20 }} />
        {/* Meta (Time + Circle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: 50, height: 16 }} />
          <div className={`${styles.skeletonAnimate}`} style={{ width: 32, height: 32, borderRadius: '50%' }} />
        </div>
      </div>
      {/* Description */}
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '90%', marginBottom: 8 }} />
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '80%' }} />
    </div>
    <div className={styles.cardFooter} style={{ paddingTop: 24 }}>
      {/* User */}
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '40%', height: 20 }} />
      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div className={`${styles.skeletonAnimate}`} style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div className={`${styles.skeletonAnimate}`} style={{ width: 40, height: 40, borderRadius: 10 }} />
      </div>
    </div>
  </div>
);

const SkeletonListCard = () => (
  <div className={styles.skeletonListCard}>
    {/* SEVERITY SKELETON REMOVED */}
    <div style={{ flexGrow: 1, paddingLeft: '20px' }}> {/* Added padding to compensate for removed block */}
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '50%', height: 20, marginBottom: 12 }} />
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '100%' }} />
    </div>
    <div style={{ width: 140, flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <div className={`${styles.skeletonAnimate}`} style={{ width: 40, height: 40, borderRadius: 10 }} />
      <div className={`${styles.skeletonAnimate}`} style={{ width: 40, height: 40, borderRadius: 10 }} />
    </div>
  </div>
);


// --- Main Component ---

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true); // Set initial loading to true
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [usersCache, setUsersCache] = useState({});
  const [openIds, setOpenIds] = useState({});

  // Tabs now include icons
  const tabs = [
    { key: 'all', label: 'All', icon: <IconList /> },
    { key: 'open', label: 'Open', icon: <IconFolderOpen /> },
    { key: 'acknowledged', label: 'Acknowledged', icon: <IconEye /> },
    { key: 'closed', label: 'Closed', icon: <IconCheckCircle /> },
    { key: 'reported', label: 'Reported', icon: <IconFlag /> },
  ];

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, acknowledged: 0, closed: 0, reported: 0 };
    for (const it of incidents) {
      c.all++;
      const status = it.status || 'open';
      if (c[status] !== undefined) {
        c[status]++;
      }
      if (it.reported_user_id) {
        c.reported++;
      }
    }
    return c;
  }, [incidents]);

  // --- SEVERITY STATS (stats variable) REMOVED ---

  useEffect(() => { loadIncidents(); }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/incidents');
      const payload = res.data?.data ?? res.data ?? res;
      const items = Array.isArray(payload) ? payload : (payload.data ?? payload);
      setIncidents(items || []);

      // fetch reported users
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

  const filtered = useMemo(() => {
    let list = incidents;
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'reported') {
        list = list.filter(i => i.reported_user_id);
      } else {
        list = list.filter(i => (i.status || 'open') === statusFilter);
      }
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        ((i.meta && i.meta.reported_plate) || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [incidents, query, statusFilter]);

  const normalIncidents = filtered.filter(i => !i.reported_user_id);
  const userReports = filtered.filter(i => i.reported_user_id);

  const resolveIncident = async (id, newStatus = 'acknowledged') => {
    if (!window.confirm(`Mark incident #${id} as ${newStatus}?`)) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      // optimistic UI
      setIncidents(prev => prev.map(it => it.id === id ? { ...it, status: newStatus, resolved_at: now } : it));
      await api.patch(`/incidents/${id}`, { status: newStatus, resolved_at: now });
      // Full reload to ensure sync
      await loadIncidents();
    } catch (e) {
      console.error('Failed to update incident', e);
      window.alert('Failed to update incident; see console');
      await loadIncidents(); // revert on error
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (id) => {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Incident Dashboard</h1>
        <div className={styles.pageSubtitle}>Overview of all reported incidents and user reports</div>
      </header>

      {/* --- STATS ROW UPDATED --- */}
      <div className={styles.statsRow}>
        <StatCard title="Total Incidents" value={counts.all} color="#1976D2" icon={<IconList size={20} />} />
        <StatCard title="Open Incidents" value={counts.open} color="#F57C00" icon={<IconFolderOpen size={20} />} />
        <StatCard title="User Reports" value={counts.reported} color="#D32F2F" icon={<IconFlag size={20} />} />
      </div>

      <div className={styles.controlsRow}>
        <nav className={styles.tabsNav}>
          {tabs.map(t => (
            <button
              type="button"
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`${styles.tabButton} ${statusFilter === t.key ? styles.tabButtonActive : ''}`}
            >
              {t.icon}
              <span>{t.label}</span>
              {/* Show count only if not loading */}
              {!loading && <span className={styles.tabCount}>{counts[t.key] ?? 0}</span>}
            </button>
          ))}
        </nav>
        <div className={styles.searchWrapper}>
          <input
            placeholder="Search by title, description, or plate..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.searchInputIcon}>
            <IconSearch />
          </div>
        </div>
        <button onClick={loadIncidents} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>User Reports</h3>
        {loading ? (
          // Skeleton loader for grid
          <div className={styles.incidentGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : userReports.length === 0 ? (
          <div className={styles.noItems}>No user reports match your filter.</div>
        ) : (
          <div className={styles.incidentGrid}>
            {userReports.map(it => (
              <UserReportCard
                key={it.id}
                incident={it}
                usersCache={usersCache}
                onResolve={resolveIncident}
                onToggleDetails={() => toggleDetails(it.id)}
                isOpen={!!openIds[it.id]}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>General Incidents</h3>
        {loading ? (
          // Skeleton loader for list
          <div className={styles.incidentList}>
            <SkeletonListCard />
            <SkeletonListCard />
            <SkeletonListCard />
          </div>
        ) : normalIncidents.length === 0 ? (
          <div className={styles.noItems}>No general incidents match your filter.</div>
        ) : (
          <div className={styles.incidentList}>
            {normalIncidents.map(it => (
              <GeneralIncidentCard
                key={it.id}
                incident={it}
                onResolve={resolveIncident}
                onToggleDetails={() => toggleDetails(it.id)}
                isOpen={!!openIds[it.id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}