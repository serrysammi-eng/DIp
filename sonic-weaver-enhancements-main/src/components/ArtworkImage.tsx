// Artwork image with premium animated fallback (initials + gradient + sheen).
// Never shows a broken-image icon or empty dark square.
import { useState, useMemo } from "react";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(seed: string): string {
  const parts = seed.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "♪";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTES: [string, string, string][] = [
  ["oklch(0.72 0.22 330)", "oklch(0.55 0.2 280)", "oklch(0.7 0.2 200)"],
  ["oklch(0.7 0.2 30)",    "oklch(0.6 0.22 350)", "oklch(0.55 0.2 280)"],
  ["oklch(0.7 0.18 160)",  "oklch(0.6 0.2 200)",  "oklch(0.55 0.2 260)"],
  ["oklch(0.72 0.22 60)",  "oklch(0.65 0.22 20)", "oklch(0.55 0.2 320)"],
  ["oklch(0.7 0.2 200)",   "oklch(0.65 0.22 180)","oklch(0.6 0.22 280)"],
];

function Fallback({ seed, className = "" }: { seed: string; className?: string }) {
  const i = hash(seed || "music") % PALETTES.length;
  const [a, b, c] = PALETTES[i];
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b} 50%, ${c})` }}
      aria-hidden
    >
      <div className="absolute -inset-4 opacity-50 blur-2xl"
           style={{ background: `radial-gradient(circle at 30% 30%, ${a}, transparent 60%), radial-gradient(circle at 70% 70%, ${c}, transparent 60%)` }} />
      <div className="absolute inset-0 opacity-20 mix-blend-overlay"
           style={{ background: "repeating-linear-gradient(45deg, white 0 1px, transparent 1px 6px)" }} />
      <span className="relative font-display font-semibold text-white/90 drop-shadow-lg select-none"
            style={{ fontSize: "min(40%, 2.5rem)" }}>
        {initials(seed)}
      </span>
    </div>
  );
}

export function ArtworkImage({
  src, alt, seed, className = "",
}: { src?: string; alt: string; seed: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const valid = useMemo(() => !!src && /^https?:\/\//.test(src), [src]);
  if (!valid || failed) return <Fallback seed={seed} className={className} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ArtistAvatar({
  src, name, className = "",
}: { src?: string; name: string; className?: string }) {
  return <ArtworkImage src={src} alt={name} seed={name} className={className} />;
}
