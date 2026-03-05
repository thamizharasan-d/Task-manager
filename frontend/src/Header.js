import React, { useState } from 'react';
import './Header.css';
import Logo from './Logo.png';
import { Link, useNavigate } from 'react-router-dom';

function getStoredUsername() {
  const keys = ['username', 'user', 'name', 'userInfo', 'profile'];
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    let val = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        val =
          parsed.username ||
          parsed.name ||
          parsed.fullName ||
          parsed.firstName ||
          parsed.user ||
          parsed.email ||
          '';
      }
    } catch (e) {
      // raw is a string username — keep as is
    }
    val = String(val || '').trim();
    if (!val) continue;
    if (/^geust$/i.test(val)) return 'Guest';
    // Capitalize each word
    return val
      .split(' ')
      .filter(Boolean)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
  return 'Guest';
}

function Header() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => getStoredUsername());

  const handleLogout = () => {
    // clear common auth/user storage keys
    ['username', 'user', 'token', 'userInfo', 'name', 'profile'].forEach(k =>
      localStorage.removeItem(k)
    );
    setUsername('Guest');
    navigate('/');
  };

  return (
    <div className="Header">
      <div id="d1">
        <img id="img" src={Logo} alt="Logo" />
        <h1 id="he1">TASK MANAGER</h1>
      </div>

      <div className="greeting">
        <span className="greet-text">✨Hi, {username}</span>
        <button onClick={handleLogout} id="logbut">Logout</button>
      </div>
    </div>
  );
}
export default Header;
