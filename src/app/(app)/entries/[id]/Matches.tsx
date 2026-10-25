"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import type { MatchLink, MatchResponse } from "@/lib/contract";
import { requestMatch, type MockVariant } from "@/lib/matching";
import { SafetyCard } from "@/components/SafetyCard";
import type { QualityRating } from "@/lib/match-feedback";
import { setPassageStatus, setResonated, setMatchQuality, type Status as Feedback } from "../../library/actions";
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
  "Searching for passages that speak to your situation…",
  "Comparing passages for a useful perspective…",
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


export function Matches({
  entryId,
  text,
  initial,
  initialFeedback,
  initialRiskFlag = false,
  mockVariant,
}: {
  entryId: string;
  text: string;
  initial: MatchResponse | null;
  initialRiskFlag?: boolean;
  initialFeedback: Record<string, Feedback>;
  mockVariant: MockVariant;
}) {
  const [match, setMatch] = useState<MatchResponse | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(initialFeedback);
  // "Spoke to me" per passage, seeded from the stored rows.
  const [resonated, setResonated_] = useState<Set<string>>(() => resonatedIn(initial));
  const [quality, setQuality] = useState<Record<string, QualityRating | null>>(() => qualityIn(initial));
  const [qualityBusy, setQualityBusy] = useState<Set<string>>(new Set());
  const qualityLocks = useRef(new Set<string>());
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
        const result = await requestMatch(entryId, text, mockVariant);
        setMatch(result);
        setResonated_(resonatedIn(result));
        setQuality(qualityIn(result));
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

  // "Spoke to me" and "Not for me" are the two ends of one axis, so turning
  // one on turns the other off. Save is a bookmark and independent of both.
  async function toggleResonated(passageId: string) {
    const was = resonated.has(passageId);
    setResonated_((r) => { const n = new Set(r); if (was) n.delete(passageId); else n.add(passageId); return n; });
    if (!was && feedback[passageId] === "not_for_me") void setLinkFeedback(passageId, "not_for_me", true);
    const { error } = await setResonated(entryId, passageId, !was);
    setActionError(error);
    if (error) setResonated_((r) => { const n = new Set(r); if (was) n.add(passageId); else n.delete(passageId); return n; });
  }

  async function updateQuality(passageId: string, value: QualityRating) {
    if (qualityLocks.current.has(passageId)) return;
    qualityLocks.current.add(passageId);
    setQualityBusy((old) => new Set(old).add(passageId));
    const previous = quality[passageId] ?? null;
    const next = previous === value ? null : value;
    setQuality((old) => ({ ...old, [passageId]: next }));
    setActionError(null);
    try {
      const { error } = await setMatchQuality(entryId, passageId, next);
      if (error) throw new Error(error);
    } catch {
      setQuality((old) => ({ ...old, [passageId]: previous }));
      setActionError("Could not save your response. Please try again.");
    } finally {
      qualityLocks.current.delete(passageId);
      setQualityBusy((old) => { const result = new Set(old); result.delete(passageId); return result; });
    }
  }

  // Optimistic: flip the card now, roll back if the server refuses.
  async function setLinkFeedback(passageId: string, value: Feedback, fromResonate = false) {
    const prev = feedback[passageId] ?? null;
    const next = prev === value ? null : value;
    setFeedback((f) => ({ ...f, [passageId]: next }));
    if (next === "not_for_me" && !fromResonate && resonated.has(passageId)) void toggleResonated(passageId);
    const { error } = await setPassageStatus(entryId, passageId, next);
    setActionError(error);
    if (error) setFeedback((f) => ({ ...f, [passageId]: prev }));
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {initialRiskFlag && <SafetyCard />}
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <p className="text-sm text-red-600">
          Matching is unavailable right now. Your entry is saved.{" "}
          <button type="button" onClick={run} className="underline">Try again</button>
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col gap-4">
        {initialRiskFlag && <SafetyCard />}
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

  const cardProps = (link: MatchLink, i: number, variant: "primary" | "alt" = "primary") => ({
    entryId,
    link,
    variant,
    color: COLORS[i % COLORS.length],
    feedback: feedback[link.passage.id] ?? null,
    onFeedback: (v: Feedback) => setLinkFeedback(link.passage.id, v),
    resonated: resonated.has(link.passage.id),
    onResonate: () => toggleResonated(link.passage.id),
    quality: quality[link.passage.id] ?? null,
    qualityBusy: qualityBusy.has(link.passage.id),
    onQuality: (value: QualityRating) => updateQuality(link.passage.id, value),
    canShare: !locked,
  });

  if (match.links.length === 0) {
    return <div className="flex flex-col gap-4">
      {locked && <SafetyCard />}
      <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
      <p className="text-sm text-muted" role="status">We couldn&apos;t find a passage that adds enough to this line.</p>
    </div>;
  }

  if (match.fallback) {
    return (
      <div className="flex flex-col gap-6">
        {locked && <SafetyCard />}
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        {match.links.length > 0 && (
          <p className="text-sm text-muted">
            We couldn&apos;t pin this one to specific lines, but these passages offer a perspective on your entry.
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
            ? "Tap a highlighted line to see its match."
            : "We couldn’t find a passage that adds enough to this line."}
        </p>
      ) : (
        <div key={selected} className="flex flex-col gap-4">
          <PassageCard {...cardProps(match.links[selected], selected)} />
          {(match.links[selected].alternates?.length ?? 0) > 0 && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Also close</p>
              {match.links[selected].alternates!.map((alt) => (
                <PassageCard key={alt.passage.id} {...cardProps(alt, selected, "alt")} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function qualityIn(match: MatchResponse | null): Record<string, QualityRating | null> {
  return Object.fromEntries((match?.links ?? []).flatMap((link) => [link, ...(link.alternates ?? [])])
    .map((link) => [link.passage.id, link.quality_feedback ?? null]));
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

// The chosen passage shows its reason and the full action row; a runner-up
// ("alt") is just the passage, who wrote it, and the two signals.
function PassageCard({
  entryId,
  link,
  variant,
  color,
  feedback,
  onFeedback,
  resonated,
  onResonate,
  canShare,
  onQuality,
}: {
  entryId: string;
  link: MatchLink;
  variant: "primary" | "alt";
  color: (typeof COLORS)[number];
  feedback: Feedback;
  onFeedback: (v: Feedback) => void;
  resonated: boolean;
  onResonate: () => void;
  canShare: boolean;
  quality: QualityRating | null;
  qualityBusy: boolean;
  onQuality: (value: QualityRating) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const { passage, phrase_start: ps, phrase_end: pe } = link;
  const hasPhrase = ps !== null && pe !== null && ps >= 0 && pe <= passage.text.length && ps < pe;

  return (
    <section
      className={`letter rounded-lg border border-rule bg-card/70 p-6 transition-opacity ${feedback === "not_for_me" ? "opacity-50" : ""}`}
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
        <Link href={`/authors/${encodeURIComponent(passage.author)}`} className="font-medium underline-offset-2 hover:underline">
          {passage.author}
        </Link>
        <span className="text-muted">
          , <cite>{passage.work}</cite>
          {passage.year ? ` (${passage.year})` : ""}
        </span>
      </p>
      {variant === "primary" && <p className="mt-3 text-sm italic text-muted">{link.reason}</p>}

      {/* Left: thumbs up (spoke to me) and thumbs down (not for me), one axis.
          Right: Share, and the bookmark (save). Icons only, no borders. */}
      <div className="mt-4 flex items-center gap-1 text-sm">
        <IconButton on={resonated} onClick={() => { onResonate(); onQuality("helped"); }} label={resonated ? "Spoke to me (on)" : "Spoke to me"} onClass="text-terracotta">
          <ThumbIcon up filled={resonated} />
        </IconButton>
        {variant === "primary" && (
          <IconButton on={feedback === "not_for_me"} onClick={() => { onFeedback("not_for_me"); onQuality("misunderstood"); }} label="Not for me" onClass="text-foreground">
            <ThumbIcon up={false} filled={feedback === "not_for_me"} />
          </IconButton>
        )}
        <span className="flex-1" />
        {variant === "primary" && link.line_text && canShare && (
          <button
            type="button"
            onClick={() => setSharing(!sharing)}
            aria-expanded={sharing}
            className="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-foreground"
          >
            Share
          </button>
        )}
        <IconButton on={feedback === "saved"} onClick={() => onFeedback("saved")} label={feedback === "saved" ? "Saved" : "Save"} onClass="text-terracotta">
          <BookmarkIcon filled={feedback === "saved"} />
        </IconButton>
      </div>
      {sharing && <SharePanel entryId={entryId} link={link} onClose={() => setSharing(false)} />}
    </section>
  );
}

function IconButton({ on, onClick, label, onClass, children }: { on: boolean; onClick: () => void; label: string; onClass: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 transition-colors hover:bg-hover ${on ? onClass : "text-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const iconProps = {
  width: 18, height: 18, viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.7,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
};

function ThumbIcon({ up, filled }: { up: boolean; filled: boolean }) {
  return (
    <svg {...iconProps} fill={filled ? "currentColor" : "none"} className={up ? undefined : "rotate-180"}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.5-7a2.5 2.5 0 0 1 2.4 3.1L13.3 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg {...iconProps} fill={filled ? "currentColor" : "none"}>
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );
}
