import api from './axios';

export const submitReport = async (targetType, targetId, reason, description = '') => {
  const res = await api.post('/reports', {
    targetType,
    targetId,
    reason,
    description,
  });
  return res.data;
};
