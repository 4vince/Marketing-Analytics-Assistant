"use client";

import { Fragment, ReactNode } from "react";

// Minimal, XSS-safe renderer for the LLM's Markdown-style replies.
// Handles **bold**, *italic*, `code`, bare URLs, newlines, and dash/numbered
// list items. Everything renders as React text nodes (no innerHTML), so raw
// HTML or injection attempts in model output stay inert.
function inlineNodes(input: string): ReactNode[] {
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|(https?:\/\/[^\s]+)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={key++}>{input.slice(last, m.index)}</Fragment>);
    }
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<em key={key++}>{m[2]}</em>);
    } else if (m[3] !== undefined) {
      out.push(
        <code key={key++} className="rounded bg-brand-pitch/60 px-1 py-0.5 text-[13px]">
          {m[3]}
        </code>
      );
    } else if (m[4] !== undefined) {
      out.push(
        <a
          key={key++}
          href={m[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary-400 break-all"
        >
          {m[4]}
        </a>
      );
    }
    last = re.lastIndex;
  }
  if (last < input.length) {
    out.push(<Fragment key={key++}>{input.slice(last)}</Fragment>);
  }
  return out;
}

function renderLine(line: string, key: number): ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return <div key={key} className="h-1" />;

  const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
  if (bullet) {
    return (
      <div key={key} className="flex gap-2">
        <span className="shrink-0 select-none text-brand-muted" aria-hidden="true">
          •
        </span>
        <div>{inlineNodes(bullet[1])}</div>
      </div>
    );
  }

  const numbered = trimmed.match(/^(\d+[.)])\s+(.*)$/);
  if (numbered) {
    return (
      <div key={key} className="flex gap-2">
        <span className="shrink-0 select-none text-brand-muted" aria-hidden="true">
          {numbered[1]}
        </span>
        <div>{inlineNodes(numbered[2])}</div>
      </div>
    );
  }

  return <div key={key}>{inlineNodes(trimmed)}</div>;
}

export default function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="h-3" />}
          <div className="space-y-0.5">
            {paragraph.split("\n").map((line, j) => renderLine(line, j))}
          </div>
        </Fragment>
      ))}
    </>
  );
}