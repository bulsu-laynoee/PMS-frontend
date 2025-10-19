import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaSync, FaStar, FaUserCircle, FaCommentDots, FaStarHalfAlt } from 'react-icons/fa';
import api from '../utils/api';
import 'assets/feedback.css';

// Helper to format time difference
function timeAgo(iso) {
  if (!iso) return '';
  try {
    const then = new Date(iso);
    const diffSeconds = Math.floor((Date.now() - then.getTime()) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMins = Math.floor(diffSeconds / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  } catch (e) {
    return iso;
  }
}

// Visual star rating component
const Stars = ({ n = 0 }) => (
  <div className="star-rating">
    {[...Array(5)].map((_, i) => (
      <FaStar key={i} className={i < n ? 'star-filled' : 'star-empty'} />
    ))}
  </div>
);

// Redesigned analytics card
const StatCard = ({ title, value, icon, variant = 'red' }) => (
  <div className="stat-card">
    <div className={`stat-card-icon ${variant}`}>{icon}</div>
    <div className="stat-card-content">
      <div className="stat-card-title">{title}</div>
      <div className="stat-card-value">{value}</div>
    </div>
  </div>
);

// Analytics section component
function AnalyticsBar() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let mounted = true;
    api.get('/admin/feedback/stats')
      .then(r => { if (mounted) setStats(r.data || null); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!stats) return null;

  return (
    <section className="analytics-grid">
      <StatCard title="Total Feedback" value={stats.total} icon={<FaCommentDots />} variant="red" />
      <StatCard title="Average Rating" value={`${stats.avg_rating}`} icon={<FaStarHalfAlt />} variant="yellow" />
      <StatCard title="5-Star Count" value={stats.counts?.['5'] ?? stats.counts?.[5] ?? 0} icon={<FaStar />} variant="green" />
    </section>
  );
}

// Redesigned single feedback card
const FeedbackCard = ({ item, user }) => {
    const [isExpanded, setIsExpanded] = useState(false); // State for "Read more"

    const userName = user ? user.name : 'Anonymous';
    const userAvatar = user ? user.profile_pic : null;
    const comment = item.comments || item.message || 'No comment provided.';
    
    // Check if comment needs truncation (e.g., > 150 chars)
    const needsTruncation = comment.length > 150;

    return (
        <div className="feedback-card">
            <div className="feedback-content">
                <div className="feedback-header">
                    <div className="feedback-icon-wrapper">
                        {userAvatar ? <img src={userAvatar} alt={userName} className="user-avatar" /> : <FaUserCircle />}
                    </div>
                    <div className="feedback-user-info">
                        <span className="user-name">{userName}</span>
                        <Stars n={item.rating ?? 0} />
                    </div>
                </div>
                
                {/* Enhanced comment section */}
                <p className="feedback-comment">
                    {isExpanded ? comment : `${comment.substring(0, 150)}${needsTruncation ? '...' : ''}`}
                </p>
                {needsTruncation && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="read-more-button">
                        {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                )}
            </div>
            <div className="feedback-footer">
                <span className="feedback-time">{timeAgo(item.date_time ?? item.created_at)}</span>
            </div>
        </div>
    );
};

// Enhanced Skeleton Loader
const SkeletonCard = () => (
    <div className="feedback-card-placeholder">
        <div className="placeholder-header">
            <div className="placeholder-icon skeleton-animate" />
            <div className="placeholder-text-group">
                <div className="skeleton-bar skeleton-animate" style={{ width: '40%', height: '14px', marginBottom: '6px' }} />
                <div className="skeleton-bar skeleton-animate" style={{ width: '30%', height: '12px' }} />
            </div>
        </div>
        <div className="skeleton-bar skeleton-animate" style={{ width: '100%', height: '12px', marginBottom: '8px' }} />
        <div className="skeleton-bar skeleton-animate" style={{ width: '90%', height: '12px', marginBottom: '8px' }} />
        <div className="skeleton-bar skeleton-animate" style={{ width: '60%', height: '12px' }} />
    </div>
);


export default function FeedbackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersCache, setUsersCache] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const candidates = ['/admin/feedback', '/admin/feedback/list', '/feedback/list'];
      let res = null;
      for (const p of candidates) {
        try {
          res = await api.get(p);
          if (res) break;
        } catch (e) { /* try next */ }
      }
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      const rows = Array.isArray(data) ? data : (data.data ?? []);
      setItems(rows.sort((a,b) => new Date(b.created_at || b.date_time) - new Date(a.created_at || a.date_time)) || []);

      const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
      const missing = ids.filter(id => !usersCache[id]);

      await Promise.all(missing.map(async id => {
        try {
          const r = await api.get(`/users/${id}`);
          const u = r.data?.data ?? r.data ?? r;
          setUsersCache(prev => ({ ...prev, [id]: {
            name: u?.name || u?.full_name || u?.email || `User #${id}`,
            profile_pic: u?.profile_pic || null,
            roles_id: u?.roles_id || null // Still fetching it, just not using for color
          }}));
        } catch (e) {
          setUsersCache(prev => ({ ...prev, [id]: { name: `User #${id}`, profile_pic: null, roles_id: null } }));
        }
      }));
    } catch (e) {
      console.error('Failed to load feedback', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="main-content">
        <div className="content-wrapper">
            <header className="feedback-header">
                <div>
                    <h1 className="feedback-title">User Feedback</h1>
                    <nav className="breadcrumbs">
                        <Link to="/home/dashboard">Dashboard</Link>
                        <span>/</span>
                        <span className="breadcrumb-active">Feedback</span>
                    </nav>
                </div>
                <button onClick={load} className="refresh-button" disabled={loading} title="Refresh">
                    <FaSync className={loading ? 'icon-spinning' : ''} />
                </button>
            </header>

            <AnalyticsBar />

            <div className="feedback-list">
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <SkeletonCard key={`ph-${i}`} />
                    ))
                ) : (
                    items.length === 0 ? (
                        <div className="no-feedback-message">No feedback has been submitted yet.</div>
                    ) : (
                        items.map(item => (
                            <FeedbackCard
                                key={item.id || JSON.stringify(item)}
                                item={item}
                                user={item.user_id ? usersCache[item.user_id] : null}
                            />
                        ))
                    )
                )}
            </div>
        </div>
    </main>
  );
}