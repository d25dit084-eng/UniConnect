import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { votePoll } from '../api/postApi';

export const PollCard = ({ post, onPollUpdated }) => {
  const { isAuthenticated } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [poll, setPoll] = useState(post.poll || null);
  const [userVotedOptionId, setUserVotedOptionId] = useState(post.userVotedOptionId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    <div
      className="poll-container"
      style={{
        margin: '12px 0',
        padding: '14px 16px',
        borderRadius: '8px',
        border: '1px solid #e2e0db',
        backgroundColor: '#faf9f6',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          fontSize: '15px',
          marginBottom: '12px',
          color: '#1a1a1b',
        }}
      >
        <span>📊</span>
        <span>{poll.question || post.title}</span>
      </div>

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#d32f2f',
            marginBottom: '8px',
            padding: '4px 8px',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
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
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: isMyVote ? '1.5px solid #3b82f6' : '1px solid #e5e5e5',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px',
                }}
              >
                {/* Background progress fill */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    backgroundColor: isMyVote ? 'rgba(59, 130, 246, 0.18)' : 'rgba(0, 0, 0, 0.06)',
                    transition: 'width 0.4s ease',
                    zIndex: 0,
                  }}
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
                    color: isMyVote ? '#1d4ed8' : '#262626',
                  }}
                >
                  <span>{opt.text}</span>
                  {isMyVote && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        fontWeight: 600,
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
                    color: '#555',
                    textAlign: 'right',
                  }}
                >
                  <span>{pct}%</span>
                  <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>
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
            {poll.options.map((opt) => (
              <label
                key={opt._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border:
                    selectedOptionId === opt._id.toString()
                      ? '1.5px solid #3b82f6'
                      : '1px solid #e0dfdb',
                  backgroundColor:
                    selectedOptionId === opt._id.toString() ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '14px',
                  color: '#262626',
                }}
              >
                <input
                  type="radio"
                  name={`poll-${post._id}`}
                  value={opt._id}
                  checked={selectedOptionId === opt._id.toString()}
                  onChange={() => setSelectedOptionId(opt._id.toString())}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: selectedOptionId === opt._id.toString() ? 600 : 400 }}>
                  {opt.text}
                </span>
              </label>
            ))}
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
              type="submit"
              disabled={!selectedOptionId || isSubmitting}
              style={{
                backgroundColor: selectedOptionId ? '#3b82f6' : '#9ca3af',
                color: '#ffffff',
                border: 'none',
                padding: '6px 18px',
                borderRadius: '20px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: selectedOptionId && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
              }}
            >
              {isSubmitting ? 'Voting...' : 'Vote'}
            </button>
          </div>
        </form>
      )}

      {/* Footer Info */}
      <div
        style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid #ebe9e3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#777',
        }}
      >
        <span>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
        <span>{formatTimeRemaining()}</span>
      </div>
    </div>
  );
};

export default PollCard;
