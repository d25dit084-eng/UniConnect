import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCommunity } from '../api/communityApi';

export const CreateCommunity = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Client-side regex check for name (alphanumeric + underscores)
    const nameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nameRegex.test(name)) {
      setError('Community name can only contain letters, numbers, and underscores.');
      setLoading(false);
      return;
    }

    try {
      const res = await createCommunity({
        name: name.toLowerCase().trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        visibility,
      });
      const newSlug = res.data.community.slug;
      alert('Community created successfully!');
      // Refresh sidebar list
      window.dispatchEvent(new Event('community-joined-change'));
      navigate(`/c/${newSlug}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', border: '1px solid #000', padding: '20px', background: '#fff' }}>
      <h2 style={{ marginBottom: '15px', borderBottom: '1px solid #000', paddingBottom: '5px' }}>
        Create Community
      </h2>
      {error && <div className="error-indicator">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Community URL Path (e.g. c/programming)</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="programming"
          />
          <span style={{ fontSize: '10px', color: '#666' }}>
            Lowercase letters, numbers, underscores only. Cannot contain spaces.
          </span>
        </div>

        <div className="form-group">
          <label>Display Name</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Programming & Computer Science"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            required
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A place for web devs, software engineers, and homework helpers..."
          />
        </div>

        <div className="form-group">
          <label>Visibility</label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public (Anyone can view, join, and post)</option>
            <option value="restricted">Restricted (Anyone can view, members can post)</option>
            <option value="private">Private (Only approved members can view/post)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </button>
          <button type="submit" style={{ background: '#000', color: '#fff' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Community'}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreateCommunity;
