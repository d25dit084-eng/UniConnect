import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicProfile, getUserPosts, blockUser, unblockUser, getBlockedUsers } from '../api/userApi';
import { createConversation } from '../api/chatApi';
import { PostCard } from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

export const ProfilePage = () => {
  const { username } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');

  const bootstrap = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch public profile
      const res = await getPublicProfile(username);
      setProfile(res.data.user);
      setLoading(false);

      // 2. Fetch user posts
      setPostsLoading(true);
      const postsRes = await getUserPosts(username, 1, 20);
      setPosts(postsRes.data.posts || []);
      setPostsLoading(false);

      // 3. Check blocking status
      if (isAuthenticated && user) {
        const blocksRes = await getBlockedUsers();
        const blockedUserIds = new Set(blocksRes.data.blockedUsers.map((b) => b._id));
        setIsBlocked(blockedUserIds.has(res.data.user._id));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load profile');
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, [username]);

  const handleBlockToggle = async () => {
    if (!isAuthenticated) return;
    try {
      if (isBlocked) {
        await unblockUser(profile.username.replace('u/', ''));
        setIsBlocked(false);
        alert(`Unblocked u/${username}`);
      } else {
        await blockUser(profile.username.replace('u/', ''));
        setIsBlocked(true);
        alert(`Blocked u/${username}`);
      }
    } catch (err) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleMessageClick = async () => {
    if (!isAuthenticated) return;
    try {
      const cleanUsername = profile.username.replace('u/', '');
      const res = await createConversation(cleanUsername);
      navigate(`/chat/${res.data.conversation._id}`);
    } catch (err) {
      alert(`Cannot start chat: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  if (loading) return <div className="loading-indicator">Loading profile...</div>;
  if (error) return <div className="error-indicator">{error}</div>;
  if (!profile) return <div className="empty-indicator">Profile not found.</div>;

  const isSelf = user && profile._id === user._id;

  return (
    <div>
      {/* Profile Card */}
      <div className="community-header">
        <div className="profile-header-inner">
          <div className="profile-avatar">👤</div>

          <div className="profile-info">
            <h2 style={{ fontSize: '20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              {profile.username}
            </h2>
            <div style={{ fontSize: '12px', color: '#666666', margin: '4px 0' }}>
              Member since: {new Date(profile.createdAt).toLocaleDateString()}
            </div>
            {profile.bio && (
              <p style={{ fontSize: '13px', margin: '8px 0', fontStyle: 'italic', overflowWrap: 'break-word' }}>
                {profile.bio}
              </p>
            )}
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <strong>Karma:</strong> {profile.karma?.total || 0}
            </div>
          </div>

          {isAuthenticated && !isSelf && (
            <div className="profile-actions">
              <button type="button" onClick={handleMessageClick}>
                Message
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBlockToggle}
                style={{
                  color: isBlocked ? '#aa2d00' : '#1a1a1a',
                  borderColor: isBlocked ? '#aa2d00' : '#d2cfc9',
                }}
              >
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User's Posts Feed */}
      <h3 style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
        Posts by {profile.username}
      </h3>
      <div style={{ marginTop: '15px' }}>
        {postsLoading ? (
          <div className="loading-indicator">Loading user posts...</div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post._id} post={post} onPostDeleted={handlePostDeleted} />
          ))
        ) : (
          <div className="empty-indicator">This user hasn't published any posts yet.</div>
        )}
      </div>
    </div>
  );
};
export default ProfilePage;
