"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message);
    // No session after sign-up means the project requires email confirmation.
    if (!data.session) return setMessage("Check your email to confirm your account.");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">PhilAI</h1>
        <p className="text-sm opacity-70">
          Your email is only used to log in. Nobody else ever sees it: other people
          only see a random name.
        </p>
        <input
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 bg-transparent"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 bg-transparent"
        />
        {mode === "signup" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-1"
            />
            <span>I&apos;m 18 or older, and I understand PhilAI is a reflection space, not therapy or emergency help.</span>
          </label>
        )}
        <button
          type="submit"
          disabled={busy || (mode === "signup" && !adult)}
          className="rounded px-3 py-2 bg-foreground text-background disabled:opacity-50"
        >
          {mode === "signup" ? "Create account" : "Log in"}
        </button>
        {message && <p className="text-sm text-red-600">{message}</p>}
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="text-sm underline opacity-70"
        >
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
        <p className="text-xs opacity-60">
          A reflection and community space, not therapy or emergency help.
        </p>
      </form>
    </main>
  );
}
