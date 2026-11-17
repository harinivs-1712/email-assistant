const express = require('express');
const router = express.Router();

const {
  getAllEmails,
  getEmailsByFolder,
  searchEmails,
  getEmailById,
  createEmail,
  updateEmail,
  toggleRead,
  toggleStar,
  moveToTrash,
  restoreFromTrash,
  deleteEmailPermanently,
  getStats,
} = require('../controllers/emailController');

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', getStats);

// ─── Search (must come before /:id) ──────────────────────────────────────────
router.get('/search', searchEmails);

// ─── Folder ───────────────────────────────────────────────────────────────────
router.get('/folder/:folder', getEmailsByFolder);

// ─── Collection ───────────────────────────────────────────────────────────────
router.get('/', getAllEmails);
router.post('/', createEmail);

// ─── Single Email ─────────────────────────────────────────────────────────────
router.get('/:id', getEmailById);
router.put('/:id', updateEmail);
router.delete('/:id', deleteEmailPermanently);

// ─── State Patches ────────────────────────────────────────────────────────────
router.patch('/:id/read', toggleRead);
router.patch('/:id/star', toggleStar);
router.patch('/:id/trash', moveToTrash);
router.patch('/:id/restore', restoreFromTrash);

module.exports = router;
