import api from './axios';

export const globalSearch = async (q, type = 'posts', page = 1, limit = 10) => {
  const res = await api.get('/search', {
    params: { q, type, page, limit },
  });
  return res.data;
};
