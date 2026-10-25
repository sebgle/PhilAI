// Faded line icons, the only decoration in the app. Fall things: a leaf, an
// acorn, a mug of something warm. Drawn once here so every page sprinkles
// the same set. Always decorative (aria-hidden); color comes from the
// className, usually text-foreground/15.
const PATHS: Record<string, string> = {
  leaf: "M4 20C4 11 11 4 20 4c0 9-7 16-16 16Zm0 0L14 10M9 15c2-1 4-3 5-5",
  maple: "M12 3l1.8 4.6L19 7l-2 4.5L21 15h-5.5L12 20.5 8.5 15H3l4-3.5L5 7l5.2.6L12 3Zm0 12.5V21",
  acorn: "M6.5 10c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6Zm.8 0c0 5.5 2.4 8.6 4.7 10 2.3-1.4 4.7-4.5 4.7-10M12 4V2.5",
  mug: "M5 8h11v8.5A3.5 3.5 0 0 1 12.5 20h-4A3.5 3.5 0 0 1 5 16.5V8Zm11 2h1.5a2.5 2.5 0 0 1 0 5H16M8.5 5c0-1.5 1-1.5 1-3M12 5c0-1.5 1-1.5 1-3",
  pinecone: "M12 3c-3.5 2.5-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-2.5-8.5-6-11Zm-4 7l4 2 4-2M7 14l5 2 5-2M8.5 18l3.5 1.5 3.5-1.5",
  feather: "M20 4c-6 0-11 4-13.5 11.5L4 20M6.5 15.5C11 15.5 15 13 18.5 8M9 11.5l3-1.5M12 15l3.5-2",
  mushroom: "M4 11c0-4.5 3.5-8 8-8s8 3.5 8 8Zm5 0c0 5 0 7.5 1 10h4c1-2.5 1-5 1-10M9 7.5h.01M14 6h.01",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
};

export type DoodleName = keyof typeof PATHS;

export function Doodle({ name, className = "h-10 w-10 text-foreground/15" }: { name: DoodleName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// Every page starts the same way: a title, maybe a line under it, and one
// faded doodle in the corner.
export function PageTitle({
  title,
  subtitle,
  doodle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  doodle: DoodleName;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <Doodle name={doodle} className="mt-1 h-10 w-10 shrink-0 text-foreground/15" />
    </div>
  );
}
