/**
 * Email Service
 *
 * Uses Nodemailer for SMTP email sending.
 * In development (when EMAIL_HOST is not configured), tokens are logged
 * to the console instead of sending real emails so the server never crashes.
 *
 * To enable real email: set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in .env
 */

const sendEmail = async ({ to, subject, html, text }) => {
  const isEmailConfigured =
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS;

  if (!isEmailConfigured) {
    // ── Development fallback ─────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 DEV EMAIL MOCK (SMTP not configured)');
    console.log(`To      : ${to}`);
    console.log(`Subject : ${subject}`);
    console.log(`Content :\n${text || html}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { messageId: 'dev-mock-email' };
  }

  // ── Production: real SMTP ───────────────────────────────────────────────────
  // Lazy-require nodemailer so missing SMTP config doesn't crash on startup
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@uniconnect.dev',
    to,
    subject,
    text,
    html,
  });

  return info;
};

/**
 * Send a verification email with a token link.
 */
const sendVerificationEmail = async (to, token) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: 'Verify your UniConnect account',
    html: `
      <h2>Welcome to UniConnect!</h2>
      <p>Click the link below to verify your student account:</p>
      <a href="${verifyUrl}" style="background:#6c63ff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
        Verify Email
      </a>
      <p>Or copy this token: <strong>${token}</strong></p>
      <p>This link expires in 24 hours.</p>
    `,
    text: `Verify your email: ${verifyUrl}\n\nToken: ${token}\n\nExpires in 24 hours.`,
  });
};

/**
 * Send a password reset email.
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
  return sendEmail({
    to,
    subject: 'UniConnect Password Reset',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background:#6c63ff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
        Reset Password
      </a>
      <p>Or copy this token: <strong>${token}</strong></p>
      <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}\n\nToken: ${token}\n\nExpires in 30 minutes.`,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
