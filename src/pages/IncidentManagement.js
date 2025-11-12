import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
// Import our new CSS Module
import styles from 'assets/incident.management.module.css';

// --- Helper Functions ---
// (Unchanged)
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
    return then.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return iso;
  }
}

// --- Icons ---
// (Unchanged)
const IconSearch = ({ size = 20, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="11" cy="11" r="6" stroke={color} strokeWidth="2" /></svg>;
const IconUser = ({ size = 16, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" /></svg>;
const IconClock = ({ size = 14, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" /><path d="M12 7v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconCheck = ({ size = 18, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconX = ({ size = 18, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconInfo = ({ size = 18, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconList = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconFolderOpen = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 17V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconEye = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconCheckCircle = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconFlag = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12zM4 21v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconRefresh = ({ size = 18, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 4v6h-6M1 20v-6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.51 9a9 9 0 0114.85-3.36L20.49 9M3.51 15l-2.02 3.36A9 9 0 0117.13 21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconAlert = ({ size = 16, color = 'currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;


// --- Sub-Components ---

function GmailHeader({ query, setQuery }) {
  // (Unchanged)
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.logo}>Incidents</span>
      </div>
      <div className={styles.searchWrapper}>
        <div className={styles.searchInputIcon}><IconSearch /></div>
        <input
          placeholder="Search incidents..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.headerRight}>
        <div className={styles.profileCircle}>A</div>
      </div>
    </header>
  );
}

function GmailSidebar({ tabs, counts, statusFilter, setStatusFilter }) {
  // (Unchanged)
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.tabsNav}>
        {tabs.map(t => (
          <button
            type="button"
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`${styles.tabButton} ${statusFilter === t.key ? styles.tabButtonActive : ''}`}
          >
            <div className={styles.tabIcon}>{t.icon}</div>
            <span className={styles.tabLabel}>{t.label}</span>
            <span className={styles.tabCount}>{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </nav>
      <div className={styles.sidebarStats}>
        <div className={styles.sidebarStatsTitle}>Quick Stats</div>
        <div className={styles.statItem}>
          <span>Total</span>
          <span>{counts.all}</span>
        </div>
        <div className={styles.statItem}>
          <span>Open</span>
          <span>{counts.open}</span>
        </div>
        <div className={styles.statItem}>
          <span>User Reports</span>
          <span>{counts.reported}</span>
        </div>
        <div className={styles.statItem}>
          <span>General</span>
          <span>{counts.general}</span>
        </div>
      </div>
    </aside>
  );
}

function MainToolbar({ onRefresh, onSelectAll, isAllSelected, hasSelection }) {
  // (Unchanged)
  return (
    <div className={styles.mainToolbar}>
      <input
        type="checkbox"
        className={styles.checkbox}
        onChange={onSelectAll}
        checked={isAllSelected}
      />
      <button
        type="button"
        className={styles.iconButton}
        title="Refresh"
        onClick={onRefresh}
      >
        <IconRefresh />
      </button>
    </div>
  );
}

function ReportCountCircle({ count }) {
  // (Unchanged)
  const countNum = count || 0;
  if (countNum === 0) return null;

  let countClass = styles.reportCount;
  if (countNum >= 3) countClass = `${styles.reportCount} ${styles.reportCountHigh}`;
  else if (countNum === 2) countClass = `${styles.reportCount} ${styles.reportCountMedium}`;

  return (
    <div className={countClass} title={`${countNum} previous report(s)`}>
      {countNum}
    </div>
  );
}

function IncidentRow({ incident, reporterUser, reportedUser, isSelected, isRead, onSelect, onOpen, onResolve }) {
  // (Unchanged)
  const status = incident.status || 'open';
  
  const isBackendUnread = status === 'open' || status === 'reported';
  const isUnread = isBackendUnread && !isRead; 
  
  const sender = incident.reporter_id ? (reporterUser || 'Unknown User') : 'System Alert';
  const isUserReport = !!incident.reported_user_id;

  let RoleIcon, iconClassName, roleTitle;
  if (isUserReport) {
    RoleIcon = IconUser;
    iconClassName = styles.rowIconUser;
    roleTitle = `Reported User: ${reportedUser || 'Unknown'}`;
  } else {
    RoleIcon = IconAlert;
    iconClassName = styles.rowIconAlert;
    roleTitle = "General Incident";
  }

  return (
    <div
      className={`${styles.incidentRow} ${isSelected ? styles.rowSelected : ''} ${isUnread ? styles.rowUnread : ''}`}
    >
      <div className={styles.rowActionsLeft} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={onSelect}
        />
        <button
          className={`${styles.iconButton} ${iconClassName}`}
          title={roleTitle}
        >
          <RoleIcon size={18} />
        </button>
      </div>

      <div className={styles.rowMain} onClick={onOpen}>
        <div className={styles.rowSender}>{sender}</div>
        <div className={styles.rowSubject}>
          {isUserReport ? (
            <>
              <span className={styles.rowTitle}>
                Report: <strong>{reportedUser || 'Unknown'}</strong>
              </span>
              <span className={styles.rowSnippet}>
                &nbsp;–&nbsp;{incident.title || 'No Title'}...
              </span>
            </>
          ) : (
            <>
              <span className={styles.rowTitle}>{incident.title}</span>
              <span className={styles.rowSnippet}>
                &nbsp;–&nbsp;{incident.description?.slice(0, 100) || 'No description'}...
              </span>
            </>
          )}
        </div>
        <div className={styles.rowMeta}>
          <ReportCountCircle count={incident.report_count} />
          <div className={styles.rowTime}>{timeAgo(incident.created_at)}</div>
        </div>
      </div>

      <div className={styles.rowActionsHover} onClick={(e) => e.stopPropagation()}>
        {status !== 'closed' && (
          <>
            {status === 'open' && (
              <button
                type="button"
                title="Acknowledge"
                onClick={() => onResolve(incident.id, 'acknowledged')}
                className={styles.iconButton}
              >
                <IconCheck />
              </button>
            )}
            <button
              type="button"
              title="Close"
              onClick={() => onResolve(incident.id, 'closed')}
              className={styles.iconButton}
            >
              <IconX />
            </button>
          </>
        )}
        <button
          type="button"
          title="Details"
          onClick={onOpen}
          className={styles.iconButton}
        >
          <IconInfo />
        </button>
      </div>
    </div>
  );
}

function IncidentDetailsModal({ incident, reporterUser, reportedUser, onClose, onResolve }) {
  // (Unchanged)
  if (!incident) return null;
  
  const status = incident.status || 'open';
  
  const senderDisplay = <strong>{incident.reporter_id ? (reporterUser || 'Unknown User') : 'System Alert'}</strong>;

  let reportedUserDisplay = null;
  if (incident.reported_user_id) {
    reportedUserDisplay = (
      <div className={styles.modalDetailItem}>
        <span className={styles.modalDetailLabel}>Reported User:</span>
        <strong>{reportedUser || 'Unknown User'}</strong>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{incident.title}</h2>
          <button className={styles.iconButton} onClick={onClose}><IconX size={24} /></button>
        </div>
        
        <div className={styles.modalSubheader}>
          <div className={styles.modalDetailItem}>
            <span className={styles.modalDetailLabel}>From:</span>
            {senderDisplay}
            <span className={styles.modalTime}>({timeAgo(incident.created_at)})</span>
          </div>
          {reportedUserDisplay}
        </div>

        <div className={styles.modalBody}>
          <div className={styles.detailsTitle}>Full Description</div>
          <p>{incident.description || '—'}</p>
          {incident.attachments && incident.attachments.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className={styles.detailsTitle}>Attachments</div>
              <ul className={styles.attachmentList}>
                {incident.attachments.map(a => (
                  <li key={a.id}>
                    <a href={a.path} target="_blank" rel="noreferrer">
                      {a.original_name || a.path}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {status !== 'closed' && (
          <div className={styles.modalFooter}>
            {status === 'open' && (
              <button
                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                onClick={() => {
                  onResolve(incident.id, 'acknowledged');
                  onClose();
                }}
              >
                <IconCheck size={16} /> Acknowledge
              </button>
            )}
            <button
              className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
              onClick={() => {
                onResolve(incident.id, 'closed');
                onClose();
              }}
            >
              <IconX size={16} /> Close Incident
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SkeletonRow = () => (
  // (Unchanged)
  <div className={styles.skeletonRow}>
    <div className={`${styles.skeletonAnimate} ${styles.skeletonBox}`} style={{ width: 60, height: 24 }} />
    <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: 120, height: 20 }} />
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '60%', height: 20 }} />
      <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: '90%', height: 16 }} />
    </div>
    <div className={`${styles.skeletonAnimate} ${styles.skeletonBar}`} style={{ width: 50, height: 20 }} />
  </div>
);


// --- Main Component ---

export default function IncidentManagement() {
  // (Unchanged)
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [usersCache, setUsersCache] = useState({});
  const [selectedIds, setSelectedIds] = useState({});
  const [currentIncidentId, setCurrentIncidentId] = useState(null);
  
  const [readIds, setReadIds] = useState(
    () => JSON.parse(localStorage.getItem('readIncidentIds')) || {}
  );

  const tabs = [
    // (Unchanged)
    { key: 'all', label: 'All Incidents', icon: <IconList /> },
    { key: 'open', label: 'Open', icon: <IconFolderOpen /> },
    { key: 'acknowledged', label: 'Acknowledged', icon: <IconEye /> },
    { key: 'closed', label: 'Closed', icon: <IconCheckCircle /> },
    { key: 'reported', label: 'User Reports', icon: <IconFlag /> },
    { key: 'general', label: 'General Incidents', icon: <IconAlert size={16} /> },
  ];

  // --- *** UPDATED: New counting logic *** ---
  const counts = useMemo(() => {
    const c = { all: 0, open: 0, acknowledged: 0, closed: 0, reported: 0, general: 0 };
    
    for (const it of incidents) {
      const status = it.status || 'open';

      // 1. Handle the 'closed' count first
      if (status === 'closed') {
        c.closed++;
        continue; // Skip to the next incident
      }

      // --- At this point, the incident is NOT closed ---

      // 2. Count for 'all' (all non-closed)
      c.all++;

      // 3. Count for 'open' and 'acknowledged'
      if (status === 'open') {
        c.open++;
      } else if (status === 'acknowledged') {
        c.acknowledged++;
      }

      // 4. Count for 'reported' vs 'general' (non-closed)
      if (it.reported_user_id) {
        c.reported++;
      } else {
        c.general++;
      }
    }
    return c;
  }, [incidents]);
  // --- *** END OF UPDATED BLOCK *** ---

  useEffect(() => { loadIncidents(); }, []);

  const loadIncidents = async () => {
    // (Unchanged)
    setLoading(true);
    setIncidents([]);
    try {
      const res = await api.get('/incidents');
      const payload = res.data?.data ?? res.data ?? res;
      const items = Array.isArray(payload) ? payload : (payload.data ?? payload.items ?? []);
      setIncidents(items || []);

      const reporterIds = (items || []).map(i => i.reporter_id).filter(Boolean);
      const reportedIds = (items || []).map(i => i.reported_user_id).filter(Boolean);
      const allIds = Array.from(new Set([...reporterIds, ...reportedIds]));

      const missing = allIds.filter(id => !usersCache[id]);
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
    // (Unchanged)
    let list;

    if (statusFilter === 'closed') {
      list = incidents.filter(i => (i.status || 'open') === 'closed');
    } else {
      list = incidents.filter(i => (i.status || 'open') !== 'closed');
    }

    if (statusFilter === 'reported') {
      list = list.filter(i => i.reported_user_id);
    } else if (statusFilter === 'general') {
      list = list.filter(i => !i.reported_user_id);
    } else if (statusFilter === 'open') {
      list = list.filter(i => (i.status || 'open') === 'open');
    } else if (statusFilter === 'acknowledged') {
      list = list.filter(i => (i.status || 'open') === 'acknowledged');
    }

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(i => {
        const reporterUser = usersCache[i.reporter_id];
        const reportedUser = usersCache[i.reported_user_id];
        return (i.title || '').toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (reporterUser || '').toLowerCase().includes(q) ||
          (reportedUser || '').toLowerCase().includes(q)
      });
    }
    return list;
  }, [incidents, query, statusFilter, usersCache]);

  const resolveIncident = async (id, newStatus = 'acknowledged') => {
    // (Unchanged)
    if (!window.confirm(`Mark incident #${id} as ${newStatus}?`)) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      setIncidents(prev => prev.map(it => it.id === id ? { ...it, status: newStatus, resolved_at: now } : it));
      await api.patch(`/incidents/${id}`, { status: newStatus, resolved_at: now });
      await loadIncidents();
    } catch (e) {
      console.error('Failed to update incident', e);
      window.alert('Failed to update incident; see console');
      await loadIncidents();
    } finally {
      setLoading(false);
    }
  };

  const currentIncident = useMemo(() => {
    // (Unchanged)
    return incidents.find(inc => inc.id === currentIncidentId) || null;
  }, [currentIncidentId, incidents]);

  const toggleSelected = (id) => {
    // (Unchanged)
    setSelectedIds(prev => {
      const newSelected = { ...prev };
      if (newSelected[id]) delete newSelected[id];
      else newSelected[id] = true;
      return newSelected;
    });
  };

  const selectedCount = Object.keys(selectedIds).length;
  const isAllSelected = filtered.length > 0 && selectedCount === filtered.length;

  const toggleSelectAll = () => {
    // (Unchanged)
    if (isAllSelected) {
      setSelectedIds({});
    } else {
      setSelectedIds(Object.fromEntries(filtered.map(inc => [inc.id, true])));
    }
  };

  const handleOpenIncident = (id) => {
    // (Unchanged)
    setCurrentIncidentId(id);
    setReadIds(prev => {
      const newReadIds = { ...prev, [id]: true };
      localStorage.setItem('readIncidentIds', JSON.stringify(newReadIds));
      return newReadIds;
    });
  };

  return (
    <div className={styles.gmailLayout}>
      <GmailHeader query={query} setQuery={setQuery} />
      <GmailSidebar
        tabs={tabs}
        counts={counts}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />
      <main className={styles.mainContent}>
        <MainToolbar
          onRefresh={loadIncidents}
          onSelectAll={toggleSelectAll}
          isAllSelected={isAllSelected}
          hasSelection={selectedCount > 0}
        />
        <div className={styles.incidentList}>
          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}
          {!loading && filtered.length === 0 && (
            <div className={styles.noItems}>
              No incidents match your filter.
            </div>
          )}
          {!loading && filtered.map(it => (
            <IncidentRow
              key={it.id}
              incident={it}
              reporterUser={usersCache[it.reporter_id]}
              reportedUser={usersCache[it.reported_user_id]}
              isSelected={!!selectedIds[it.id]}
              isRead={!!readIds[it.id]}
              onSelect={() => toggleSelected(it.id)}
              onOpen={() => handleOpenIncident(it.id)}
              onResolve={resolveIncident}
            />
          ))}
        </div>
      </main>

      {currentIncident && (
        <IncidentDetailsModal
          incident={currentIncident}
          reporterUser={usersCache[currentIncident.reporter_id]}
          reportedUser={usersCache[currentIncident.reported_user_id]}
          onClose={() => setCurrentIncidentId(null)}
          onResolve={resolveIncident}
        />
      )}
    </div>
  );
}