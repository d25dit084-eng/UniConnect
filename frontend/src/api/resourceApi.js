import api from './axios';

export const getResources = async (params = {}) => {
  const res = await api.get('/resources', { params });
  return res.data;
};

export const getResourceDetails = async (id) => {
  const res = await api.get(`/resources/${id}`);
  return res.data;
};

export const createResource = async (data) => {
  const res = await api.post('/resources', data);
  return res.data;
};

export const downloadResource = async (id) => {
  const res = await api.post(`/resources/${id}/download`);
  return res.data;
};

export const voteResource = async (id) => {
  const res = await api.post(`/resources/${id}/vote`);
  return res.data;
};

export const deleteResource = async (id) => {
  const res = await api.delete(`/resources/${id}`);
  return res.data;
};
