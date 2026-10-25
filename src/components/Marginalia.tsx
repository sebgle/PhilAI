// The forum as marginalia: the passage is the page, the shared line is the
// note written in its margin. Used by forum posts and the share preview, so
// the preview shows exactly what strangers will see.
export function Marginalia({
  passage,
  phraseStart,
  phraseEnd,
  line,
  meta,
}: {
  passage: { author: string; work: string; year: number | null; text: string };
  phraseStart: number | null;
  phraseEnd: number | null;
  line: string;
  meta: React.ReactNode;
}) {
  const ps = phraseStart, pe = phraseEnd;
  const hasPhrase = ps !== null && pe !== null && ps >= 0 && ps < pe && pe <= passage.text.length;

  return (
    <div className="grid gap-4 p-5 sm:grid-cols-[1fr_14rem]">
      <div>
        <blockquote className="font-serif text-lg leading-relaxed">
          {hasPhrase ? (
            <>
              {passage.text.slice(0, ps!)}
              <mark className="rounded-sm bg-[var(--hl-1)] px-0.5 text-inherit">
                {passage.text.slice(ps!, pe!)}
              </mark>
              {passage.text.slice(pe!)}
            </>
          ) : (
            passage.text
          )}
        </blockquote>
        <p className="mt-2 text-sm">
          <span className="font-medium">{passage.author}</span>
          <span className="text-muted">
            , <cite>{passage.work}</cite>
            {passage.year ? ` (${passage.year})` : ""}
          </span>
        </p>
      </div>
      <aside className="border-l-2 border-rule pl-4 sm:self-start">
        <p className="break-words font-serif italic leading-snug">&ldquo;{line}&rdquo;</p>
        <p className="mt-2 text-xs text-muted">{meta}</p>
      </aside>
    </div>
  );
}
