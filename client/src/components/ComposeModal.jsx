import React, { useState, useEffect } from 'react';
import { X, Send, Save, AlertCircle } from 'lucide-react';

const ComposeModal = ({
  onClose,
  onSend,
  initialData = null,
  senderEmail = 'rahul.sharma@student.university.edu',
}) => {
  const [form, setForm] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
    draftId: null,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm({
        to: initialData.recipient_email || initialData.to || '',
        cc: Array.isArray(initialData.cc)
          ? initialData.cc.join(', ')
          : initialData.cc || '',
        subject: initialData.subject || '',
        body: initialData.body || '',
        draftId: initialData._id || initialData.id || null,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const validate = () => {
    if (!form.to.trim()) return 'Recipient (To) is required.';
    if (!form.subject.trim()) return 'Subject is required.';
    if (!form.body.trim()) return 'Email body cannot be empty.';
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(form.to.trim())) return 'Please enter a valid recipient email.';
    return null;
  };

  const handleSubmit = async (asDraft = false) => {
    if (!asDraft) {
      const err = validate();
      if (err) {
        setError(err);
        return;
      }
    }
    setSending(true);
    try {
      const payload = {
        sender_name: 'Rahul Sharma',
        sender_email: senderEmail,
        recipient_email: form.to.trim().toLowerCase(),
        cc: form.cc
          ? form.cc.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
          : [],
        subject: form.subject.trim() || '(No Subject)',
        body: form.body,
        folder: asDraft ? 'drafts' : 'sent',
        status: asDraft ? 'draft' : 'sent',
        is_read: true,
        ...(form.draftId && { draft_id: form.draftId }),
      };
      await onSend(payload);
      onClose();
    } catch (err) {
      setError('Failed to process email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-sm font-bold text-slate-800">
            {form.draftId ? '✏️ Edit Draft' : '✉️ New Message'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-3 flex-1 overflow-y-auto">
          {/* To */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
            <label className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">
              To
            </label>
            <input
              type="email"
              name="to"
              value={form.to}
              onChange={handleChange}
              placeholder="recipient@example.com"
              className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
            <label className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">
              CC
            </label>
            <input
              type="text"
              name="cc"
              value={form.cc}
              onChange={handleChange}
              placeholder="comma-separated email addresses"
              className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
            <label className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              placeholder="Subject line"
              className="flex-1 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Body */}
          <div className="pt-2">
            <textarea
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder="Write your email here..."
              rows={10}
              className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400 resize-none font-sans leading-relaxed"
            />
          </div>
        </div>

        {/* Simulated disclaimer banner */}
        <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span>
            Simulated Email: Sent messages and drafts update MongoDB directly; no external SMTP transmission occurs.
          </span>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Discard
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
