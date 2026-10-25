// Two quiet pieces of botanical art, fixed in the corners behind the page:
// a eucalyptus stem hanging in from the top right, and a low sun over soft
// hills at the bottom left. Earth tones, mostly transparent, never in the
// reading column, hidden on phones where there is no margin for them.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block">
      <svg viewBox="0 0 200 320" className="absolute -right-6 -top-4 h-[22rem] w-auto text-sage opacity-60">
        <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M140 0c-10 50-30 120-70 190-12 22-26 42-44 60" />
          <path d="M118 70c-14-2-28 4-38 16M112 112c-16 0-30 8-40 20M100 150c-14 2-26 10-34 22M84 188c-12 4-22 12-28 24" />
          <path d="M126 50c12-6 26-4 36 4M122 92c12-8 26-8 38-2M110 134c12-10 26-12 38-8M94 174c10-10 22-14 34-12" />
        </g>
        <g fill="currentColor" opacity="0.75">
          <ellipse cx="92" cy="92" rx="10" ry="6" transform="rotate(-25 92 92)" />
          <ellipse cx="84" cy="136" rx="10" ry="6" transform="rotate(-30 84 136)" />
          <ellipse cx="78" cy="176" rx="9" ry="5.5" transform="rotate(-35 78 176)" />
          <ellipse cx="66" cy="214" rx="8" ry="5" transform="rotate(-40 66 214)" />
          <ellipse cx="150" cy="60" rx="10" ry="6" transform="rotate(20 150 60)" />
          <ellipse cx="148" cy="98" rx="10" ry="6" transform="rotate(15 148 98)" />
          <ellipse cx="138" cy="134" rx="9" ry="5.5" transform="rotate(10 138 134)" />
          <ellipse cx="120" cy="170" rx="8" ry="5" transform="rotate(5 120 170)" />
        </g>
      </svg>
      <svg viewBox="0 0 320 200" className="absolute -bottom-6 -left-8 h-[16rem] w-auto opacity-70">
        <circle cx="150" cy="96" r="42" fill="var(--terracotta)" opacity="0.28" />
        <path d="M0 150c60-30 110-40 180-20s100 30 140 10v60H0Z" fill="var(--sand)" opacity="0.5" />
        <path d="M0 176c50-18 100-24 160-10s100 22 160 6v28H0Z" fill="var(--sage)" opacity="0.4" />
        <path d="M30 140c20-6 40-6 60 2" fill="none" stroke="var(--terracotta)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  );
}
