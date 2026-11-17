const mongoose = require('mongoose');

// ─── Attachment Sub-Schema ────────────────────────────────────────────────────
const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    url: { type: String, default: null },   // simulated URL/path (no real storage)
  },
  { _id: true }
);

// ─── Email Schema ─────────────────────────────────────────────────────────────
const emailSchema = new mongoose.Schema(
  {
    sender_name: { type: String, required: true, trim: true },
    sender_email: { type: String, required: true, trim: true, lowercase: true },
    recipient_email: { type: String, required: true, trim: true, lowercase: true },
    cc: [{ type: String, trim: true, lowercase: true }],
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    received_at: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['received', 'sent', 'draft', 'deleted'],
      default: 'received',
    },
    folder: {
      type: String,
      enum: ['inbox', 'sent', 'drafts', 'starred', 'trash'],
      default: 'inbox',
    },
    attachments: [attachmentSchema],
    is_read: { type: Boolean, default: false },
    is_starred: { type: Boolean, default: false },
    thread_id: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes for Search & Filtering ──────────────────────────────────────────
emailSchema.index({ folder: 1, received_at: -1 });
emailSchema.index({ sender_email: 1 });
emailSchema.index({ subject: 'text', body: 'text', sender_name: 'text', sender_email: 'text' });

// ─── Virtual: unread count helper (used externally) ──────────────────────────
emailSchema.virtual('preview').get(function () {
  return this.body ? this.body.substring(0, 120).replace(/\n/g, ' ') + '...' : '';
});

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;
