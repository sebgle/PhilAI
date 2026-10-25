// Lofi line art for the Entries page: a moonlit window with a gathered
// curtain, and a desk below with a warm lamp and a stack of books.
// Strokes use currentColor so the drawing follows light/dark text color.
export function RoomNight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 440" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="rn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#28325c" />
          <stop offset="1" stopColor="#5d5f99" />
        </linearGradient>
        <radialGradient id="rn-glow">
          <stop offset="0" stopColor="#ffd99a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd99a" stopOpacity="0" />
        </radialGradient>
        <mask id="rn-crescent">
          <circle cx="92" cy="80" r="22" fill="#fff" />
          <circle cx="102" cy="72" r="20" fill="#000" />
        </mask>
      </defs>

      <circle cx="232" cy="278" r="70" fill="url(#rn-glow)" />

      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* window */}
        <rect x="30" y="34" width="170" height="196" rx="4" fill="var(--art-frame)" />
        <rect x="43" y="47" width="144" height="170" fill="url(#rn-sky)" />
        <circle cx="92" cy="80" r="22" fill="#f6e7c1" mask="url(#rn-crescent)" stroke="none" />
        <g fill="#f6e7c1" stroke="none">
          <circle cx="150" cy="70" r="1.5" />
          <circle cx="62" cy="150" r="1.2" />
          <circle cx="160" cy="180" r="1.6" />
        </g>
        <rect x="111" y="47" width="7" height="170" fill="var(--art-frame)" />
        <rect x="43" y="129" width="144" height="7" fill="var(--art-frame)" />

        {/* curtain: rod, drape gathered by a tie */}
        <path d="M14 26 H236" />
        <path d="M176 26 C182 90 196 130 206 168 C212 188 222 204 218 232 L240 232 C246 196 236 160 236 26 Z" fill="#b8a6cf" />
        <path d="M196 30 C200 90 210 130 214 170" opacity="0.45" />
        <path d="M218 30 C220 100 226 140 228 200" opacity="0.45" />
        <path d="M203 176 q14 6 30 -2" />

        {/* desk */}
        <rect x="8" y="318" width="284" height="14" rx="3" fill="#c49a74" />
        <path d="M30 332 V440 M270 332 V440" />

        {/* books */}
        <rect x="40" y="298" width="74" height="12" rx="2" fill="#8bb08f" />
        <rect x="46" y="286" width="62" height="12" rx="2" fill="#d98e7a" />
        <rect x="52" y="274" width="52" height="12" rx="2" fill="#e8d8b8" />

        {/* lamp */}
        <path d="M208 250 L256 250 L247 280 L217 280 Z" fill="#f2d9a6" />
        <path d="M232 280 V306" />
        <ellipse cx="232" cy="310" rx="20" ry="6" fill="#d9c7b0" />
      </g>
    </svg>
  );
}
