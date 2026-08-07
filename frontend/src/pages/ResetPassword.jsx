import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../api/authApi';

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await resetPassword(token, password);
      setSuccess(true);
      alert('Password has been reset successfully! Redirecting to login...');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
    <div className="auth-container">
      <h2>Reset Password</h2>
      {error && <div className="error-indicator">{error}</div>}
      {success && (
        <div style={{ padding: '10px', border: '1px solid #000', background: '#efe', color: '#060', marginBottom: '15px' }}>
          Password successfully reset. You can now login.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>New Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="form-group">
          <label>Confirm New Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" style={{ width: '100%', background: '#000', color: '#fff', marginTop: '10px' }} disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div style={{ marginTop: '15px', fontSize: '12px', textAlign: 'center' }}>
        <Link to="/login">Back to Login</Link>
      </div>
    </div>
    </div>
  );
};
export default ResetPassword;
