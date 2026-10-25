// Two quiet pieces of botanical art, fixed in the corners behind the page.
// Hand-drawn feel: every line runs through a small noise displacement so
// nothing is geometrically perfect, leaves are stroked shapes with a midrib
// rather than ellipses, and strokes vary in weight. Both pieces anchor to an
// outer edge so they only ever crop at the window's edge, never inside the
// page. Earth tones, mostly transparent, hidden on phones.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block">
      {/* Eucalyptus stem hanging in from the top right. */}
      <svg viewBox="0 0 220 360" className="absolute -right-3 -top-6 h-[24rem] w-auto text-sage opacity-70">
        <defs>
          <filter id="wobble-a" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#wobble-a)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {/* main stem, drawn twice at different weights like a pen that pressed harder in places */}
          <path d="M160 -4c-6 46-20 96-46 150-16 34-36 66-62 96-10 12-20 22-32 32" strokeWidth="1.6" />
          <path d="M160 -4c-6 46-20 96-46 150" strokeWidth="0.7" opacity="0.6" transform="translate(1.5 0)" />
          {/* side twigs */}
          <path d="M146 58c-10-2-20 0-30 8M136 104c-12 0-22 4-32 12M118 150c-10 2-20 8-26 16M92 200c-8 4-16 10-20 18M70 246c-8 4-14 10-18 16" strokeWidth="1.1" />
          <path d="M150 40c10-4 20-2 28 4M140 88c10-6 22-6 30 0M126 134c10-8 22-10 32-6M106 182c8-8 20-10 30-8M84 228c8-6 18-8 26-6" strokeWidth="1.1" />
          {/* leaves: an asymmetric lobe plus a midrib, each one a little different */}
          <Leaf x={116} y={66} r={-30} s={1.05} />
          <Leaf x={104} y={116} r={-22} s={1} />
          <Leaf x={92} y={166} r={-28} s={0.95} />
          <Leaf x={72} y={218} r={-18} s={0.9} />
          <Leaf x={52} y={262} r={-26} s={0.8} />
          <Leaf x={178} y={44} r={160} s={1} />
          <Leaf x={170} y={88} r={168} s={0.95} />
          <Leaf x={158} y={128} r={162} s={0.9} />
          <Leaf x={136} y={174} r={170} s={0.85} />
          <Leaf x={110} y={222} r={164} s={0.8} />
        </g>
      </svg>

      {/* Pampas grass rising out of the bottom-left corner. */}
      <svg viewBox="0 0 260 360" className="absolute -bottom-3 -left-4 h-[22rem] w-auto opacity-75">
        <defs>
          <filter id="wobble-b" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#wobble-b)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* stems lean inward from the corner and end in the air */}
          <path d="M14 366c10-70 30-140 76-206" stroke="var(--sand)" strokeWidth="1.5" />
          <path d="M40 366c0-60 14-130 50-190" stroke="var(--terracotta)" strokeWidth="1.3" opacity="0.7" />
          <path d="M4 366c22-56 60-110 120-150" stroke="var(--sage)" strokeWidth="1.4" />
          <Plume x={90} y={160} r={-28} color="var(--sand)" />
          <Plume x={90} y={176} r={-32} color="var(--terracotta)" small />
          <Plume x={124} y={216} r={-48} color="var(--sage)" />
        </g>
      </svg>
    </div>
  );
}

// One leaf: a lobe that bulges more on one side, a midrib that stops short of
// the tip, a wash of color inside.
function Leaf({ x, y, r, s }: { x: number; y: number; r: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0c7-8 18-9 26-1-6 8-17 10-26 1z" fill="currentColor" fillOpacity="0.16" strokeWidth="1.2" />
      <path d="M1 0c8 0 15 0 21-1" strokeWidth="0.8" opacity="0.8" />
    </g>
  );
}

// A seed head: a soft fan of short, uneven strokes around the top of a stem.
function Plume({ x, y, r, color, small }: { x: number; y: number; r: number; color: string; small?: boolean }) {
  const k = small ? 0.7 : 1;
  const strokes = [
    "M0 0c-6-10-8-22-6-34", "M0 0c-2-12-1-24 3-36", "M0 0c3-11 8-21 15-30", "M0 0c6-8 13-15 22-20",
    "M0 0c-10-6-18-14-22-26", "M0 0c-3-14 1-28 8-40", "M0 0c8-10 17-18 28-23", "M0 0c-13-4-22-10-30-18",
    "M0 0c1-16 7-30 17-42", "M0 0c-8-12-12-26-11-40",
  ];
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${k})`} stroke={color}>
      {strokes.map((d, i) => (
        <path key={i} d={d} strokeWidth={i % 3 === 0 ? 1.4 : 0.9} opacity={0.55 + (i % 4) * 0.1} />
      ))}
      <path d="M-6-20c4 2 8 2 12 0M-4-30c3 2 7 2 10 0" strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}
