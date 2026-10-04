const mongoose = require('mongoose');

const EVENT_CATEGORIES = [
  'academic',
  'social',
  'career',
  'sports',
  'workshop',
  'cultural',
  'other',
];

const EVENT_FORMATS = ['in_person', 'virtual', 'hybrid'];

const RSVP_STATUSES = ['going', 'maybe', 'not_going'];

const attendeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: RSVP_STATUSES,
      default: 'going',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [3, 'Event title must be at least 3 characters'],
      maxlength: [120, 'Event title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [3000, 'Event description cannot exceed 3000 characters'],
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      default: null,
    },
    category: {
      type: String,
      enum: EVENT_CATEGORIES,
      default: 'social',
    },
    format: {
      type: String,
      enum: EVENT_FORMATS,
      default: 'in_person',
    },
    location: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    virtualLink: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Virtual link cannot exceed 500 characters'],
    },
    startDate: {
      type: Date,
      required: [true, 'Event start date is required'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    capacity: {
      type: Number,
      default: 0, // 0 = unlimited
      min: [0, 'Capacity cannot be negative'],
    },
    attendees: [attendeeSchema],
    attendeeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    coverImage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1, startDate: 1 });
eventSchema.index({ 'attendees.user': 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = {
  Event,
  EVENT_CATEGORIES,
  EVENT_FORMATS,
  RSVP_STATUSES,
};
