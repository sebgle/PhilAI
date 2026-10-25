"use client";

import { useSelectedLayoutSegment } from "next/navigation";

// Every page reads in one narrow column, a little left of center on wide
// screens so the right margin is left to the art. Explore is the exception:
// it's a mosaic you scan, not a page you read, so it takes the full width.
// The segment (not the URL) decides, so the mosaic stays wide behind a post
// popup whose URL is /posts/<id>.
export function ReadingColumn({ children }: { children: React.ReactNode }) {
  if (useSelectedLayoutSegment() === "__PAGE__") return <>{children}</>;
  return <div className="max-w-2xl lg:ml-[6%]">{children}</div>;
}
