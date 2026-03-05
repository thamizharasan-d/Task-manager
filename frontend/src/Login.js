import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthForm.css';
import { login, forgotPassword } from './api';
import Header1 from "./Header1";

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // route based on role
      if (data.user && data.user.role === 'admin') {
        navigate('/TaskForm');
      } else {
        navigate('/AssignedTask');
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Login failed');
    }
  };

  const handleForgotPassword = async () => {
    const inputEmail = window.prompt('Enter your email to receive a password reset link:', email || '');
    if (!inputEmail) return;
    const emailTrim = inputEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      alert('Please enter a valid email address.');
      return;
    }
    try {
      const res = await forgotPassword({ email: emailTrim });
      alert(res?.message || 'If this email exists, a reset link has been sent.');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Could not send reset email.');
    }
  };

  return (
    <div>
      <Header1/>
      <div className="auth-container">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Login</h2>
          <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)}/>
          <button type="submit">Login</button>

          <p className="toggle-text">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleForgotPassword(); }}
              className="forgot-link"
            >
              Forgot password?
            </a>
          </p>

          <p className="toggle-text">
            Don't have an account?
            <Link to="/Signup"> Sign Up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
export default Login;
