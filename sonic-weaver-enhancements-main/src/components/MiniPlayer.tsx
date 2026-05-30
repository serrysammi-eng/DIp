// MiniPlayer — glassmorphic bar with anti-gravity aesthetic. Entire surface
// (except control buttons & seek) opens the full-screen player. Sits ABOVE
// the bottom nav on mobile.
import { ChevronUp, Heart, Pause, Play, SkipBack, SkipForward, Sparkles, Zap } from "lucide-react";
import { usePlayer, usePrefs } from "../lib/store";
import { Equalizer } from "./Equalizer";
import { ArtworkImage } from "./ArtworkImage";

function pct(p: number, d: number) { return d > 0 ? Math.min(100, (p / d) * 100) : 0; }

export function MiniPlayer() {
  const { state, player } = usePlayer();
  const { isLiked, toggleLike } = usePrefs();
  if (!state.current) return null;
  const t = state.current;
  const progress = pct(state.position, state.duration);
  const liked = isLiked(t.id);

  const openFull = () => player?.setFullscreen(true);
  const stop = (fn: () => void) => (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault(); fn();
  };

  const onSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    player?.seek((e.clientX - r.left) / r.width);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openFull}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFull(); }}
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[min(960px,calc(100vw-1rem))] bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-4 cursor-pointer fade-up"
    >
      <div className="glass-glow rounded-2xl overflow-hidden text-left art-bg shadow-2xl">
        {/* seek line — tap to scrub */}
        <div
          onPointerDown={onSeek}
          onClick={(e) => e.stopPropagation()}
          className="h-1.5 bg-white/5 cursor-pointer touch-none relative overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] transition-[width] duration-150 pointer-events-none seek-glow-bar"
            style={{ width: `${progress}%` }}
          />
          {/* Glowing dot at the end of seek bar */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_oklch(0.72_0.22_330/0.8)] pointer-events-none transition-[left] duration-150"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="relative w-12 h-12 shrink-0">
            <div className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/10 spin-disc"
                 data-paused={!state.isPlaying}>
              <ArtworkImage src={t.artwork} alt="" seed={t.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <span className="w-2.5 h-2.5 rounded-full bg-black/80 ring-1 ring-white/20" />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium text-sm">{t.title}</div>
              {state.aiDj && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] text-white">
                  <Sparkles size={9} /> AI DJ
                </span>
              )}
              {state.highlightActive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gradient-to-r from-[oklch(0.7_0.22_40)] to-[oklch(0.72_0.2_60)] text-white highlight-badge">
                  <Zap size={9} /> Hook
                </span>
              )}
              {state.isPlaying && <Equalizer playing className="text-[oklch(0.78_0.2_330)]" />}
            </div>
            <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Btn onClick={stop(() => toggleLike(t.id))} aria-label="Like">
              <Heart size={16} className={liked ? "fill-[oklch(0.78_0.22_330)] text-[oklch(0.78_0.22_330)]" : "text-white/80"} />
            </Btn>
            <Btn onClick={stop(() => player?.prev())} aria-label="Previous" hideOnMobile>
              <SkipBack size={16} />
            </Btn>
            <button
              onClick={stop(() => player?.togglePlay())}
              aria-label={state.isPlaying ? "Pause" : "Play"}
              className="w-10 h-10 grid place-items-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform shadow-lg spring-press"
            >
              {state.isLoading
                ? <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                : state.isPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black ml-0.5" />}
            </button>
            <Btn onClick={stop(() => player?.next())} aria-label="Next">
              <SkipForward size={16} />
            </Btn>
            <Btn onClick={stop(openFull)} aria-label="Open" hideOnMobile>
              <ChevronUp size={16} />
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, "aria-label": al, hideOnMobile }: {
  children: React.ReactNode; onClick: (e: React.MouseEvent) => void; "aria-label": string; hideOnMobile?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={al}
      className={`w-9 h-9 grid place-items-center rounded-full hover:bg-white/10 transition-all text-white/80 spring-press ${hideOnMobile ? "hidden sm:grid" : ""}`}>
      {children}
    </button>
  );
}
