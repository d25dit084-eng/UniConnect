import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from '../api/notificationApi';
import {
  isPushSupported,
  getCurrentPushSubscription,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '../utils/pushManager';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (isPushSupported()) {
      getCurrentPushSubscription().then((sub) => {
        setPushSubscribed(!!sub);
      });
    }
  }, []);

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      if (pushSubscribed) {
        await unsubscribeUserFromPush();
        setPushSubscribed(false);
      } else {
        await subscribeUserToPush();
        setPushSubscribed(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to update push notification subscription');
    } finally {
      setPushLoading(false);
    }
  };

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
          <button
            type="button"
            onClick={handleClearAll}
            style={{ color: '#c00' }}
            disabled={notifications.length === 0}
          >
            Clear All
          </button>
        </div>
      </div>

      {isPushSupported() && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: pushSubscribed ? '#f0fdf4' : '#faf8f5',
            border: '1px solid',
            borderColor: pushSubscribed ? '#bbf7d0' : '#e2e0db',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{pushSubscribed ? '🔔' : '🔕'}</span>
            <span>
              {pushSubscribed
                ? 'Browser Web Push notifications are active.'
                : 'Enable browser push notifications to get real-time campus alerts.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={pushLoading}
            style={{
              padding: '5px 12px',
              backgroundColor: pushSubscribed ? '#ffffff' : '#1a1a1a',
              color: pushSubscribed ? '#15803d' : '#ffffff',
              border: '1px solid',
              borderColor: pushSubscribed ? '#15803d' : '#1a1a1a',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: pushLoading ? 'wait' : 'pointer',
            }}
          >
            {pushLoading
              ? 'Updating...'
              : pushSubscribed
              ? 'Disable Push'
              : 'Enable Push'}
          </button>
        </div>
      )}

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
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#c00',
                    fontSize: '11px',
                    textDecoration: 'underline',
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}
          >
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
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
