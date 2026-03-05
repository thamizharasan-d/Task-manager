import React, { useState } from 'react';
import './Header.css';
import Logo from './Logo.png';
import { Link, useNavigate } from 'react-router-dom';

function Header1() {
  return (
    <div className="Header">
      <div id="d1">
        <img id="img" src={Logo} alt="Logo" />
        <h1 id="he1">TASK MANAGER</h1>
      </div>
    </div>
  );
}
export default Header1;
