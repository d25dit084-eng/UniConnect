import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, uploadAvatar, getBlockedUsers, unblockUser } from '../api/userApi';

export const SettingsPage = () => {
  const { user, updateCurrentUser } = useAuth();

  const [bio, setBio] = useState('');
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [interests, setInterests] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await getProfile();
      const u = res.data.user;
      setBio(u.bio || '');
      setAllowDirectMessages(u.allowDirectMessages ?? true);
      setShowOnlineStatus(u.showOnlineStatus ?? true);
      setProfileVisibility(u.profileVisibility ?? true);
      setInterests(u.interests ? u.interests.join(', ') : '');

      const blocksRes = await getBlockedUsers();
      setBlockedUsers(blocksRes.data.blockedUsers || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // 1. Update basic profile info
      const parsedInterests = interests
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      const updateRes = await updateProfile({
        bio: bio.trim(),
        allowDirectMessages,
        showOnlineStatus,
        profileVisibility,
        interests: parsedInterests,
      });

      // 2. Upload avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('image', avatarFile);
        const avatarRes = await uploadAvatar(formData);
        updateRes.data.user.avatar = avatarRes.data.imageUrl;
      }

      updateCurrentUser(updateRes.data.user);
      alert('Settings updated successfully!');
      setAvatarFile(null);
      fetchSettings();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (username) => {
    try {
      await unblockUser(username);
      setBlockedUsers((prev) => prev.filter((u) => u.username !== username));
      alert(`Unblocked u/${username}`);
    } catch (err) {
      alert(`Unblock failed: ${err.message}`);
    }
  };

  if (loading) return <div className="loading-indicator">Loading settings...</div>;

  return (
    <div className="settings-card">
      <h2>Settings</h2>
      {error && <div className="error-indicator">{error}</div>}

      <form onSubmit={handleSave}>
        <h4 style={{ marginBottom: '10px', borderBottom: '1px dotted #000' }}>Public Information</h4>

        <div className="form-group">
          <label>Bio (max 500 chars)</label>
          <textarea
            rows="3"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write something about yourself..."
          />
        </div>

        <div className="form-group">
          <label>Interests (comma-separated list)</label>
          <input
            type="text"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="React, Mechanical, Board Games"
          />
        </div>

        <div className="form-group">
          <label>Profile Avatar Image</label>
          {user?.avatar && (
            <div style={{ margin: '5px 0' }}>
              <img
                src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`}
                alt="Avatar Preview"
                style={{ width: '50px', height: '50px', border: '1px solid #000' }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files[0])}
          />
        </div>

        <h4 style={{ margin: '20px 0 10px 0', borderBottom: '1px dotted #000' }}>Privacy & Communication</h4>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={allowDirectMessages}
              onChange={(e) => setAllowDirectMessages(e.target.checked)}
            />
            Allow private direct messages from other users
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
            />
            Show my online presence status in chat rooms
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.checked)}
            />
            Show my public profile in general search results
          </label>
        </div>

        <button type="submit" style={{ background: '#000', color: '#fff', marginTop: '10px' }} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Blocked Users Section */}
      <div className="settings-section">
        <h4>Blocked Users</h4>
        <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          Blocked users cannot send you private direct messages
        </p>

        {blockedUsers.length > 0 ? (
          <ul style={{ listStyle: 'none' }}>
            {blockedUsers.map((b) => (
              <li
                key={b._id}
                className="blocked-user-item"
              >
                <span>u/{b.username}</span>
                <button
                  type="button"
                  onClick={() => handleUnblock(b.username)}
                  style={{ fontSize: '11px', padding: '2px 5px', color: '#c00' }}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#888' }}>No blocked users.</p>
        )}
      </div>
    </div>
  );
};
export default SettingsPage;
