const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: { type: String },
  dueDate: Date,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notified: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },

  // added fields
  completed: { type: Boolean, default: false },
  status: { type: String, default: 'Not Completed' }
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
