import api from './axios';

export const listCourses = async (params = {}) => {
  const res = await api.get('/courses', { params });
  return res.data;
};

export const getCourseDetails = async (id) => {
  const res = await api.get(`/courses/${id}`);
  return res.data;
};

export const createCourse = async (data) => {
  const res = await api.post('/courses', data);
  return res.data;
};

export const listProfessors = async (params = {}) => {
  const res = await api.get('/professors', { params });
  return res.data;
};

export const getProfessorDetails = async (id) => {
  const res = await api.get(`/professors/${id}`);
  return res.data;
};

export const createProfessor = async (data) => {
  const res = await api.post('/professors', data);
  return res.data;
};

export const submitReview = async (data) => {
  const res = await api.post('/reviews', data);
  return res.data;
};

export const voteReview = async (id, voteType) => {
  const res = await api.post(`/reviews/${id}/vote`, { voteType });
  return res.data;
};
