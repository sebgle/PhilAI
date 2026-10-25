// Two quiet abstract pieces, fixed in the corners behind the page: soft
// organic blobs in the earth tones with a few thin, slightly wobbly lines over
// them, the way a brush or pencil would leave them. Both pieces push into a
// corner so they only ever crop at the window's own edges, never inside the
// page. Hidden on phones, where there is no margin for them.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block">
      <svg viewBox="0 0 360 360" className="absolute -right-24 -top-28 h-[30rem] w-auto opacity-80">
        <defs>
          <filter id="wobble-a" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#wobble-a)">
          {/* terracotta blob, a smaller sand blob tucked against it */}
          <path d="M232 36c52-14 100 10 110 58 8 42-10 86-54 100-40 12-84-6-104-44-20-40 4-100 48-114Z" fill="var(--terracotta)" opacity="0.22" />
          <path d="M150 170c30-10 58 2 66 26 8 26-8 54-36 62-26 8-56-4-66-28-10-26 8-52 36-60Z" fill="var(--sand)" opacity="0.5" />
          {/* contour lines: three arcs following the blob, one straight-ish line cutting across */}
          <g fill="none" stroke="var(--foreground)" strokeLinecap="round" opacity="0.35">
            <path d="M200 60c40-20 90-10 118 24" strokeWidth="1.1" />
            <path d="M190 84c42-18 92-6 124 30" strokeWidth="0.8" />
            <path d="M184 110c36-10 76 0 108 26" strokeWidth="0.8" />
            <path d="M120 250L330 120" strokeWidth="1" opacity="0.7" />
          </g>
          <circle cx="306" cy="208" r="3" fill="var(--terracotta)" opacity="0.7" />
        </g>
      </svg>

      <svg viewBox="0 0 360 300" className="absolute -bottom-24 -left-20 h-[26rem] w-auto opacity-80">
        <defs>
          <filter id="wobble-b" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#wobble-b)">
          {/* sage blob leaning into the corner, a sand crescent beside it */}
          <path d="M40 300c-10-60 10-120 60-150 50-30 110-14 136 30 26 46 6 104-40 124-30 12-60 10-90 2-22-6-44-6-66-6Z" fill="var(--sage)" opacity="0.3" />
          <path d="M210 150c40 10 70 44 70 86 0 20-6 40-16 56 10-40 2-80-26-108-10-10-20-18-28-34Z" fill="var(--sand)" opacity="0.55" />
          <g fill="none" stroke="var(--foreground)" strokeLinecap="round" opacity="0.35">
            <path d="M70 230c40-30 90-40 150-26" strokeWidth="1.1" />
            <path d="M90 256c36-22 80-30 130-20" strokeWidth="0.8" />
            <path d="M20 170c30-50 80-80 140-82" strokeWidth="0.8" />
          </g>
          <circle cx="250" cy="120" r="2.5" fill="var(--foreground)" opacity="0.35" />
        </g>
      </svg>
    </div>
  );
}
