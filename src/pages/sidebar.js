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
      <div>
        {/* Logo (not clickable) */}
        <div className="sidebar-logo">
          <img
            src={require("assets/logo.png")}
            alt="Logo"
            className="logo-image"
          />
          <div className="logo-title">
            <div className="logo-line1">PARKING MANAGEMENT</div>
            <div className="logo-line2">SYSTEM</div>
          </div>
        </div>

        {/* Menu */}
        <ul className="sidebar-menu">
          <li className={location.pathname === "/dashboard" ? "active" : ""}>
            <a href="/dashboard">
              <FaTachometerAlt className="sidebar-icon" />
              DASHBOARD
            </a>
          </li>
          <li
            className={location.pathname === "/parking-spaces" ? "active" : ""}
          >
            <a href="/parking-spaces">
              <FaCar className="sidebar-icon" />
              PARKING SPACES
            </a>
          </li>
          <li className={location.pathname === "/user-list" ? "active" : ""}>
            <a href="/user-list">
              <FaUsers className="sidebar-icon" />
              USER LIST
            </a>
          </li>
          <li className={location.pathname === "/messages" ? "active" : ""}>
            <a href="/messages">
              <FaEnvelope className="sidebar-icon" />
              MESSAGES
            </a>
          </li>
          <li className={location.pathname === "/incidents" ? "active" : ""}>
            <a href="/incidents">
              <FaEnvelope className="sidebar-icon" />
              INCIDENT REPORTS
            </a>
          </li>
          <li className={location.pathname === "/settings" ? "active" : ""}>
            <a href="/settings">
              <FaCog className="sidebar-icon" />
              SETTINGS
            </a>
          </li>
        </ul>
      </div>

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
