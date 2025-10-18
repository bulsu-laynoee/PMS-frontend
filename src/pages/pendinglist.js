import React, { useEffect, useState } from 'react';
import 'assets/pendinglist.css';
// 1. Import Link from react-router-dom
import { FaFilePdf, FaCheck, FaEye, FaUserGraduate, FaUserTie, FaUserCog, FaUsers, FaTimes } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import api, { API_BASE_URL } from '../utils/api';
import { useAlert } from 'context/AlertContext';

export default function PendingList() {
  console.debug('[PendingList] render');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeRole, setActiveRole] = useState('Student');
  const [detailUser, setDetailUser] = useState(null);

  // State for Reject modal
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [userToReject, setUserToReject] = useState(null);

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
  function previewFile(path) {
    if (!path) return;
    const url = `/api/image/${encodeURIComponent(path)}`;
    window.open(url, '_blank');
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

    try {
      console.debug('[PendingList] Reject payload', { url: `${api.defaults.baseURL}/users/${user.id}` });
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
          let msg = 'Failed to reject';
          try {
            const txt = await fres.text();
            console.error('[PendingList] Reject failed response body:', txt.slice(0, 2000));
            try { const dj = JSON.parse(txt); if (dj?.message) msg = dj.message; } catch (_) {}
          } catch (e) {
            console.error('[PendingList] Failed to read reject response body', e);
          }
          throw new Error(msg);
        }
      }
      setUsers(users.filter(u => u.id !== user.id));
      try { showAlert(`${user.name || 'User'} rejected and deleted`, 'success', 4000); } catch (e) { console.debug('[PendingList] showAlert failed',e); }
    } catch (e) {
      console.error('Reject failed', e);
      const msg = 'Reject failed: ' + (e.message || String(e));
      try { showAlert(msg, 'error', 6000); } catch (_) { alert(msg); }
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 8000);
    } finally {
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
              <td><button onClick={() => setDetailUser(u)} className="pdf-link"><FaEye /> View</button></td>
              
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
                {detailUser.or_path ? (
                  <button className="modal-button modal-button-secondary" onClick={() => previewFile(detailUser.or_path)}>
                    <FaFilePdf /> Preview OR
                  </button>
                ) : null}
                {detailUser.cr_path ? (
                  <button className="modal-button modal-button-secondary" onClick={() => previewFile(detailUser.cr_path)}>
                    <FaFilePdf /> Preview CR
                  </button>
                ) : null}
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
              <button className="modal-button modal-button-danger" onClick={confirmReject}>
                Reject
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