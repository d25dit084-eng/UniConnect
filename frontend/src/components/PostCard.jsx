import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../context/AuthContext';
import { votePost } from '../api/voteApi';
import { savePost, unsavePost } from '../api/savedApi';
import { deletePost } from '../api/postApi';
import { PollCard } from './PollCard';
import { renderContentWithMentions } from '../utils/mentionRenderer';

export const PostCard = ({ post: initialPost, onPostDeleted }) => {
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [isSaved, setIsSaved] = useState(initialPost.savedByMe || false);
  const isVotingRef = useRef(false);
  const isSavingRef = useRef(false);

  const cardRef = useRef(null);
  const upBtnRef = useRef(null);
  const downBtnRef = useRef(null);
  const scoreRef = useRef(null);
  const saveBtnRef = useRef(null);

  useEffect(() => {
    setPost(initialPost);
    if (initialPost.savedByMe !== undefined) {
      setIsSaved(initialPost.savedByMe);
    }
  }, [initialPost]);

  // GSAP card entrance animation
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 14, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, []);

  const handleVote = async (value) => {
    if (!isAuthenticated) return;
    if (isVotingRef.current) return;
    isVotingRef.current = true;

    // Trigger smooth micro-animation on arrow and score with GSAP
    const targetBtn = value === 1 ? upBtnRef.current : downBtnRef.current;
    if (targetBtn) {
      gsap.fromTo(
        targetBtn,
        { scale: 0.75 },
        { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }
      );
    }
    if (scoreRef.current) {
      gsap.fromTo(
        scoreRef.current,
        { y: value === 1 ? -4 : 4, scale: 1.15 },
        { y: 0, scale: 1, duration: 0.22, ease: 'back.out(2)' }
      );
    }

    // Snapshot current state for rollback
    const prevScore = post.score || 0;
    const prevVoteStatus = post.voteStatus || 0;

    // Calculate optimistic delta: if already voted same way, toggle to 0; else to value
    const targetStatus = prevVoteStatus === value ? 0 : value;
    const delta = targetStatus - prevVoteStatus;
    const optimisticScore = prevScore + delta;

    // Immediate optimistic update
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
      console.error('[Vote] Failed, rolling back:', err.message);
      // Rollback on error
      setPost((prev) => ({
        ...prev,
        score: prevScore,
        voteStatus: prevVoteStatus,
      }));
    } finally {
      isVotingRef.current = false;
    }
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    // GSAP micro-interaction on save toggle
    if (saveBtnRef.current) {
      gsap.fromTo(
        saveBtnRef.current,
        { scale: 0.8 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: 'back.out(2)' }
      );
    }

    // Snapshot current state for rollback
    const prevSaved = isSaved;
    const nextSaved = !prevSaved;

    // Immediate optimistic update
    setIsSaved(nextSaved);

    try {
      if (prevSaved) {
        await unsavePost(post._id);
      } else {
        await savePost(post._id);
      }
    } catch (err) {
      console.error('[Save] Failed, rolling back:', err.message);
      // Rollback on error
      setIsSaved(prevSaved);
    } finally {
      isSavingRef.current = false;
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

  const isOwner =
    user && post.author && (user._id === (post.author._id || post.author) || post.author?.isMine);
  const isAdmin = user && user.role === 'admin';
  const isAnonymous = Boolean(post.isAnonymous);
  const authorDisplay = isAnonymous
    ? post.author?.alias || 'Anonymous'
    : post.author?.username || '[deleted]';
  const isOP = Boolean(post.author?.isOP);
  const isMine = Boolean(post.author?.isMine) || isOwner;

  return (
    <div ref={cardRef} className="post-card">
      <div className="post-meta">
        {post.community && (
          <>
            <Link
              to={`/c/${post.community.slug || post.community.name}`}
              className="post-community-badge"
            >
              c/{post.community.name}
            </Link>
            <span>•</span>
          </>
        )}
        <span>Posted by</span>
        {isAnonymous ? (
          <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
            {authorDisplay}
            {isOP && <span className="post-badge-op">[OP]</span>}
            {isMine && <span className="post-badge-you">[you]</span>}
          </span>
        ) : (
          <Link to={`/u/${post.author?.username?.replace('u/', '') || 'deleted'}`}>
            {authorDisplay}
          </Link>
        )}
        <span>•</span>
        <span>{formatTime(post.createdAt)}</span>
      </div>

      <div className="post-title">
        <Link to={`/post/${post._id}`}>{post.title}</Link>
      </div>

      {post.type === 'text' && post.content && (
        <div className="post-content">
          {renderContentWithMentions(
            post.content.length > 300 ? `${post.content.slice(0, 300)}...` : post.content
          )}
        </div>
      )}

      {post.type === 'link' && post.url && (
        <div>
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
        <div className="post-media-container">
          <img
            src={
              post.media[0].startsWith('http')
                ? post.media[0]
                : `${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${post.media[0]}`
            }
            alt={post.title}
            width="600"
            height="338"
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {(post.type === 'poll' || post.poll) && (
        <PollCard
          post={post}
          onPollUpdated={(updated) => setPost((prev) => ({ ...prev, ...updated }))}
        />
      )}

      <div className="post-actions">
        <div className="vote-buttons">
          <button
            ref={upBtnRef}
            type="button"
            className={`vote-btn upvote ${post.voteStatus === 1 ? 'active' : ''}`}
            onClick={() => handleVote(1)}
            disabled={!isAuthenticated}
            title={isAuthenticated ? 'Upvote' : 'Log in to vote'}
            aria-label="Upvote"
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
          <span ref={scoreRef} className="vote-score">
            {post.score || 0}
          </span>
          <button
            ref={downBtnRef}
            type="button"
            className={`vote-btn downvote ${post.voteStatus === -1 ? 'active' : ''}`}
            onClick={() => handleVote(-1)}
            disabled={!isAuthenticated}
            title={isAuthenticated ? 'Downvote' : 'Log in to vote'}
            aria-label="Downvote"
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

        <Link to={`/post/${post._id}`} className="post-action-btn">
          💬 {post.commentCount || 0} {post.commentCount === 1 ? 'Comment' : 'Comments'}
        </Link>

        {isAuthenticated && (
          <button
            ref={saveBtnRef}
            type="button"
            onClick={handleSaveToggle}
            className="post-action-btn"
          >
            {isSaved ? '🔖 Saved' : '🔖 Save'}
          </button>
        )}

        {isAuthenticated && (isOwner || isAdmin) && (
          <button
            type="button"
            onClick={handleDelete}
            className="post-action-btn delete-btn"
          >
            🗑️ Delete
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
            className="post-action-btn"
          >
            🚩 Report
          </button>
        )}
      </div>
    </div>
  );
};
