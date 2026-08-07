import api from './axios';

export const createComment = async (postId, content) => {
  const res = await api.post('/comments', { postId, content });
  return res.data;
};

export const getPostComments = async (postId) => {
  const res = await api.get(`/comments/post/${postId}`);
  return res.data;
};

export const replyToComment = async (commentId, content) => {
  const res = await api.post(`/comments/${commentId}/reply`, { content });
  return res.data;
};

export const updateComment = async (commentId, content) => {
  const res = await api.put(`/comments/${commentId}`, { content });
  return res.data;
};

export const deleteComment = async (commentId) => {
  const res = await api.delete(`/comments/${commentId}`);
  return res.data;
};
