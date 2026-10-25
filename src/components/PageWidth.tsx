"use client";

import { usePathname } from "next/navigation";

// Write and Entries are two-column pages (artwork beside content); everything
// else keeps a comfortable single reading column.
const WIDE = new Set(["/", "/entries"]);

export function PageWidth({ children }: { children: React.ReactNode }) {
  const wide = WIDE.has(usePathname());
  return (
    <main className={`mx-auto w-full flex-1 px-4 py-10 sm:px-8 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
      {children}
    </main>
  );
}
