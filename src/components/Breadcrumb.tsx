import Link from "next/link";

// The one way back: the parent page's name, then a slash, above the title.
export function Breadcrumb({ href, label }: { href: string; label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <Link href={href} className="underline-offset-4 hover:text-foreground hover:underline">{label}</Link>
      <span aria-hidden="true" className="ml-1.5 opacity-60">/</span>
    </nav>
  );
}
