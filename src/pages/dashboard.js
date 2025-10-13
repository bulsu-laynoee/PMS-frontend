import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaParking,
  FaUsers,
  FaClock,
  FaEnvelope,
  FaCog,
  FaBell,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { getUserName, getToken } from 'utils/auth';
import api from 'utils/api';
import 'assets/dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = React.useState(getUserName() || 'User');

  React.useEffect(() => {
    const load = async () => {
      try {
        await api.initCsrf();
        const res = await api.get('/account');
        const name = res.data?.data?.name || res.data?.name;
        if (name) setUserName(name);
      } catch (e) {
        // ignore - fallback to auth-stored name
      }
    };
    // only call if token exists
    if (getToken()) load();
  }, []);

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Welcome back, <strong>{userName}!</strong></h2>

      <div className="dashboard-grid">
        <div className="card" onClick={() => navigate('/home/parkingspaces')}>
          <FaParking className="card-icon" />
          <h3>Parking Spaces</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/userlist')}>
          <FaUsers className="card-icon" />
          <h3>User List</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/pendinglist')}>
          <FaClock className="card-icon" />
          <h3>Pending List</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/incidents')}>
          <FaExclamationTriangle className="card-icon" />
          <h3>Incident Reports</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/notifications')}>
          <FaBell className="card-icon" />
          <h3>Notifications</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/messages')}>
          <FaEnvelope className="card-icon" />
          <h3>Messages</h3>
        </div>

        <div className="card" onClick={() => navigate('/home/settings')}>
          <FaCog className="card-icon" />
          <h3>Settings</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
