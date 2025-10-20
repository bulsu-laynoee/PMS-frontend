import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import 'assets/userlist.css'; // <-- IMPORT YOUR NEW CSS FILE

// --- Component Imports ---
import api from '../utils/api';
import { useAlert } from 'context/AlertContext';
import Modal from 'components/Modal'; // Your Chakra Modals are still used
import AdminCreateUser from './AdminCreateUser';
import VehicleModal from 'components/VehicleModal';
import VehicleListModal from 'components/VehicleListModal';
import EditUserModal from 'components/EditUserModal';

// --- Icon Imports ---
import { FiEye } from 'react-icons/fi';
import {
  FaUser,
  FaChalkboardTeacher,
  FaBriefcase,
  FaShieldAlt,
  FaUserGraduate,
  FaUserTie,
  FaUserCog,
  FaUsers,
  FaEdit,
  FaPlus,
  FaComment,
  FaList,
} from 'react-icons/fa'; // Added FaList for Pending

const UserList = () => {
  const { showAlert } = useAlert();
  const [users, setUsers] = useState([]);
  // const [vehicles, setVehicles] = useState([]); // No longer needed for display
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('All');
  const [isModalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [vehicleModalUser, setVehicleModalUser] = useState(null);
  const [vehicleListUser, setVehicleListUser] = useState(null);
  const [editUser, setEditUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get('/users')
      .then(res => {
        if (!mounted) return;
        setUsers(res.data.data || res.data || []);
      })
      .catch(err => {
        console.error('Failed to load users', err);
        showAlert('Failed to load users', 'error');
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [refreshKey]);

  // Role list and counts for filter buttons
  const roles = ['All', 'Student', 'Faculty', 'Employee', 'Guard'];
  
  const roleIcons = {
    All: <FaUsers />,
    Student: <FaUserGraduate />,
    Faculty: <FaUserTie />,
    Employee: <FaUserCog />,
    Guard: <FaShieldAlt />,
  };

  const tableIcons = {
    student: <FaUserGraduate />,
    faculty: <FaUserTie />,
    employee: <FaBriefcase />, // Using Briefcase for table
    guard: <FaShieldAlt />,
    default: <FaUser />,
  }

  // Calculate counts
  const counts = roles.reduce((acc, r) => {
    const lowerRole = r.toLowerCase();
    if (r === 'All') {
      const allCount = users.filter(u => (u.role || '').toLowerCase() !== 'admin').length;
      return { ...acc, All: allCount };
    }
    const c = users.filter(u => (u.role || '').toLowerCase() === lowerRole).length;
    return { ...acc, [r]: c };
  }, {});


  const filtered = users.filter(u => {
    const userRole = (u.role || '').toLowerCase();
    // hide Admins
    if (userRole === 'admin') return false;
    // filter by active role
    if (activeRole !== 'All' && (u.role || '') !== activeRole) return false;
    // filter by search
    return (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
  });

  // Chat navigation logic
  const handleChatClick = async (u) => {
    try {
      const res = await api.post('/conversations', { user_ids: [u.id] });
      const conv = res.data.data || res.data || null;
      const id = conv?.id || conv?.thread_id || conv?.conversation_id || conv?.conversation?.id || conv?.conversation?.thread_id;

      if (id) {
        navigate(`/home/messages/${id}`);
      } else {
        navigate(`/home/messages?user=${u.id}`);
      }
    } catch (e) {
      console.error('failed to create conversation', e);
      showAlert('Could not start chat. Navigating to messages.', 'error');
      navigate(`/home/messages?user=${u.id}`);
    }
  };


  return (
    <div className="userlist-container">
      {/* --- Header --- */}
      <div className="userlist-header">
        <div className="header-left-side">
          <h2>User List</h2>
          <nav className="breadcrumbs">
            <Link to="/home/dashboard">Dashboard</Link>
            <span>/</span>
            <span className="breadcrumb-active">User List</span>
          </nav>
        </div>

        <div className="role-buttons">
          {roles.map(role => (
            <button
              key={role}
              className={activeRole === role ? 'active' : ''}
              onClick={() => setActiveRole(role)}
            >
              <span className="role-icon">{roleIcons[role]}</span>
              <div className="role-info">
                <span className="role-name">
                  {role === 'All' ? 'All Users' : (role === 'Faculty' ? 'Faculty' : `${role}s`)}
                </span>
                <span className="role-count">
                  {counts[role] || 0} {role === 'All' ? 'Total' : 'Users'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* --- Actions --- */}
      <div className="userlist-actions">
        <div className="left-actions">
          <button className="nav-button nav-button-pending" onClick={() => navigate('/home/pendinglist')}>
            <FaList /> Pending List
          </button>
          <button className="nav-button" onClick={() => setModalOpen(true)}>
            <FaPlus /> Create User
          </button>
        </div>
        <div className="right-actions">
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* --- Table --- */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>Loading...</div>
      ) : (
        <table className="userlist-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5}>No users found{activeRole !== 'All' ? ` for "${activeRole}"` : ''}</td></tr>
            ) : filtered.map((u) => {
              const role = (u.role || '').toLowerCase();
              const icon = tableIcons[role] || tableIcons.default;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="userlist-name-cell">
                      {icon}
                      {u.name}
                    </div>
                  </td>
                  <td>{u.email || '—'}</td>
                  <td>{u.department || '—'}</td>
                  <td>{u.contact_number || '—'}</td>
                  
                  <td className="action-buttons-group">
                    <button 
                      className="action-button action-edit" 
                      onClick={() => setEditUser(u)}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className="action-button action-add" 
                      onClick={() => setVehicleModalUser(u)}
                    >
                      <FaPlus /> Add Vehicle
                    </button>
                    <button 
                      className="action-button action-view" 
                      onClick={() => setVehicleListUser(u)}
                    >
                      <FiEye /> View
                    </button>
                    <button 
                      className="action-button action-chat" 
                      onClick={() => handleChatClick(u)}
                    >
                      <FaComment /> Chat
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* --- Modals (Still uses Chakra components) --- */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create User">
        <AdminCreateUser onSuccess={() => { setModalOpen(false); setRefreshKey(k => k + 1); }} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Edit ${editUser?.name || ''}`}>
        {editUser && (
          <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>

      <Modal isOpen={!!vehicleModalUser} onClose={() => setVehicleModalUser(null)} title="Add Vehicle" maxWidth={{ base: '95vw', md: '760px' }}>
        {vehicleModalUser && (
          <VehicleModal user={vehicleModalUser} onClose={() => setVehicleModalUser(null)} onSuccess={() => { setVehicleModalUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>

      <Modal isOpen={!!vehicleListUser} onClose={() => setVehicleListUser(null)} title="Vehicles">
        {vehicleListUser && (
          <VehicleListModal user={vehicleListUser} onClose={() => setVehicleListUser(null)} onUpdated={() => { setVehicleListUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>
    </div>
  );
};

export default UserList;