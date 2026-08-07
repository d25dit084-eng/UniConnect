import React, { useState } from 'react';

export const CommunityPulse = () => {
  const states = [
    { label: 'Active now', color: '#090', browsing: 342, posts: 47, comments: 128 },
    { label: 'Busy', color: '#c50', browsing: 512, posts: 74, comments: 201 },
    { label: 'Quiet', color: '#666', browsing: 42, posts: 3, comments: 8 }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentState = states[currentIndex];

  const cycleState = () => {
    setCurrentIndex((prev) => (prev + 1) % states.length);
  };

  return (
    <div style={{ border: '1px solid #e0e0e0', padding: '16px', background: '#ffffff', borderRadius: '4px', marginBottom: '20px' }}>
      <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#111111', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.05em' }}>
        Community Pulse
      </h4>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#1a1a1a' }}>
        {/* State Toggle indicator */}
        <div 
          onClick={cycleState}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 'bold',
            alignSelf: 'flex-start'
          }}
          title="Click to cycle status mode"
        >
          <span style={{ color: currentState.color, fontSize: '10px' }}>●</span>
          <span>{currentState.label}</span>
          <span style={{ fontSize: '9px', color: '#888888', fontWeight: 'normal' }}>(click to cycle)</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#666666' }}>
          <div>👥 <strong>{currentState.browsing}</strong> people browsing</div>
          <div>📝 <strong>{currentState.posts}</strong> posts today</div>
          <div>💬 <strong>{currentState.comments}</strong> comments today</div>
        </div>
      </div>
    </div>
  );
};
export default CommunityPulse;
