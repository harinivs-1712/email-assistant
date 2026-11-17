import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import EmailList from '../components/EmailList';
import EmailPane from '../components/EmailPane';
import ComposeModal from '../components/ComposeModal';
import AIAssistantPanel from '../components/AIAssistantPanel';
import emailService from '../services/emailService';

// ─── Toast System ─────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };
  return { toasts, showToast };
};

const FOLDER_TITLES = {
  inbox: 'Inbox',
  starred: 'Starred',
  sent: 'Sent',
  drafts: 'Drafts',
  trash: 'Trash',
};

const InboxPage = () => {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [stats, setStats] = useState(null);
  const { toasts, showToast } = useToast();
  const searchTimeoutRef = useRef(null);

  // ─── Fetch emails by folder ─────────────────────────────────────────────────
  const fetchEmails = useCallback(async (folder) => {
    setLoading(true);
    try {
      const res = await emailService.getByFolder(folder);
      const list = res.data || [];
      setEmails(list);

      // If currently selected email is not in this folder, unselect or update
      setSelectedEmail((prev) => {
        if (!prev) return null;
        const found = list.find((e) => e._id === prev._id);
        return found || null;
      });
    } catch (err) {
      showToast('Failed to load emails', 'error');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch stats (folder & unread counts) ───────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await emailService.getStats();
      setStats(res.data || {});
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchEmails(activeFolder);
    fetchStats();
  }, [activeFolder, fetchEmails, fetchStats]);

  // ─── Search input handling ─────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!q.trim()) {
      fetchEmails(activeFolder);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await emailService.search(q.trim());
        setEmails(res.data || []);
      } catch (err) {
        showToast('Search query failed', 'error');
        setEmails([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchEmails(activeFolder);
  };

  // ─── Select Email (auto-mark read) ──────────────────────────────────────────
  const handleSelectEmail = useCallback(
    async (email) => {
      setSelectedEmail(email);
      if (!email.is_read) {
        try {
          await emailService.toggleRead(email._id, true);
          setEmails((prev) =>
            prev.map((e) => (e._id === email._id ? { ...e, is_read: true } : e))
          );
          setSelectedEmail((prev) =>
            prev?._id === email._id ? { ...prev, is_read: true } : prev
          );
          fetchStats();
        } catch (err) {
          // ignore
        }
      }
    },
    [fetchStats]
  );

  // ─── Open Email from AI Assistant ───────────────────────────────────────────
  const handleOpenEmailFromAgent = useCallback(
    async (emailId) => {
      try {
        const res = await emailService.getById(emailId);
        if (res.data) {
          setSelectedEmail(res.data);
          // If the email is from a different folder, switch folder or keep current
          if (res.data.folder && res.data.folder !== activeFolder) {
            setActiveFolder(res.data.folder);
          }
          showToast(`Opened email: ${res.data.subject}`, 'info');
        }
      } catch (err) {
        showToast(`Email ${emailId} could not be loaded`, 'error');
      }
    },
    [activeFolder]
  );

  // ─── Edit Draft from AI Assistant ───────────────────────────────────────────
  const handleEditDraftFromAgent = useCallback((draft) => {
    setDraftToEdit(draft);
    setComposeOpen(true);
  }, []);

  // ─── Star action ────────────────────────────────────────────────────────────
  const handleStar = useCallback(
    async (id, is_starred) => {
      try {
        await emailService.toggleStar(id, is_starred);
        setEmails((prev) =>
          prev.map((e) => (e._id === id ? { ...e, is_starred } : e))
        );
        setSelectedEmail((prev) =>
          prev?._id === id ? { ...prev, is_starred } : prev
        );
        fetchStats();
      } catch (err) {
        showToast('Failed to update star', 'error');
      }
    },
    [fetchStats]
  );

  // ─── Move to trash ──────────────────────────────────────────────────────────
  const handleTrash = useCallback(
    async (id) => {
      try {
        await emailService.trash(id);
        showToast('Moved email to trash', 'info');
        setEmails((prev) => prev.filter((e) => e._id !== id));
        if (selectedEmail?._id === id) setSelectedEmail(null);
        fetchStats();
      } catch (err) {
        showToast('Failed to move to trash', 'error');
      }
    },
    [selectedEmail, fetchStats]
  );

  // ─── Restore from trash ─────────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (id) => {
      try {
        await emailService.restore(id);
        showToast('Restored email to inbox', 'success');
        setEmails((prev) => prev.filter((e) => e._id !== id));
        if (selectedEmail?._id === id) setSelectedEmail(null);
        fetchStats();
      } catch (err) {
        showToast('Failed to restore email', 'error');
      }
    },
    [selectedEmail, fetchStats]
  );

  // ─── Permanent delete ───────────────────────────────────────────────────────
  const handlePermanentDelete = useCallback(
    async (id) => {
      try {
        await emailService.deletePermanently(id);
        showToast('Email permanently deleted from MongoDB', 'info');
        setEmails((prev) => prev.filter((e) => e._id !== id));
        if (selectedEmail?._id === id) setSelectedEmail(null);
        fetchStats();
      } catch (err) {
        showToast('Failed to delete email', 'error');
      }
    },
    [selectedEmail, fetchStats]
  );

  // ─── Toggle read ────────────────────────────────────────────────────────────
  const handleToggleRead = useCallback(
    async (id, is_read) => {
      try {
        await emailService.toggleRead(id, is_read);
        setEmails((prev) =>
          prev.map((e) => (e._id === id ? { ...e, is_read } : e))
        );
        setSelectedEmail((prev) =>
          prev?._id === id ? { ...prev, is_read } : prev
        );
        fetchStats();
      } catch (err) {
        showToast('Failed to update read status', 'error');
      }
    },
    [fetchStats]
  );

  // ─── Reply / Forward ────────────────────────────────────────────────────────
  const handleReply = (email) => {
    setDraftToEdit({
      to: email.sender_email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\nOn ${new Date(email.received_at).toLocaleDateString()}, ${email.sender_name} wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`,
    });
    setComposeOpen(true);
  };

  const handleForward = (email) => {
    setDraftToEdit({
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${email.sender_name} <${email.sender_email}>\nDate: ${new Date(email.received_at).toLocaleString()}\nSubject: ${email.subject}\n\n${email.body}`,
    });
    setComposeOpen(true);
  };

  // ─── Send email handler (from ComposeModal) ─────────────────────────────────
  const handleSendEmail = async (payload) => {
    try {
      if (payload.status === 'draft') {
        await emailService.create(payload);
        showToast('Draft saved successfully', 'success');
      } else {
        await emailService.create(payload);
        showToast('Email sent (simulated MongoDB dispatch)', 'success');
      }
      fetchEmails(activeFolder);
      fetchStats();
    } catch (err) {
      showToast('Failed to send email', 'error');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* ─── 1. Left Sidebar: Folders & Compose ───────────────────────────── */}
      <Sidebar
        activeFolder={activeFolder}
        onFolderChange={(f) => {
          setActiveFolder(f);
          setSelectedEmail(null);
          setSearchQuery('');
        }}
        onCompose={() => {
          setDraftToEdit(null);
          setComposeOpen(true);
        }}
        isAssistantOpen={isAssistantOpen}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
        stats={stats}
      />

      {/* ─── 2. Middle Section: Gmail-Style List or Full Email Reading View ── */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white overflow-hidden border-r border-slate-200">
        {/* Top Search & Header Bar (Gmail Pill Style) */}
        <header className="h-16 px-6 border-b border-slate-200/80 flex items-center justify-between gap-4 bg-white flex-shrink-0">
          {/* Search bar styled like Gmail */}
          <div className="flex-1 max-w-2xl relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search in mail (e.g. sender, subject, keywords)..."
              className="w-full pl-11 pr-10 py-2.5 rounded-full bg-[#f1f3f4] hover:bg-[#e9ebee] focus:bg-white border border-transparent focus:border-slate-300 text-sm text-slate-800 placeholder:text-slate-500 focus:shadow-md outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Folder indicator */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hidden sm:inline-block">
              {searchQuery ? 'Search' : FOLDER_TITLES[activeFolder]} • {emails.length}
            </span>

            {/* Toggle AI Assistant button if collapsed */}
            {!isAssistantOpen && (
              <button
                onClick={() => setIsAssistantOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all flex-shrink-0 shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>AI Assistant</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Gmail View: List OR Selected Email Reading View */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
          {selectedEmail ? (
            /* When an email is clicked: Full screen reading view with Back button */
            <EmailPane
              email={selectedEmail}
              onStar={handleStar}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onDelete={handlePermanentDelete}
              onToggleRead={handleToggleRead}
              onReply={handleReply}
              onForward={handleForward}
              onClose={() => setSelectedEmail(null)}
              folder={activeFolder}
            />
          ) : (
            /* When no email is selected: Full Gmail table row-by-row list */
            <EmailList
              emails={emails}
              selectedId={selectedEmail?._id}
              onSelect={handleSelectEmail}
              onStar={handleStar}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onDelete={handlePermanentDelete}
              onToggleRead={handleToggleRead}
              folder={activeFolder}
              loading={loading}
            />
          )}
        </div>
      </main>

      {/* ─── 3. Right Section: AI Assistant Chat Panel ─────────────────────── */}
      <AIAssistantPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onOpenEmail={handleOpenEmailFromAgent}
        onEditDraft={handleEditDraftFromAgent}
        onEmailMutated={() => {
          fetchEmails(activeFolder);
          fetchStats();
        }}
      />

      {/* ─── Compose / Edit Draft Modal ────────────────────────────────────── */}
      {composeOpen && (
        <ComposeModal
          initialData={draftToEdit}
          onClose={() => {
            setComposeOpen(false);
            setDraftToEdit(null);
          }}
          onSend={handleSendEmail}
        />
      )}

      {/* ─── Floating Toast Notifications ──────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-2 ${
              t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : t.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InboxPage;
