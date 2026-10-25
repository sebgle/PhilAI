"use client";

import { useState } from "react";

// Heart with a count. Optimistic: flips at once, reverts if the server says no.
// Signed-out requests get redirected to /login by the middleware, which fetch
// follows and reports as an HTML 200, so a redirected response counts as a miss.
export function LikeButton({
  postId,
  replyId,
  count,
  liked,
}: {
  postId?: string;
  replyId?: string;
  count: number;
  liked: boolean;
}) {
  const [state, setState] = useState({ count, liked });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (busy) return;
    const prev = state;
    setState({ liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) });
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postId ? { post_id: postId } : { reply_id: replyId }),
      });
      const body = res.ok && !res.redirected ? await res.json().catch(() => null) : null;
      if (!body || typeof body.count !== "number") throw new Error("like failed");
      setState({ liked: !!body.liked, count: body.count });
    } catch {
      setState(prev);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const label = `${state.liked ? "Unlike" : "Like"}${state.count ? `, ${state.count} ${state.count === 1 ? "like" : "likes"}` : ""}`;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.liked}
      aria-label={label}
      title={error ? "Couldn't save that. Try again." : label}
      className={`inline-flex items-center gap-1 rounded px-1 leading-none hover:text-foreground ${
        state.liked ? "text-red-600" : "text-muted"
      } ${error ? "underline decoration-red-600" : ""}`}
    >
      <span aria-hidden="true" className="text-sm">{state.liked ? "♥" : "♡"}</span>
      {state.count > 0 && <span className="tabular-nums">{state.count}</span>}
    </button>
  );
}
