/**
 * Email Service
 *
 * Mocked for simplicity. Logs verification and password reset tokens directly to the server console.
 * This completely avoids external SMTP setup, email variables, and nodemailer dependencies.
 */

const sendEmail = async ({ to, subject, html, text }) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 EMAIL MOCKED (SMTP Disabled)');
  console.log(`To      : ${to}`);
  console.log(`Subject : ${subject}`);
  console.log(`Content :\n${text || html}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  return { messageId: 'mock-email-success' };
};

/**
 * Send a verification email with a token link.
 */
const sendVerificationEmail = async (to, token) => {
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: 'Verify your UniConnect account',
    html: `Verify your email: ${verifyUrl}\n\nToken: ${token}`,
    text: `Verify your email: ${verifyUrl}\n\nToken: ${token}\n\nExpires in 24 hours.`,
  });
};

/**
 * Send a password reset email.
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`;
  return sendEmail({
    to,
    subject: 'UniConnect Password Reset',
    html: `Reset your password: ${resetUrl}\n\nToken: ${token}`,
    text: `Reset your password: ${resetUrl}\n\nToken: ${token}\n\nExpires in 30 minutes.`,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
