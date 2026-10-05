import React, { useState } from 'react';

export const CommunityPulse = () => {
  const states = [
    { label: 'Active now', color: '#090', browsing: 342, posts: 47, comments: 128 },
    { label: 'Busy', color: '#c50', browsing: 512, posts: 74, comments: 201 },
    { label: 'Quiet', color: '#666', browsing: 42, posts: 3, comments: 8 },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentState = states[currentIndex];

  const cycleState = () => {
    setCurrentIndex((prev) => (prev + 1) % states.length);
  };

  return (
    <div className="widget-card">
      <h4>Community Pulse</h4>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '13px',
          color: 'var(--text-primary)',
        }}
      >
        {/* State Toggle indicator */}
        <div
          onClick={cycleState}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: '600',
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--glass-border)',
          }}
          title="Click to cycle status mode"
        >
          <span style={{ color: currentState.color, fontSize: '12px' }}>●</span>
          <span>{currentState.label}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            (tap to cycle)
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '2px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            👥 <strong style={{ color: 'var(--text-primary)' }}>{currentState.browsing}</strong> people browsing
          </div>
          <div>
            📝 <strong style={{ color: 'var(--text-primary)' }}>{currentState.posts}</strong> posts today
          </div>
          <div>
            💬 <strong style={{ color: 'var(--text-primary)' }}>{currentState.comments}</strong> comments today
          </div>
        </div>
      </div>
    </div>
  );
};
export default CommunityPulse;
