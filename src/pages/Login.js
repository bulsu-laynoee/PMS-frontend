import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import 'assets/Login.css';
import api from 'utils/api';
import { setAuth, getToken } from 'utils/auth';
import { useAlert } from 'context/AlertContext';
import { FiEye, FiEyeOff } from 'react-icons/fi';

function Login() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  useEffect(() => {
    const t = getToken();
    if (t) {
      navigate('/home/dashboard');
    }
  }, [navigate]);

  const handleInput = (e) => {
    setValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // For the admin web interface send an `admin` flag so the backend
      // can enforce admin-only access (role id = 6). This ensures non-admin
      // accounts attempting to use this UI receive a friendly 403 response.
      const payload = { ...values, admin: true };
      const response = await api.post('/login', payload);
      const token = response.data?.data?.token;
      const name = response.data?.data?.name;
      const email = response.data?.data?.email;

      if (token) {
        setAuth(token, name || '', email || '', remember === true);
        showAlert('Login successful!', 'success');
        navigate('/home/dashboard');
      } else {
        // This is a fallback; the 'catch' block is more reliable for errors
        showAlert('Login failed: Invalid credentials', 'error');
      }
    } catch (error) {
      // Provide specific guidance depending on the HTTP status
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      if (status === 401) {
        showAlert('Email or password is incorrect', 'error');
      } else if (status === 403) {
        // Admin-only restriction: give a friendly explanation
        const msg = serverMessage || 'Access denied: this portal is for admin accounts only.';
        showAlert(`${msg} If you need access, contact your administrator.`, 'error');
      } else {
        const errorMessage = serverMessage || 'Something went wrong';
        showAlert(`Login failed: ${errorMessage}`, 'error');
      }
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Left Side - Form */}
        <div className="login-left">
          <div className="login-form-container">
            <img
              src={require('assets/logo.png')}
              alt="Logo"
              className="login-logo"
            />

            <h2 className="login-title">Welcome back!</h2>
            <p className="login-subtitle">
              Enter your credentials to access your account
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={values.email}
                onChange={handleInput}
                className="login-input"
                required
              />

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={values.password}
                  onChange={handleInput}
                  className="login-input"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <div className="login-options">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />{' '}
                  Remember me
                </label>
              </div>

              <button type="submit" className="login-button">
                ➔ Sign In
              </button>

              <p className="forgot-link">
                <Link to="/forgotpassword">Forgot Password?</Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right Side - Banner */}
        <div className="login-right">
          <div className="login-overlay">
            <h3 className="login-banner-title">BULACAN STATE UNIVERSITY</h3>
            <h4 className="login-banner-sub">PARKING MANAGEMENT SYSTEM</h4>
            <p className="login-banner-tagline">Drive In. Park Smart. Move On.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;