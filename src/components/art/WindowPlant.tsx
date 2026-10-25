// Lofi line art for the Write page: a night window with a crescent moon, a
// mug steaming on the sill, and a potted plant leaning into the frame.
// Strokes use currentColor so the drawing follows light/dark text color.
export function WindowPlant({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 420" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f3a66" />
          <stop offset="1" stopColor="#6b6aa3" />
        </linearGradient>
        <mask id="wp-crescent">
          <circle cx="196" cy="86" r="24" fill="#fff" />
          <circle cx="208" cy="78" r="22" fill="#000" />
        </mask>
      </defs>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* window */}
        <rect x="40" y="20" width="220" height="250" rx="4" fill="var(--art-frame)" />
        <rect x="55" y="35" width="190" height="220" fill="url(#wp-sky)" />
        <circle cx="196" cy="86" r="24" fill="#f6e7c1" mask="url(#wp-crescent)" stroke="none" />
        <g fill="#f6e7c1" stroke="none">
          <circle cx="90" cy="70" r="1.8" />
          <circle cx="120" cy="105" r="1.3" />
          <circle cx="225" cy="160" r="1.5" />
          <circle cx="80" cy="190" r="1.2" />
          <circle cx="170" cy="210" r="1.6" />
        </g>
        <rect x="146" y="35" width="8" height="220" fill="var(--art-frame)" />
        <rect x="55" y="140" width="190" height="8" fill="var(--art-frame)" />
        <rect x="25" y="266" width="250" height="14" rx="3" fill="var(--art-frame)" />

        {/* mug on the sill */}
        <path d="M70 236 h30 v24 a6 6 0 0 1 -6 6 h-18 a6 6 0 0 1 -6 -6 z" fill="#d9c7b0" />
        <path d="M100 242 h5 a6 6 0 0 1 0 12 h-5" />
        <path d="M80 228 q-5 -7 0 -14 q5 -7 0 -14" strokeWidth="2" opacity="0.6" />
        <path d="M90 228 q-5 -7 0 -14 q5 -7 0 -14" strokeWidth="2" opacity="0.6" />

        {/* plant */}
        <path d="M215 326 Q172 262 186 206 Q212 262 215 326 Z" fill="#6f9a78" />
        <path d="M216 326 Q214 240 238 186 Q246 262 216 326 Z" fill="#8bb08f" />
        <path d="M217 326 Q258 270 286 252 Q262 300 217 326 Z" fill="#6f9a78" />
        <path d="M214 326 Q180 300 158 296 Q178 322 214 326 Z" fill="#8bb08f" />
        <rect x="168" y="322" width="96" height="14" rx="3" fill="#c48a6e" />
        <path d="M176 336 L256 336 L246 404 L186 404 Z" fill="#c9876b" />
        <path d="M190 356 h52" opacity="0.35" />
      </g>
      <ellipse cx="216" cy="410" rx="56" ry="6" fill="currentColor" opacity="0.08" />
    </svg>
  );
}
