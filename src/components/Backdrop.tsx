// Quiet abstract art fixed in the corners behind each page: soft organic
// blobs in the earth tones with a few thin, slightly wobbly lines over them,
// the way a brush or pencil would leave them. Each page gets its own pair so
// moving between tabs feels like turning a page, in the same hand. Pieces
// push into a corner so they only ever crop at the window's own edges, never
// inside the page. Hidden on phones, where there is no margin for them.

type Blob = { d: string; fill: string; opacity: number };
type Line = { d: string; w: number; o?: number };
type Piece = {
  pos: string;          // Tailwind placement classes
  box: string;          // viewBox
  blobs: Blob[];
  lines: Line[];
  dot?: { cx: number; cy: number; fill: string };
  flip?: boolean;       // mirror horizontally
};

const T = "var(--terracotta)", S = "var(--sage)", N = "var(--sand)", F = "var(--foreground)";

// Blob outlines, reused across pages in different colors and corners.
const ROUND = "M232 36c52-14 100 10 110 58 8 42-10 86-54 100-40 12-84-6-104-44-20-40 4-100 48-114Z";
const PEBBLE = "M150 170c30-10 58 2 66 26 8 26-8 54-36 62-26 8-56-4-66-28-10-26 8-52 36-60Z";
const LEAN = "M40 300c-10-60 10-120 60-150 50-30 110-14 136 30 26 46 6 104-40 124-30 12-60 10-90 2-22-6-44-6-66-6Z";
const CRESCENT = "M210 150c40 10 70 44 70 86 0 20-6 40-16 56 10-40 2-80-26-108-10-10-20-18-28-34Z";
const TALL = "M120 20c40-20 90-6 110 40 18 42 10 100-20 140-26 36-70 50-110 36-40-14-62-56-56-100 6-50 36-96 76-116Z";
const WIDE = "M20 220c30-50 90-70 160-62 60 8 110 34 150 70 10 10 16 22 20 34H0c4-16 10-30 20-42Z";

const PIECES: Record<string, [Piece, Piece]> = {
  write: [
    { pos: "-right-24 -top-28 h-[30rem]", box: "0 0 360 360",
      blobs: [{ d: ROUND, fill: T, opacity: 0.22 }, { d: PEBBLE, fill: N, opacity: 0.5 }],
      lines: [{ d: "M200 60c40-20 90-10 118 24", w: 1.1 }, { d: "M190 84c42-18 92-6 124 30", w: 0.8 }, { d: "M184 110c36-10 76 0 108 26", w: 0.8 }, { d: "M120 250L330 120", w: 1, o: 0.7 }],
      dot: { cx: 306, cy: 208, fill: T } },
    { pos: "-bottom-24 -left-20 h-[26rem]", box: "0 0 360 300",
      blobs: [{ d: LEAN, fill: S, opacity: 0.3 }, { d: CRESCENT, fill: N, opacity: 0.55 }],
      lines: [{ d: "M70 230c40-30 90-40 150-26", w: 1.1 }, { d: "M90 256c36-22 80-30 130-20", w: 0.8 }, { d: "M20 170c30-50 80-80 140-82", w: 0.8 }],
      dot: { cx: 250, cy: 120, fill: F } },
  ],
  entries: [
    { pos: "-left-28 -top-24 h-[28rem]", box: "0 0 360 360", flip: true,
      blobs: [{ d: TALL, fill: S, opacity: 0.26 }, { d: PEBBLE, fill: T, opacity: 0.18 }],
      lines: [{ d: "M60 80c60-30 130-30 190 10", w: 1.1 }, { d: "M70 110c60-24 126-22 180 14", w: 0.8 }, { d: "M40 300L300 170", w: 1, o: 0.6 }],
      dot: { cx: 90, cy: 250, fill: T } },
    { pos: "-bottom-20 -right-16 h-[20rem]", box: "0 0 360 300",
      blobs: [{ d: CRESCENT, fill: N, opacity: 0.6 }],
      lines: [{ d: "M160 240c50-20 100-20 150-4", w: 1.1 }, { d: "M180 266c40-14 86-14 130-2", w: 0.8 }],
      dot: { cx: 150, cy: 200, fill: F } },
  ],
  matches: [
    { pos: "-right-28 -top-24 h-[26rem]", box: "0 0 360 360",
      blobs: [{ d: PEBBLE, fill: N, opacity: 0.55 }, { d: ROUND, fill: S, opacity: 0.2 }],
      lines: [{ d: "M190 70c50-20 100-10 130 20", w: 1.1 }, { d: "M184 100c46-16 96-8 130 20", w: 0.8 }],
      dot: { cx: 150, cy: 150, fill: T } },
    { pos: "-bottom-24 -left-24 h-[18rem]", box: "0 0 360 300",
      blobs: [{ d: WIDE, fill: T, opacity: 0.16 }],
      lines: [{ d: "M40 250c60-40 140-50 220-30", w: 1 }, { d: "M60 276c56-30 126-36 196-20", w: 0.8 }],
      dot: undefined },
  ],
  saved: [
    { pos: "-right-24 -bottom-28 h-[30rem]", box: "0 0 360 360",
      blobs: [{ d: ROUND, fill: S, opacity: 0.26 }, { d: PEBBLE, fill: T, opacity: 0.2 }],
      lines: [{ d: "M200 300c40-20 90-10 118 24", w: 1.1 }, { d: "M190 326c42-18 92-6 124 30", w: 0.8 }, { d: "M120 110L330 240", w: 1, o: 0.6 }],
      dot: { cx: 300, cy: 120, fill: T } },
    { pos: "-top-20 -left-24 h-[20rem]", box: "0 0 360 300", flip: true,
      blobs: [{ d: CRESCENT, fill: N, opacity: 0.6 }],
      lines: [{ d: "M160 60c50-20 100-20 150-4", w: 1.1 }, { d: "M180 86c40-14 86-14 130-2", w: 0.8 }],
      dot: { cx: 150, cy: 120, fill: F } },
  ],
  community: [
    { pos: "-right-24 -top-24 h-[28rem]", box: "0 0 360 360",
      blobs: [{ d: TALL, fill: S, opacity: 0.24 }, { d: CRESCENT, fill: T, opacity: 0.2 }],
      lines: [{ d: "M150 60c60-30 130-30 190 10", w: 1.1 }, { d: "M160 90c60-24 126-22 180 14", w: 0.8 }, { d: "M110 320L330 190", w: 1, o: 0.6 }],
      dot: { cx: 140, cy: 240, fill: T } },
    { pos: "-bottom-24 -left-20 h-[22rem]", box: "0 0 360 300",
      blobs: [{ d: WIDE, fill: N, opacity: 0.5 }, { d: PEBBLE, fill: S, opacity: 0.2 }],
      lines: [{ d: "M30 230c60-40 140-50 220-30", w: 1.1 }, { d: "M50 256c56-30 126-36 196-20", w: 0.8 }],
      dot: { cx: 240, cy: 140, fill: F } },
  ],
  quiet: [
    { pos: "-right-28 -bottom-24 h-[24rem]", box: "0 0 360 360",
      blobs: [{ d: ROUND, fill: N, opacity: 0.5 }, { d: PEBBLE, fill: S, opacity: 0.22 }],
      lines: [{ d: "M200 300c40-20 90-10 118 24", w: 1.1 }, { d: "M190 326c42-18 92-6 124 30", w: 0.8 }],
      dot: { cx: 300, cy: 140, fill: T } },
    { pos: "-top-24 -left-24 h-[16rem]", box: "0 0 360 300", flip: true,
      blobs: [{ d: CRESCENT, fill: T, opacity: 0.18 }],
      lines: [{ d: "M160 60c50-20 100-20 150-4", w: 1 }],
      dot: undefined },
  ],
  login: [
    { pos: "-right-20 -top-20 h-[34rem]", box: "0 0 360 360",
      blobs: [{ d: ROUND, fill: T, opacity: 0.22 }, { d: PEBBLE, fill: N, opacity: 0.5 }],
      lines: [{ d: "M200 60c40-20 90-10 118 24", w: 1.1 }, { d: "M190 84c42-18 92-6 124 30", w: 0.8 }, { d: "M184 110c36-10 76 0 108 26", w: 0.8 }, { d: "M120 250L330 120", w: 1, o: 0.7 }],
      dot: { cx: 306, cy: 208, fill: T } },
    { pos: "-bottom-24 -left-20 h-[30rem]", box: "0 0 360 300",
      blobs: [{ d: LEAN, fill: S, opacity: 0.3 }, { d: CRESCENT, fill: N, opacity: 0.55 }],
      lines: [{ d: "M70 230c40-30 90-40 150-26", w: 1.1 }, { d: "M90 256c36-22 80-30 130-20", w: 0.8 }, { d: "M20 170c30-50 80-80 140-82", w: 0.8 }],
      dot: { cx: 250, cy: 120, fill: F } },
  ],
};

export type BackdropVariant = keyof typeof PIECES;

export function Backdrop({ variant = "write" }: { variant?: BackdropVariant }) {
  const [a, b] = PIECES[variant];
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block">
      <Art piece={a} id={`${variant}-a`} seed={5} />
      <Art piece={b} id={`${variant}-b`} seed={11} />
    </div>
  );
}

function Art({ piece, id, seed }: { piece: Piece; id: string; seed: number }) {
  const w = piece.box.split(" ")[2];
  return (
    <svg viewBox={piece.box} className={`absolute w-auto opacity-80 ${piece.pos}`}>
      <defs>
        <filter id={`wobble-${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#wobble-${id})`} transform={piece.flip ? `translate(${w} 0) scale(-1 1)` : undefined}>
        {piece.blobs.map((b, i) => <path key={i} d={b.d} fill={b.fill} opacity={b.opacity} />)}
        <g fill="none" stroke={F} strokeLinecap="round" opacity="0.35">
          {piece.lines.map((l, i) => <path key={i} d={l.d} strokeWidth={l.w} opacity={l.o} />)}
        </g>
        {piece.dot && <circle cx={piece.dot.cx} cy={piece.dot.cy} r="3" fill={piece.dot.fill} opacity="0.7" />}
      </g>
    </svg>
  );
}
