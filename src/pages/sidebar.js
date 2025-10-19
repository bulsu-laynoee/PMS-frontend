import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaCar,
  FaUsers,
  FaEnvelope,
  FaCog,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaBell
} from 'react-icons/fa';
import 'assets/sidebar.css';
import { logout } from '../utils/auth';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + '/') ||
    location.pathname === path.replace('/home', '');

  return (
    <div className="sidebar">
      {/* Logo and title */}
      <div className="sidebar-logo">
        <img
          src={require('assets/logo.png')}
          alt="Logo"
          className="logo-image"
        />
        <div className="logo-title">
          <div className="logo-line1">PARKING MANAGEMENT</div>
          <div className="logo-line2">SYSTEM</div>
        </div>
      </div>

      {/* Menu */}
      <div className="sidebar-menu">
        <Link
          to="/home/dashboard"
          className={isActive('/home/dashboard') ? 'active' : ''}
        >
          <FaTachometerAlt className="sidebar-icon" />
          DASHBOARD
        </Link>

        <Link
          to="/home/parkingspaces"
          className={isActive('/home/parkingspaces') ? 'active' : ''}
        >
          <FaCar className="sidebar-icon" />
          PARKING SPACES
        </Link>

        <Link
          to="/home/userlist"
          className={isActive('/home/userlist') ? 'active' : ''}
        >
          <FaUsers className="sidebar-icon" />
          USER LIST
        </Link>

        <Link
          to="/home/messages"
          className={isActive('/home/messages') ? 'active' : ''}
        >
          <FaEnvelope className="sidebar-icon" />
          MESSAGES
        </Link>

        <Link
          to="/home/incidents"
          className={isActive('/home/incidents') ? 'active' : ''}
        >
          <FaExclamationTriangle className="sidebar-icon" />
          INCIDENTS REPORT
        </Link>

        <Link
          to="/home/notifications"
          className={isActive('/home/notifications') ? 'active' : ''}
        >
          <FaBell className="sidebar-icon" />
          NOTIFICATIONS
        </Link>

        <Link
          to="/home/settings"
          className={isActive('/home/settings') ? 'active' : ''}
        >
          <FaCog className="sidebar-icon" />
          SETTINGS
        </Link>
      </div>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={() => logout(navigate)}>
          <FaSignOutAlt className="sidebar-icon" />
          LOGOUT
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
