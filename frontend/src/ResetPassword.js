import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header1 from './Header1';
import { resetPassword } from './api';
import './AuthForm.css';

export default function ResetPassword() {
  const loc = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(loc.search);
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div>
        <Header1 />
        <div className="auth-container">
          <div className="auth-form">
            <h3>Invalid or missing reset token</h3>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return alert('Password must be at least 6 characters');
    if (password !== confirm) return alert('Passwords do not match');

    try {
      setLoading(true);
      const res = await resetPassword({ token, password });

      // only navigate when backend explicitly indicates success
      if (res && (res.message === 'Password updated successfully' || res.success === true)) {
        alert('Password updated. Please log in.');
        navigate('/');
      } else {
        // don't navigate on unexpected/failed responses
        alert(res?.message || 'Unexpected response from server.');
        console.log('Reset response:', res);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header1 />
      <div className="auth-container">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Reset password</h2>
          <input type="password" placeholder="New password" required value={password} onChange={e => setPassword(e.target.value)} />
          <input type="password" placeholder="Confirm password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save new password'}</button>
        </form>
      </div>
    </div>
  );
}