"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

// The popup a post opens in over Explore. Closing goes Back, so the URL and
// the history stay in step with what's on screen. It renders into <body>: the
// page template's fade-in leaves a transform behind, and a transformed
// ancestor would pin this fixed overlay to itself instead of the window.
export function PostModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.back();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [router]);

  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && router.back()}
      className="modal-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-[2px] sm:py-16"
    >
      <div className="relative w-full max-w-2xl rounded-xl bg-background p-4 shadow-2xl sm:p-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:bg-hover hover:text-foreground sm:right-4 sm:top-4"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
