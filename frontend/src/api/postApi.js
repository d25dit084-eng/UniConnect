import api from './axios';

export const createPost = async (data) => {
  const res = await api.post('/posts', data);
  return res.data;
};

export const getPostDetails = async (id) => {
  const res = await api.get(`/posts/${id}`);
  return res.data;
};

export const updatePost = async (id, data) => {
  const res = await api.put(`/posts/${id}`, data);
  return res.data;
};

export const deletePost = async (id) => {
  const res = await api.delete(`/posts/${id}`);
  return res.data;
};

export const searchPosts = async (q, sort = 'hot', page = 1, limit = 10) => {
  const res = await api.get('/posts/search', {
    params: { q, sort, page, limit },
  });
  return res.data;
};
