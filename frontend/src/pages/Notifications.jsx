import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } from '../api/notificationApi';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getNotifications(page, 20, unreadOnly);
      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly, page]);

  const handleMarkRead = async (notif) => {
    if (notif.isRead) return;
    try {
      await markAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('[NotificationMarkRead] Error:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all notifications?')) return;
    try {
      await clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="notification-header">
        <h2>Notifications</h2>
        <div className="notification-header-actions">
          <button type="button" onClick={handleMarkAllRead} disabled={notifications.length === 0}>
            Mark All Read
          </button>
          <button type="button" onClick={handleClearAll} style={{ color: '#c00' }} disabled={notifications.length === 0}>
            Clear All
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
          />
          Show unread notifications only
        </label>
      </div>

      {loading ? (
        <div className="loading-indicator">Loading notifications...</div>
      ) : error ? (
        <div className="error-indicator">{error}</div>
      ) : notifications.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleMarkRead(n)}
                className="notification-item"
                style={{
                  background: n.isRead ? '#ffffff' : '#f3f0ea',
                  fontWeight: n.isRead ? 'normal' : 'bold',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                <div className="notification-body">
                  <div style={{ fontSize: '13px' }}>{n.message}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                    {new Date(n.createdAt).toLocaleString()}
                    {n.post && (
                      <>
                        {' • '}
                        <Link to={`/post/${n.post}`} style={{ fontWeight: 'normal' }}>
                          View Post
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n._id);
                  }}
                  style={{ border: 'none', background: 'none', color: '#c00', fontSize: '11px', textDecoration: 'underline', flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous Page
            </button>
            <span style={{ fontSize: '13px', alignSelf: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next Page
            </button>
          </div>
        </>
      ) : (
        <div className="empty-indicator">No notifications.</div>
      )}
    </div>
  );
};
export default Notifications;
