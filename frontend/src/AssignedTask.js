import React, { useEffect, useState } from 'react';
import Header from './Header';
import { getAssignedTasks } from './api';
import "./TaskForm.css";
import axios from 'axios';
const API_URL = "https://task-manager-backend-1uzm.onrender.com"; 

export default function AssignedTask() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');
  
  const load = async () => {
    try {
      const res = await getAssignedTasks();
      setTasks(res.tasks || []);
    } catch (err) {
      console.error(err);
      // if unauthorized, clear token
      if (err?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // mark a task completed
  const handleComplete = async (id) => {
    if (!id) return;
    try {
      await axios.put(`${API_URL}/tasks/${id}`, { status: 'Task Completed', completed: true }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // update local state so UI updates immediately
      setTasks(prev => prev.map(t => {
        const tid = t._id || t.id;
        if (tid === id) return { ...t, status: 'Task Completed', completed: true };
        return t;
      }));
      alert('Task marked as completed.');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Could not mark task completed.');
    }
  };

  return (
    <div>
      <Header />
      <div   style={{ padding: 20, maxWidth: 900, margin: '0 auto', color: 'white' }}>
        <h2 className="list-title" style={{ textAlign: 'center' }}>Assigned Tasks</h2>
        {loading && <p>Loading...</p>}
        {!loading && tasks.length === 0 && <p>No tasks assigned to you.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tasks.map(t => (
            <li className="task-card" key={t._id || t.id} style={{ marginBottom: 16, background: 'rgba(14,33,54,0.85)', padding: 12, borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 6px', color: '#ffc002' }}>{t.title}</h3>
              {t.description && <p style={{ margin: '6px 0' }}>{t.description}</p>}
              {t.dueDate && <p style={{ margin: '6px 0' }}><b>Due:</b> {new Date(t.dueDate).toLocaleString()}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  style={{
                    background: (t.status === 'Task Completed' || t.completed === true) ? '#4caf50' : '#1e90ff',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: (t.status === 'Task Completed' || t.completed === true) ? 'default' : 'pointer'
                  }}
                  onClick={() => { if (!(t.status === 'Task Completed' || t.completed === true)) handleComplete(t._id || t.id); }}
                  disabled={t.status === 'Task Completed' || t.completed === true}
                >
                  { (t.status === 'Task Completed' || t.completed === true) ? 'Completed' : 'Mark Completed' }
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: '18px', color: '#ffffffff' }}>
        <b>Total Tasks Assigned: {tasks.length}</b>
      </div>
    </div>
  );
}