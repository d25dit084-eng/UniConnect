import api from './axios';

export const getStudyGroups = async (params = {}) => {
  const res = await api.get('/study-groups', { params });
  return res.data;
};

export const getStudyGroupDetails = async (id) => {
  const res = await api.get(`/study-groups/${id}`);
  return res.data;
};

export const createStudyGroup = async (data) => {
  const res = await api.post('/study-groups', data);
  return res.data;
};

export const joinStudyGroup = async (id) => {
  const res = await api.post(`/study-groups/${id}/join`);
  return res.data;
};

export const leaveStudyGroup = async (id) => {
  const res = await api.post(`/study-groups/${id}/leave`);
  return res.data;
};

export const deleteStudyGroup = async (id) => {
  const res = await api.delete(`/study-groups/${id}`);
  return res.data;
};
