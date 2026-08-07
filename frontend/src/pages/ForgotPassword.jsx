import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
    <div className="auth-container">
      <h2>Forgot Password</h2>
      {error && <div className="error-indicator">{error}</div>}
      {success && (
        <div style={{ padding: '10px', border: '1px solid #000', background: '#efe', color: '#060', marginBottom: '15px' }}>
          If that email is registered, we have sent a reset password link.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>College Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@college.edu"
          />
        </div>

        <button type="submit" style={{ width: '100%', background: '#000', color: '#fff', marginTop: '10px' }} disabled={loading}>
          {loading ? 'Submitting...' : 'Send Reset Link'}
        </button>
      </form>

      <div style={{ marginTop: '15px', fontSize: '12px', textAlign: 'center' }}>
        <Link to="/login">Back to Login</Link>
      </div>
    </div>
    </div>
  );
};
export default ForgotPassword;
