import React from 'react';
import {
  Star,
  Trash2,
  Paperclip,
  Mail,
  MailOpen,
  RotateCcw,
  Archive,
  Clock,
  CheckSquare,
  Square,
} from 'lucide-react';

const formatGmailDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const EmailList = ({
  emails,
  selectedId,
  onSelect,
  onStar,
  onTrash,
  onRestore,
  onDelete,
  onToggleRead,
  folder,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium text-slate-600">Loading your inbox...</p>
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Mail className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">Your {folder || 'inbox'} is empty</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          {folder === 'trash'
            ? 'Messages in Trash are kept for testing.'
            : folder === 'starred'
            ? 'Starred messages will appear here.'
            : folder === 'drafts'
            ? 'Saved drafts will appear here.'
            : 'Incoming messages and AI assistant interactions will show up here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white divide-y divide-slate-100">
      {emails.map((email) => {
        const isUnread = !email.is_read;
        const hasAttachments = email.attachments && email.attachments.length > 0;
        const snippetText = email.body ? email.body.replace(/\n+/g, ' ').trim() : '';

        return (
          <div
            key={email._id}
            onClick={() => onSelect(email)}
            className={`group relative flex items-center px-4 py-2.5 cursor-pointer text-sm transition-all duration-100 select-none border-b border-slate-100 ${
              isUnread
                ? 'bg-white font-bold text-slate-900 shadow-2xs'
                : 'bg-[#f6f8fc]/60 hover:bg-[#eef2f9] text-slate-700'
            } hover:shadow-xs hover:border-slate-300`}
          >
            {/* Left Controls: Checkbox & Star */}
            <div className="flex items-center gap-2 mr-3.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="text-slate-300 hover:text-slate-500 transition-colors p-0.5 rounded"
                title="Select"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onStar(email._id, !email.is_starred)}
                title={email.is_starred ? 'Starred' : 'Not starred'}
                className="p-0.5 rounded text-slate-300 hover:text-amber-500 transition-colors"
              >
                <Star
                  className={`w-4 h-4 ${
                    email.is_starred
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 hover:text-slate-400'
                  }`}
                />
              </button>
            </div>

            {/* Subject + Snippet Column (Shows FIRST) */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden pr-3">
              {email.folder === 'drafts' && (
                <span className="text-rose-600 font-semibold text-xs flex-shrink-0">
                  Draft
                </span>
              )}

              <span className={`truncate text-sm ${isUnread ? 'font-bold text-slate-950' : 'font-semibold text-slate-800'}`}>
                {email.subject || '(no subject)'}
              </span>

              <span className="text-slate-400 font-normal text-sm truncate hidden sm:inline">
                — {snippetText}
              </span>
            </div>

            {/* Sender Column (Shows after Subject) */}
            <div className="w-36 md:w-48 truncate mr-3 flex-shrink-0 text-left">
              <span className={`text-xs md:text-sm truncate ${isUnread ? 'font-semibold text-slate-800' : 'font-medium text-slate-500'}`}>
                {email.sender_name || email.sender_email}
              </span>
            </div>

            {/* Right Status Badges (Attachments, Date or Hover Actions) */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {hasAttachments && (
                <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" title="Has attachments" />
              )}

              {/* Date (Default visible; hides on hover when quick actions show) */}
              <span className="text-xs text-slate-500 group-hover:hidden whitespace-nowrap min-w-16 text-right font-medium">
                {formatGmailDate(email.received_at)}
              </span>

              {/* Quick Hover Actions (Gmail style: Archive, Trash, Read/Unread) */}
              <div
                className="hidden group-hover:flex items-center gap-1 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {onToggleRead && (
                  <button
                    type="button"
                    onClick={() => onToggleRead(email._id, !email.is_read)}
                    title={email.is_read ? 'Mark as unread' : 'Mark as read'}
                    className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors"
                  >
                    {email.is_read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </button>
                )}

                {folder === 'trash' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onRestore(email._id)}
                      title="Restore to Inbox"
                      className="p-1.5 rounded-full text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(email._id)}
                      title="Delete forever"
                      className="p-1.5 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTrash(email._id)}
                    title="Delete"
                    className="p-1.5 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EmailList;
