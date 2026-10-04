const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['course', 'professor'],
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    professor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Professor',
      default: null,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    rating: {
      type: Number,
      required: [true, 'Rating (1-5) is required'],
      min: 1,
      max: 5,
    },
    difficulty: {
      type: Number,
      required: [true, 'Difficulty (1-5) is required'],
      min: 1,
      max: 5,
    },
    wouldTakeAgain: {
      type: Boolean,
      default: true,
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'Pass', 'Audit', 'N/A'],
      default: 'N/A',
    },
    content: {
      type: String,
      required: [true, 'Review text is required'],
      minlength: [10, 'Review must be at least 10 characters'],
      maxlength: [2000, 'Review cannot exceed 2000 characters'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unhelpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reviews by the same author for the same course or professor
reviewSchema.index(
  { author: 1, targetType: 1, course: 1, professor: 1 },
  { unique: true }
);

module.exports = mongoose.model('Review', reviewSchema);
