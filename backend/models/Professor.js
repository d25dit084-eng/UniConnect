const mongoose = require('mongoose');

const professorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Professor name is required'],
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Professor',
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    courses: {
      type: [String],
      default: [],
    },
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    avgDifficulty: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    wouldTakeAgainPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

professorSchema.index({ department: 1, avgRating: -1 });

module.exports = mongoose.model('Professor', professorSchema);
