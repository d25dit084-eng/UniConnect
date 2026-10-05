import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import { getPostDetails, deletePost } from '../api/postApi';
import {
  createComment,
  getPostComments,
  replyToComment,
  updateComment,
  deleteComment,
} from '../api/commentApi';
import { votePost, voteComment } from '../api/voteApi';
import { savePost, unsavePost } from '../api/savedApi';
import { useAuth } from '../context/AuthContext';
import { PollCard } from '../components/PollCard';
import { renderContentWithMentions } from '../utils/mentionRenderer';
import { MentionTextarea } from '../components/MentionTextarea';

// ─── Comment Node Component (Recursive) ──────────────────────────────────────────
const CommentNode = ({ comment, onCommentAction, depth = 0 }) => {
  const { user, isAuthenticated } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyIsAnonymous, setReplyIsAnonymous] = useState(false);
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
      await replyToComment(comment._id, replyContent.trim(), replyIsAnonymous);
      setReplyContent('');
      setReplyIsAnonymous(false);
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

  const isOwner =
    user &&
    comment.author &&
    (user._id === (comment.author._id || comment.author) || comment.author?.isMine);
  const isAdmin = user && user.role === 'admin';
  const isAnonymous = Boolean(comment.isAnonymous);
  const authorDisplay = isAnonymous
    ? comment.author?.alias || 'Anonymous'
    : comment.author?.username || '[deleted]';
  const isOP = Boolean(comment.author?.isOP);
  const isMine = Boolean(comment.author?.isMine) || isOwner;

  return (
    <div
      className="comment-item"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth, 3) * 14}px` : '0' }}
    >
      <div className="comment-author-meta">
        {isAnonymous ? (
          <span style={{ fontStyle: 'italic', color: '#888' }}>
            {authorDisplay}
            {isOP && (
              <span
                style={{
                  marginLeft: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#4f8ef7',
                  letterSpacing: '0.5px',
                }}
              >
                [OP]
              </span>
            )}
            {isMine && (
              <span
                style={{
                  marginLeft: '4px',
                  fontSize: '10px',
                  color: '#6c6',
                  fontWeight: 700,
                }}
              >
                [you]
              </span>
            )}
          </span>
        ) : (
          <>
            <Link to={`/u/${comment.author?.username?.replace('u/', '') || 'deleted'}`}>
              {authorDisplay}
            </Link>
            {isOP && (
              <span
                style={{
                  marginLeft: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#4f8ef7',
                  letterSpacing: '0.5px',
                }}
              >
                [OP]
              </span>
            )}
          </>
        )}{' '}
        •{' '}
        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" style={{ background: '#000', color: '#fff' }}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-body">{renderContentWithMentions(comment.content)}</div>
      )}

      {!isEditing && (
        <div className="comment-actions">
          <div className="vote-buttons" style={{ display: 'inline-flex' }}>
            <button
              type="button"
              className={`vote-btn upvote ${comment.voteStatus === 1 ? 'active' : ''}`}
              onClick={(e) => {
                if (e.currentTarget) {
                  gsap.fromTo(
                    e.currentTarget,
                    { scale: 0.75 },
                    { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }
                  );
                }
                handleVote(1);
              }}
              disabled={!isAuthenticated}
              style={{ fontSize: '11px', padding: '2px 4px' }}
              title={isAuthenticated ? 'Upvote comment' : 'Log in to vote'}
              aria-label="Upvote comment"
            >
              <svg
                className="vote-arrow"
                style={{ width: '12px', height: '12px' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <span className="vote-score" style={{ fontSize: '11px', minWidth: '18px' }}>
              {comment.score}
            </span>
            <button
              type="button"
              className={`vote-btn downvote ${comment.voteStatus === -1 ? 'active' : ''}`}
              onClick={(e) => {
                if (e.currentTarget) {
                  gsap.fromTo(
                    e.currentTarget,
                    { scale: 0.75 },
                    { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }
                  );
                }
                handleVote(-1);
              }}
              disabled={!isAuthenticated}
              style={{ fontSize: '11px', padding: '2px 4px' }}
              title={isAuthenticated ? 'Downvote comment' : 'Log in to vote'}
              aria-label="Downvote comment"
            >
              <svg
                className="vote-arrow"
                style={{ width: '12px', height: '12px' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {isAuthenticated && depth < 8 && !comment.isDeleted && (
            <button
              type="button"
              onClick={() => setIsReplying(!isReplying)}
              style={{
                border: 'none',
                background: 'none',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Reply
            </button>
          )}

          {isAuthenticated && isOwner && !comment.isDeleted && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              style={{
                border: 'none',
                background: 'none',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Edit
            </button>
          )}

          {isAuthenticated && (isOwner || isAdmin) && !comment.isDeleted && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                color: '#c00',
                border: 'none',
                background: 'none',
                textDecoration: 'underline',
                padding: 0,
              }}
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
              style={{
                border: 'none',
                background: 'none',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Report
            </button>
          )}
        </div>
      )}

      {/* Inline Reply Form */}
      {isReplying && (
        <form onSubmit={handleReplySubmit} className="reply-form">
          <MentionTextarea
            required
            rows={2}
            value={replyContent}
            onChange={setReplyContent}
            placeholder="Write a reply (type @ to mention)..."
          />
          <div style={{ margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              id={`anon-reply-${comment._id}`}
              checked={replyIsAnonymous}
              onChange={(e) => setReplyIsAnonymous(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label
              htmlFor={`anon-reply-${comment._id}`}
              style={{ fontSize: '11px', color: '#666', cursor: 'pointer' }}
            >
              Reply anonymously
            </label>
          </div>
          <div className="form-btn-row">
            <button type="button" onClick={() => setIsReplying(false)}>
              Cancel
            </button>
            <button type="submit" style={{ background: '#000', color: '#fff' }}>
              Submit Reply
            </button>
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
  const [commentIsAnonymous, setCommentIsAnonymous] = useState(false);
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

  const detailCardRef = useRef(null);
  const postUpBtnRef = useRef(null);
  const postDownBtnRef = useRef(null);
  const postScoreRef = useRef(null);
  const postSaveBtnRef = useRef(null);

  useEffect(() => {
    if (detailCardRef.current) {
      gsap.fromTo(
        detailCardRef.current,
        { opacity: 0, y: 14, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }
      );
    }
  }, [post?._id]);

  const handlePostVote = async (value) => {
    if (!isAuthenticated || !post) return;

    // Trigger smooth micro-animation on arrow and score with GSAP
    const targetBtn = value === 1 ? postUpBtnRef.current : postDownBtnRef.current;
    if (targetBtn) {
      gsap.fromTo(
        targetBtn,
        { scale: 0.75 },
        { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }
      );
    }
    if (postScoreRef.current) {
      gsap.fromTo(
        postScoreRef.current,
        { y: value === 1 ? -4 : 4, scale: 1.15 },
        { y: 0, scale: 1, duration: 0.22, ease: 'back.out(2)' }
      );
    }

    // Snapshot current state for rollback
    const prevScore = post.score || 0;
    const prevVoteStatus = post.voteStatus || 0;

    // Calculate optimistic delta
    const targetStatus = prevVoteStatus === value ? 0 : value;
    const delta = targetStatus - prevVoteStatus;
    const optimisticScore = prevScore + delta;

    // 1. Immediate optimistic update
    setPost((prev) => ({
      ...prev,
      score: optimisticScore,
      voteStatus: targetStatus,
    }));

    try {
      const res = await votePost(post._id, value);
      if (res?.data) {
        setPost((prev) => ({
          ...prev,
          score: res.data.score,
          voteStatus: res.data.voteStatus,
        }));
      }
    } catch (err) {
      console.error('[VotePost] Error, rolling back:', err.message);
      // 2. Rollback on error
      setPost((prev) => ({
        ...prev,
        score: prevScore,
        voteStatus: prevVoteStatus,
      }));
    }
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated || !post) return;

    // GSAP micro-interaction on save toggle
    if (postSaveBtnRef.current) {
      gsap.fromTo(
        postSaveBtnRef.current,
        { scale: 0.8 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: 'back.out(2)' }
      );
    }

    // Snapshot current state for rollback
    const prevSaved = isSaved;
    const nextSaved = !prevSaved;

    // 1. Immediate optimistic update
    setIsSaved(nextSaved);

    try {
      if (prevSaved) {
        await unsavePost(post._id);
      } else {
        await savePost(post._id);
      }
    } catch (err) {
      console.error('[SavePost] Error, rolling back:', err.message);
      // 2. Rollback on error
      setIsSaved(prevSaved);
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
      await createComment(post._id, newComment.trim(), commentIsAnonymous);
      setNewComment('');
      setCommentIsAnonymous(false);
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

  const isOwner =
    user && post.author && (user._id === (post.author._id || post.author) || post.author?.isMine);
  const isAdmin = user && user.role === 'admin';
  const isPostAnonymous = Boolean(post.isAnonymous);
  const postAuthorDisplay = isPostAnonymous
    ? post.author?.alias || 'Anonymous'
    : post.author?.username || '[deleted]';
  const isPostOP = Boolean(post.author?.isOP);
  const isPostMine = Boolean(post.author?.isMine) || isOwner;

  return (
    <div>
      {/* Post Detail Body (Dark Grey Glassmorphism) */}
      <div ref={detailCardRef} className="post-detail-card">
        <div className="post-meta">
          {post.community && (
            <>
              <Link to={`/c/${post.community.slug}`} className="post-community-badge">
                c/{post.community.name}
              </Link>
              <span>•</span>
            </>
          )}
          <span>Posted by</span>
          {isPostAnonymous ? (
            <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
              {postAuthorDisplay}
              {isPostOP && <span className="post-badge-op">[OP]</span>}
              {isPostMine && <span className="post-badge-you">[you]</span>}
            </span>
          ) : (
            <Link to={`/u/${post.author?.username?.replace('u/', '') || 'deleted'}`}>
              {postAuthorDisplay}
            </Link>
          )}
          <span>•</span>
          <span>{new Date(post.createdAt).toLocaleString()}</span>
        </div>

        <h2
          style={{
            fontSize: '20px',
            margin: '8px 0',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            color: '#f8fafc',
          }}
        >
          {post.title}
        </h2>

        {post.type === 'text' && post.content && (
          <div
            style={{
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              margin: '15px 0',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            {renderContentWithMentions(post.content)}
          </div>
        )}

        {post.type === 'link' && post.url && (
          <div style={{ margin: '15px 0' }}>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="post-link-pill"
            >
              <span>🔗</span>
              <span>{post.url}</span>
            </a>
          </div>
        )}

        {post.type === 'image' && post.media && post.media.length > 0 && (
          <div className="post-media-container" style={{ maxWidth: '800px', margin: '15px auto' }}>
            <img
              src={
                post.media[0].startsWith('http')
                  ? post.media[0]
                  : `${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${post.media[0]}`
              }
              alt={post.title}
              width="800"
              height="450"
              className="post-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {(post.type === 'poll' || post.poll) && (
          <PollCard
            post={post}
            onPollUpdated={(updated) => setPost((prev) => ({ ...prev, ...updated }))}
          />
        )}

        <div className="post-detail-actions">
          <div className="vote-buttons">
            <button
              ref={postUpBtnRef}
              type="button"
              className={`vote-btn upvote ${post.voteStatus === 1 ? 'active' : ''}`}
              onClick={() => handlePostVote(1)}
              disabled={!isAuthenticated}
              title={isAuthenticated ? 'Upvote post' : 'Log in to vote'}
              aria-label="Upvote post"
            >
              <svg
                className="vote-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <span ref={postScoreRef} className="vote-score">
              {post.score || 0}
            </span>
            <button
              ref={postDownBtnRef}
              type="button"
              className={`vote-btn downvote ${post.voteStatus === -1 ? 'active' : ''}`}
              onClick={() => handlePostVote(-1)}
              disabled={!isAuthenticated}
              title={isAuthenticated ? 'Downvote post' : 'Log in to vote'}
              aria-label="Downvote post"
            >
              <svg
                className="vote-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <span className="post-action-btn" style={{ cursor: 'default' }}>
            👁️ {post.viewCount || 0} View(s)
          </span>

          {isAuthenticated && (
            <button
              ref={postSaveBtnRef}
              type="button"
              onClick={handleSaveToggle}
              className="post-action-btn"
            >
              {isSaved ? '🔖 Unsave Post' : '🔖 Save Post'}
            </button>
          )}

          {isAuthenticated && (isOwner || isAdmin) && (
            <button
              type="button"
              onClick={handlePostDelete}
              className="post-action-btn delete-btn"
            >
              🗑️ Delete Post
            </button>
          )}
        </div>
      </div>

      {/* Comment Input */}
      {isAuthenticated ? (
        <form
          onSubmit={handleCommentSubmit}
          className="comment-input-area"
          style={{ border: '1px solid #000', padding: '12px', background: '#fafafa' }}
        >
          <label
            style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}
          >
            Write a comment
          </label>
          <MentionTextarea
            required
            rows={3}
            value={newComment}
            onChange={setNewComment}
            placeholder="What are your thoughts on this post? (type @ to mention)"
          />
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#666',
              }}
            >
              <input
                type="checkbox"
                checked={commentIsAnonymous}
                onChange={(e) => setCommentIsAnonymous(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Comment anonymously
            </label>
            <button type="submit" style={{ background: '#000', color: '#fff' }}>
              {commentIsAnonymous ? '👻 Submit Anonymously' : 'Submit Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            padding: '10px',
            border: '1px dashed #000',
            textAlign: 'center',
            fontSize: '13px',
          }}
        >
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
            <CommentNode key={comm._id} comment={comm} onCommentAction={fetchPostAndComments} />
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
