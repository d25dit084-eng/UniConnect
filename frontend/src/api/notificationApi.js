import api from './axios';

export const getNotifications = async (page = 1, limit = 20, unread = false) => {
  const res = await api.get('/notifications', {
    params: { page, limit, unread: unread ? 'true' : 'false' },
  });
  return res.data;
};

export const getUnreadCount = async () => {
  const res = await api.get('/notifications/unread-count');
  return res.data;
};

export const markAsRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
};

export const markAllAsRead = async () => {
  const res = await api.patch('/notifications/read-all');
  return res.data;
};

export const deleteNotification = async (id) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};

export const clearAllNotifications = async () => {
  const res = await api.delete('/notifications/clear-all');
  return res.data;
};
