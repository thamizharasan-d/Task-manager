require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const User = require('./models/User');
const Task = require('./models/Task');
const auth = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB error', err); process.exit(1); });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify((err) => { if (err) console.error('Mailer verify failed', err); });

function formatDate(date) { if (!date) return 'N/A'; return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(date); }

// ---------- Auth routes (unchanged) ----------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      fullName,
      email: email.toLowerCase(),
      password: hashed,
      role: role === 'admin' ? 'admin' : 'user'
    });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing fields' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: { ...user.toObject(), role: req.userRole } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- NEW: user existence check (auth-protected) ----------
app.get('/api/users/exists', auth, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email query required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    res.json({ exists: !!user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Create task (owner is req.userId) ----------
// Modified: validate that assignedTo (if provided) exists in Users collection.
app.post('/api/tasks', auth, async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const owner = req.userId;

    // If assignedTo provided -> ensure user exists
    let normalizedAssignedTo = null;
    if (assignedTo) {
      normalizedAssignedTo = assignedTo.toLowerCase();
      const assigneeUser = await User.findOne({ email: normalizedAssignedTo });
      if (!assigneeUser) {
        return res.status(404).json({ message: 'Assignee email does NOT exist in database' });
      }
    }

    const task = new Task({
      title,
      description,
      assignedTo: normalizedAssignedTo,
      dueDate: dueDate ? new Date(dueDate) : null,
      owner,
      reminderSent: false,
      notified: false,
    });
    await task.save();

    const ownerUser = await User.findById(owner);
    const recipients = [ownerUser.email];
    if (task.assignedTo) recipients.push(task.assignedTo);

    transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(','),
      subject: `Task assigned: ${task.title}`,
      text: `Task Details:\nTitle: ${task.title}\nDescription: ${task.description || 'N/A'}\nDue: ${formatDate(task.dueDate)}\nAssigned By: ${ownerUser.fullName}`,
    }, (err) => { if (err) console.error('Assignment email error:', err); });

    res.json({ task });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ---------- Get tasks owned by logged-in user ----------
app.get('/api/tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ owner: req.userId }).sort({ dueDate: 1 });
    res.json({ tasks });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ---------- tasks assigned to logged-in user's email ----------
app.get('/api/tasks/assigned', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const email = user.email.toLowerCase();
    const tasks = await Task.find({ assignedTo: email }).sort({ dueDate: 1 });
    res.json({ tasks });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ---------- Update task (owner / assignee / admin allowed) ----------
// Modified: if update contains assignedTo, ensure that assignee exists
app.put('/api/tasks/:id', auth, async (req, res) => {
  try {
    const updates = req.body;
    if (updates.assignedTo) updates.assignedTo = updates.assignedTo.toLowerCase();
    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

    // If assignedTo provided ensure user exists
    if (updates.assignedTo) {
      const assigneeUser = await User.findOne({ email: updates.assignedTo });
      if (!assigneeUser) {
        return res.status(404).json({ message: 'Assignee email does NOT exist in database' });
      }
    }

    // Normalize status/completed values to consistent strings/boolean
    if (updates.completed === true || (typeof updates.status === 'string' && updates.status.toLowerCase().includes('complete'))) {
      updates.completed = true;
      updates.status = 'Task Completed';
    } else if (updates.completed === false || (typeof updates.status === 'string' && updates.status.toLowerCase().includes('not'))) {
      updates.completed = false;
      updates.status = 'Not Completed';
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(401).json({ message: 'User not found' });

    const userEmail = currentUser.email && currentUser.email.toLowerCase();
    const isOwner = task.owner && task.owner.toString() === req.userId;
    const isAssignee = task.assignedTo && userEmail && task.assignedTo.toLowerCase() === userEmail;
    const isAdmin = req.userRole === 'admin';

    if (!isOwner && !isAssignee && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    Object.assign(task, updates);
    await task.save();

    const ownerUser = await User.findById(task.owner);
    const recipientsSet = new Set([ownerUser ? ownerUser.email : '']);
    if (task.assignedTo) recipientsSet.add(task.assignedTo);
    const recipients = Array.from(recipientsSet).filter(Boolean);

    transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(','),
      subject: `Task updated: ${task.title}`,
      text: `Task "${task.title}" has been updated.\n\nTitle: ${task.title}\nDescription: ${task.description || 'N/A'}\nDue: ${formatDate(task.dueDate)}\nAssigned To: ${task.assignedTo || 'N/A'}\nStatus: ${task.status}`,
    }, (err) => { if (err) console.error('Update email error:', err); });

    res.json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const ownerUser = await User.findById(req.userId);
    const recipientsSet = new Set([ownerUser.email]);
    if (task.assignedTo) recipientsSet.add(task.assignedTo);
    const recipients = Array.from(recipientsSet);

    transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(','),
      subject: `Task deleted: ${task.title}`,
      text: `Task "${task.title}" has been deleted by ${ownerUser.fullName}.\n\nTitle: ${task.title}\nDescription: ${task.description || 'N/A'}\nDue: ${formatDate(task.dueDate)}`,
    }, (err) => { if (err) console.error('Delete email error:', err); });

    res.json({ message: 'Task deleted successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ---------- Background reminder & overdue code (unchanged) ----------
async function checkHalfwayReminders() {
  const now = new Date();
  const tasks = await Task.find({ reminderSent: { $ne: true }, dueDate: { $ne: null } });

  for (const task of tasks) {
    try {
      const assignTime = task.createdAt;
      const dueTime = task.dueDate;
      if (!assignTime || !dueTime) {
        console.warn(`Skipping task ${task._id}: missing createdAt or dueDate`);
        continue;
      }
      if (assignTime >= dueTime) {
        console.warn(`Skipping task ${task._id}: createdAt >= dueDate`);
        continue;
      }

      const halfTime = new Date(assignTime.getTime() + (dueTime.getTime() - assignTime.getTime()) / 2);

      if (now >= halfTime) {
        const ownerUser = await User.findById(task.owner);
        if (!ownerUser) {
          console.warn(`Owner not found for task ${task._id}`);
          continue;
        }

        const recipients = [ownerUser.email];
        if (task.assignedTo) recipients.push(task.assignedTo);

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: recipients.join(','),
          subject: `Reminder: ${task.title}`,
          text: `Task "${task.title}" is halfway to its due time.\nDue: ${formatDate(task.dueDate)}\nDescription: ${task.description || 'N/A'}`,
          replyTo: ownerUser.email,
        });

        task.reminderSent = true;
        await task.save();
        console.log('Halfway reminder sent:', recipients.join(','));
      }
    } catch (err) {
      console.error('Error processing halfway reminder for task', task._id, err);
    }
  }
}

async function checkOverdue() {
  const now = new Date();
  const tasks = await Task.find({ dueDate: { $lte: now }, notified: { $ne: true } });

  for (const task of tasks) {
    const ownerUser = await User.findById(task.owner);
    if (!ownerUser) continue;

    const recipients = [ownerUser.email];
    if (task.assignedTo) recipients.push(task.assignedTo);

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(','),
      subject: `Task overdue: ${task.title}`,
      text: `Task "${task.title}" is overdue.\nDue: ${formatDate(task.dueDate)}\nDescription: ${task.description || 'N/A'}`,
      replyTo: ownerUser.email,
    });

    task.notified = true;
    await task.save();
    console.log('Overdue sent:', recipients.join(','));
  }
}

setInterval(async () => {
  try {
    await checkHalfwayReminders();
    await checkOverdue();
  } catch (err) {
    console.error('Background job error:', err);
  }
}, 30 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ---------- Password reset routes (unchanged) ----------
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If this email exists, a reset link has been sent.' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontend}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Password reset request',
      text: `You (or someone else) requested a password reset.\n\nClick or paste the link to reset your password:\n\n${resetLink}\n\nThis link expires in 1 hour.`,
      replyTo: process.env.SMTP_FROM,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) console.error('Reset email error:', err);
      else console.log('Reset email sent to:', user.email);
    });

    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(400).json({ message: 'Invalid token' });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
