import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
// ...existing code...

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + '/') ||
    location.pathname === path.replace('/home', '');

  const handleNav = (e, path) => {
    e.preventDefault();
    navigate(path);
  };

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
          <a href="/home/dashboard" onClick={(e) => handleNav(e, '/home/dashboard')}>
            <FaTachometerAlt className="sidebar-icon" />
            DASHBOARD
          </a>
        </li>
        <li className={isActive('/home/parkingspaces') ? 'active' : ''}>
          <a href="/home/parkingspaces" onClick={(e) => handleNav(e, '/home/parkingspaces')}>
            <FaCar className="sidebar-icon" />
            PARKING SPACES
          </a>
        </li>
        <li className={isActive('/home/userlist') ? 'active' : ''}>
          <a href="/home/userlist" onClick={(e) => handleNav(e, '/home/userlist')}>
            <FaUsers className="sidebar-icon" />
            USER LIST
          </a>
        </li>
        <li className={isActive('/home/messages') ? 'active' : ''}>
          <a href="/home/messages" onClick={(e) => handleNav(e, '/home/messages')}>
            <FaEnvelope className="sidebar-icon" />
            MESSAGES
          </a>
        </li>
        <li className={isActive('/home/incidents') ? 'active' : ''}>
          <a href="/home/incidents" onClick={(e) => handleNav(e, '/home/incidents')}>
            <FaExclamationTriangle className="sidebar-icon" />
            INCIDENTS REPORT
          </a>
        </li>
        <li className={isActive('/home/settings') ? 'active' : ''}>
          <a href="/home/settings" onClick={(e) => handleNav(e, '/home/settings')}>
            <FaCog className="sidebar-icon" />
            SETTINGS
          </a>
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