import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const agentService = {
  // Send message to AI Agent
  chat: (message, conversation_id = null) =>
    api.post('/agent/chat', { message, conversation_id }).then((r) => r.data),

  // List all conversations
  getConversations: () =>
    api.get('/agent/conversations').then((r) => r.data),

  // Get specific conversation messages
  getConversation: (conversation_id) =>
    api.get(`/agent/conversations/${conversation_id}`).then((r) => r.data),

  // Delete a conversation
  deleteConversation: (conversation_id) =>
    api.delete(`/agent/conversations/${conversation_id}`).then((r) => r.data),

  // Inspect available tools
  getTools: () =>
    api.get('/agent/tools').then((r) => r.data),

  // Health & model info
  getHealth: () =>
    api.get('/agent/health').then((r) => r.data),

  // Security Firewall inclusion / absence management
  getFirewallStatus: () =>
    api.get('/agent/firewall').then((r) => r.data),

  toggleFirewall: () =>
    api.post('/agent/firewall/toggle').then((r) => r.data),

  setFirewall: (enabled) =>
    api.post('/agent/firewall/set', { enabled }).then((r) => r.data),
};

export default agentService;
