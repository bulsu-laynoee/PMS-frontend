import React, { useEffect, useState } from 'react';
import 'assets/pendinglist.css';
// 1. Import Link from react-router-dom
import { FaFilePdf, FaCheck, FaEye, FaUserGraduate, FaUserTie, FaUserCog, FaUsers, FaTimes } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import api, { API_BASE_URL, getImageUrl } from '../utils/api';
import { useAlert } from 'context/AlertContext';

export default function PendingList() {
  console.debug('[PendingList] render');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeRole, setActiveRole] = useState('Student');
  const [detailUser, setDetailUser] = useState(null);
  // When a user's detail modal opens, aggressively log and attempt to fetch any
  // file candidates so we can see in the console exactly what paths exist and
  // whether a network fetch is performed for id1_path / deed_path etc.
  useEffect(() => {
    if (!detailUser) return;
    (async () => {
      try {
        console.log('[PendingList] detailUser opened', detailUser);
        const keys = ['or_path','cr_path','deed_path','id1_path','id2_path'];
        for (const key of keys) {
          // gather raw candidate values from multiple possible shapes
          const raw = (detailUser && (detailUser[key] || detailUser.user_details?.[key] || detailUser.userDetail?.[key] || detailUser.user_detail?.[key])) || null;
          const normalized = getFilePath(detailUser, key);
          console.log('[PendingList] candidate', { key, raw, normalized });
          if (!raw && !normalized) {
            console.log('[PendingList] candidate missing, skipping fetch for', key);
            continue;
          }
          // choose the value to try fetching (prefer normalized path)
          const candidate = normalized || raw;
          const url = normalizeToApiImageUrl(candidate);
          console.log('[PendingList] attempting fetch for', { key, candidate, url });
          try {
            const res = await fetch(url, { credentials: 'include' });
            console.log('[PendingList] fetch result', { key, ok: res.ok, status: res.status, statusText: res.statusText });
            if (res.ok) {
              const ct = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : null;
              console.log('[PendingList] fetch successful headers', { key, contentType: ct });
            }
          } catch (e) {
            console.error('[PendingList] fetch exception for candidate', { key, candidate, error: e });
          }
        }
      } catch (e) {
        console.error('[PendingList] detailUser prefetch runner failed', e);
      }
    })();
  }, [detailUser]);

  // State for Reject modal
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [userToReject, setUserToReject] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // State for Approve modal
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [userToApprove, setUserToApprove] = useState(null);

  const [authRequired, setAuthRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showAlert } = useAlert();

  const navigate = useNavigate();
  const goToUserList = () => {
    navigate('/home/userlist'); 
  };

  // Open the detail modal but first fetch the canonical user object (with userDetail)
  async function openDetail(user) {
    if (!user || !user.id) return;
    console.log('[PendingList] openDetail - fetching full user', user.id);
    try {
      let response;
      try {
        response = await api.get(`/users/${user.id}`);
        console.log('[PendingList] openDetail - api.get /users/{id}', { status: response.status });
      } catch (err) {
        console.log('[PendingList] openDetail - api.get failed, trying absolute origin', err?.message || err);
        const origin = API_BASE_URL.replace(/\/$/, '');
        const url = `${origin}/api/users/${user.id}`;
        const fres = await fetch(url, { credentials: 'include' });
        const text = await fres.text();
        try { response = { data: JSON.parse(text), status: fres.status }; } catch (_) { throw new Error(`Open detail: non-JSON response (${fres.status})`); }
      }

      const json = response.data;
      const body = json?.data || json;
      console.log('[PendingList] openDetail - fetched body', body);
      // Merge fetched body with the original list row so we don't lose top-level
      // fields (contact_number, or_path, etc.) the table had.
      const merged = { ...(user || {}), ...(body || {}) };
      // Prefer to expose a normalized nested userDetail for backward compat
      const ud = body?.userDetail || body?.user_details || body?.user_detail || merged.userDetail || merged.user_details || merged.user_detail || null;
      if (ud) {
        // Ensure some commonly-used top-level fields exist (fall back to nested values)
        ['contact_number','department','plate_number','from_pending','or_path','cr_path','id1_path','id2_path','deed_path'].forEach(k => {
          if ((merged[k] === undefined || merged[k] === null || merged[k] === '') && ud[k] !== undefined && ud[k] !== null) {
            merged[k] = ud[k];
          }
        });
        // keep nested userDetail available
        merged.userDetail = ud;
      }

      setDetailUser(merged);
    } catch (e) {
      console.error('[PendingList] openDetail failed', e);
      // fallback to using the provided user object so modal still opens
      setDetailUser(user);
    }
  }

  const roleIcons = {
    Student: <FaUserGraduate />,
    Faculty: <FaUserTie />,
    Personnel: <FaUserCog />,
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let response;
        try {
          response = await api.get('/users');
          console.debug('[PendingList] api.get /users', { url: api.defaults.baseURL + '/users', status: response.status });
        } catch (firstErr) {
          console.debug('[PendingList] api.get /users failed, trying absolute origin fallback', firstErr?.message || firstErr);
          const origin = API_BASE_URL.replace(/\/$/, '');
          const absUrl = `${origin}/api/users`;
          const absRes = await fetch(absUrl, { credentials: 'include' });
          console.debug('[PendingList] fallback fetch', { url: absRes.url, status: absRes.status });
          if (absRes.status === 401) { setAuthRequired(true); setLoading(false); return; }
          const text = await absRes.text();
          try { response = { data: JSON.parse(text), status: absRes.status }; } catch (_) { throw new Error(`API returned non-JSON response (status ${absRes.status}). First chars: ${String(text).slice(0,200)}`); }
        }

        const json = response.data;
        const data = json?.data || json;
        const pending = (data || []).filter(u =>
          (u.from_pending === 1 || u.from_pending === true || String(u.from_pending) === '1') ||
          (u.user_details && (u.user_details.from_pending === 1 || u.user_details.from_pending === true || String(u.user_details.from_pending) === '1'))
        );
        setUsers(pending);
      } catch (e) {
        console.error('Failed to load pending users', e);
        setErrorMessage(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const roleCount = { Student: 0, Faculty: 0, Personnel: 0 };
  users.forEach(u => { const pos = u.position || u.role || (u.position === null ? 'Student' : 'Student'); if (roleCount[pos] !== undefined) roleCount[pos]++; });
  const filtered = users.filter(u => (u.position || u.role || 'Student') === activeRole && ((u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase())));
  async function previewFile(path) {
    // Improved preview logic: normalize, try API image endpoint, on 404/403 try encoded path, then fall back to raw URL
    console.log('[PendingList] previewFile called', { path });
    if (!path) {
      console.debug('[PendingList] previewFile - empty path, aborting');
      return;
    }
    const s = String(path).trim();
    console.debug('[PendingList] previewFile - normalized string', { s });
    if (!s || s === '0' || s.toLowerCase() === 'false') {
      console.debug('[PendingList] previewFile - path is falsy after normalization, aborting', { s });
      return;
    }

    // If the incoming path is a full URL, prefer using normalizeToApiImageUrl which will return it as-is or convert storage URLs
    const url = normalizeToApiImageUrl(s);
    console.debug('[PendingList] previewFile - initial url', { url });

    try {
      console.debug('[PendingList] previewFile - fetching', { url });
      let res = await fetch(url, { credentials: 'include' });
      console.debug('[PendingList] previewFile - fetch response', { ok: res.ok, status: res.status, statusText: res.statusText });

      // If not ok and looks like a server-side 404/403 for unencoded path, try encoded variant
      if (!res.ok && (res.status === 404 || res.status === 403)) {
        try {
          const cleaned = url.replace(/^[^/]*\/api\/image\//, '');
          const encoded = encodeURIComponent(cleaned).replace(/%2F/g, '/');
          const alt = `${API_BASE_URL.replace(/\/$/, '')}/api/image/${encoded}`;
          console.debug('[PendingList] previewFile - retrying with encoded path', { alt });
          res = await fetch(alt, { credentials: 'include' });
          console.debug('[PendingList] previewFile - encoded fetch response', { ok: res.ok, status: res.status });
          if (res.ok) {
            // replace url for blob fetch below
            console.debug('[PendingList] previewFile - encoded fetch succeeded, using alt url', { alt });
          } else {
            console.debug('[PendingList] previewFile - encoded fetch also failed', { status: res.status });
          }
        } catch (encErr) {
          console.debug('[PendingList] previewFile - encoded retry failed', encErr);
        }
      }

      if (!res.ok) {
        // If the normalize returned a full external URL, open it directly as a last-resort fallback
        if (/^https?:\/\//i.test(s)) {
          console.debug('[PendingList] previewFile - opening original full URL fallback', { s });
          window.open(s, '_blank');
          return;
        }

        showAlert(`Preview failed: ${res.status} ${res.statusText}`, 'error');
        console.debug('[PendingList] previewFile - opening url in new tab as fallback', { url });
        window.open(url, '_blank');
        return;
      }

      const blob = await res.blob();
      console.debug('[PendingList] previewFile - blob obtained', { size: blob.size, type: blob.type });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
    } catch (e) {
      console.error('[PendingList] previewFile - fetch exception, falling back to direct open', e, { url });
      // fallback: if original looks like a url, open it; otherwise open normalized url
      try {
        if (/^https?:\/\//i.test(s)) {
          window.open(s, '_blank');
        } else {
          window.open(url, '_blank');
        }
      } catch (ow) { console.error('[PendingList] previewFile - fallback window.open failed', ow); }
    }
  }

  // Normalize file path location: try top-level then user_details, and ignore false/'0' placeholders
  function getFilePath(user, key) {
    if (!user) return null;
    let candidate = null;
    // Try a few common shapes: top-level, nested under user_details, userDetail, or user_detail
    if (user[key] !== undefined && user[key] !== null) candidate = user[key];
    if ((candidate === null || candidate === undefined) && user.user_details) {
      candidate = user.user_details[key];
    }
    if ((candidate === null || candidate === undefined) && user.userDetail) {
      candidate = user.userDetail[key];
    }
    if ((candidate === null || candidate === undefined) && user.user_detail) {
      candidate = user.user_detail[key];
    }
    if (candidate === undefined || candidate === null) return null;
    // reject boolean false and numeric/string '0'
    if (candidate === false) return null;
    let s = String(candidate || '').trim();
    if (!s || s === '0' || s.toLowerCase() === 'false') return null;

    // Normalize Windows backslashes to forward slashes
    s = s.replace(/\\/g, '/');

    // If stored as a file:// URL, strip the scheme
    if (s.startsWith('file://')) {
      // file:///C:/path/to/storage/app/public/or_cr/...
      s = s.replace(/^file:\/\//i, '');
    }

    // If the stored path contains the storage/app/public prefix, extract the relative part
    const storageMarker = '/storage/app/public/';
    const publicMarker = '/public/';
    if (s.includes(storageMarker)) {
      s = s.substring(s.indexOf(storageMarker) + storageMarker.length);
    } else if (s.includes('/storage/')) {
      // fallback: find 'storage/' and strip up to 'public/' if present
      const idx = s.indexOf('/storage/');
      s = s.substring(idx + '/storage/'.length);
      if (s.startsWith('app/public/')) s = s.substring('app/public/'.length);
    } else if (s.includes(publicMarker)) {
      // path may include '.../public/or_cr/...'
      s = s.substring(s.indexOf(publicMarker) + publicMarker.length);
    }

    // Trim any leading slashes and whitespace
    s = s.replace(/^\/+/, '').trim();

    if (!s) return null;
    // final sanity check: avoid storing absolute drive letters
    if (/^[A-Za-z]:\//.test(s)) return null;
    return s;
  }

  // Accept backend-returned asset URLs (/storage/...) and convert them to the
  // API image endpoint URL so the preview fetch uses FileController which reads
  // directly from storage/app/public. Accepts both relative paths and full URLs.
  function normalizeToApiImageUrl(candidate) {
    if (!candidate) return '';
    let s = String(candidate).trim();
    if (!s) return '';

    // If it's a full http(s) URL and contains '/storage/', convert to API image
    try {
      if (/^https?:\/\//i.test(s)) {
        const urlObj = new URL(s);
        const storageIndex = urlObj.pathname.indexOf('/storage/');
        if (storageIndex >= 0) {
          const rel = urlObj.pathname.substring(storageIndex + '/storage/'.length) + (urlObj.hash || '');
          const encoded = encodeURIComponent(rel.replace(/^\/+/, '')).replace(/%2F/g, '/');
          return `${API_BASE_URL.replace(/\/$/, '')}/api/image/${encoded}`;
        }
        // otherwise return full URL as-is
        return s;
      }
    } catch (e) {
      // ignore URL parse errors and fall through
    }

    // If it's already a relative path (possibly starting with 'storage/' or 'public/'), strip known prefixes
    s = s.replace(/^\/+/, '');
    if (s.startsWith('storage/')) s = s.substring('storage/'.length);
    if (s.startsWith('app/public/')) s = s.substring('app/public/'.length);
    if (s.startsWith('public/')) s = s.substring('public/'.length);

    const encodedRel = encodeURIComponent(s).replace(/%2F/g, '/');
    return `${API_BASE_URL.replace(/\/$/, '')}/api/image/${encodedRel}`;
  }

  function handleApproveClick(user) {
    setUserToApprove(user);
    setShowApproveConfirm(true);
  }

  async function confirmApprove() {
    if (!userToApprove) return;
    const user = userToApprove;

    try {
      const name = (user.name || '').split(' ');
      const firstname = name[0] || '';
      let lastname = name.slice(1).join(' ') || '';
      if (!lastname || lastname.trim().length === 0) lastname = 'Unknown';
      const body = {
        firstname,
        lastname,
        email: user.email,
        department: user.department || null,
        contact_number: user.contact_number || null,
        plate_number: user.plate_number || null,
        position: user.position || user.role || null,
        from_pending: 0
      };
      console.debug('[PendingList] Approve payload', { url: `${api.defaults.baseURL}/users/${user.id}`, body });
      try {
        const res = await api.put(`/users/${user.id}`, body);
        console.debug('[PendingList] Approve response', { status: res.status, data: res.data });
        if (res.status >= 400) throw new Error('Failed to approve');
      } catch (err) {
        console.debug('[PendingList] api.put failed, trying absolute origin fallback', err?.message || err);
        const origin = API_BASE_URL.replace(/\/$/, '');
        const url = `${origin}/api/users/${user.id}`;
        const fres = await fetch(url, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!fres.ok) {
          let msg = 'Failed to approve';
          try {
            const txt = await fres.text();
            console.error('[PendingList] Approve failed response body:', txt.slice(0, 2000));
            try { const dj = JSON.parse(txt); if (dj?.message) msg = dj.message; else if (dj?.errors) msg = Object.values(dj.errors).flat().join('\n'); } catch (_) {}
          } catch (e) {
            console.error('[PendingList] Failed to read approve response body', e);
          }
          throw new Error(msg);
        }
      }
      setUsers(users.filter(u => u.id !== user.id));
      try { showAlert(`${user.name || 'User'} approved`, 'success', 4000); } catch (e) { console.debug('[PendingList] showAlert failed', e); }
    } catch (e) {
      console.error('Approve failed', e);
      const msg = 'Approve failed: ' + (e.message || String(e));
      try { showAlert(msg, 'error', 6000); } catch (_) { alert(msg); }
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 8000);
    } finally {
      setShowApproveConfirm(false);
      setUserToApprove(null);
    }
  }

  const cancelApprove = () => {
    setShowApproveConfirm(false);
    setUserToApprove(null);
  };

  function handleRejectClick(user) {
    setUserToReject(user);
    setShowRejectConfirm(true);
  }

  async function confirmReject() {
    if (!userToReject) return;
    const user = userToReject;
    setIsRejecting(true);

    try {
      console.debug('[PendingList] Reject payload', { url: `${api.defaults.baseURL}/users/${user.id}` });

      // Ensure CSRF cookie is initialized for Sanctum-protected endpoints (no-op if not used)
      try {
        await api.initCsrf();
      } catch (csrfErr) {
        // Not fatal; proceed and allow fallback logic to handle failures
        console.debug('[PendingList] initCsrf failed (continuing):', csrfErr?.message || csrfErr);
      }

      try {
        const res = await api.delete(`/users/${user.id}`);
        console.debug('[PendingList] Reject response', { status: res.status, data: res.data });
        if (res.status >= 400) throw new Error('Failed to reject');
      } catch (err) {
        console.debug('[PendingList] api.delete failed, trying absolute origin fallback', err?.message || err);
        const origin = API_BASE_URL.replace(/\/$/, '');
        const url = `${origin}/api/users/${user.id}`;
        const fres = await fetch(url, { method: 'DELETE', credentials: 'include' });
        if (!fres.ok) {
          if (fres.status === 401) {
            setAuthRequired(true);
          }
          let msg = 'Failed to reject';
          try {
            const txt = await fres.text();
            console.error('[PendingList] Reject failed response body:', txt.slice(0, 2000));
            try { const dj = JSON.parse(txt); if (dj?.message) msg = dj.message; else if (dj?.errors) msg = Object.values(dj.errors).flat().join('\n'); } catch (_) {}
          } catch (e) {
            console.error('[PendingList] Failed to read reject response body', e);
          }
          throw new Error(msg);
        }
      }

      setUsers(prev => prev.filter(u => u.id !== user.id));
      try { showAlert(`${user.name || 'User'} rejected and deleted`, 'success', 4000); } catch (e) { console.debug('[PendingList] showAlert failed',e); }
    } catch (e) {
      console.error('Reject failed', e);
      const msg = 'Reject failed: ' + (e.message || String(e));
      try { showAlert(msg, 'error', 6000); } catch (_) { alert(msg); }
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 8000);
    } finally {
      setIsRejecting(false);
      setShowRejectConfirm(false);
      setUserToReject(null);
    }
  }

  const cancelReject = () => {
    setShowRejectConfirm(false);
    setUserToReject(null);
  };

  return (
    <div className="pendinglist-container">
       {authRequired ? (
        <div style={{ background: '#fff3cd', padding: 12, borderRadius: 6, marginBottom: 12, border: '1px solid #ffeeba' }}>
          <strong>Authentication required:</strong> You must be logged in as an admin to view pending users. Open the admin login in this browser session and try again.
        </div>
      ) : null}
      {errorMessage ? (
        <div style={{ background: '#f8d7da', padding: 12, borderRadius: 6, marginBottom: 12, border: '1px solid #f5c6cb' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      ) : null}
      
      <div className="pendinglist-header">
        {/* 2. Added a wrapper div */}
        <div className="header-left-side">
          <h2>Pending List</h2>
          
          {/* 3. Added the new breadcrumb navigation */}
          <nav className="breadcrumbs">
            <Link to="/home/dashboard">Dashboard</Link>
            <span>/</span>
            <Link to="/home/pendinglist">Pending List</Link>
            <span>/</span>
            <span className="breadcrumb-active">{activeRole}</span>
          </nav>
        </div>

        <div className="role-buttons">
          {Object.keys(roleCount).map((role) => (
            <button key={role} className={activeRole === role ? 'active' : ''} onClick={() => setActiveRole(role)}>
              <span className="role-icon">{roleIcons[role]}</span>
              <div className="role-info">
                <span className="role-name">{role === 'Faculty' ? 'Faculty' : `${role}s`}</span>
                <span className="role-count">{roleCount[role]} Pending</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="pendinglist-actions">
        <div className="left-actions">
          <button className="nav-button" onClick={goToUserList}>
            <FaUsers /> User List
          </button>
        </div>
        <div className="right-actions">
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest to Oldest</option>
            <option value="oldest">Oldest to Newest</option>
          </select>
        </div>
      </div>

      <table className="pendinglist-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Department</th>
            <th>Position</th>
            <th>Details</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6}>Loading…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={6}>No pending users</td></tr>
          ) : filtered.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.contact_number || '—'}</td>
              <td>{u.department || '—'}</td>
              <td>{u.position || u.role || '—'}</td>
              <td><button onClick={() => { console.log('[PendingList] open detail for user', u); openDetail(u); }} className="pdf-link"><FaEye /> View</button></td>
              
              <td className="action-icons">
                <button className="approve" title="Approve" onClick={() => handleApproveClick(u)}><FaCheck /></button>
                <button className="reject" title="Reject" onClick={() => handleRejectClick(u)}><FaTimes /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- Details Modal --- */}
      {detailUser ? (
        <div className="modal-overlay" onClick={() => setDetailUser(null)}>
          <div className="modal-content-base modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header">
              <h3>{detailUser.name}</h3>
            </div>
            
            <div className="modal-body">
              <div className="info-group full-width">
                <label>Email</label>
                <p>{detailUser.email}</p>
              </div>
              <div className="info-group">
                <label>Phone</label>
                <p>{detailUser.contact_number || '—'}</p>
              </div>
              <div className="info-group">
                <label>Plate</label>
                <p>{detailUser.plate_number || '—'}</p>
              </div>
              <div className="info-group full-width">
                <label>Department</label>
                <p>{detailUser.department || '—'}</p>
              </div>
              
              <div className="modal-files">
                {getFilePath(detailUser, 'or_path') ? (
                  <div className="file-row">
                    <button className="modal-button modal-button-secondary" onClick={() => { const p = getFilePath(detailUser, 'or_path'); console.debug('[PendingList] Preview OR clicked', { p, detailUser }); previewFile(p); }}>
                      <FaFilePdf /> Preview OR
                    </button>
                  </div>
                ) : null}

                {getFilePath(detailUser, 'cr_path') ? (
                  <div className="file-row">
                    <button className="modal-button modal-button-secondary" onClick={() => { const p = getFilePath(detailUser, 'cr_path'); console.debug('[PendingList] Preview CR clicked', { p, detailUser }); previewFile(p); }}>
                      <FaFilePdf /> Preview CR
                    </button>
                  </div>
                ) : null}

                <div className="file-row">
                  <button
                    className="modal-button modal-button-secondary"
                    onClick={() => {
                      const key = 'deed_path';
                      const p = getFilePath(detailUser, key);
                      console.log('[PendingList] Preview Deed clicked', { key, normalized: p, detailUser });
                      if (p) return previewFile(p);
                      // fallback: try raw candidates and log for debugging
                      const raw = (detailUser && (detailUser[key] || detailUser.user_details?.[key] || detailUser.userDetail?.[key] || detailUser.user_detail?.[key])) || null;
                      console.log('[PendingList] deed preview fallback', { key, normalized: p, raw, detailUser });
                      if (raw) {
                        const url = normalizeToApiImageUrl(raw);
                        console.log('[PendingList] deed preview fallback - opening raw->api url', { raw, url });
                        window.open(url, '_blank');
                        return;
                      }
                      showAlert('No deed file available for this user', 'info');
                    }}
                  >
                    <FaFilePdf /> Preview Deed
                  </button>
                </div>

                <div className="file-row">
                  <button
                    className="modal-button modal-button-secondary"
                    onClick={() => {
                      const key = 'id1_path';
                      const p = getFilePath(detailUser, key);
                      console.log('[PendingList] Preview ID1 clicked', { key, normalized: p, detailUser });
                      if (p) return previewFile(p);
                      const raw = (detailUser && (detailUser[key] || detailUser.user_details?.[key] || detailUser.userDetail?.[key] || detailUser.user_detail?.[key])) || null;
                      console.log('[PendingList] id1 preview fallback', { key, normalized: p, raw, detailUser });
                      if (raw) { const url = normalizeToApiImageUrl(raw); console.log('[PendingList] id1 preview fallback - opening', { raw, url }); window.open(url, '_blank'); return; }
                      showAlert('No ID 1 file available for this user', 'info');
                    }}
                  >
                    <FaFilePdf /> Preview ID 1
                  </button>
                </div>

                <div className="file-row">
                  <button
                    className="modal-button modal-button-secondary"
                    onClick={() => {
                      const key = 'id2_path';
                      const p = getFilePath(detailUser, key);
                      console.log('[PendingList] Preview ID2 clicked', { key, normalized: p, detailUser });
                      if (p) return previewFile(p);
                      const raw = (detailUser && (detailUser[key] || detailUser.user_details?.[key] || detailUser.userDetail?.[key] || detailUser.user_detail?.[key])) || null;
                      console.log('[PendingList] id2 preview fallback', { key, normalized: p, raw, detailUser });
                      if (raw) { const url = normalizeToApiImageUrl(raw); console.log('[PendingList] id2 preview fallback - opening', { raw, url }); window.open(url, '_blank'); return; }
                      showAlert('No ID 2 file available for this user', 'info');
                    }}
                  >
                    <FaFilePdf /> Preview ID 2
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer-base" onClick={() => setDetailUser(null)}>
              <button className="modal-button modal-button-primary">
                Close
              </button>
            </div>

          </div>
        </div>
      ) : null}

      {/* --- Reject Confirmation Modal --- */}
      {showRejectConfirm && userToReject ? (
        <div className="modal-overlay" onClick={cancelReject}>
          <div className="modal-content-base confirm-modal-content danger" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <h3>Confirm Rejection</h3>
            </div>
            <div className="confirm-modal-body">
              <p>Are you sure you want to reject and delete <strong>{userToReject.name || 'this user'}</strong>?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="modal-footer-base confirm-modal-footer">
              <button className="modal-button modal-button-secondary" onClick={cancelReject}>
                Cancel
              </button>
              <button className="modal-button modal-button-danger" onClick={confirmReject} disabled={isRejecting}>
                {isRejecting ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- Approve Confirmation Modal --- */}
      {showApproveConfirm && userToApprove ? (
        <div className="modal-overlay" onClick={cancelApprove}>
          <div className="modal-content-base confirm-modal-content success" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <h3>Confirm Approval</h3>
            </div>
            <div className="confirm-modal-body">
              {/* Using the rephrased text */}
              <p>Are you sure you want to approve <strong>{userToApprove.name || 'this user'}</strong>?</p>
              <p>Their pending account will be activated.</p>
            </div>
            <div className="modal-footer-base confirm-modal-footer">
              <button className="modal-button modal-button-secondary" onClick={cancelApprove}>
                Cancel
              </button>
              <button className="modal-button modal-button-success" onClick={confirmApprove}>
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}