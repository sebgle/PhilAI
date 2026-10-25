"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Backdrop } from "@/components/Backdrop";
import { Showcase } from "./Showcase";

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
    <main className="grid min-h-screen md:grid-cols-2">
      <Backdrop variant="login" />
      {/* Instagram's layout: the pitch and a fan of screenshots on the left,
          the way in on the right, a thin rule between. Phones show the
          pitch above the form and drop the screenshots. */}
      <section className="flex flex-col items-center justify-center gap-12 px-6 pb-4 pt-14 md:border-r md:border-rule md:py-16">
        <h1 className="max-w-md text-center text-3xl font-medium leading-snug tracking-tight sm:text-[2.6rem] sm:leading-[1.3]">
          Don&apos;t journal alone! Explore the philosophy of your ideas to{" "}
          <span className="font-serif font-semibold italic text-terracotta">find your people</span>.
        </h1>
        <div className="hidden w-full md:block">
          <Showcase />
        </div>
      </section>

      <section className="flex items-center justify-center px-6 pb-14 pt-6 md:py-16">
        <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
          <p className="mb-2 text-center text-4xl leading-none tracking-tight">
            <span className="font-serif font-semibold italic">Phil</span>
            <span className="font-semibold">AI</span>
          </p>
          <h2 className="mb-2 text-center text-xl font-medium tracking-tight">
            {mode === "signup" ? "Start journaling" : "Welcome back"}
          </h2>
          <input
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-rule bg-card px-3 py-2.5"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-rule bg-card px-3 py-2.5"
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
            className="rounded-lg bg-terracotta px-4 py-2.5 font-medium text-white hover:bg-terracotta-deep disabled:opacity-50"
          >
            {mode === "signup" ? "Create account" : "Log in"}
          </button>
          {message && <p className="text-sm text-red-600">{message}</p>}
          <p className="mt-2 text-center text-sm text-muted">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-terracotta hover:text-terracotta-deep"
            >
              {mode === "signup" ? "Log in" : "Sign up"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted">
            Your email is only used to log in; others only ever see a random name.
            A reflection and community space, not therapy or emergency help.
          </p>
        </form>
      </section>
    </main>
  );
}
