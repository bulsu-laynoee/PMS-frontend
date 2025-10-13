import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaCar,
  FaUsers,
  FaEnvelope,
  FaCog,
  FaExclamationTriangle
} from 'react-icons/fa';
import 'assets/sidebar.css';
import { logout } from '../utils/auth';

const Sidebar = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/') || location.pathname === path.replace('/home','');

  return (
    <div className="sidebar">
      {/* Logo section with title split into two lines */}
      <Link to="home/dashboard" className="sidebar-logo">
        <img
          src={require('assets/logo.png')}
          alt="Logo"
          className="logo-image"
        />
        <div className="logo-title">
          <div className="logo-line1">PARKING MANAGEMENT</div>
          <div className="logo-line2">SYSTEM</div>
        </div>
      </Link>

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
      </ul>

      <ul className="sidebar-menu">
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
            INCIDENTS
          </Link>
        </li>
      </ul>

      <ul className="sidebar-menu">
        <li className={isActive('/home/settings') ? 'active' : ''}>
          <Link to="/home/settings">
            <FaCog className="sidebar-icon" />
            SETTINGS
          </Link>
        </li>
      </ul>

      <ul className="sidebar-menu">
        <li>
          <button
            className="logout-btn"
            onClick={() => logout(navigate)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <FaCog style={{ display: 'none' }} />
            <strong>LOGOUT</strong>
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
