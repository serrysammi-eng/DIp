import { Link } from "@tanstack/react-router";
import { rememberTrack, usePlayer, usePrefs } from "../lib/store";
import type { Track } from "../lib/providers";
import { Play, TrendingUp } from "lucide-react";
import { ArtworkImage } from "./ArtworkImage";

function compactNum(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return `${n}`;
}

export function TrackCard({ track, queue, index }: { track: Track; queue?: Track[]; index?: number }) {
  const { player } = usePlayer();
  const { pushRecent } = usePrefs();
  const delay = (index ?? 0) * 60;

  return (
    <button
      type="button"
      onClick={() => { rememberTrack(track); pushRecent(track.id);
        player?.playTrack(track, (queue ?? []).filter((t) => t.id !== track.id)); }}
      className="group text-left relative rounded-2xl p-3 hover:bg-white/5 transition-all w-full spring-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden ring-1 ring-white/10">
        <ArtworkImage src={track.artwork} alt="" seed={track.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-gradient-to-br from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] grid place-items-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all shadow-xl spring-press">
          <Play size={18} className="text-white fill-white ml-0.5" />
        </div>
        {track.playCount && track.playCount > 0 && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-[10px] font-medium text-white/90">
            <TrendingUp size={9} />
            {compactNum(track.playCount)} plays
          </div>
        )}
        {/* Popularity badge for top tracks */}
        {track.popularity && track.popularity > 70 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[oklch(0.72_0.22_330)] to-[oklch(0.7_0.2_200)] text-[9px] font-bold text-white uppercase tracking-wider">
            Hot
          </div>
        )}
      </div>
      <div className="px-1 pt-2.5">
        <div className="truncate text-sm font-medium">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
      </div>
    </button>
  );
}

export function ArtistCard({
  name, image, listeners, index,
}: { name: string; image: string; listeners?: number; index?: number }) {
  const delay = (index ?? 0) * 80;
  return (
    <Link
      to="/artist/$name" params={{ name }}
      className="group text-left block spring-in magnetic-hover"
      style={{ perspective: 800, animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-square rounded-full overflow-hidden ring-1 ring-white/10 transition-all duration-500 group-hover:[transform:rotateX(8deg)_rotateY(-8deg)_scale(1.04)] group-hover:ring-[oklch(0.72_0.22_330/0.4)] group-hover:shadow-[0_0_30px_-5px_oklch(0.72_0.22_330/0.3)] shadow-xl">
        <ArtworkImage src={image} alt={name} seed={name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-full pointer-events-none" />
        {/* Glow ring on hover */}
        <div className="absolute inset-[-4px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: "conic-gradient(from 0deg, oklch(0.72 0.22 330 / 0.3), oklch(0.7 0.2 200 / 0.3), oklch(0.72 0.22 330 / 0.3))", filter: "blur(6px)" }} />
      </div>
      <div className="text-center mt-2.5 text-sm font-medium truncate">{name}</div>
      {listeners && listeners > 0 && (
        <div className="text-center text-[11px] text-white/50">{compactNum(listeners)} fans</div>
      )}
    </Link>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {/* Animated gradient underline */}
        <div className="mt-1.5 h-0.5 w-12 rounded-full bg-gradient-to-r from-[oklch(0.72_0.22_330)] to-[oklch(0.7_0.2_200)] opacity-60" />
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}
