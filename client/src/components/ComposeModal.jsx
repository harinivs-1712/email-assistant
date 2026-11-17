import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Save, AlertCircle, Paperclip, FileText, ChevronDown } from 'lucide-react';

const AVAILABLE_DOCUMENTS = [
  {
    doc_id: 'DOC_BUDGET',
    title: 'Q4 Budget & Vendor Expenses',
    filename: 'q4_budget_expenses.pdf',
    mimetype: 'application/pdf',
    size: 4096,
    content: 'Project Budget Document: Q4 AI Research Assistant. Vendor TechNova Solutions allocation: INR 50,000.',
  },
  {
    doc_id: 'DOC_ROADMAP_2027',
    title: 'Product Roadmap 2027',
    filename: 'ai_assistant_roadmap_2027.pdf',
    mimetype: 'application/pdf',
    size: 5120,
    content: 'Autonomous AI Email Assistant Product Roadmap: Phase 1 Context grounding, Phase 2 Multi-modal attachments, Phase 3 Self-auditing firewall.',
  },
  {
    doc_id: 'DOC_ACADEMIC_RESEARCH',
    title: 'Quantum NLP Research Draft',
    filename: 'quantum_nlp_draft.pdf',
    mimetype: 'application/pdf',
    size: 6144,
    content: 'Working paper: Exploring quantum semantic representations in high-dimensional generative language models.',
  },
];

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

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
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showDocMenu, setShowDocMenu] = useState(false);

  const fileInputRef = useRef(null);

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
      if (initialData.attachments && Array.isArray(initialData.attachments)) {
        setAttachments(initialData.attachments);
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newAtt = {
          filename: file.name,
          mimetype: file.type || 'application/octet-stream',
          size: file.size,
          content: typeof reader.result === 'string' ? reader.result : '',
          url: null,
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      // Read as text if readable or data url
      if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachProjectDoc = (doc) => {
    // Avoid duplicate doc_id
    if (attachments.some((a) => a.doc_id === doc.doc_id)) {
      setShowDocMenu(false);
      return;
    }
    const newAtt = {
      filename: doc.filename,
      mimetype: doc.mimetype,
      size: doc.size,
      doc_id: doc.doc_id,
      content: doc.content,
      url: `/documents/${doc.doc_id}`,
    };
    setAttachments((prev) => [...prev, newAtt]);
    setShowDocMenu(false);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
        attachments: attachments,
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
              rows={8}
              className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400 resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span>Attachments ({attachments.length})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="font-medium max-w-[180px] truncate" title={att.filename}>
                      {att.filename}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({formatSize(att.size)})
                    </span>
                    {att.doc_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold uppercase">
                        DOC
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-1"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          className="hidden"
        />

        {/* Simulated disclaimer banner */}
        <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span>
            Simulated Email: Sent messages and drafts update MongoDB directly; documents & attachments are stored safely in the database.
          </span>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Discard
            </button>

            {/* Attach local file */}
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="Attach document or file"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Attach File</span>
            </button>

            {/* Attach project document dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDocMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                title="Attach internal project document"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Attach Project Doc</span>
                <ChevronDown className="w-3 h-3 text-indigo-400" />
              </button>

              {showDocMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Project Document
                  </div>
                  {AVAILABLE_DOCUMENTS.map((doc) => (
                    <button
                      key={doc.doc_id}
                      type="button"
                      onClick={() => handleAttachProjectDoc(doc)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between group transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-slate-800 group-hover:text-indigo-600 truncate">
                          {doc.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {doc.doc_id} • {doc.filename}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                        {formatSize(doc.size)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
