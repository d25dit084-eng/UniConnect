import api from './axios';

export const createCommunity = async (data) => {
  const res = await api.post('/communities', data);
  return res.data;
};

export const listCommunities = async (q = '', sort = 'members') => {
  const res = await api.get('/communities', {
    params: { q, sort },
  });
  return res.data;
};

export const getJoinedCommunities = async () => {
  const res = await api.get('/communities/joined');
  return res.data;
};

export const getCommunityDetails = async (slug) => {
  const res = await api.get(`/communities/${slug}`);
  return res.data;
};

export const updateCommunity = async (id, data) => {
  const res = await api.put(`/communities/${id}`, data);
  return res.data;
};

export const deleteCommunity = async (id) => {
  const res = await api.delete(`/communities/${id}`);
  return res.data;
};

export const joinCommunity = async (id) => {
  const res = await api.post(`/communities/${id}/join`);
  return res.data;
};

export const leaveCommunity = async (id) => {
  const res = await api.delete(`/communities/${id}/leave`);
  return res.data;
};

export const getCommunityPosts = async (slug, sort = 'hot', page = 1, limit = 10) => {
  try {
    const res = await api.get(`/posts/community/${slug}`, {
      params: { sort, page, limit },
    });
    return res.data;
  } catch (err) {
    const res = await api.get(`/communities/${slug}/posts`, {
      params: { sort, page, limit },
    });
    return res.data;
  }
};

export const getCommunityMembers = async (slug, page = 1, limit = 10) => {
  const res = await api.get(`/communities/${slug}/members`, {
    params: { page, limit },
  });
  return res.data;
};

// ─── Community Moderation & Automod Endpoints ─────────────────────────────────
export const getCommunityModReports = async (slug, status = '', page = 1, limit = 20) => {
  const res = await api.get(`/communities/${slug}/mod/reports`, {
    params: { status: status || undefined, page, limit },
  });
  return res.data;
};

export const actionCommunityModReport = async (slug, id, action, note = '') => {
  const res = await api.post(`/communities/${slug}/mod/reports/${id}/action`, {
    action,
    note,
  });
  return res.data;
};

export const getCommunityModSettings = async (slug) => {
  const res = await api.get(`/communities/${slug}/mod/settings`);
  return res.data;
};

export const updateCommunityModSettings = async (slug, data) => {
  const res = await api.put(`/communities/${slug}/mod/settings`, data);
  return res.data;
};

