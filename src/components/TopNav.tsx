"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One quiet row: the name, four text tabs, the bell and the account. The
// current tab sits on Notion's hover grey.
const TABS = [
  { href: "/", label: "Write", match: (p: string) => p === "/" },
  { href: "/entries", label: "Entries", match: (p: string) => p.startsWith("/entries") },
  { href: "/library", label: "Saved", match: (p: string) => p.startsWith("/library") || p.startsWith("/authors") },
  { href: "/forums", label: "Forums", match: (p: string) => p.startsWith("/forums") },
];

const tab =
  "rounded-md px-2.5 py-1 text-muted hover:bg-hover hover:text-foreground aria-[current=page]:bg-hover aria-[current=page]:text-foreground";

export function TopNav({ handle, unread }: { handle: string; unread: number }) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-background">
      <nav className="no-scrollbar mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-8">
        <Link href="/" className="mr-2 shrink-0 rounded-md px-1.5 py-0.5 font-serif text-lg italic hover:bg-hover">
          PhilAI
        </Link>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.match(path) ? "page" : undefined} className={`${tab} shrink-0`}>
            {t.label}
          </Link>
        ))}
        <span className="flex-1" />
        <Link
          href="/notifications"
          aria-current={path.startsWith("/notifications") ? "page" : undefined}
          aria-label={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
          title={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
          className={`${tab} relative shrink-0 !px-1.5`}
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#eb5757] px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          href="/account"
          aria-current={path.startsWith("/account") ? "page" : undefined}
          aria-label={`Account (${handle})`}
          title={handle}
          className={`${tab} shrink-0 !px-1.5`}
        >
          <UserIcon />
        </Link>
      </nav>
    </header>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

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
