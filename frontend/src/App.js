import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TaskForm from './TaskForm';
import Login from './Login';
import Signup from './Signup';
import ResetPassword from './ResetPassword';
import AssignedTask from './AssignedTask';
function App() {
  return (
    <div id='divmain'>
      <Router>
        <Routes>
          <Route path="/" element={<Login/>}/>
          <Route path="/Signup" element={<Signup/>}/>
          <Route path="/TaskForm" element={<TaskForm />}/>
          <Route path="/AssignedTask" element={<AssignedTask />}/>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
