import React, { useState, useEffect } from 'react';
import { submitReport } from '../api/reportApi';

export const ReportModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleOpen = (e) => {
      setTargetType(e.detail.targetType);
      setTargetId(e.detail.targetId);
      setReason('spam');
      setDescription('');
      setError('');
      setIsOpen(true);
    };

    window.addEventListener('open-report-modal', handleOpen);
    return () => window.removeEventListener('open-report-modal', handleOpen);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await submitReport(targetType, targetId, reason, description);
      alert('Report submitted successfully.');
      setIsOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 style={{ marginBottom: '12px', borderBottom: '1px solid #000' }}>
          Report Content ({targetType})
        </h3>
        {error && <div className="error-indicator">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="spam">Spam / Advertising</option>
              <option value="harassment">Harassment / Bullying</option>
              <option value="hate">Hate Speech</option>
              <option value="misinformation">Misinformation</option>
              <option value="inappropriate">Inappropriate / NSFW</option>
              <option value="privacy">Privacy Violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more context..."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
            <button type="button" onClick={() => setIsOpen(false)} disabled={loading}>
              Cancel
            </button>
            <button type="submit" style={{ background: '#000', color: '#fff' }} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
