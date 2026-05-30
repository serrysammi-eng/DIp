// Reusable track row used in Home, Artist, Search, Library.
import { Heart, Play, Pause } from "lucide-react";
import { useState, useEffect } from "react";
import { usePlayer, usePrefs, rememberTrack } from "../lib/store";
import type { Track } from "../lib/providers";
import { Equalizer } from "./Equalizer";
import { ArtworkImage } from "./ArtworkImage";

function fmt(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "—:—";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function compactNum(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return `${n}`;
}

export function TrackRow({ track, index, queue }: { track: Track; index?: number; queue?: Track[] }) {
  const { state, player } = usePlayer();
  const { toggleLike, isLiked, pushRecent } = usePrefs();
  const liked = isLiked(track.id);
  const isCur = state.current?.id === track.id;
  const isPlay = isCur && state.isPlaying;
  const [burst, setBurst] = useState(0);

  // Reset burst counter after animation completes to prevent overflow
  useEffect(() => {
    if (burst > 0) {
      const timer = setTimeout(() => setBurst(0), 600);
      return () => clearTimeout(timer);
    }
  }, [burst]);

  const play = () => {
    rememberTrack(track);
    pushRecent(track.id);
    player?.playTrack(track, (queue ?? []).filter((t) => t.id !== track.id));
  };
  const onLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track.id);
    if (!liked) setBurst((n) => n + 1);
  };

  return (
    <div role="button" onClick={play}
      className="group flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer relative magnetic-hover">
      <div className="w-6 text-center text-sm text-muted-foreground">
        {isCur ? <Equalizer playing={isPlay} className="text-[oklch(0.78_0.2_330)] mx-auto" />
              : <span className="group-hover:hidden">{(index ?? 0) + 1}</span>}
        {!isCur && <span className="hidden group-hover:inline"><Play size={14} className="inline" /></span>}
      </div>
      <div className="relative shrink-0">
        <ArtworkImage src={track.artwork} alt="" seed={track.title}
          className="w-11 h-11 rounded-lg object-cover ring-1 ring-white/10" />
        {isPlay && <div className="absolute inset-0 rounded-lg bg-black/40 grid place-items-center"><Pause size={16} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[15px]">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
      </div>
      {track.playCount && track.playCount > 0 && (
        <div className="hidden md:block text-xs text-muted-foreground tabular-nums w-20 text-right">
          {compactNum(track.playCount)} plays
        </div>
      )}
      <button type="button" onClick={onLike}
        className="relative w-9 h-9 grid place-items-center rounded-full hover:bg-white/10 transition-colors spring-press"
        aria-label={liked ? "Unlike" : "Like"}>
        <Heart size={18} className={liked ? "fill-[oklch(0.72_0.22_330)] text-[oklch(0.72_0.22_330)]" : "text-white/70"} />
        {burst > 0 && (
          <span key={burst} className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <span key={i} className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-[oklch(0.78_0.22_330)]"
                  style={{
                    // @ts-expect-error CSS vars
                    "--dx": `${Math.cos(angle) * 26}px`,
                    "--dy": `${Math.sin(angle) * 26}px`,
                    animation: "particle 0.55s ease-out forwards",
                  }} />
              );
            })}
          </span>
        )}
      </button>
      <div className="text-xs text-muted-foreground tabular-nums w-12 text-right">{fmt(track.duration)}</div>
    </div>
  );
}
