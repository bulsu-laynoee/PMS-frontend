import React, { useEffect, useState } from 'react';
import 'assets/pendinglist.css';
import { FaFilePdf, FaCheck, FaEye } from 'react-icons/fa';
import api from '../utils/api';
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
        // Try relative API first (works when frontend is served by backend or proxy is configured)
        let res = await fetch('/api/users', { credentials: 'include' });
        console.debug('[PendingList] initial /api/users response', { url: res.url, status: res.status, ok: res.ok });

        // If unauthorized, inform the admin to login; do not try anonymous fallbacks
        if (res.status === 401) { setAuthRequired(true); setLoading(false); return; }

        // If the relative fetch returned a non-JSON payload (for example CRA dev server index.html),
        // try common backend fallbacks before failing.
        let contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('application/json')) {
          const fallbacks = ['http://localhost:8000', 'http://127.0.0.1', 'http://localhost'];
          let ok = false;
          for (const b of fallbacks) {
            try {
              const testUrl = `${b.replace(/\/$/, '')}/api/users`;
              const fres = await fetch(testUrl, { credentials: 'include' });
              console.debug('[PendingList] tried backend fallback', { base: b, url: fres.url, status: fres.status, ok: fres.ok, contentType: fres.headers.get('content-type') });
              if (fres.status === 401) { setAuthRequired(true); ok = true; res = fres; break; }
              const fct = (fres.headers.get('content-type') || '').toLowerCase();
              if (fres.ok && fct.includes('application/json')) { ok = true; res = fres; break; }
            } catch (e) {
              // try next fallback
              console.debug('[PendingList] fallback fetch failed for', b, e?.message || e);
            }
          }
          if (!ok) {
            // Read original response text for a better error message
            const text = await res.text();
            const snippet = String(text).slice(0, 800);
            console.error('[PendingList] API returned non-JSON response and fallbacks failed', { url: res.url, status: res.status, snippet });
            if (res.status === 401) {
              setAuthRequired(true);
              setLoading(false);
              return;
            }
            throw new Error(`API returned non-JSON response (status ${res.status}). First characters: ${snippet.startsWith('<') ? '[HTML]' : snippet.slice(0, 120)}`);
          }
        }

        const json = await res.json();
        const data = json?.data || json;
        // filter only pending users
        const pending = (data || []).filter(u => (u.from_pending === 1 || u.from_pending === true || String(u.from_pending) === '1'));
        setUsers(pending);
      } catch (e) {
        console.error('Failed to load pending users', e);
        setErrorMessage(e.message || String(e));
      }
      setLoading(false);
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
      try {
        // Build absolute URL pointing to backend origin (api.defaults.baseURL expected to be like 'http://localhost:8000/api')
        const base = (api && api.defaults && api.defaults.baseURL) ? api.defaults.baseURL : 'http://127.0.0.1:8000/api';
        const origin = String(base).replace(/\/api\/?$/, '');
        const url = `${origin}/api/users/${user.id}`;
        console.debug('[PendingList] Approve absolute URL', url);
        const fres = await fetch(url, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        console.debug('[PendingList] Approve fetch status', { status: fres.status, ok: fres.ok, url: fres.url });
        if (!fres.ok) {
          let msg = 'Failed to approve';
          try {
            const txt = await fres.text();
            console.error('[PendingList] Approve failed response body:', txt.slice(0, 2000));
            // try parse json
            try { const dj = JSON.parse(txt); if (dj?.message) msg = dj.message; else if (dj?.errors) msg = Object.values(dj.errors).flat().join('\n'); } catch (_) {}
          } catch (e) {
            console.error('[PendingList] Failed to read approve response body', e);
          }
          throw new Error(msg);
        }
      } catch (err) {
        console.error('[PendingList] Approve request error', err);
        throw err;
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
