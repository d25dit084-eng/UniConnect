import api from './axios';

export const savePost = async (postId) => {
  const res = await api.post(`/saved/${postId}`);
  return res.data;
};

export const unsavePost = async (postId) => {
  const res = await api.delete(`/saved/${postId}`);
  return res.data;
};

export const getSavedPosts = async (page = 1, limit = 10) => {
  const res = await api.get('/saved', {
    params: { page, limit },
  });
  return res.data;
};
