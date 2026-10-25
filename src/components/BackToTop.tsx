"use client";

import { useEffect, useState } from "react";

// A round button in the bottom-right corner that shows up once you're a screen
// or so down a long page (the Explore feed, a busy room) and takes you back to
// the top, where the nav is.
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
      }
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`fixed bottom-5 right-5 z-40 rounded-full border border-rule bg-card p-2.5 text-muted shadow-lg shadow-black/10 transition duration-200 hover:bg-hover hover:text-foreground motion-reduce:transition-none sm:bottom-8 sm:right-8 ${
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
