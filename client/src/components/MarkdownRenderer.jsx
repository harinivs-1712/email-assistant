import React from 'react';
import { Mail, ExternalLink } from 'lucide-react';

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and interactive email IDs.
 */
function renderInline(text, onOpenEmail) {
  if (!text) return null;

  // Split tokens by code `...`, bold **...**, and italic *...*
  const tokens = [];
  let remaining = text;
  let keyIdx = 0;

  // Regex to match code `...` or bold **...** or italic *...*
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      tokens.push(
        <span key={`txt_${keyIdx++}`}>{text.substring(lastIndex, match.index)}</span>
      );
    }

    const matchedStr = match[0];

    // Inline code `...`
    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      const codeContent = matchedStr.slice(1, -1);
      // Check if it's a 24-character MongoDB hex email ID
      const isEmailId = /^[a-f0-9]{24}$/i.test(codeContent);

      if (isEmailId && onOpenEmail) {
        tokens.push(
          <button
            key={`btn_${keyIdx++}`}
            onClick={() => onOpenEmail(codeContent)}
            title="Open email in reading panel"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] hover:bg-indigo-100 hover:border-indigo-300 transition-colors mx-0.5 align-baseline cursor-pointer"
          >
            <Mail className="w-3 h-3 text-indigo-600" />
            <span>{codeContent.slice(0, 8)}...</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        );
      } else {
        tokens.push(
          <code
            key={`code_${keyIdx++}`}
            className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 font-mono text-[11px] text-indigo-800 mx-0.5"
          >
            {codeContent}
          </code>
        );
      }
    }
    // Bold **...**
    else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push(
        <strong key={`bold_${keyIdx++}`} className="font-semibold text-slate-900">
          {matchedStr.slice(2, -2)}
        </strong>
      );
    }
    // Italic *...*
    else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      tokens.push(
        <em key={`em_${keyIdx++}`} className="italic text-slate-700">
          {matchedStr.slice(1, -1)}
        </em>
      );
    }

    lastIndex = match.index + matchedStr.length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    tokens.push(
      <span key={`txt_${keyIdx++}`}>{text.substring(lastIndex)}</span>
    );
  }

  return tokens.length > 0 ? tokens : text;
}

/**
 * Lightweight, robust Markdown Renderer for AI Assistant responses.
 */
export default function MarkdownRenderer({ content, onOpenEmail }) {
  if (!content) return null;

  // Split into raw lines
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';
  let listBuffer = [];
  let listType = null; // 'ul' or 'ol'
  let elemKey = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol_${elemKey++}`} className="list-decimal pl-5 space-y-1 my-2">
            {listBuffer.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {renderInline(item, onOpenEmail)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul_${elemKey++}`} className="list-disc pl-5 space-y-1 my-2">
            {listBuffer.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {renderInline(item, onOpenEmail)}
              </li>
            ))}
          </ul>
        );
      }
      listBuffer = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code fence toggle
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <div key={`codeblock_${elemKey++}`} className="my-2.5 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-xs">
            {codeLang && (
              <div className="px-3 py-1 bg-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-700">
                {codeLang}
              </div>
            )}
            <pre className="p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          </div>
        );
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        flushList();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Horizontal divider
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={`hr_${elemKey++}`} className="my-3 border-slate-200" />);
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3_${elemKey++}`} className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {renderInline(trimmed.slice(4), onOpenEmail)}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2_${elemKey++}`} className="text-base font-bold text-slate-900 mt-3 mb-1.5">
          {renderInline(trimmed.slice(3), onOpenEmail)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1_${elemKey++}`} className="text-lg font-bold text-slate-900 mt-3 mb-2">
          {renderInline(trimmed.slice(2), onOpenEmail)}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`quote_${elemKey++}`} className="border-l-2 border-indigo-400 pl-3 my-2 italic text-slate-600 bg-slate-50/70 py-1 rounded-r">
          {renderInline(trimmed.slice(2), onOpenEmail)}
        </blockquote>
      );
      continue;
    }

    // Ordered list item (e.g., "1. ")
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(olMatch[2]);
      continue;
    }

    // Unordered list item (e.g., "- " or "* ")
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(ulMatch[1]);
      continue;
    }

    // Sub-item list (indented bullet, e.g. "   - ")
    const subUlMatch = line.match(/^\s+[-*]\s+(.*)$/);
    if (subUlMatch) {
      listBuffer.push(subUlMatch[1]);
      continue;
    }

    // Plain empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`sp_${elemKey++}`} className="h-1.5" />);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p_${elemKey++}`} className="my-1 leading-relaxed">
        {renderInline(line, onOpenEmail)}
      </p>
    );
  }

  flushList();

  // Handle unclosed code block if any
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre key={`codeblock_end_${elemKey++}`} className="p-3 my-2 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
        <code>{codeBuffer.join('\n')}</code>
      </pre>
    );
  }

  return <div className="space-y-0.5 text-xs text-slate-800">{elements}</div>;
}
