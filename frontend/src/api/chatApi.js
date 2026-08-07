import api from './axios';

export const createConversation = async (recipientUsername) => {
  const res = await api.post('/chat/conversations', { recipientUsername });
  return res.data;
};

export const listConversations = async () => {
  const res = await api.get('/chat/conversations');
  return res.data;
};

export const getMessages = async (conversationId, page = 1, limit = 50) => {
  const res = await api.get(`/chat/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });
  return res.data;
};

export const sendMessage = async (conversationId, content, attachments = []) => {
  const res = await api.post(`/chat/conversations/${conversationId}/messages`, {
    content,
    attachments,
  });
  return res.data;
};

export const markMessageAsRead = async (messageId) => {
  const res = await api.patch(`/chat/messages/${messageId}/read`);
  return res.data;
};

export const deleteMessage = async (messageId) => {
  const res = await api.delete(`/chat/messages/${messageId}`);
  return res.data;
};
