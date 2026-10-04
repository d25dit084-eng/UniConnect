import React from 'react';

export const PostSkeleton = () => (
  <div className="post-card skeleton-card" aria-hidden="true">
    <div className="skeleton-line" style={{ width: '35%', height: '14px', marginBottom: '10px' }} />
    <div className="skeleton-line" style={{ width: '75%', height: '20px', marginBottom: '12px' }} />
    <div className="skeleton-line" style={{ width: '95%', height: '15px', marginBottom: '8px' }} />
    <div className="skeleton-line" style={{ width: '85%', height: '15px', marginBottom: '14px' }} />
    <div className="skeleton-line" style={{ width: '45%', height: '24px' }} />
  </div>
);

export const ConversationSkeleton = () => (
  <div className="conversation-item skeleton-card" aria-hidden="true" style={{ cursor: 'default' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
      <div className="skeleton-line" style={{ width: '50%', height: '14px' }} />
      <div className="skeleton-line" style={{ width: '15%', height: '10px' }} />
    </div>
    <div className="skeleton-line" style={{ width: '80%', height: '12px' }} />
  </div>
);

export const CommentSkeleton = () => (
  <div
    className="comment-item skeleton-card"
    aria-hidden="true"
    style={{ padding: '12px', borderBottom: '1px solid #e2e0db' }}
  >
    <div className="skeleton-line" style={{ width: '30%', height: '12px', marginBottom: '8px' }} />
    <div className="skeleton-line" style={{ width: '90%', height: '14px', marginBottom: '6px' }} />
    <div className="skeleton-line" style={{ width: '65%', height: '14px' }} />
  </div>
);

export const MessageSkeleton = ({ isMine = false }) => (
  <div
    className={`message-bubble skeleton-card ${isMine ? 'mine' : 'other'}`}
    aria-hidden="true"
    style={{ minWidth: '140px', maxWidth: '60%' }}
  >
    <div className="skeleton-line" style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
    <div className="skeleton-line" style={{ width: '60%', height: '10px' }} />
  </div>
);
