import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPostDetails, deletePost } from '../api/postApi';
import { createComment, getPostComments, replyToComment, updateComment, deleteComment } from '../api/commentApi';
import { votePost, voteComment } from '../api/voteApi';
import { savePost, unsavePost } from '../api/savedApi';
import { useAuth } from '../context/AuthContext';

// ─── Comment Node Component (Recursive) ──────────────────────────────────────────
const CommentNode = ({ comment, onCommentAction, depth = 0 }) => {
  const { user, isAuthenticated } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleVote = async (value) => {
    if (!isAuthenticated) return;
    try {
      const res = await voteComment(comment._id, value);
      onCommentAction(); // trigger refresh to update tree
    } catch (err) {
      console.error('[VoteComment] Action failed:', err.message);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      await replyToComment(comment._id, replyContent.trim());
      setReplyContent('');
      setIsReplying(false);
      onCommentAction(); // refresh
    } catch (err) {
      alert(`Reply failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    try {
      await updateComment(comment._id, editContent.trim());
      setIsEditing(false);
      onCommentAction(); // refresh
    } catch (err) {
      alert(`Edit failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(comment._id);
      onCommentAction(); // refresh
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const isOwner = user && comment.author && user._id === (comment.author._id || comment.author);
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="comment-item" style={{ marginLeft: depth > 0 ? `${Math.min(depth, 3) * 14}px` : '0' }}>
      <div className="comment-author-meta">
        <Link to={`/u/${comment.author?.username?.replace('u/', '') || 'deleted'}`}>
          {comment.author?.username || '[deleted]'}
        </Link>{' '}
        • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>

      {isEditing ? (
        <form onSubmit={handleEditSubmit} style={{ marginTop: '5px' }}>
          <textarea
            required
            rows="2"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
          <div style={{ marginTop: '4px', display: 'flex', gap: '5px' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit" style={{ background: '#000', color: '#fff' }}>Save</button>
          </div>
        </form>
      ) : (
        <div className="comment-body">{comment.content}</div>
      )}

      {!isEditing && (
        <div className="comment-actions">
          <div className="vote-buttons" style={{ display: 'inline-flex' }}>
            <button
              type="button"
              className={`vote-btn ${comment.voteStatus === 1 ? 'active' : ''}`}
              onClick={() => handleVote(1)}
              disabled={!isAuthenticated}
              style={{ fontSize: '11px', padding: '1px 4px' }}
            >
              ▲
            </button>
            <span style={{ fontSize: '11px', margin: '0 4px', color: '#1a1a1a' }}>{comment.score}</span>
            <button
              type="button"
              className={`vote-btn ${comment.voteStatus === -1 ? 'active' : ''}`}
              onClick={() => handleVote(-1)}
              disabled={!isAuthenticated}
              style={{ fontSize: '11px', padding: '1px 4px' }}
            >
              ▼
            </button>
          </div>

          {isAuthenticated && depth < 8 && !comment.isDeleted && (
            <button
              type="button"
              onClick={() => setIsReplying(!isReplying)}
              style={{ border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              Reply
            </button>
          )}

          {isAuthenticated && isOwner && !comment.isDeleted && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              style={{ border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              Edit
            </button>
          )}

          {isAuthenticated && (isOwner || isAdmin) && !comment.isDeleted && (
            <button
              type="button"
              onClick={handleDelete}
              style={{ color: '#c00', border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              Delete
            </button>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('open-report-modal', {
                    detail: { targetType: 'comment', targetId: comment._id },
                  })
                );
              }}
              style={{ border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              Report
            </button>
          )}
        </div>
      )}

      {/* Inline Reply Form */}
      {isReplying && (
        <form onSubmit={handleReplySubmit} className="reply-form">
          <textarea
            required
            rows="2"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
          />
          <div className="form-btn-row">
            <button type="button" onClick={() => setIsReplying(false)}>Cancel</button>
            <button type="submit" style={{ background: '#000', color: '#fff' }}>Submit Reply</button>
          </div>
        </form>
      )}

      {/* Recursive Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply._id}
              comment={reply}
              onCommentAction={onCommentAction}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Post Detail Page Component ─────────────────────────────────────────────
export const PostDetailPage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPostAndComments = async () => {
    try {
      const postRes = await getPostDetails(id);
      setPost(postRes.data.post);
      setIsSaved(postRes.data.post.savedByMe || false);
      setLoading(false);

      const commentsRes = await getPostComments(id);
      setComments(commentsRes.data.comments || []);
      setCommentsLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load post');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostAndComments();
  }, [id]);

  const handlePostVote = async (value) => {
    if (!isAuthenticated) return;
    try {
      const res = await votePost(post._id, value);
      setPost((prev) => ({
        ...prev,
        score: res.data.score,
        voteStatus: res.data.voteStatus,
      }));
    } catch (err) {
      console.error('[VotePost] Error:', err.message);
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
      console.error('[SavePost] Error:', err.message);
    }
  };

  const handlePostDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(post._id);
      alert('Post deleted.');
      navigate('/home');
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await createComment(post._id, newComment.trim());
      setNewComment('');
      // Reload comments
      const commentsRes = await getPostComments(post._id);
      setComments(commentsRes.data.comments || []);
    } catch (err) {
      alert(`Failed to post comment: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) return <div className="loading-indicator">Loading post details...</div>;
  if (error) return <div className="error-indicator">{error}</div>;
  if (!post) return <div className="empty-indicator">Post not found.</div>;

  const isOwner = user && post.author && user._id === (post.author._id || post.author);
  const isAdmin = user && user.role === 'admin';

  return (
    <div>
      {/* Post Detail Body */}
      <div className="post-detail-card">
        <div className="post-meta">
          {post.community && (
            <Link to={`/c/${post.community.slug}`} style={{ fontWeight: 'bold' }}>
              c/{post.community.name}
            </Link>
          )}
          {' • '}Posted by{' '}
          <Link to={`/u/${post.author?.username?.replace('u/', '') || 'deleted'}`}>
            {post.author?.username || '[deleted]'}
          </Link>{' '}
          • {new Date(post.createdAt).toLocaleString()}
        </div>

        <h2 style={{ fontSize: '20px', margin: '8px 0', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{post.title}</h2>

        {post.type === 'text' && post.content && (
          <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', margin: '15px 0', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {post.content}
          </div>
        )}

        {post.type === 'link' && post.url && (
          <div style={{ margin: '15px 0', overflowWrap: 'break-word', wordBreak: 'break-all' }}>
            🔗 <a href={post.url} target="_blank" rel="noopener noreferrer">{post.url}</a>
          </div>
        )}

        {post.type === 'image' && post.media && post.media.length > 0 && (
          <div style={{ margin: '15px 0', textAlign: 'center' }}>
            <img
              src={post.media[0].startsWith('http') ? post.media[0] : `http://localhost:5000${post.media[0]}`}
              alt={post.title}
              className="post-image"
              style={{ maxHeight: '500px', margin: '0 auto' }}
            />
          </div>
        )}

        <div className="post-detail-actions">
          <div className="vote-buttons">
            <button
              type="button"
              className={`vote-btn ${post.voteStatus === 1 ? 'active' : ''}`}
              onClick={() => handlePostVote(1)}
              disabled={!isAuthenticated}
            >
              ▲
            </button>
            <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{post.score}</span>
            <button
              type="button"
              className={`vote-btn ${post.voteStatus === -1 ? 'active' : ''}`}
              onClick={() => handlePostVote(-1)}
              disabled={!isAuthenticated}
            >
              ▼
            </button>
          </div>

          <span style={{ fontSize: '12px' }}>
            👁️ {post.viewCount || 0} View(s)
          </span>

          {isAuthenticated && (
            <button
              type="button"
              onClick={handleSaveToggle}
              style={{ border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              {isSaved ? 'Unsave Post' : 'Save Post'}
            </button>
          )}

          {isAuthenticated && (isOwner || isAdmin) && (
            <button
              type="button"
              onClick={handlePostDelete}
              style={{ color: '#c00', border: 'none', background: 'none', textDecoration: 'underline', padding: 0 }}
            >
              Delete Post
            </button>
          )}
        </div>
      </div>

      {/* Comment Input */}
      {isAuthenticated ? (
        <form onSubmit={handleCommentSubmit} className="comment-input-area" style={{ border: '1px solid #000', padding: '12px', background: '#fafafa' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>
            Write a comment
          </label>
          <textarea
            required
            rows="3"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="What are your thoughts on this post?"
          />
          <button type="submit" style={{ background: '#000', color: '#fff', marginTop: '8px' }}>
            Submit Comment
          </button>
        </form>
      ) : (
        <div style={{ padding: '10px', border: '1px dashed #000', textAlign: 'center', fontSize: '13px' }}>
          Please <Link to="/login">login</Link> to join the discussion.
        </div>
      )}

      {/* Threaded Comments List */}
      <div className="comment-thread-container">
        <h3>Discussion ({comments.length} comment chain(s))</h3>

        {commentsLoading ? (
          <div className="loading-indicator">Loading comments...</div>
        ) : comments.length > 0 ? (
          comments.map((comm) => (
            <CommentNode
              key={comm._id}
              comment={comm}
              onCommentAction={fetchPostAndComments}
            />
          ))
        ) : (
          <div className="empty-indicator" style={{ marginTop: '10px' }}>
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
    </div>
  );
};
export default PostDetailPage;
