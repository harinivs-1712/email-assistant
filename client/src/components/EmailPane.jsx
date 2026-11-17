import React, { useState } from 'react';
import {
  Star,
  Trash2,
  Mail,
  MailOpen,
  RotateCcw,
  Paperclip,
  ArrowLeft,
  Reply,
  Forward,
  Download,
  MoreVertical,
  Printer,
  ExternalLink,
  Send,
  CornerDownLeft,
  Eye,
  FileText,
  X,
} from 'lucide-react';

const formatFullDate = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const EmailPane = ({
  email,
  onStar,
  onTrash,
  onRestore,
  onDelete,
  onToggleRead,
  onReply,
  onForward,
  onClose,
  folder,
}) => {
  const [quickReplyText, setQuickReplyText] = useState('');
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const handleDownloadAttachment = (att) => {
    const content = att.content || `[Attachment: ${att.filename} - Content simulated]`;
    const blob = new Blob([content], { type: att.mimetype || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!email) return null;

  const hasAttachments = email.attachments && email.attachments.length > 0;
  const isTrash = folder === 'trash' || email.folder === 'trash';
  const senderInitial = (email.sender_name || email.sender_email || 'U')[0].toUpperCase();

  // Color generator for avatar based on name
  const avatarColors = [
    'bg-red-500',
    'bg-blue-600',
    'bg-emerald-600',
    'bg-purple-600',
    'bg-amber-600',
    'bg-teal-600',
  ];
  const colorIndex = (email.sender_name || email.sender_email || 'A').charCodeAt(0) % avatarColors.length;
  const avatarBg = avatarColors[colorIndex];

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-text">
      {/* ─── 1. Gmail-Style Top Action Toolbar ─────────────────────────────── */}
      <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Back Button (Returns to Email List) */}
          <button
            onClick={onClose}
            title="Back to inbox"
            className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors mr-2 flex items-center gap-1 font-medium text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Star Action */}
          <button
            onClick={() => onStar(email._id, !email.is_starred)}
            title={email.is_starred ? 'Starred' : 'Not starred'}
            className="p-2 rounded-full text-slate-500 hover:text-amber-500 hover:bg-slate-100 transition-colors"
          >
            <Star
              className={`w-4 h-4 ${
                email.is_starred ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>

          {/* Mark Read/Unread */}
          <button
            onClick={() => onToggleRead(email._id, !email.is_read)}
            title={email.is_read ? 'Mark as unread' : 'Mark as read'}
            className="p-2 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
          >
            {email.is_read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
          </button>

          {/* Trash or Restore / Delete */}
          {isTrash ? (
            <>
              <button
                onClick={() => onRestore(email._id)}
                title="Restore to Inbox"
                className="p-2 rounded-full text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(email._id)}
                title="Delete forever"
                className="p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onTrash(email._id)}
              title="Delete"
              className="p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-100 uppercase">
            {email.folder || 'inbox'}
          </span>
        </div>
      </div>

      {/* ─── 2. Email Content Scroll Container ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        {/* Email Subject & Folder Badge */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-normal text-slate-900 leading-snug">
              {email.subject || '(no subject)'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-block text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Inbox
              </span>
              {email.is_starred && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Starred
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sender Header Card */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            {/* Avatar Circle */}
            <div
              className={`w-10 h-10 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0`}
            >
              {senderInitial}
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900">
                  {email.sender_name || 'Unknown Sender'}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  &lt;{email.sender_email}&gt;
                </span>
              </div>

              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>to {email.recipient_email === 'rahul.sharma@student.university.edu' ? 'me' : email.recipient_email}</span>
                {email.cc && email.cc.length > 0 && (
                  <span>• cc: {email.cc.join(', ')}</span>
                )}
              </div>
            </div>
          </div>

          {/* Date & Quick Reply Icon */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {formatFullDate(email.received_at)}
            </span>
            <button
              onClick={() => onReply(email)}
              title="Reply"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Reply className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── 3. Email Body Text ───────────────────────────────────────────── */}
        <div className="py-6 text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
          {email.body}
        </div>

        {/* ─── 4. Attachments (if any) ──────────────────────────────────────── */}
        {hasAttachments && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <span>{email.attachments.length} Attachment(s) / Document(s)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {email.attachments.map((att, idx) => (
                <div
                  key={idx}
                  onClick={() => setPreviewAttachment(att)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {att.doc_id ? 'DOC' : (att.filename.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-600 transition-colors" title={att.filename}>
                      {att.filename}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(att.size)} {att.doc_id ? `• ${att.doc_id}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Preview Document"
                      onClick={() => setPreviewAttachment(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Download"
                      onClick={() => handleDownloadAttachment(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── 5. Gmail-Style Bottom Action Buttons ─────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={() => onReply(email)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-all"
          >
            <Reply className="w-4 h-4 text-slate-500" />
            <span>Reply</span>
          </button>

          <button
            onClick={() => onForward(email)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-all"
          >
            <Forward className="w-4 h-4 text-slate-500" />
            <span>Forward</span>
          </button>
        </div>
      </div>

      {/* Document / Attachment Viewer Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-800 truncate">
                    {previewAttachment.filename}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {formatFileSize(previewAttachment.size)} • {previewAttachment.mimetype || 'document'}
                    {previewAttachment.doc_id ? ` • Doc ID: ${previewAttachment.doc_id}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadAttachment(previewAttachment)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/30">
              {previewAttachment.content ? (
                previewAttachment.content
              ) : (
                <div className="text-center py-12 text-slate-400 font-sans">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium text-slate-600">Simulated Binary Document</p>
                  <p className="text-xs mt-1">This attachment is registered in the database. Use Download to retrieve the file.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailPane;
