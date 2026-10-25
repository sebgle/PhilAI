"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import { THEMES, type MatchLink, type MatchResponse } from "@/lib/contract";
import { requestMatch, type MockVariant } from "@/lib/matching";
import { SafetyCard } from "@/components/SafetyCard";
import { setPassageStatus, setResonated, type Status as Feedback } from "../../library/actions";
import { SharePanel } from "./SharePanel";

// One highlighter per line; the passage's echoing phrase uses the same one.
// Colors live in globals.css (--hl-1..3) so light and dark mode both work.
const COLORS = [
  { hl: "var(--hl-1)", ring: "ring-amber-500" },
  { hl: "var(--hl-2)", ring: "ring-sky-500" },
  { hl: "var(--hl-3)", ring: "ring-rose-500" },
];

// Matching takes ~15 s; say what's actually happening rather than spin.
const STAGES = [
  "Reading your entry…",
  "Finding the lines that carry the most feeling…",
  "Searching 900 passages for ones that feel the same way…",
  "Finding the words in each passage that echo yours…",
];

function Finding() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STAGES.length - 1)), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-sm text-muted animate-pulse" aria-live="polite">
      {STAGES[i]}
    </p>
  );
}

const themeName = new Map(THEMES.map((t) => [t.slug, t.name]));

export function Matches({
  entryId,
  text,
  initial,
  initialFeedback,
  mockVariant,
}: {
  entryId: string;
  text: string;
  initial: MatchResponse | null;
  initialFeedback: Record<string, Feedback>;
  mockVariant: MockVariant;
}) {
  const [match, setMatch] = useState<MatchResponse | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(initialFeedback);
  // "Spoke to me" per passage, seeded from the stored rows.
  const [resonated, setResonated_] = useState<Set<string>>(() => resonatedIn(initial));
  const [actionError, setActionError] = useState<string | null>(null);

  // Muse has stretches of refusing requests that outlast one server call's
  // retry budget, so the page itself tries again a few times before giving up.
  const AUTO_RETRIES = 3;
  const [retrying, setRetrying] = useState(0);

  async function run() {
    setError(null);
    for (let attempt = 0; attempt <= AUTO_RETRIES; attempt++) {
      setRetrying(attempt);
      try {
        setMatch(await requestMatch(entryId, text, mockVariant));
        setRetrying(0);
        return;
      } catch (e) {
        if (attempt === AUTO_RETRIES) {
          setRetrying(0);
          setError(e instanceof Error ? e.message : "Matching failed");
          return;
        }
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      }
    }
  }

  // Only on first mount: an entry that already has matches is never re-run.
  // The ref stops React's dev-mode double effect from matching twice.
  const started = useRef(false);
  useEffect(() => {
    if (initial || started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleResonated(passageId: string) {
    const was = resonated.has(passageId);
    setResonated_((r) => { const n = new Set(r); if (was) n.delete(passageId); else n.add(passageId); return n; });
    const { error } = await setResonated(entryId, passageId, !was);
    setActionError(error);
    if (error) setResonated_((r) => { const n = new Set(r); if (was) n.add(passageId); else n.delete(passageId); return n; });
  }

  // Optimistic: flip the card now, roll back if the server refuses.
  async function setLinkFeedback(passageId: string, value: Feedback) {
    const prev = feedback[passageId] ?? null;
    const next = prev === value ? null : value;
    setFeedback((f) => ({ ...f, [passageId]: next }));
    const { error } = await setPassageStatus(entryId, passageId, next);
    setActionError(error);
    if (error) setFeedback((f) => ({ ...f, [passageId]: prev }));
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <p className="text-sm text-red-600">
          Muse, the model that finds your passages, isn&apos;t responding right now. Your entry is saved.{" "}
          <button type="button" onClick={run} className="underline">Try again</button>
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col gap-4">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        {retrying > 0 ? (
          <p className="animate-pulse text-sm text-muted" aria-live="polite">
            Muse is busy. Trying again ({retrying} of {AUTO_RETRIES})…
          </p>
        ) : (
          <Finding />
        )}
      </div>
    );
  }

  // Risk-flagged entries still show their passages (the matcher already
  // skipped any that could romanticize death), under the 988 card, with
  // sharing turned off. The server refuses those shares too.
  const locked = match.risk_flag;

  const cardProps = (link: MatchLink, i: number) => ({
    entryId,
    link,
    color: COLORS[i % COLORS.length],
    feedback: feedback[link.passage.id] ?? null,
    onFeedback: (v: Feedback) => setLinkFeedback(link.passage.id, v),
    resonated: resonated.has(link.passage.id),
    onResonate: () => toggleResonated(link.passage.id),
    canShare: !locked,
  });

  if (match.fallback || (locked && !match.links.length)) {
    return (
      <div className="flex flex-col gap-6">
        {locked && <SafetyCard />}
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        {match.links.length > 0 && (
          <p className="text-sm text-muted">
            We couldn&apos;t pin this one to specific lines, but these passages share its feeling.
          </p>
        )}
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        {match.links.map((link, i) => (
          <PassageCard key={link.passage.id} {...cardProps(link, i)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {locked && <SafetyCard />}
      <EntryText text={text} links={match.links} selected={selected} onSelect={setSelected} />
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {selected === null ? (
        <p className="text-sm text-muted">
          {match.links.length
            ? "Tap a highlighted line to see the passage it found."
            : "No passages found for this entry yet."}
        </p>
      ) : (
        <div key={selected} className="flex flex-col gap-4">
          <PassageCard {...cardProps(match.links[selected], selected)} />
          {(match.links[selected].alternates?.length ?? 0) > 0 && (
            <>
              <p className="text-sm text-muted">Two more that came close. Tell us which ones spoke to you.</p>
              {match.links[selected].alternates!.map((alt) => (
                <PassageCard key={alt.passage.id} {...cardProps(alt, selected)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function resonatedIn(m: MatchResponse | null) {
  const out = new Set<string>();
  for (const l of m?.links ?? []) {
    if (l.resonated) out.add(l.passage.id);
    for (const a of l.alternates ?? []) if (a.resonated) out.add(a.passage.id);
  }
  return out;
}

// The entry with each verified line wrapped in its color. Spans come straight
// from line_start/line_end; overlapping or out-of-range spans are skipped.
function EntryText({
  text,
  links,
  selected,
  onSelect,
}: {
  text: string;
  links: MatchLink[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const spans = links
    .map((l, i) => ({ start: l.line_start, end: l.line_end, i }))
    .filter((s): s is { start: number; end: number; i: number } =>
      s.start !== null && s.end !== null && s.start >= 0 && s.end <= text.length && s.start < s.end,
    )
    .sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  // Strokes land one after another, in reading order.
  let order = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    parts.push(text.slice(cursor, s.start));
    const c = COLORS[s.i % COLORS.length];
    parts.push(
      <mark
        key={s.i}
        role="button"
        tabIndex={0}
        aria-pressed={selected === s.i}
        onClick={() => onSelect(s.i)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(s.i);
          }
        }}
        style={{ "--hl": c.hl, "--delay": `${200 + order++ * 450}ms` } as React.CSSProperties}
        className={`hl cursor-pointer rounded-sm bg-transparent px-0.5 text-inherit ${
          selected === s.i ? `ring-2 ${c.ring}` : ""
        }`}
      >
        {text.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  }
  parts.push(text.slice(cursor));

  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}

function PassageCard({
  entryId,
  link,
  color,
  feedback,
  onFeedback,
  resonated,
  onResonate,
  canShare,
}: {
  entryId: string;
  link: MatchLink;
  color: (typeof COLORS)[number];
  feedback: Feedback;
  onFeedback: (v: Feedback) => void;
  resonated: boolean;
  onResonate: () => void;
  canShare: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const { passage, phrase_start: ps, phrase_end: pe } = link;
  const hasPhrase = ps !== null && pe !== null && ps >= 0 && pe <= passage.text.length && ps < pe;

  return (
    <section
      className={`letter rounded-sm border border-rule bg-card p-6 transition-opacity ${feedback === "not_for_me" ? "opacity-50" : ""}`}
    >
      <blockquote className="font-serif text-lg leading-[1.7]">
        {hasPhrase ? (
          <>
            {passage.text.slice(0, ps!)}
            <mark
              style={{ "--hl": color.hl, "--delay": "450ms" } as React.CSSProperties}
              className="hl rounded-sm bg-transparent px-0.5 text-inherit"
            >
              {passage.text.slice(ps!, pe!)}
            </mark>
            {passage.text.slice(pe!)}
          </>
        ) : (
          passage.text
        )}
      </blockquote>
      <p className="mt-3 text-sm">
        <span className="font-medium">{passage.author}</span>
        <span className="text-muted">
          , <cite>{passage.work}</cite>
          {passage.year ? ` (${passage.year})` : ""}
        </span>
        <span className="ml-2 rounded-full bg-hover px-2 py-0.5 text-xs">
          {themeName.get(link.theme) ?? link.theme}
        </span>
      </p>
      <p className="mt-3 text-sm italic opacity-80">{link.reason}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={onResonate}
          aria-pressed={resonated}
          title="Not a bookmark: it tells the matcher what moves you."
          className="rounded border border-rule px-3 py-1 hover:bg-hover aria-pressed:border-foreground aria-pressed:bg-hover"
        >
          {resonated ? "♥ Spoke to me" : "♡ Spoke to me"}
        </button>
        <button
          type="button"
          onClick={() => onFeedback("saved")}
          aria-pressed={feedback === "saved"}
          className="rounded border border-rule px-3 py-1 hover:bg-hover aria-pressed:bg-[#2383e2] aria-pressed:text-white"
        >
          {feedback === "saved" ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => onFeedback("not_for_me")}
          aria-pressed={feedback === "not_for_me"}
          className="rounded border border-rule px-3 py-1 hover:bg-hover aria-pressed:bg-hover"
        >
          Not for me
        </button>
        <Link
          href={`/authors/${encodeURIComponent(passage.author)}`}
          className="rounded border border-rule px-3 py-1 hover:bg-hover"
        >
          More by {passage.author}
        </Link>
        {link.line_text && canShare && (
          <button
            type="button"
            onClick={() => setSharing(!sharing)}
            aria-expanded={sharing}
            className="rounded border border-rule px-3 py-1 hover:bg-hover"
          >
            Share this line
          </button>
        )}
      </div>
      {feedback === "not_for_me" && (
        <p className="mt-2 text-xs text-muted">Got it. This helps us find better matches.</p>
      )}
      {sharing && <SharePanel entryId={entryId} link={link} onClose={() => setSharing(false)} />}
    </section>
  );
}
