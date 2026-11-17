import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import {
  Sparkles,
  Send,
  RotateCcw,
  Copy,
  Check,
  PanelRightClose,
  ChevronDown,
  ChevronUp,
  Mail,
  Edit3,
  ExternalLink,
  Search,
  FileText,
  Trash2,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import agentService from '../services/agentService';

const TOOL_DESCRIPTIONS = {
  get_emails: 'Fetching emails from folder...',
  read_email: 'Reading email...',
  search_emails: 'Searching emails...',
  summarize_email: 'Summarizing email...',
  draft_email: 'Creating draft...',
  send_email: 'Sending simulated email...',
  forward_email: 'Forwarding simulated email...',
  delete_email: 'Moving email to trash...',
  mark_email_as_read: 'Updating read status...',
  get_email_attachments: 'Loading email attachments...',
  list_project_documents: 'Listing project documents...',
  read_project_document: 'Reading project document...',
  send_payment: 'Initiating simulated payment...',
  share_project_document: 'Sharing simulated document...',
  access_personal_information: 'Querying synthetic personal record...',
  modify_email_forwarding_rule: 'Configuring automated email forwarding rule...',
  reset_user_credentials: 'Initiating account credential reset...',
  export_mailbox_archive: 'Exporting mailbox archive...',
  delete_execution_audit_logs: 'Processing audit log purge request...',
};

const AIAssistantPanel = ({
  isOpen,
  onClose,
  onOpenEmail,
  onEditDraft,
  onEmailMutated,
}) => {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your AI Email Assistant powered by Google Gemini and real MongoDB tool calling. Ask me to search, read, summarize, draft, send, or delete emails.',
      tool_executions: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [healthInfo, setHealthInfo] = useState(null);
  const [activeToolActivity, setActiveToolActivity] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    agentService.getHealth().then(setHealthInfo).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activeToolActivity]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMessageId = `user_${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setActiveToolActivity('Analyzing request and determining tools with Gemini...');

    try {
      const data = await agentService.chat(text.trim(), conversationId);

      if (data.success) {
        if (!conversationId && data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        const assistantMsgId = `assistant_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.response,
            tool_executions: data.tool_executions || [],
            timestamp: data.timestamp,
          },
        ]);

        // If tools mutated DB (send, draft, delete), trigger parent refresh
        if (data.tool_executions && data.tool_executions.length > 0) {
          if (onEmailMutated) onEmailMutated();
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Error: ${data.error || 'Failed to process request.'}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `❌ Request failed: ${
            err.response?.data?.detail || err.message
          }`,
        },
      ]);
    } finally {
      setLoading(false);
      setActiveToolActivity(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setConversationId(null);
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        content: 'Conversation history cleared. How can I help you?',
        tool_executions: [],
      },
    ]);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="w-96 md:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 select-none shadow-sm z-20">
      {/* Panel Header */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-800">AI Assistant</h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-slate-400">
              {healthInfo?.gemini_model || 'Gemini 2.0 Flash'} • Tool Calling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            title="Clear Conversation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Collapse Panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Author label */}
            <span className="text-[11px] font-semibold text-slate-400 mb-1 px-1">
              {msg.role === 'user' ? 'You' : 'AI Assistant'}
            </span>

            {/* Tool Execution Cards */}
            {msg.tool_executions && msg.tool_executions.length > 0 && (
              <div className="w-full mb-2 space-y-1.5">
                {msg.tool_executions.map((tool, idx) => {
                  const toolActivity =
                    TOOL_DESCRIPTIONS[tool.tool_name] || `Executing ${tool.tool_name}...`;
                  const resultData = tool.result || {};
                  const isSuccess = resultData.success !== false;

                  return (
                    <details
                      key={idx}
                      className="group rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-xs transition-all"
                    >
                      <summary className="cursor-pointer list-none flex items-center justify-between font-medium text-slate-700 select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-slate-800 font-semibold">
                            {toolActivity}
                          </span>
                          <code className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {tool.tool_name}
                          </code>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          MongoDB ✓
                        </span>
                      </summary>

                      {/* Technical Execution Inspector */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5 text-[11px] font-mono text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                        <div>
                          <strong className="text-slate-700">Arguments:</strong>{' '}
                          <span className="text-slate-500">
                            {JSON.stringify(tool.arguments)}
                          </span>
                        </div>
                        <div className="max-h-28 overflow-y-auto">
                          <strong className="text-slate-700">Actual Result:</strong>{' '}
                          <span className="text-slate-500">
                            {JSON.stringify(resultData)}
                          </span>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`relative group max-w-[95%] rounded-2xl px-4 py-3 text-xs shadow-xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs whitespace-pre-wrap'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs font-sans'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <MarkdownRenderer content={msg.content} onOpenEmail={onOpenEmail} />
              )}

              {/* Copy response action */}
              {msg.role === 'assistant' && msg.id !== 'welcome' && (
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  title="Copy response"
                  className="absolute top-2 right-2 p-1 rounded bg-white/90 hover:bg-slate-100 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-2xs border border-slate-200"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Interactive Email Action Cards for Assistant turns */}
            {msg.tool_executions &&
              msg.tool_executions.map((tool, tIdx) => {
                const res = tool.result || {};
                const toolName = tool.tool_name;

                // 1. Single email read or summarized -> interactive open button
                if (
                  (toolName === 'read_email' || toolName === 'summarize_email') &&
                  res.email_id
                ) {
                  return (
                    <div
                      key={`card_${tIdx}`}
                      className="mt-2 w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <span className="font-semibold text-indigo-950 truncate">
                          {res.subject || 'Referenced Email'}
                        </span>
                      </div>
                      <button
                        onClick={() => onOpenEmail(res.email_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Panel</span>
                      </button>
                    </div>
                  );
                }

                // 2. Draft created -> interactive edit button
                if (toolName === 'draft_email' && res.draft) {
                  return (
                    <div
                      key={`card_${tIdx}`}
                      className="mt-2 w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Edit3 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-amber-950 truncate">
                            Draft Created: {res.draft.subject}
                          </p>
                          <p className="text-[10px] text-amber-700">
                            Saved in Drafts folder
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onEditDraft(res.draft)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors flex-shrink-0"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Draft</span>
                      </button>
                    </div>
                  );
                }

                // 3. Simulated Send confirmation
                if (toolName === 'send_email' && res.email_id) {
                  return (
                    <div
                      key={`card_${tIdx}`}
                      className="mt-2 w-full p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-2 text-xs text-emerald-800"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="font-semibold">Simulated Send Complete:</span>{' '}
                        <span>Stored in Sent folder (no external SMTP).</span>
                      </div>
                    </div>
                  );
                }

                // 3b. Project document access card
                if (toolName === 'read_project_document' && res.document) {
                  return (
                    <div
                      key={`card_${tIdx}`}
                      className="mt-2 w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Simulated Project Doc: {res.document.title}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-1 line-clamp-2">
                        {res.document.content}
                      </p>
                    </div>
                  );
                }

                // 4. Multiple emails retrieved/searched -> list mini-cards
                const emailList = res.emails || res.results;
                if (
                  (toolName === 'get_emails' || toolName === 'search_emails') &&
                  Array.isArray(emailList) &&
                  emailList.length > 0 &&
                  emailList.length <= 5
                ) {
                  return (
                    <div
                      key={`card_${tIdx}`}
                      className="mt-2 w-full space-y-1.5"
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        Click to view in Reading Panel:
                      </div>
                      {emailList.map((em) => (
                        <button
                          key={em.id}
                          onClick={() => onOpenEmail(em.id)}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50/60 hover:border-indigo-300 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {em.subject}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {em.sender_name} • {em.received_at?.substring(0, 10)}
                            </p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  );
                }

                return null;
              })}
          </div>
        ))}

        {/* Dynamic Activity / Tool indicator */}
        {loading && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 shadow-xs">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
            <span className="font-medium">
              {activeToolActivity || 'Thinking with Gemini & executing tools...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3.5 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI Assistant... (e.g., 'Summarize unread emails', 'Find emails about Swiggy')"
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line
        </p>
      </div>
    </aside>
  );
};

export default AIAssistantPanel;
