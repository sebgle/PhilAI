"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Three parts: the name on the left, the worded tabs in the middle, and
// new entry, the bell and the account on the right. No bar behind them: they sit on the surface.
const TABS = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" || p.startsWith("/posts") },
  { href: "/entries", label: "Entries", match: (p: string) => p.startsWith("/entries") },
  { href: "/library", label: "Saved", match: (p: string) => p.startsWith("/library") },
  // Author pages are browsing, not the reader's saved items, so they count as Community.
  { href: "/forums", label: "Community", match: (p: string) => p.startsWith("/forums") || p.startsWith("/authors") },
];

const tab =
  "rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-hover hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-terracotta aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-6";
const icon = "rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground aria-[current=page]:text-foreground";

export function TopNav({ handle, unread }: { handle: string; unread: number }) {
  const path = usePathname();

  return (
    <header>
      <nav className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-5 py-3 text-sm sm:px-8">
        {/* "Phil" in the book face (Literata, semibold italic), "AI" in the UI sans: old and new in one word. */}
        <Link href="/" className="justify-self-start text-[19px] leading-none tracking-tight">
          <span className="font-serif font-semibold italic">Phil</span>
          <span className="font-semibold">AI</span>
        </Link>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.match(path) ? "page" : undefined} className={`${tab} shrink-0`}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 justify-self-end">
          <Link
            href="/write"
            aria-current={path.startsWith("/write") ? "page" : undefined}
            aria-label="New entry"
            title="New entry"
            className={icon}
          >
            <PlusIcon />
          </Link>
          <Link
            href="/notifications"
            aria-current={path.startsWith("/notifications") ? "page" : undefined}
            aria-label={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
            title={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
            className={`${icon} relative`}
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-terracotta px-1 text-center text-[10px] font-semibold leading-4 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            aria-current={path.startsWith("/account") ? "page" : undefined}
            aria-label={`Account (${handle})`}
            title={handle}
            className={icon}
          >
            <UserIcon />
          </Link>
        </div>
      </nav>
    </header>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" />
    </svg>
  );
}
