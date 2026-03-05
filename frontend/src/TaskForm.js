import React, { useState, useEffect } from "react";
import "./TaskForm.css";
import Header from "./Header";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = "https://task-manager-backend-1uzm.onrender.com"; // change if your server URL is different

function TaskForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Load tasks
  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
      } else {
        // keep console error
      }
    }
  };
  useEffect(() => {
    loadTasks();
  }, []);

  // Listen for updates dispatched from other pages/components (e.g. AssignedTask)
  useEffect(() => {
    const onTaskUpdated = async (e) => {
      const detail = e?.detail || {};
      const updatedId = detail.id;
      const updatedStatus = detail.status;
      if (!updatedId) return;

      let matched = false;
      setTasks(prev => prev.map(t => {
        const tid = t._id || t.id;
        if (tid === updatedId) {
          matched = true;
          return { ...t, status: updatedStatus, completed: updatedStatus === 'completed' };
        }
        return t;
      }));

      if (!matched) {
        console.log('task-updated: no local match for', updatedId, ' -> reloading tasks');
        await loadTasks();
      }
    };
    window.addEventListener('task-updated', onTaskUpdated);
    return () => window.removeEventListener('task-updated', onTaskUpdated);
  }, []);

  // --- New state for editing ---
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: ""
  });

  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 16);
  };

  // helper: check if an email exists on server (calls new endpoint)
  const checkAssigneeExists = async (email) => {
    if (!email) return false;
    try {
      const res = await axios.get(`${API_URL}/users/exists`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { email }
      });
      return !!res.data.exists;
    } catch (err) {
      console.error('Error checking assignee existence', err);
      // In case of error, we fallback to server-side validation (so allow client to try to create)
      return null; // null -> unknown
    }
  };

  // Create task
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: require title and assignee
    if (!title.trim() || !assignedTo.trim()) {
      alert("Please enter the details");
      return;
    }

    // Ensure title starts with an alphabetic character
    const trimmedTitle = title.trim();
    if (!/^[A-Za-z]/.test(trimmedTitle)) {
      alert("Task title must start with an alphabetic character (A-Z)");
      return;
    }

    // Capitalize first letter
    const finalTitle = trimmedTitle.charAt(0).toUpperCase() + trimmedTitle.slice(1);

    // --- NEW: check uniqueness against loaded tasks (case-insensitive) ---
    const normalizedNew = finalTitle.trim().toLowerCase();
    const exists = tasks.some(t => (t.title || '').trim().toLowerCase() === normalizedNew);
    if (exists) {
      alert("Task title already exists. Please use a different title.");
      return;
    }

    // Optional: basic email validation for assignee
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(assignedTo)) {
      alert("Please enter a valid assignee email");
      return;
    }

    // Description required
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      alert("Please enter the description.");
      return;
    }
    if (trimmedDescription.length > 1000) {
      alert("Description is too long (max 1000 characters).");
      return;
    }

    // Due date required and validation: must include date+time and not be in the past
    if (!dueDate) {
      alert("Please enter the due date and time.");
      return;
    }
    if (!dueDate.includes('T')) {
      alert("Please include both date and time for the due date.");
      return;
    }
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      alert("Please provide a valid due date and time.");
      return;
    }
    if (parsed.getTime() < Date.now() - 1000) {
      alert("Due date/time cannot be in the past.");
      return;
    }

    try {
      // Client-side pre-check: verify assignee exists (gives faster feedback)
      const existsCheck = await checkAssigneeExists(assignedTo);
      if (existsCheck === false) {
        alert("Assignee email does NOT exist in database");
        return;
      }

      const payload = {
        title: finalTitle,
        description: trimmedDescription,
        assignedTo,
        dueDate: new Date(dueDate).toISOString()
      };

      const res = await axios.post(`${API_URL}/tasks`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Task was created successfully.");

      setTasks(prev => [...prev, res.data.task]);
      setTitle("");
      setAssignedTo("");
      setDescription("");
      setDueDate("");
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 404) {
        // backend 404 indicates assignee not found
        alert(err?.response?.data?.message || "Assignee email does NOT exist in database");
      } else if (err?.response?.status === 409) {
        alert(err?.response?.data?.message || "Task title already exists.");
      } else {
        alert(err?.response?.data?.message || "Could not create task");
      }
    }
  };

  // Delete task
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await axios.delete(`${API_URL}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(prev => prev.filter(task => task._id !== id && task.id !== id));
      alert("Task was deleted successfully.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not delete task");
    }
  };

  // --- Edit handlers ---
  const handleEditClick = (task) => {
    setEditingTaskId(task._id || task.id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      assignedTo: task.assignedTo || "",
      dueDate: toLocalInput(task.dueDate)
    });
    setTimeout(() => {
      const el = document.getElementById(`edit-panel-${task._id || task.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditForm({ title: "", description: "", assignedTo: "", dueDate: "" });
  };

  const handleUpdate = async () => {
    if (!editingTaskId) return;

    const trimmedTitle = (editForm.title || "").trim();
    if (!trimmedTitle || !editForm.assignedTo.trim()) {
      alert("Please provide title and assignee.");
      return;
    }
    if (!/^[A-Za-z]/.test(trimmedTitle)) {
      alert("Task title must start with an alphabetic character (A-Z).");
      return;
    }
    const finalTitle = trimmedTitle.charAt(0).toUpperCase() + trimmedTitle.slice(1);

    const parsed = new Date(editForm.dueDate);
    if (isNaN(parsed.getTime())) {
      alert("Please provide a valid due date and time.");
      return;
    }
    if (parsed.getTime() < Date.now() - 1000) {
      alert("Due date/time cannot be in the past.");
      return;
    }

    try {
      // Client-side pre-check: verify assignee exists
      const existsCheck = await checkAssigneeExists(editForm.assignedTo);
      if (existsCheck === false) {
        alert("Assignee email does NOT exist in database");
        return;
      }

      const payload = {
        title: finalTitle,
        description: editForm.description.trim(),
        assignedTo: editForm.assignedTo,
        dueDate: new Date(editForm.dueDate).toISOString()
      };
      const res = await axios.put(`${API_URL}/tasks/${editingTaskId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(prev => prev.map(t => {
        const id = t._id || t.id;
        if (id === editingTaskId) return res.data.task || { ...t, ...payload };
        return t;
      }));
      alert("Task updated successfully.");
      handleCancelEdit();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 404) {
        alert(err?.response?.data?.message || "Assignee email does NOT exist in database");
      } else if (err?.response?.status === 409) {
        alert(err?.response?.data?.message || "Task title already exists.");
      } else {
        alert(err?.response?.data?.message || "Could not update task");
      }
    }
  };

  return (
    <div>
      <Header/>
      <div className="task-wrapper">
        <h1 className="title">Task Form</h1>

        <form className="task-form" onSubmit={handleSubmit} noValidate>
          <input
            className="input-field"
            type="text"
            placeholder="Enter Task Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            className="input-field"
            type="email"
            placeholder="Enter assignee email"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            required
          />
          <textarea
            className="input-field input-textarea"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="input-field"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button type="submit" className="btn-submit">Create Task</button>
        </form>

        <div className="task-list">
          <h2 className="list-title">Assigned Tasks</h2>
          <ul className="task-items">
            {tasks.map(task => {
              const id = task._id || task.id;
              return (
                <li key={id} className="task-card">
                  <h3>{task.title}</h3>
                  <p><b>Assigned To:</b> {task.assignedTo}</p>
                  {task.description && <p>{task.description}</p>}
                  {task.dueDate && <p><b>Due:</b> {new Date(task.dueDate).toLocaleString()}</p>}
                  <p style={{ marginTop: 8 }}>
                    <b>Status:</b> { (task.status === 'completed' || task.completed) ? 'Completed' : 'Not Completed' }
                  </p>
                  <div className="task-actions">
                    <button className="btn-delete" onClick={() => handleEditClick(task)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDelete(id)}>Delete</button>
                  </div>

                  {editingTaskId === id && (
                    <div id={`edit-panel-${id}`} className="edit-panel" style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 6, }}>
                      <h4>Edit Task</h4>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Task Title"
                        value={editForm.title}
                        onChange={(e) => handleEditChange("title", e.target.value)}
                      />
                      <textarea
                        className="input-field input-textarea"
                        placeholder="Description"
                        value={editForm.description}
                        onChange={(e) => handleEditChange("description", e.target.value)}
                      />
                      <input
                        className="input-field"
                        type="datetime-local"
                        value={editForm.dueDate}
                        onChange={(e) => handleEditChange("dueDate", e.target.value)}
                      />
                      <div style={{ marginTop: 8 }}>
                        <button className="btn-delete" onClick={handleUpdate} type="button">Update</button>
                        <button className="btn-delete" onClick={handleCancelEdit} type="button" style={{ marginLeft: 8 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TaskForm;
