"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THEMES, type MatchLink, type MatchResponse } from "@/lib/contract";
import { IS_MOCK, requestMatch, type MockVariant } from "@/lib/matching";
import { SafetyCard } from "@/components/SafetyCard";

type Feedback = "saved" | "not_for_me" | null;

// One color per highlighted line; the passage's echoing phrase uses the same one.
const COLORS = [
  { mark: "bg-amber-200/80 dark:bg-amber-400/30", ring: "ring-amber-500" },
  { mark: "bg-sky-200/80 dark:bg-sky-400/30", ring: "ring-sky-500" },
  { mark: "bg-rose-200/80 dark:bg-rose-400/30", ring: "ring-rose-500" },
];

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

  async function run() {
    setError(null);
    try {
      setMatch(await requestMatch(entryId, text, mockVariant));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matching failed");
    }
  }

  useEffect(() => {
    if (!initial) run();
    // Only on first mount: an entry that already has matches is never re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setLinkFeedback(passageId: string, value: Feedback) {
    const next = feedback[passageId] === value ? null : value;
    setFeedback((f) => ({ ...f, [passageId]: next }));
    if (IS_MOCK) return;
    const { error } = await createClient()
      .from("matches")
      .update({ feedback: next })
      .eq("entry_id", entryId)
      .eq("passage_id", passageId);
    if (error) setError(error.message);
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <p className="text-sm text-red-600">
          {error}{" "}
          <button type="button" onClick={run} className="underline">Try again</button>
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col gap-4">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <p className="text-sm opacity-60 animate-pulse">Finding passages that feel the same way…</p>
      </div>
    );
  }

  if (match.risk_flag) {
    return (
      <div className="flex flex-col gap-6">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <SafetyCard />
      </div>
    );
  }

  const cardProps = (link: MatchLink, i: number) => ({
    link,
    color: COLORS[i % COLORS.length],
    feedback: feedback[link.passage.id] ?? null,
    onFeedback: (v: Feedback) => setLinkFeedback(link.passage.id, v),
  });

  if (match.fallback) {
    return (
      <div className="flex flex-col gap-6">
        <EntryText text={text} links={[]} selected={null} onSelect={() => {}} />
        <p className="text-sm opacity-70">
          We couldn&apos;t pin this one to specific lines, but these passages share its feeling.
        </p>
        {match.links.map((link, i) => (
          <PassageCard key={link.passage.id} {...cardProps(link, i)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <EntryText text={text} links={match.links} selected={selected} onSelect={setSelected} />
      {selected === null ? (
        <p className="text-sm opacity-60">
          {match.links.length
            ? "Tap a highlighted line to see the passage it found."
            : "No passages found for this entry yet."}
        </p>
      ) : (
        <PassageCard key={selected} {...cardProps(match.links[selected], selected)} />
      )}
    </div>
  );
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
        className={`cursor-pointer rounded px-0.5 text-inherit ${c.mark} ${
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
  link,
  color,
  feedback,
  onFeedback,
}: {
  link: MatchLink;
  color: (typeof COLORS)[number];
  feedback: Feedback;
  onFeedback: (v: Feedback) => void;
}) {
  const { passage, phrase_start: ps, phrase_end: pe } = link;
  const hasPhrase = ps !== null && pe !== null && ps >= 0 && pe <= passage.text.length && ps < pe;

  return (
    <section
      className={`rounded border border-foreground/15 p-5 ${feedback === "not_for_me" ? "opacity-50" : ""}`}
    >
      <blockquote className="font-serif text-lg leading-relaxed">
        {hasPhrase ? (
          <>
            {passage.text.slice(0, ps!)}
            <mark className={`rounded px-0.5 text-inherit ${color.mark}`}>
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
        <span className="opacity-70">
          , <cite>{passage.work}</cite>
          {passage.year ? ` (${passage.year})` : ""}
        </span>
        <span className="ml-2 rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
          {themeName.get(link.theme) ?? link.theme}
        </span>
      </p>
      <p className="mt-3 text-sm italic opacity-80">{link.reason}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => onFeedback("saved")}
          aria-pressed={feedback === "saved"}
          className="rounded border border-foreground/20 px-3 py-1 hover:bg-foreground/5 aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {feedback === "saved" ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => onFeedback("not_for_me")}
          aria-pressed={feedback === "not_for_me"}
          className="rounded border border-foreground/20 px-3 py-1 hover:bg-foreground/5 aria-pressed:bg-foreground/10"
        >
          Not for me
        </button>
        {/* Wired up in S8 (author pages) and S9 (share flow). */}
        <button type="button" disabled title="Author pages are coming soon" className="rounded border border-foreground/10 px-3 py-1 opacity-40">
          More by {passage.author}
        </button>
        {link.line_text && (
          <button type="button" disabled title="Sharing is coming soon" className="rounded border border-foreground/10 px-3 py-1 opacity-40">
            Share this line
          </button>
        )}
      </div>
      {feedback === "not_for_me" && (
        <p className="mt-2 text-xs opacity-70">Got it. This helps us find better matches.</p>
      )}
    </section>
  );
}
