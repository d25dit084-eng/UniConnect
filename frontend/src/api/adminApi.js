import api from './axios';

export const getAdminStats = async () => {
  const res = await api.get('/admin/stats');
  return res.data;
};

export const listAllUsers = async (page = 1, limit = 20, verified, role) => {
  const res = await api.get('/admin/users', {
    params: { page, limit, verified, role },
  });
  return res.data;
};

export const listAllReports = async (page = 1, limit = 20, status, targetType) => {
  const res = await api.get('/admin/reports', {
    params: { page, limit, status, targetType },
  });
  return res.data;
};

export const reviewReport = async (id, status, moderationNote = '') => {
  const res = await api.patch(`/admin/reports/${id}`, { status, moderationNote });
  return res.data;
};

export const moderatePost = async (id, status) => {
  const res = await api.patch(`/admin/posts/${id}/moderate`, { status });
  return res.data;
};

export const moderateComment = async (id, status) => {
  const res = await api.patch(`/admin/comments/${id}/moderate`, { status });
  return res.data;
};
