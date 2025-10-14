import React, { useEffect, useState } from 'react';
import 'assets/pendinglist.css';
import { FaFilePdf, FaCheck, FaEye } from 'react-icons/fa';
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
  const [authRequired, setAuthRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showAlert } = useAlert();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Prefer configured axios instance which already contains baseURL and withCredentials
        // Use API_BASE_URL (origin without /api) for building absolute endpoints when needed.
        let response;
        try {
          response = await api.get('/users');
          console.debug('[PendingList] api.get /users', { url: api.defaults.baseURL + '/users', status: response.status });
        } catch (firstErr) {
          // If axios failed because the dev server served SPA HTML on relative paths, try absolute origin fallback
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
        // filter only pending users, checking both top-level and user_details
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

  const roleCount = { Student: 0, Faculty: 0, Personnel: 0, Guard: 0 };
  users.forEach(u => { const pos = u.position || u.role || (u.position === null ? 'Student' : 'Student'); if (roleCount[pos] !== undefined) roleCount[pos]++; });

  const filtered = users.filter(u => (u.position || u.role || 'Student') === activeRole && ((u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase())));

  function previewFile(path) {
    if (!path) return;
    const url = `/api/image/${encodeURIComponent(path)}`;
    window.open(url, '_blank');
  }

  async function approveUser(user) {
    try {
      // split name
      const name = (user.name || '').split(' ');
      const firstname = name[0] || '';
      let lastname = name.slice(1).join(' ') || '';
      // Backend validator requires lastname; if missing, provide a safe placeholder
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
      // Use axios instance to perform the update so baseURL and credentials are honored
      try {
        const res = await api.put(`/users/${user.id}`, body);
        console.debug('[PendingList] Approve response', { status: res.status, data: res.data });
        if (res.status >= 400) throw new Error('Failed to approve');
      } catch (err) {
        // If axios failed, attempt an absolute origin PUT to help dev setups where relative /api is served by CRA
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
      // refresh list
      setUsers(users.filter(u => u.id !== user.id));
      // show success toast/alert
      try { showAlert(`${user.name || 'User'} approved`, 'success', 4000); } catch (e) { console.debug('[PendingList] showAlert failed', e); }
    } catch (e) {
      console.error('Approve failed', e);
      const msg = 'Approve failed: ' + (e.message || String(e));
      // show both alert and page-level error banner
      try { showAlert(msg, 'error', 6000); } catch (_) { alert(msg); }
      setErrorMessage(msg);
      // clear after 8s
      setTimeout(() => setErrorMessage(''), 8000);
    }
  }

  // decline flow removed per request

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
        <h2>Pending List</h2>
        <div className="role-buttons">
          {Object.keys(roleCount).map((role) => (
            <button key={role} className={activeRole === role ? 'active' : ''} onClick={() => setActiveRole(role)}>
              {role === 'Faculty' ? 'Faculty' : `${role}s`}: {roleCount[role]}
            </button>
          ))}
        </div>
      </div>

      <div className="pendinglist-actions">
        <div className="role-buttons">
          <button className="add">Add</button>
          <button className="pending">Pending</button>
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
            <th>Plate</th>
            <th>OR</th>
            <th>CR</th>
            <th>Details</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={9}>Loading…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={9}>No pending users</td></tr>
          ) : filtered.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.contact_number || '—'}</td>
              <td>{u.department || '—'}</td>
              <td>{u.position || u.role || '—'}</td>
              <td>{u.plate_number || '—'}</td>
              <td>{u.or_path ? (<a className="pdf-link" onClick={() => previewFile(u.or_path)}><FaFilePdf /> OR</a>) : '—'}</td>
              <td>{u.cr_path ? (<a className="pdf-link" onClick={() => previewFile(u.cr_path)}><FaFilePdf /> CR</a>) : '—'}</td>
              <td><button onClick={() => setDetailUser(u)} className="pdf-link"><FaEye /> View</button></td>
              <td className="action-icons">
                <button className="approve" title="Approve" onClick={() => approveUser(u)}><FaCheck /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* details modal */}
      {detailUser ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDetailUser(null)}>
          <div style={{ background: '#fff', padding: 20, maxWidth: 800, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>{detailUser.name}</h3>
            <p><strong>Email:</strong> {detailUser.email}</p>
            <p><strong>Department:</strong> {detailUser.department || '—'}</p>
            <p><strong>Phone:</strong> {detailUser.contact_number || '—'}</p>
            <p><strong>Plate:</strong> {detailUser.plate_number || '—'}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {detailUser.or_path ? <button onClick={() => previewFile(detailUser.or_path)}><FaFilePdf /> Preview OR</button> : null}
              {detailUser.cr_path ? <button onClick={() => previewFile(detailUser.cr_path)}><FaFilePdf /> Preview CR</button> : null}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDetailUser(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
