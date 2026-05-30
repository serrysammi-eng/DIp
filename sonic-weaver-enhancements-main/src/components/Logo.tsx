// Brand logo — preserved from existing brand intent. Geometric sound-wave wordmark.
export function Logo({ size = 28, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Sonic Weaver">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.2 330)" />
            <stop offset="100%" stopColor="oklch(0.72 0.2 200)" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#lg)" opacity="0.18" />
        <g stroke="url(#lg)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M8 20 Q14 8 20 20 T32 20" />
          <path d="M8 26 Q14 18 20 26 T32 26" opacity="0.6" />
        </g>
        <circle cx="20" cy="20" r="2.6" fill="white" />
      </svg>
      {withWord && (
        <span className="font-display font-semibold tracking-tight text-[15px]">
          <span className="text-gradient">Sonic</span>{" "}
          <span className="text-white/85">Weaver</span>
        </span>
      )}
    </div>
  );
}
