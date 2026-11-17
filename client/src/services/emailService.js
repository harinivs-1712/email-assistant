import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Email Service ────────────────────────────────────────────────────────────
export const emailService = {
  // Fetch all emails (optional folder filter)
  getAll: (folder = null) =>
    api.get('/emails', { params: folder ? { folder } : {} }).then((r) => r.data),

  // Fetch by folder
  getByFolder: (folder) =>
    api.get(`/emails/folder/${folder}`).then((r) => r.data),

  // Search
  search: (q) =>
    api.get('/emails/search', { params: { q } }).then((r) => r.data),

  // Single email
  getById: (id) =>
    api.get(`/emails/${id}`).then((r) => r.data),

  // Create email
  create: (data) =>
    api.post('/emails', data).then((r) => r.data),

  // Update email
  update: (id, data) =>
    api.put(`/emails/${id}`, data).then((r) => r.data),

  // Toggle read/unread
  toggleRead: (id, is_read) =>
    api.patch(`/emails/${id}/read`, { is_read }).then((r) => r.data),

  // Toggle star
  toggleStar: (id, is_starred) =>
    api.patch(`/emails/${id}/star`, { is_starred }).then((r) => r.data),

  // Move to trash
  trash: (id) =>
    api.patch(`/emails/${id}/trash`).then((r) => r.data),

  // Restore from trash
  restore: (id) =>
    api.patch(`/emails/${id}/restore`).then((r) => r.data),

  // Permanently delete
  deletePermanently: (id) =>
    api.delete(`/emails/${id}`).then((r) => r.data),

  // Stats (folder counts + unread)
  getStats: () =>
    api.get('/emails/stats').then((r) => r.data),
};

export default emailService;
