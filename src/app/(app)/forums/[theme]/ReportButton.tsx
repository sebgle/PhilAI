"use client";

import { useState } from "react";

// Two-step inline confirm (no browser dialog).
export function ReportButton({ postId, replyId }: { postId?: string; replyId?: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "sending" | "done" | "error">("idle");

  async function send() {
    setState("sending");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postId ? { post_id: postId } : { reply_id: replyId }),
    });
    setState(res.ok ? "done" : "error");
  }

  const cls = "rounded px-1 text-sm leading-none tracking-widest text-muted opacity-60 hover:text-foreground hover:opacity-100";
  if (state === "done") return <span className="text-xs text-muted">Reported. Thank you.</span>;
  if (state === "error") return <span className="text-xs text-red-600">Couldn&apos;t report. Try again later.</span>;
  if (state === "confirm" || state === "sending") {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-muted">Report this?</span>
        <button type="button" onClick={send} disabled={state === "sending"} className="underline text-red-600">
          Yes, report
        </button>
        <button type="button" onClick={() => setState("idle")} className="underline text-muted">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setState("confirm")} aria-label="Report" title="Report" className={cls}>
      ···
    </button>
  );
}
