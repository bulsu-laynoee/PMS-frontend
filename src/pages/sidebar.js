import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaCar,
  FaUsers,
  FaEnvelope,
  FaCog,
  FaSignOutAlt,
  FaExclamationTriangle
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
      {/* Centered logo + title */}
      <div className="sidebar-logo">
        <img
          src={require('assets/logo.png')}
          alt="Bulacan State University Logo"
          className="logo-image"
        />
        <h1 className="logo-title">
          PARKING MANAGEMENT SYSTEM
        </h1>
      </div>

      {/* Menu items */}
      <ul className="sidebar-menu">
        <li className={isActive('/home/dashboard') ? 'active' : ''}>
          <Link to="/home/dashboard">
            <FaTachometerAlt className="sidebar-icon" />
            DASHBOARD
          </Link>
        </li>
        <li className={isActive('/home/parkingspaces') ? 'active' : ''}>
          <Link to="/home/parkingspaces">
            <FaCar className="sidebar-icon" />
            PARKING SPACES
          </Link>
        </li>
        <li className={isActive('/home/userlist') ? 'active' : ''}>
          <Link to="/home/userlist">
            <FaUsers className="sidebar-icon" />
            USER LIST
          </Link>
        </li>
        <li className={isActive('/home/messages') ? 'active' : ''}>
          <Link to="/home/messages">
            <FaEnvelope className="sidebar-icon" />
            MESSAGES
          </Link>
        </li>
        <li className={isActive('/home/incidents') ? 'active' : ''}>
          <Link to="/home/incidents">
            <FaExclamationTriangle className="sidebar-icon" />
            INCIDENTS REPORT
          </Link>
        </li>
        <li className={isActive('/home/settings') ? 'active' : ''}>
          <Link to="/home/settings">
            <FaCog className="sidebar-icon" />
            SETTINGS
          </Link>
        </li>
      </ul>

      {/* Logout at bottom */}
      <div className="sidebar-footer">
        <button
          className="logout-btn"
          onClick={() => logout(navigate)}
        >
          <FaSignOutAlt className="sidebar-icon" />
          LOGOUT
        </button>
      </div>
    </div>
  );
};

export default Sidebar;