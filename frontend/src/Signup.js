import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthForm.css';
import { signup } from './api';
import Header1 from "./Header1";

function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await signup({ fullName, email, password, role });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div>
      <Header1/>
      <div className="auth-container">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Sign Up</h2>
          <input type="text" placeholder="Full Name" required value={fullName} onChange={e=>setFullName(e.target.value)} />
          <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
          <div style={{ width: '95%', maxWidth: 380, textAlign: 'left', marginTop: 6 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Role</label>
            <select className="role-select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit">Sign Up</button>
          <p className="toggle-text"> Already have an account? <Link to="/"> Login</Link> </p>
        </form>
      </div>
    </div>
  );
}

export default Signup;
