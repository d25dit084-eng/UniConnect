const ApiError = require('../utils/ApiError');

// ─── Regex ────────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
// Min 8 chars, at least one uppercase, one lowercase, one number, one special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// ─── Validate Register ────────────────────────────────────────────────────────

const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
  } else if (username.trim().length < 3 || username.trim().length > 30) {
    errors.push('Username must be between 3 and 30 characters');
  } else if (!USERNAME_REGEX.test(username.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    );
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

// ─── Validate Login ───────────────────────────────────────────────────────────

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

// ─── Validate Forgot Password ─────────────────────────────────────────────────

const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return next(new ApiError(400, 'Please provide a valid email address'));
  }

  next();
};

// ─── Validate Reset Password ──────────────────────────────────────────────────

const validateResetPassword = (req, res, next) => {
  const { password } = req.body;

  if (!password || !PASSWORD_REGEX.test(password)) {
    return next(
      new ApiError(
        400,
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      )
    );
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};
