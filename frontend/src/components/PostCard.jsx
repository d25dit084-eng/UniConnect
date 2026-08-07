import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { votePost } from '../api/voteApi';
import { savePost, unsavePost } from '../api/savedApi';
import { deletePost } from '../api/postApi';

export const PostCard = ({ post: initialPost, onPostDeleted }) => {
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [isSaved, setIsSaved] = useState(post.savedByMe || false);

  const handleVote = async (value) => {
    if (!isAuthenticated) return;
    try {
      // API call returns new score and updated status
      const res = await votePost(post._id, value);
      setPost((prev) => ({
        ...prev,
        score: res.data.score,
        voteStatus: res.data.voteStatus,
      }));
    } catch (err) {
      console.error('[Vote] Failed to register vote:', err.message);
    }
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated) return;
    try {
      if (isSaved) {
        await unsavePost(post._id);
        setIsSaved(false);
      } else {
        await savePost(post._id);
        setIsSaved(true);
      }
    } catch (err) {
      console.error('[Save] Failed to toggle save:', err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(post._id);
      if (onPostDeleted) onPostDeleted(post._id);
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const formatTime = (dateStr) => {
    const diffMs = new Date() - new Date(dateStr);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const isOwner = user && post.author && user._id === (post.author._id || post.author);
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="post-card">
      <div className="post-meta">
        {post.community && (
          <>
            <Link to={`/c/${post.community.slug || post.community.name}`} style={{ fontWeight: 'bold' }}>
              c/{post.community.name}
            </Link>
            {' • '}
          </>
        )}
        Posted by{' '}
        <Link to={`/u/${post.author?.username?.replace('u/', '') || 'deleted'}`}>
          {post.author?.username || '[deleted]'}
        </Link>{' '}
        • {formatTime(post.createdAt)}
      </div>

      <div className="post-title">
        <Link to={`/post/${post._id}`}>{post.title}</Link>
      </div>

      {post.type === 'text' && post.content && (
        <div className="post-content">
          {post.content.length > 300 ? `${post.content.slice(0, 300)}...` : post.content}
        </div>
      )}

      {post.type === 'link' && post.url && (
        <div style={{ margin: '8px 0' }}>
          <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px' }}>
            🔗 {post.url}
          </a>
        </div>
      )}

      {post.type === 'image' && post.media && post.media.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <img
            src={post.media[0].startsWith('http') ? post.media[0] : `${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${post.media[0]}`}
            alt={post.title}
            style={{ maxWidth: '100%', maxHeight: '400px', border: '1px solid #e2e0db' }}
          />
        </div>
      )}

      <div className="post-actions">
        <div className="vote-buttons">
          <button
            type="button"
            className={`vote-btn ${post.voteStatus === 1 ? 'active' : ''}`}
            onClick={() => handleVote(1)}
            disabled={!isAuthenticated}
          >
            ▲
          </button>
          <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>
            {post.score}
          </span>
          <button
            type="button"
            className={`vote-btn ${post.voteStatus === -1 ? 'active' : ''}`}
            onClick={() => handleVote(-1)}
            disabled={!isAuthenticated}
          >
            ▼
          </button>
        </div>

        <Link to={`/post/${post._id}`} style={{ textDecoration: 'none' }}>
          💬 {post.commentCount || 0} Comment(s)
        </Link>

        {isAuthenticated && (
          <button
            type="button"
            onClick={handleSaveToggle}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            {isSaved ? '🔖 Saved' : '🔖 Save'}
          </button>
        )}

        {isAuthenticated && (isOwner || isAdmin) && (
          <button
            type="button"
            onClick={handleDelete}
            style={{ color: '#aa2d00', border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
          >
            Delete
          </button>
        )}

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              // Dispatch event to show report modal
              window.dispatchEvent(
                new CustomEvent('open-report-modal', {
                  detail: { targetType: 'post', targetId: post._id },
                })
              );
            }}
            style={{ border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
          >
            Report
          </button>
        )}
      </div>
    </div>
  );
};
