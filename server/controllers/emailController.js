const Email = require('../models/Email');

// ─── Helper ───────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── GET /api/emails ──────────────────────────────────────────────────────────
// Optional query: ?folder=inbox&limit=50
const getAllEmails = asyncHandler(async (req, res) => {
  const { folder, limit = 100 } = req.query;
  const filter = {};
  if (folder) filter.folder = folder;

  const emails = await Email.find(filter)
    .sort({ received_at: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, count: emails.length, data: emails });
});

// ─── GET /api/emails/folder/:folder ──────────────────────────────────────────
const getEmailsByFolder = asyncHandler(async (req, res) => {
  const { folder } = req.params;
  const validFolders = ['inbox', 'sent', 'drafts', 'starred', 'trash'];

  if (!validFolders.includes(folder)) {
    return res.status(400).json({ success: false, message: `Invalid folder: ${folder}` });
  }

  let filter;
  if (folder === 'starred') {
    // Starred shows is_starred=true from any folder except trash
    filter = { is_starred: true, folder: { $ne: 'trash' } };
  } else {
    filter = { folder };
  }

  const emails = await Email.find(filter).sort({ received_at: -1 }).lean();
  res.json({ success: true, count: emails.length, data: emails });
});

// ─── GET /api/emails/search?q= ────────────────────────────────────────────────
const searchEmails = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.status(400).json({ success: false, message: 'Search query (q) is required' });
  }

  const emails = await Email.find(
    { $text: { $search: q } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .lean();

  res.json({ success: true, count: emails.length, query: q, data: emails });
});

// ─── GET /api/emails/:id ──────────────────────────────────────────────────────
const getEmailById = asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id).lean();
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }
  res.json({ success: true, data: email });
});

// ─── POST /api/emails ─────────────────────────────────────────────────────────
const createEmail = asyncHandler(async (req, res) => {
  const {
    sender_name,
    sender_email,
    recipient_email,
    cc,
    subject,
    body,
    folder,
    status,
    attachments,
    thread_id,
    received_at,
  } = req.body;

  const email = await Email.create({
    sender_name,
    sender_email,
    recipient_email,
    cc: cc || [],
    subject,
    body,
    folder: folder || 'inbox',
    status: status || 'received',
    attachments: attachments || [],
    thread_id: thread_id || null,
    received_at: received_at || new Date(),
  });

  res.status(201).json({ success: true, data: email });
});

// ─── PUT /api/emails/:id ──────────────────────────────────────────────────────
const updateEmail = asyncHandler(async (req, res) => {
  const email = await Email.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();

  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }
  res.json({ success: true, data: email });
});

// ─── PATCH /api/emails/:id/read ───────────────────────────────────────────────
const toggleRead = asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }

  // Allow explicit value or just toggle
  const { is_read } = req.body;
  email.is_read = is_read !== undefined ? is_read : !email.is_read;
  await email.save();

  res.json({ success: true, data: { _id: email._id, is_read: email.is_read } });
});

// ─── PATCH /api/emails/:id/star ───────────────────────────────────────────────
const toggleStar = asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }

  const { is_starred } = req.body;
  email.is_starred = is_starred !== undefined ? is_starred : !email.is_starred;
  await email.save();

  res.json({ success: true, data: { _id: email._id, is_starred: email.is_starred } });
});

// ─── PATCH /api/emails/:id/trash ─────────────────────────────────────────────
const moveToTrash = asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }

  // Store original folder in thread_id as a workaround for restore, using a separate field
  email._previousFolder = email.folder;
  email.folder = 'trash';
  email.status = 'deleted';

  // Store the previous folder in thread metadata for restore
  await Email.findByIdAndUpdate(req.params.id, {
    $set: { folder: 'trash', status: 'deleted' },
  });

  res.json({ success: true, message: 'Email moved to trash', data: { _id: email._id, folder: 'trash' } });
});

// ─── PATCH /api/emails/:id/restore ───────────────────────────────────────────
const restoreFromTrash = asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }

  if (email.folder !== 'trash') {
    return res.status(400).json({ success: false, message: 'Email is not in trash' });
  }

  // Restore to inbox (or original folder if supplied)
  const targetFolder = req.body.folder || 'inbox';
  email.folder = targetFolder;
  email.status = targetFolder === 'sent' ? 'sent' : 'received';
  await email.save();

  res.json({ success: true, message: 'Email restored', data: { _id: email._id, folder: email.folder } });
});

// ─── DELETE /api/emails/:id ───────────────────────────────────────────────────
const deleteEmailPermanently = asyncHandler(async (req, res) => {
  const email = await Email.findByIdAndDelete(req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, message: 'Email not found' });
  }
  res.json({ success: true, message: 'Email permanently deleted', data: { _id: req.params.id } });
});

// ─── GET /api/emails/stats ────────────────────────────────────────────────────
const getStats = asyncHandler(async (req, res) => {
  const [folderCounts, unreadCounts] = await Promise.all([
    Email.aggregate([{ $group: { _id: '$folder', count: { $sum: 1 } } }]),
    Email.aggregate([
      { $match: { is_read: false, folder: { $ne: 'trash' } } },
      { $group: { _id: '$folder', unread: { $sum: 1 } } },
    ]),
  ]);

  const stats = {};
  folderCounts.forEach(({ _id, count }) => { stats[_id] = { count }; });
  unreadCounts.forEach(({ _id, unread }) => {
    if (stats[_id]) stats[_id].unread = unread;
    else stats[_id] = { unread };
  });

  // Count starred across non-trash
  const starredCount = await Email.countDocuments({ is_starred: true, folder: { $ne: 'trash' } });
  stats.starred = { ...(stats.starred || {}), count: starredCount };

  res.json({ success: true, data: stats });
});

module.exports = {
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
};
