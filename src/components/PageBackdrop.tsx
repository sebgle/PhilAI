"use client";

import { usePathname } from "next/navigation";
import { Backdrop, BACKDROP_VARIANTS, type BackdropVariant } from "./Backdrop";

function variantFor(path: string): BackdropVariant {
  if (path === "/entries") return "entries";
  if (path.startsWith("/entries/")) return "matches";
  if (path.startsWith("/library")) return "saved";
  if (path.startsWith("/forums") || path.startsWith("/authors")) return "community";
  if (path.startsWith("/account") || path.startsWith("/notifications")) return "quiet";
  return "write";
}

// Lives in the signed-in layout so it survives navigation: every page's art
// stays mounted and the old pair fades out as the new one fades in, instead
// of the corners swapping in a single frame.
export function PageBackdrop() {
  const current = variantFor(usePathname());
  return (
    <>
      {BACKDROP_VARIANTS.filter((v) => v !== "login").map((v) => (
        <Backdrop key={v} variant={v} active={v === current} />
      ))}
    </>
  );
}
