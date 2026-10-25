"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { THEMES, type MatchLink, type ScrubResponse, type ScrubSpan } from "@/lib/contract";
import { MAX_LINE } from "@/lib/forum";
import { Marginalia } from "@/components/Marginalia";

const themeName = new Map(THEMES.map((t) => [t.slug, t.name]));
const TYPE_LABEL: Record<ScrubSpan["type"], string> = {
  name: "a name",
  place: "a place",
  school: "a school",
  email: "an email address",
  phone: "a phone number",
  other: "something identifying",
};

// Removing an identifier shouldn't leave "at  ." behind.
function tidy(s: string) {
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
}

// Share one highlighted line to its theme forum: edit, scrub identifiers,
// preview exactly what strangers see, post. Only this line and its passage
// leave the journal.
export function SharePanel({
  entryId,
  link,
  onClose,
}: {
  entryId: string;
  link: MatchLink;
  onClose: () => void;
}) {
  const [text, setText] = useState(link.line_text ?? "");
  const [scrub, setScrub] = useState<ScrubResponse | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  // Re-scrub shortly after the user stops typing. A stale response (for text
  // that has since changed) is ignored.
  useEffect(() => {
    if (!text.trim()) return;
    let cancelled = false;
    setScrubbing(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/scrub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const body: ScrubResponse = res.ok ? await res.json() : { text, spans: [] };
        if (!cancelled) setScrub(body);
      } finally {
        if (!cancelled) setScrubbing(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text]);

  const current = scrub?.text === text;
  const warnings = current ? scrub!.spans.filter((s) => !kept.has(s.value)) : [];
  const tooLong = text.length > MAX_LINE;
  const canPost = !!text.trim() && !tooLong && current && !scrubbing && warnings.length === 0 && !posting;

  // "…at Lincoln High." → "…." would leave a dangling "at"; drop a lone
  // preposition when the identifier ended the sentence.
  function remove(span: ScrubSpan) {
    let before = text.slice(0, span.start);
    const after = text.slice(span.end);
    if (/^\s*([.,!?;:]|$)/.test(after)) before = before.replace(/\s+(at|in|from|near|to|on|of|with)\s*$/i, " ");
    setText(tidy(before + after));
  }

  async function post() {
    setPosting(true);
    setError(null);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: entryId,
        forum_id: link.theme,
        line_text: text.trim(),
        passage_id: link.passage.id,
        phrase_start: link.phrase_start,
        phrase_end: link.phrase_end,
      }),
    });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Couldn't share this line.");
    }
    setPosted(true);
  }

  const forumName = themeName.get(link.theme) ?? link.theme;

  if (posted) {
    return (
      <div className="mt-4 rounded border border-rule p-4 text-sm">
        <p>
          Shared to <span className="font-medium">{forumName}</span>. Nobody can see who you are, and
          nothing else from your entry left your journal.
        </p>
        <div className="mt-2 flex gap-4">
          <Link href={`/forums/${link.theme}`} className="underline">See it in {forumName}</Link>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4 rounded border border-rule p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">Share this line</h3>
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs">Posting to {forumName}</span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">You can trim or edit it first.</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          aria-label="Line to share"
          className="w-full rounded border border-rule bg-transparent p-2"
        />
        <span className={`self-end text-xs ${tooLong ? "text-red-600" : "opacity-50"}`}>
          {text.length}/{MAX_LINE}
        </span>
      </label>

      {scrubbing && <p className="text-sm text-muted">Checking for anything that could identify you…</p>}
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-2 rounded bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          {warnings.map((s) => (
            <li key={`${s.start}-${s.value}`} className="flex flex-wrap items-center gap-2">
              <span>
                &ldquo;{s.value}&rdquo; looks like {TYPE_LABEL[s.type]}.
              </span>
              <button type="button" onClick={() => remove(s)} className="underline">Remove it</button>
              <button
                type="button"
                onClick={() => setKept(new Set(kept).add(s.value))}
                className="underline text-muted"
              >
                It&apos;s fine
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide opacity-50">What others will see</p>
        <div className="rounded border border-dashed border-rule">
          <Marginalia
            passage={link.passage}
            phraseStart={link.phrase_start}
            phraseEnd={link.phrase_end}
            line={text.trim() || "…"}
            meta="a new name for this thread · just now"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={post}
          disabled={!canPost}
          className="rounded-full bg-terracotta px-4 py-2 text-white hover:bg-terracotta-deep disabled:opacity-40"
        >
          {posting ? "Posting…" : `Post to ${forumName}`}
        </button>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}
