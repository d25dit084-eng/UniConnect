import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useAuth } from '../context/AuthContext';
import { votePoll } from '../api/postApi';

export const PollCard = ({ post, onPollUpdated }) => {
  const { isAuthenticated } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [poll, setPoll] = useState(post.poll || null);
  const [userVotedOptionId, setUserVotedOptionId] = useState(post.userVotedOptionId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const submitBtnRef = useRef(null);

  if (!poll || !Array.isArray(poll.options) || poll.options.length === 0) {
    return null;
  }

  const isExpired = Boolean(poll.expiresAt && new Date(poll.expiresAt) < new Date());
  const hasVoted = Boolean(userVotedOptionId);
  const showResults = hasVoted || isExpired || !isAuthenticated;
  const totalVotes = poll.totalVotes || 0;

  const formatTimeRemaining = () => {
    if (!poll.expiresAt) return 'Open poll';
    const diffMs = new Date(poll.expiresAt) - new Date();
    if (diffMs <= 0) return 'Final results • Poll closed';
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `Ends in ${Math.max(1, diffHours)} hour${diffHours === 1 ? '' : 's'}`;
    const diffDays = Math.floor(diffHours / 24);
    return `Ends in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  };

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please log in to vote in this poll.');
      return;
    }
    if (!selectedOptionId || isSubmitting) return;

    if (submitBtnRef.current) {
      gsap.fromTo(
        submitBtnRef.current,
        { scale: 0.9 },
        { scale: 1.05, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }
      );
    }

    setIsSubmitting(true);
    setError('');

    // Optimistic snapshot
    const prevPoll = poll;
    const prevVoted = userVotedOptionId;

    // Optimistic calculation
    const updatedOptions = poll.options.map((opt) =>
      opt._id === selectedOptionId
        ? { ...opt, voteCount: (opt.voteCount || 0) + 1 }
        : opt
    );
    const optimisticPoll = {
      ...poll,
      options: updatedOptions,
      totalVotes: (poll.totalVotes || 0) + 1,
    };

    setPoll(optimisticPoll);
    setUserVotedOptionId(selectedOptionId);

    try {
      const res = await votePoll(post._id, selectedOptionId);
      if (res?.data?.poll) {
        setPoll(res.data.poll);
        setUserVotedOptionId(res.data.userVotedOptionId || selectedOptionId);
        if (onPollUpdated) {
          onPollUpdated({
            poll: res.data.poll,
            userVotedOptionId: res.data.userVotedOptionId || selectedOptionId,
          });
        }
      }
    } catch (err) {
      // Rollback on error
      setPoll(prevPoll);
      setUserVotedOptionId(prevVoted);
      setError(err.response?.data?.message || err.message || 'Failed to submit vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={pollRef} className="poll-container">
      <div className="poll-question">
        <span>📊</span>
        <span>{poll.question || post.title}</span>
      </div>

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#f87171',
            marginBottom: '10px',
            padding: '6px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
          }}
        >
          {error}
        </div>
      )}

      {showResults ? (
        // Results View
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {poll.options.map((opt) => {
            const count = opt.voteCount || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isMyVote = userVotedOptionId && userVotedOptionId.toString() === opt._id.toString();

            return (
              <div
                key={opt._id}
                className={`poll-option-result ${isMyVote ? 'my-vote' : ''}`}
              >
                {/* Background progress fill */}
                <div
                  className="poll-progress-fill"
                  style={{ width: `${pct}%` }}
                />

                {/* Option text and badges */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: isMyVote ? 600 : 500,
                    color: isMyVote ? '#93c5fd' : '#e2e8f0',
                  }}
                >
                  <span>{opt.text}</span>
                  {isMyVote && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        fontWeight: 700,
                      }}
                    >
                      ✓ Your vote
                    </span>
                  )}
                </div>

                {/* Percentage & count */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontWeight: 600,
                    fontSize: '13px',
                    color: isMyVote ? '#bfdbfe' : '#94a3b8',
                    textAlign: 'right',
                  }}
                >
                  <span>{pct}%</span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({count})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Voting Form View
        <form onSubmit={handleVoteSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {poll.options.map((opt) => {
              const isSelected = selectedOptionId === opt._id.toString();
              return (
                <label
                  key={opt._id}
                  className={`poll-option-label ${isSelected ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`poll-${post._id}`}
                    value={opt._id}
                    checked={isSelected}
                    onChange={() => setSelectedOptionId(opt._id.toString())}
                    style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                    {opt.text}
                  </span>
                </label>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '12px',
            }}
          >
            <button
              ref={submitBtnRef}
              type="submit"
              disabled={!selectedOptionId || isSubmitting}
              style={{
                backgroundColor: selectedOptionId ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                color: selectedOptionId ? '#ffffff' : '#64748b',
                border: 'none',
                padding: '6px 18px',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: selectedOptionId && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              {isSubmitting ? 'Voting...' : 'Vote'}
            </button>
          </div>
        </form>
      )}

      {/* Footer Info */}
      <div className="poll-footer">
        <span>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
        <span>{formatTimeRemaining()}</span>
      </div>
    </div>
  );
};

export default PollCard;
