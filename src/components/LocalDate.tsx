"use client";

// Formats a timestamp in the viewer's timezone. The server renders in UTC, so
// the first paint can differ by a day; suppressHydrationWarning covers that.
export function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const d = new Date(iso);
  const text = withTime
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
