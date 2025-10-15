import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaTachometerAlt,
  FaCar,
  FaUsers,
  FaEnvelope,
  FaCog,
  FaSignOutAlt,
  FaExclamationTriangle
} from "react-icons/fa";
import "assets/Sidebar.css";
import { clearAuth, getToken } from "../utils/auth"; //  use helpers

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const token = getToken(); // centralized token getter

      if (token) {
        await axios.post(
          "http://localhost:8000/api/logout",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // clear tokens in one call
      clearAuth();
      navigate("/sign-in");
    }
  };

  return (
    <div className="sidebar">
      <div>
        {/* Logo (not clickable) */}
        <div className="sidebar-logo">
          <img
            src={require("assets/images/logo.png")}
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
              <FaExclamationTriangle className="sidebar-icon" />
              INCIDENT REPORT
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

      {/* Logout Button */}
      <ul className="sidebar-menu">
        <li>
          <button onClick={handleLogout} className="logout-btn">
            <FaSignOutAlt className="sidebar-icon" />
            <strong>LOGOUT</strong>
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;