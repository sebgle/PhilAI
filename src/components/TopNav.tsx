"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The top bar from the sketch: one full-width row of bordered cells, the
// current page's cell shaded. PhilAI and ⊕ both open the Write page.
const TABS = [
  { href: "/", label: "PhilAI", match: (p: string) => p === "/", brand: true },
  { href: "/entries", label: "Entries", match: (p: string) => p.startsWith("/entries") },
  { href: "/library", label: "Saved", match: (p: string) => p.startsWith("/library") || p.startsWith("/authors") },
  { href: "/forums", label: "Forums", match: (p: string) => p.startsWith("/forums") },
];

const cell = "flex items-center border-r border-rule px-3 py-3 hover:bg-hover aria-[current=page]:bg-hover sm:px-4";

export function TopNav({ handle, unread }: { handle: string; unread: number }) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-background">
      <nav className="no-scrollbar flex overflow-x-auto text-sm sm:text-[15px]">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.match(path) ? "page" : undefined}
            className={`${cell} shrink-0 ${t.brand ? "font-serif text-lg italic" : "text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
        <span className="flex-1 border-r border-rule" />
        <Link
          href="/notifications"
          aria-current={path.startsWith("/notifications") ? "page" : undefined}
          aria-label={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
          title={unread ? `${unread} new ${unread === 1 ? "reply" : "replies"}` : "Notifications"}
          className={`${cell} relative shrink-0`}
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute right-2 top-2 min-w-4 rounded-full bg-[#eb5757] px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          href="/account"
          aria-current={path.startsWith("/account") ? "page" : undefined}
          aria-label={`Account (${handle})`}
          title={handle}
          className={`${cell} shrink-0`}
        >
          <UserIcon />
        </Link>
        {/* On phones the PhilAI cell already opens Write; drop ⊕ to fit the row. */}
        <Link href="/" aria-label="New entry" title="New entry" className={`${cell} hidden shrink-0 border-r-0 sm:flex`}>
          <PlusIcon />
        </Link>
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

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
