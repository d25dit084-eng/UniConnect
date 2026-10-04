import api from './axios';

export const getProfile = async () => {
  const res = await api.get('/users/profile');
  return res.data;
};

export const updateProfile = async (data) => {
  const res = await api.put('/users/profile', data);
  return res.data;
};

export const uploadAvatar = async (formData) => {
  const res = await api.post('/users/profile/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const getPublicProfile = async (username) => {
  const res = await api.get(`/users/${username}`);
  return res.data;
};

export const getUserPosts = async (username, page = 1, limit = 10) => {
  const res = await api.get(`/users/${username}/posts`, {
    params: { page, limit },
  });
  return res.data;
};

export const getBlockedUsers = async () => {
  const res = await api.get('/users/blocked');
  return res.data;
};

export const blockUser = async (username) => {
  const res = await api.post(`/users/${username}/block`);
  return res.data;
};

export const unblockUser = async (username) => {
  const res = await api.delete(`/users/${username}/block`);
  return res.data;
};

export const autocompleteUsers = async (q) => {
  const res = await api.get('/users/autocomplete', {
    params: { q },
  });
  return res.data;
};

export const completeOnboarding = async (data) => {
  const res = await api.post('/users/onboarding', data);
  return res.data;
};

export const getNotificationPreferences = async () => {
  const res = await api.get('/users/preferences/notifications');
  return res.data;
};

export const updateNotificationPreferences = async (data) => {
  const res = await api.put('/users/preferences/notifications', data);
  return res.data;
};

export const triggerEmailDigest = async () => {
  const res = await api.post('/users/preferences/notifications/digest');
  return res.data;
};

