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
  const res = await api.get(`/communities/${slug}/posts`, {
    params: { sort, page, limit },
  });
  return res.data;
};

export const getCommunityMembers = async (slug, page = 1, limit = 10) => {
  const res = await api.get(`/communities/${slug}/members`, {
    params: { page, limit },
  });
  return res.data;
};
