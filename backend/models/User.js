const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in normal queries
    },
    avatar: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    department: {
      type: String,
      default: '',
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    year: {
      type: Number,
      default: null,
      min: [1, 'Year must be at least 1'],
      max: [6, 'Year cannot exceed 6'],
    },
    interests: {
      type: [String],
      default: [],
    },
    karma: {
      post: {
        type: Number,
        default: 0,
      },
      comment: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
      },
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpires: {
      type: Date,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    allowDirectMessages: {
      type: Boolean,
      default: true,
    },
    showOnlineStatus: {
      type: Boolean,
      default: true,
    },
    profileVisibility: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Pre-save Hook: Hash password ────────────────────────────────────────────
// Mongoose 9: async middleware does not receive next as a parameter — just return
userSchema.pre('save', async function () {
  // Only hash if password was actually modified (avoids double-hashing on other saves)
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});


// ─── Instance Method: Compare password ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance Method: Safe public profile (no secrets) ───────────────────────
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username.startsWith('u/') ? this.username : `u/${this.username}`,
    avatar: this.avatar || this.profileImage,
    bio: this.bio,
    karma: this.karma,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
