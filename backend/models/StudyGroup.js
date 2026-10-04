const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const studyGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Study group name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    courseCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: [120, 'Topic cannot exceed 120 characters'],
      default: '',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [memberSchema],
    maxMembers: {
      type: Number,
      default: 20,
      min: [2, 'A study group must allow at least 2 members'],
      max: [100, 'A study group cannot exceed 100 members'],
    },
    meetingSchedule: {
      type: String,
      trim: true,
      default: '',
    },
    meetingType: {
      type: String,
      enum: ['in_person', 'virtual', 'hybrid'],
      default: 'in_person',
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    meetingLink: {
      type: String,
      trim: true,
      default: '',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

studyGroupSchema.index({ courseCode: 1, status: 1 });
studyGroupSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('StudyGroup', studyGroupSchema);
