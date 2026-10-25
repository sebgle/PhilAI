// A shared line with the passage it was matched to. The line leads, since
// strangers come here to find each other; the passage sits under it like a
// clipping tucked in beside the note. Used by forum posts, author pages and
// the share preview, so the preview shows exactly what strangers will see.
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
    <div className="px-5 pt-5 pb-4">
      <p className="break-words font-serif text-[1.35rem] leading-snug">&ldquo;{line}&rdquo;</p>
      <p className="mt-2 text-xs text-muted">{meta}</p>

      <figure className="mt-4 border-l-2 border-sand pl-4">
        <blockquote className="font-serif leading-relaxed text-foreground/75">
          {hasPhrase ? (
            <>
              {passage.text.slice(0, ps!)}
              <mark className="rounded-sm bg-[var(--hl-1)] px-0.5 text-foreground">
                {passage.text.slice(ps!, pe!)}
              </mark>
              {passage.text.slice(pe!)}
            </>
          ) : (
            passage.text
          )}
        </blockquote>
        <figcaption className="mt-1.5 text-xs text-muted">
          {passage.author}, <cite>{passage.work}</cite>
          {passage.year ? ` (${passage.year})` : ""}
        </figcaption>
      </figure>
    </div>
  );
}
