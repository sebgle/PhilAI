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
              <mark className="rounded bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-400/30">
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
          <span className="opacity-70">
            , <cite>{passage.work}</cite>
            {passage.year ? ` (${passage.year})` : ""}
          </span>
        </p>
      </div>
      <aside className="border-l-2 border-amber-400/60 pl-4 sm:self-start">
        <p className="break-words italic leading-snug">&ldquo;{line}&rdquo;</p>
        <p className="mt-2 text-xs opacity-60">{meta}</p>
      </aside>
    </div>
  );
}
