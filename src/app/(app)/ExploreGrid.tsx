"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { THEMES } from "@/lib/contract";
import { ThemeIcon } from "@/components/ThemeIcon";
import { exploreTiles, type Cursor, type TileData } from "./explore";

// Tiles take one of these grounds, picked from the post id so a post keeps its
// color between visits and neighbours rarely match.
const TINTS = ["bg-card", "bg-[var(--hl-1)]", "bg-[var(--hl-2)]", "bg-[var(--hl-3)]"];

function tintFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

// Short lines get set large, long ones smaller, so the mosaic varies in rhythm
// the way a photo grid varies in shape. chars and px are rough per-line
// figures used only to guess a tile's height when placing it.
const SIZES = [
  { max: 60, cls: "text-[1.6rem] leading-tight", chars: 15, px: 34 },
  { max: 140, cls: "text-[1.25rem] leading-snug", chars: 21, px: 28 },
  { max: Infinity, cls: "text-base leading-relaxed", chars: 28, px: 26 },
];
const sizeFor = (line: string) => SIZES.find((s) => line.length < s.max)!;

// Each tile goes to whichever column is shortest so far. Placement depends
// only on the tiles before it, so loading more appends to the bottoms of the
// columns and never moves a tile already on screen (CSS columns would reflow).
function place(tiles: TileData[], n: number) {
  const cols: TileData[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  for (const t of tiles) {
    const s = sizeFor(t.line);
    const k = heights.indexOf(Math.min(...heights));
    cols[k].push(t);
    heights[k] += Math.ceil((t.line.length + 2) / s.chars) * s.px + 110;
  }
  return cols;
}

// The mosaic, which keeps loading as you near the bottom. The button is both
// the trigger the observer watches and a fallback to click.
export function ExploreGrid({ initial, next: firstNext }: { initial: TileData[]; next: Cursor | null }) {
  const [tiles, setTiles] = useState(initial);
  const [next, setNext] = useState(firstNext);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);

  async function loadMore() {
    if (!next || busy.current) return;
    busy.current = true;
    setLoading(true);
    const page = await exploreTiles(next).catch(() => null);
    busy.current = false;
    setLoading(false);
    if (!page) return;
    // A post can only repeat if the feed shifted under us; skip it if so.
    setTiles((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      return [...prev, ...page.tiles.filter((t) => !seen.has(t.id))];
    });
    setNext(page.next);
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  });

  return (
    <>
      {/* Two columns on phones, three from md up; each is placed on its own. */}
      {[2, 3].map((n) => (
        <div key={n} className={`gap-3 ${n === 2 ? "flex md:hidden" : "hidden md:flex"}`}>
          {place(tiles, n).map((col, i) => (
            <ul key={i} className="flex min-w-0 flex-1 flex-col gap-3">
              {col.map((t) => (
                <li key={t.id}>
                  <Tile tile={t} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      ))}

      {next ? (
        <button
          ref={sentinel}
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mx-auto rounded-full border border-rule bg-card px-4 py-1.5 text-sm text-muted hover:bg-hover hover:text-foreground disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : (
        tiles.length > 0 && <p className="text-center text-sm text-muted">You&apos;ve seen every line. Check back later.</p>
      )}
    </>
  );
}

function Tile({ tile }: { tile: TileData }) {
  const room = THEMES.find((t) => t.slug === tile.forum_id);
  return (
    <Link
      href={`/posts/${tile.id}`}
      // The popup opens over the grid where you were, not back at the top.
      scroll={false}
      className={`group flex flex-col gap-4 rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 sm:p-5 ${tintFor(tile.id)}`}
    >
      <p className={`break-words font-serif ${sizeFor(tile.line).cls}`}>&ldquo;{tile.line}&rdquo;</p>
      <p className="text-xs text-foreground/60 transition-colors group-hover:text-foreground">
        {tile.author}, <cite>{tile.work}</cite>
      </p>
      <div className="flex items-center gap-3 text-xs text-foreground/60 transition-colors group-hover:text-foreground">
        {room && (
          <span className="flex min-w-0 items-center gap-1">
            <ThemeIcon slug={room.slug} className="size-3.5 shrink-0 text-terracotta" />
            <span className="truncate">{room.name}</span>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span aria-label={`${tile.likes} likes`}>♥ {tile.likes}</span>
          <span aria-label={`${tile.replies} replies`}>↩ {tile.replies}</span>
        </span>
      </div>
    </Link>
  );
}
