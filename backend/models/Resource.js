const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
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
    category: {
      type: String,
      enum: ['syllabus', 'lecture_notes', 'past_exam', 'assignment', 'cheatsheet', 'other'],
      default: 'lecture_notes',
      index: true,
    },
    semester: {
      type: String,
      trim: true,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
      index: true,
    },
    encryptedAuthor: {
      type: String,
      default: null,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL or download path is required'],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'pdf',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    downloadsCount: {
      type: Number,
      default: 0,
    },
    upvotesCount: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance
resourceSchema.index({ courseCode: 1, category: 1 });
resourceSchema.index({ category: 1, createdAt: -1 });
resourceSchema.index({ author: 1, isAnonymous: 1 });
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
