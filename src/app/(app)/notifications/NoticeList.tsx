"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReplyNotice } from "@/lib/notifications";
import { LocalDate } from "@/components/LocalDate";

// Opening the page marks everything seen, which re-renders it on the server
// with no unread flags. Keep the first render's flags so the "new" dots stay
// visible for this visit.
export function NoticeList({ replies, themeNames }: { replies: ReplyNotice[]; themeNames: Record<string, string> }) {
  const [unreadIds] = useState(() => new Set(replies.filter((r) => r.unread).map((r) => r.id)));

  return (
    <ul className="flex flex-col divide-y divide-rule border-y border-rule">
      {replies.map((r) => {
        const isNew = unreadIds.has(r.id);
        return (
          <li key={r.id}>
            <Link href={`/forums/${r.post.forum_id}`} className="flex gap-3 px-2 py-4 hover:bg-hover">
              <span
                aria-label={isNew ? "New" : undefined}
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isNew ? "bg-terracotta" : "bg-transparent"}`}
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm text-muted">
                  {r.alias} replied to &ldquo;{r.post.line_text}&rdquo; in {themeNames[r.post.forum_id] ?? r.post.forum_id}
                </span>
                <span className="line-clamp-2">{r.text}</span>
                <span className="text-xs text-muted"><LocalDate iso={r.created_at} withTime /></span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
