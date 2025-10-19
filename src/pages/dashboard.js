import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaParking,
  FaUsers,
  FaClock,
  FaEnvelope,
  FaBell,
  FaExclamationTriangle,
  FaArrowRight,
  FaCar,
} from 'react-icons/fa';
import { MdFeedback } from 'react-icons/md';
import { getUserName, getToken } from '../utils/auth';
import api from '../utils/api';
import 'assets/dashboard.css';

// Reusable Card Component
const DashboardCard = ({ icon, title, description, onClick }) => (
  <div className="card" onClick={onClick}>
    <div className="card-header">
      <div className="card-icon-wrapper">{icon}</div>
      <FaArrowRight className="arrow-icon" />
    </div>
    <h3 className="card-title">{title}</h3>
    <p className="card-description">{description}</p>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(getUserName() || 'User');
  const [currentDate, setCurrentDate] = useState('');
  const [stats, setStats] = useState({
    totalSpaces: '...',
    activeUsers: '...',
    currentlyParked: '...',
  });

  useEffect(() => {
    const loadData = async () => {
      if (getToken()) {
        try {
          await api.initCsrf();
          const res = await api.get('/account');
          const name = res.data?.data?.name || res.data?.name;
          if (name) setUserName(name);

          const statsRes = await api.get('/dashboard-stats');
          const { total_parking_spaces, active_users, currently_parked } = statsRes.data;

          setStats({
            totalSpaces: total_parking_spaces ?? '0',
            activeUsers: active_users ?? '0',
            currentlyParked: currently_parked ?? '0',
          });
        } catch (e) {
          console.error('Failed to load dashboard data', e);
          setStats({
            totalSpaces: '0',
            activeUsers: '0',
            currentlyParked: '0',
          });
        }
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(`Today is ${now.toLocaleDateString('en-US', options)}.`);
  }, []);

  return (
    <main className="main-content">
      <div className="content-wrapper">
        {/* Header */}
        <header className="dashboard-header">
          <h1 className="welcome-message">
            Welcome back, <span className="user-name">{userName}!</span>
          </h1>
          <p className="current-date">{currentDate}</p>
        </header>

        {/* Quick Stats (One Long Card) */}
        <section className="quick-stats-long-card">
          <div className="stat-item">
            <div className="stat-icon-wrapper">
              <FaParking size={28} />
            </div>
            <div>
              <p className="stat-title">Total Parking Spaces</p>
              <p className="stat-value">{stats.totalSpaces}</p>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon-wrapper">
              <FaCar size={28} />
            </div>
            <div>
              <p className="stat-title">Currently Parked Vehicles</p>
              <p className="stat-value">{stats.currentlyParked}</p>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon-wrapper">
              <FaUsers size={28} />
            </div>
            <div>
              <p className="stat-title">Active Users</p>
              <p className="stat-value">{stats.activeUsers}</p>
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <section className="dashboard-grid">
          <DashboardCard
            onClick={() => navigate('/home/parkingspaces')}
            icon={<FaParking className="card-icon" />}
            title="Parking Spaces"
            description="Manage all available parking locations."
          />
          <DashboardCard
            onClick={() => navigate('/home/userlist')}
            icon={<FaUsers className="card-icon" />}
            title="User List"
            description="View and manage all registered users."
          />
          <DashboardCard
            onClick={() => navigate('/home/pendinglist')}
            icon={<FaClock className="card-icon" />}
            title="Pending List"
            description="Review and approve pending requests."
          />
          <DashboardCard
            onClick={() => navigate('/home/incidents')}
            icon={<FaExclamationTriangle className="card-icon" />}
            title="Incidents Report"
            description="Address and resolve reported incidents."
          />
          <DashboardCard
            onClick={() => navigate('/home/feedback')}
            icon={<MdFeedback className="card-icon" />}
            title="Feedback"
            description="Review submitted user feedback."
          />
          <DashboardCard
            onClick={() => navigate('/home/messages')}
            icon={<FaEnvelope className="card-icon" />}
            title="Messages"
            description="Read and respond to inquiries."
          />
        </section>
      </div>
    </main>
  );
};

export default Dashboard;
