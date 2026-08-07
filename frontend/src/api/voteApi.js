import api from './axios';

export const votePost = async (postId, value) => {
  const res = await api.post(`/votes/posts/${postId}`, { value });
  return res.data;
};

export const voteComment = async (commentId, value) => {
  const res = await api.post(`/votes/comments/${commentId}`, { value });
  return res.data;
};
