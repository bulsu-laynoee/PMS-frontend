import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaCar,
  FaUsers,
  FaEnvelope,
  FaCog,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaBell,
  FaChartBar
} from 'react-icons/fa';
import 'assets/sidebar.css';
import { logout } from '../utils/auth';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // --- States ---
  const [logo, setLogo] = useState(localStorage.getItem('customLogo') || require('assets/logo.png'));
  const [title, setTitle] = useState(localStorage.getItem('sidebarTitle') || 'PARKING MANAGEMENT SYSTEM');
  const [editing, setEditing] = useState(false);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // --- Check active link ---
  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + '/') ||
    location.pathname === path.replace('/home', '');

  // --- Upload new logo ---
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
        localStorage.setItem('customLogo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Edit title ---
  const handleDoubleClick = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setEditing(false);
    localStorage.setItem('sidebarTitle', title);
  };

  const handleChange = (e) => {
    setTitle(e.target.value);
  };

  // --- Render ---
  return (
    <div className="sidebar">
      {/* Logo and title */}
      <div className="sidebar-logo">
        <div
          className="logo-wrapper"
          onClick={() => fileInputRef.current.click()}
          title="Click to change logo"
          style={{ cursor: 'pointer' }}
        >
          <img src={logo} alt="Logo" className="logo-image" />
        </div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleLogoChange}
        />

        <div className="logo-title" onDoubleClick={handleDoubleClick} title="Double-click to rename">
          {editing ? (
            <input
              ref={inputRef}
              value={title}
              onChange={handleChange}
              onBlur={handleBlur}
              className="title-input"
              style={{
                width: '100%',
                textAlign: 'center',
                border: '2px solid #9e2d2d',
                borderRadius: '8px',
                padding: '4px 6px',
                fontSize: '13px',
                color: '#9e2d2d', // maroon font while typing
                fontWeight: '600',
                transition: 'all 0.3s ease',
              }}
            />
          ) : (
            <div
              className="logo-text"
              style={{
                cursor: 'text',
                color: 'white',
                fontWeight: '700',
                fontSize: '17px',
                lineHeight: '1.4',
                textAlign: 'center',
              }}
            >
              {title}
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="sidebar-menu">
        <Link to="/home/dashboard" className={isActive('/home/dashboard') ? 'active' : ''}>
          <FaTachometerAlt className="sidebar-icon" />
          DASHBOARD
        </Link>

        <Link to="/home/analytics-dashboard" className={isActive('/home/analytics-dashboard') ? 'active' : ''}>
          <FaChartBar className="sidebar-icon" />
          ANALYTICS
        </Link>

        <Link to="/home/parkingspaces" className={isActive('/home/parkingspaces') ? 'active' : ''}>
          <FaCar className="sidebar-icon" />
          PARKING SPACES
        </Link>

        <Link to="/home/userlist" className={isActive('/home/userlist') ? 'active' : ''}>
          <FaUsers className="sidebar-icon" />
          USER LIST
        </Link>

        <Link to="/home/messages" className={isActive('/home/messages') ? 'active' : ''}>
          <FaEnvelope className="sidebar-icon" />
          MESSAGES
        </Link>

        <Link to="/home/incidents" className={isActive('/home/incidents') ? 'active' : ''}>
          <FaExclamationTriangle className="sidebar-icon" />
          INCIDENTS REPORT
        </Link>

        <Link to="/home/notifications" className={isActive('/home/notifications') ? 'active' : ''}>
          <FaBell className="sidebar-icon" />
          NOTIFICATIONS
        </Link>

        <Link to="/home/settings" className={isActive('/home/settings') ? 'active' : ''}>
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
