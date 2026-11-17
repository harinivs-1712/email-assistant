import React from 'react';
import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  Plus,
  Sparkles,
  Edit3,
} from 'lucide-react';

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: FileText },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];

const Sidebar = ({
  activeFolder,
  onFolderChange,
  onCompose,
  isAssistantOpen,
  onToggleAssistant,
  stats,
}) => {
  const getUnread = (folderKey) => {
    if (!stats || folderKey === 'starred') return 0;
    return stats[folderKey]?.unread || 0;
  };

  const getCount = (folderKey) => {
    if (!stats) return 0;
    if (folderKey === 'starred') return stats.starred?.count || 0;
    return stats[folderKey]?.count || 0;
  };

  return (
    <aside className="w-64 bg-[#f6f8fc] border-r border-slate-200/80 flex flex-col h-full flex-shrink-0 select-none">
      {/* ─── Top Brand Header ────────────────────────────────────────────── */}
      <div className="h-16 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Gmail-style Red Envelope Logo */}
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            M
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-normal text-slate-800 tracking-tight">Mail</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              AI
            </span>
          </div>
        </div>
      </div>

      {/* ─── Gmail Compose Button ────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-3.5 bg-[#c2e7ff] hover:bg-[#b3d7ef] hover:shadow-md text-[#001d35] font-semibold text-sm py-4 px-6 rounded-2xl shadow-xs transition-all duration-150 cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-[#001d35]" />
          <span>Compose</span>
        </button>
      </div>

      {/* ─── Gmail Folder Navigation ─────────────────────────────────────── */}
      <nav className="flex-1 pr-3 pt-2 space-y-0.5 overflow-y-auto">
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          const isActive = activeFolder === f.key;
          const unread = getUnread(f.key);
          const count = getCount(f.key);

          return (
            <button
              key={f.key}
              onClick={() => onFolderChange(f.key)}
              className={`w-full flex items-center justify-between pl-6 pr-4 py-2.5 rounded-r-full text-sm font-medium transition-colors duration-100 cursor-pointer ${
                isActive
                  ? 'bg-[#d3e3fd] text-[#041e49] font-bold'
                  : 'text-slate-700 hover:bg-[#eaedf2] hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? 'text-[#041e49]' : 'text-slate-600'
                  }`}
                />
                <span className="truncate">{f.label}</span>
              </div>

              {/* Counts Badge */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {unread > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-[#041e49] text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {unread}
                  </span>
                )}
                {unread === 0 && count > 0 && f.key !== 'inbox' && (
                  <span className="text-xs text-slate-400 font-normal">
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* ─── Bottom Assistant Status & Toggle ────────────────────────────── */}
      <div className="p-4 border-t border-slate-200/80 bg-white/40 flex-shrink-0">
        <button
          onClick={onToggleAssistant}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
            isAssistantOpen
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Sidecar</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            {isAssistantOpen ? 'Active' : 'Closed'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
