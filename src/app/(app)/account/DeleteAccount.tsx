"use client";

import { useState } from "react";

// Typing "delete" is the confirmation, so it can't happen by a stray click.
export function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Couldn't delete your account.");
    }
    // Full reload so no cached signed-in UI survives.
    window.location.href = "/login";
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm">
        Type <span className="font-mono">delete</span> to confirm
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className="mt-1 block w-full max-w-xs rounded border border-rule bg-transparent px-3 py-2"
        />
      </label>
      <button
        type="button"
        onClick={remove}
        disabled={busy || confirm.trim().toLowerCase() !== "delete"}
        className="self-start rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
