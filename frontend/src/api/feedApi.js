import api from './axios';

export const getHomeFeed = async (sort = 'hot', page = 1, limit = 10) => {
  const res = await api.get('/feed/home', {
    params: { sort, page, limit },
  });
  return res.data;
};

export const getLatestFeed = async (page = 1, limit = 10) => {
  const res = await api.get('/feed/latest', {
    params: { page, limit },
  });
  return res.data;
};

export const getPopularFeed = async (page = 1, limit = 10) => {
  const res = await api.get('/feed/popular', {
    params: { page, limit },
  });
  return res.data;
};
