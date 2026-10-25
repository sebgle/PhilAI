"use client";

import { useState } from "react";
import Image from "next/image";

// Three screenshots fanned like the phones on Instagram's login page: two
// tilted behind, one in front. Files live in public/landing/, 1600x1000,
// light mode, browser chrome cropped. A missing file shows a blank page
// sketch in the card's tint, so the fan holds its shape before they exist.
const CARDS = [
  { src: "/landing/explore.png", alt: "The Explore feed", tint: "bg-[var(--hl-2)]", pos: "left-0 top-10 w-[62%] -rotate-6" },
  { src: "/landing/thread.png", alt: "A thread of replies", tint: "bg-[var(--hl-3)]", pos: "right-0 top-10 w-[62%] rotate-6" },
  { src: "/landing/matches.png", alt: "Passages matched to an entry", tint: "bg-[var(--hl-1)]", pos: "left-1/2 top-0 -translate-x-1/2 z-10 w-[72%]" },
];

export function Showcase() {
  const [missing, setMissing] = useState<Set<string>>(new Set());

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-lg">
      {CARDS.map((c) => (
        <div
          key={c.src}
          className={`absolute aspect-[16/10] overflow-hidden rounded-xl bg-card shadow-xl shadow-black/15 ring-1 ring-rule ${c.pos}`}
        >
          {missing.has(c.src) ? (
            <div className={`flex h-full flex-col gap-2 p-[8%] ${c.tint}`}>
              <span className="h-2 w-1/3 rounded-full bg-foreground/15" />
              <span className="mt-2 h-2 w-full rounded-full bg-foreground/10" />
              <span className="h-2 w-5/6 rounded-full bg-foreground/10" />
              <span className="h-2 w-2/3 rounded-full bg-foreground/10" />
            </div>
          ) : (
            <Image
              src={c.src}
              alt={c.alt}
              fill
              sizes="360px"
              className="object-cover object-top"
              onError={() => setMissing((m) => new Set(m).add(c.src))}
            />
          )}
        </div>
      ))}
    </div>
  );
}
