import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'assets/forgotpassword.css';
import api from 'utils/api';
import { useAlert } from 'context/AlertContext';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { showAlert } = useAlert();
  const navigate = useNavigate();

  useEffect(() => {
    // Try to prefill email if user is remembered somewhere (optional)
    const stored = localStorage.getItem('resetEmail');
    if (stored) setEmail(stored);
  }, []);

  const handleSendCode = async (e) => {
    e && e.preventDefault();
    if (!email.trim()) return showAlert('Please enter your email', 'error');

    setLoading(true);
    try {
      await api.initCsrf();
      const res = await api.post('/forgot-password', { email });
      setCodeSent(true);
      localStorage.setItem('resetEmail', email);
      showAlert(res.data?.message || 'Code sent to your email', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send reset code';
      showAlert(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e && e.preventDefault();
    if (!code || !newPassword || !confirmPassword) return showAlert('All fields are required', 'error');
    if (newPassword !== confirmPassword) return showAlert('Passwords do not match', 'error');
    if (!/^\d+$/.test(code)) return showAlert('Code must be numeric', 'error');

    setLoading(true);
    try {
      await api.initCsrf();
      const res = await api.post('/reset-password', {
        email,
        token: code,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      showAlert(res.data?.message || 'Password reset successfully', 'success');
      localStorage.removeItem('resetEmail');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password';
      showAlert(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-wrapper">
      <div className="forgot-left">
        <div className="forgot-form-container">
          <img
            src={require('assets/logo.png')}
            alt="BulSU Logo"
            className="forgot-logo"
          />
          <h2 className="forgot-title">Forgot Password</h2>
          <p className="forgot-subtitle">
            {codeSent
              ? 'Enter the code sent to your email and reset your password.'
              : 'Enter your email to receive a code.'}
          </p>

          <form onSubmit={codeSent ? handleResetPassword : handleSendCode}>
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="forgot-input"
              required
              disabled={codeSent}
            />

            {codeSent && (
              <>
                <input
                  type="text"
                  name="code"
                  placeholder="Enter code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="forgot-input"
                  required
                />

                <input
                  type="password"
                  name="newPassword"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="forgot-input"
                  required
                />

                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="forgot-input"
                  required
                />
              </>
            )}

            <div className="button-group">
              <button
                type="submit"
                className={codeSent ? 'forgot-button' : 'send-code-button'}
                disabled={loading}
              >
                {loading ? 'Please wait...' : codeSent ? 'Reset Password' : 'Send Code'}
              </button>
            </div>

            <p className="back-link">
              <Link to="/login">← Back to Login</Link>
            </p>
          </form>
        </div>
      </div>

      <div className="forgot-right">
        <div className="forgot-overlay">
          <h3 className="forgot-banner-title">BULACAN STATE UNIVERSITY</h3>
          <h4 className="forgot-banner-sub">PARKING MANAGEMENT SYSTEM</h4>
          <p className="forgot-banner-tagline">Drive In. Park Smart. Move On.</p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
