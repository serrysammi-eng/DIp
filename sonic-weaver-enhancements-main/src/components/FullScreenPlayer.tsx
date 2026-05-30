// Full-screen player overlay with anti-gravity aesthetic. Closing is internal
// state — never navigates, never refreshes. Open/close animates smoothly.
// Mobile swipe-down to close.
import { ChevronDown, Heart, Pause, Play, Shuffle, SkipBack, SkipForward, Sparkles, SlidersHorizontal, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlayer, usePrefs } from "../lib/store";
import { fetchLyrics, type LyricLine } from "../lib/providers";
import { Visualizer } from "./Visualizer";
import { ArtworkImage } from "./ArtworkImage";
import { SoundFxSheet } from "./SoundFxSheet";
import { LyricsPanel } from "./LyricsPanel";
import { BannerAd } from "./BannerAd";

function fmt(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Lyrics = { synced?: LyricLine[]; plain?: string } | null;

export function FullScreenPlayer() {
  const { state, player } = usePlayer();
  const { isLiked, toggleLike } = usePrefs();
  const [lyrics, setLyrics] = useState<Lyrics>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [tab, setTab] = useState<"queue" | "lyrics">("queue");
  const [fxOpen, setFxOpen] = useState(false);
  const touchStartY = useRef(0);
  const [panelAnim, setPanelAnim] = useState("");
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef<{ startY: number; startT: number; lastY: number; lastT: number; pointerId: number } | null>(null);
  const seekDragRef = useRef(false);
  const seekRef = useRef<HTMLDivElement>(null);

  const t = state.current;
  const liked = t ? isLiked(t.id) : false;

  // Mount/unmount with transition
  useEffect(() => {
    if (state.fullscreen) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    } else if (mounted) {
      setShow(false);
      setDragY(0);
      const tm = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(tm);
    }
  }, [state.fullscreen, mounted]);

  useEffect(() => {
    if (!t || !state.fullscreen) return;
    setLyrics(null);
    setLyricsLoading(true);
    let canceled = false;
    fetchLyrics(t.artist, t.title, t.album).then((l) => {
      if (!canceled) { setLyrics(l); setLyricsLoading(false); }
    });
    return () => { canceled = true; };
  }, [t?.id, t?.title, t?.artist, t?.album, state.fullscreen]);

  // Escape key + browser back close
  useEffect(() => {
    if (!state.fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); player?.setFullscreen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.fullscreen, player]);

  if (!t || !mounted) return null;

  const seekFromClient = (clientX: number) => {
    if (!seekRef.current) return;
    const r = seekRef.current.getBoundingClientRect();
    const p = (clientX - r.left) / r.width;
    player?.seek(p);
  };
  const onSeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    seekDragRef.current = true;
    seekFromClient(e.clientX);
  };
  const onSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekDragRef.current) return;
    e.stopPropagation();
    seekFromClient(e.clientX);
  };
  const onSeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    seekDragRef.current = false;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const close = () => { player?.setFullscreen(false); };

  // Drag-to-close handling
  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, [role='slider'], [data-no-drag]")) return;
    draggingRef.current = {
      startY: e.clientY, startT: performance.now(),
      lastY: e.clientY, lastT: performance.now(),
      pointerId: e.pointerId,
    };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    d.lastY = e.clientY; d.lastT = performance.now();
    setDragY(dy > 0 ? dy : dy * 0.15);
  };
  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    const dt = Math.max(16, performance.now() - d.startT);
    const velocity = dy / dt;
    draggingRef.current = null;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const threshold = Math.min(180, window.innerHeight * 0.22);
    if (dy > threshold || velocity > 0.6) {
      setDragY(0);
      close();
    } else {
      setDragY(0);
    }
  };

  const dragging = draggingRef.current !== null;
  const openProgress = show ? 1 : 0;
  const baseTranslate = (1 - openProgress) * 100;
  const transformStyle = dragging || dragY !== 0
    ? `translate3d(0, ${dragY}px, 0)`
    : `translate3d(0, ${baseTranslate}%, 0)`;
  const backdropOpacity = show
    ? Math.max(0, 1 - Math.min(1, Math.abs(dragY) / 600))
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ pointerEvents: show ? "auto" : "none" }}
      aria-hidden={!show}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 art-bg transition-opacity duration-300"
        style={{ opacity: backdropOpacity }}
      />
      <div
        className="absolute inset-0 backdrop-blur-2xl bg-black/40 transition-opacity duration-300"
        style={{ opacity: backdropOpacity }}
      />
      <div
        className="absolute -inset-20 aurora pointer-events-none transition-opacity duration-300"
        style={{ opacity: backdropOpacity * 0.9 }}
      />

      {/* Multi-ring BeatPulse */}
      {state.aiDj && <BeatPulse playing={state.isPlaying} />}

      {/* Sheet */}
      <div
        className="relative h-full flex flex-col will-change-transform"
        style={{
          transform: transformStyle,
          transition: dragging ? "none" : "transform 300ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Header — drag handle */}
        <div
          className="shrink-0 touch-none select-none"
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="flex justify-center pt-2 md:hidden">
            <div className="w-10 h-1.5 rounded-full bg-white/30" />
          </div>
          <div className="flex items-center justify-between p-4 md:p-6">
            <button
              type="button"
              data-no-drag
              onClick={close}
              aria-label="Close player"
              className="w-10 h-10 grid place-items-center rounded-full glass hover:bg-white/10 active:scale-95 transition-transform spring-press"
            >
              <ChevronDown size={22} />
            </button>
            <div className="text-center pointer-events-none">
              <div className="text-[10px] uppercase tracking-widest text-white/60">Now playing</div>
              {state.aiDj && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/90">
                  <Sparkles size={12} className="text-[oklch(0.78_0.2_330)]" /> AI DJ mixing
                </div>
              )}
              {state.highlightActive && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-[oklch(0.8_0.2_50)]">
                  <Zap size={12} /> Playing hook
                </div>
              )}
            </div>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 grid md:grid-cols-[1.05fr_0.95fr] gap-6 px-4 md:px-10 pb-4 overflow-auto">
          <div className="flex flex-col items-center justify-center gap-6 py-6">
            {/* Spinning disc with floating particles */}
            <div className="relative" style={{ perspective: 1000 }}>
              <div className="absolute inset-0 rounded-full aurora opacity-60 blur-2xl scale-110" />
              {/* Floating particles around disc */}
              <div className="absolute inset-[-30px] pointer-events-none">
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i / 16) * Math.PI * 2;
                  const radius = 52 + Math.random() * 15;
                  return (
                    <span
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/50 float"
                      style={{
                        left: `${50 + Math.cos(angle) * radius}%`,
                        top: `${50 + Math.sin(angle) * radius}%`,
                        animationDelay: `${i * 0.3}s`,
                        animationDuration: `${3 + Math.random() * 4}s`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="relative w-[260px] h-[260px] md:w-[360px] md:h-[360px] rounded-full overflow-hidden ring-1 ring-white/15 spin-disc"
                   data-paused={!state.isPlaying} style={{ animationDuration: "12s" }}>
                <ArtworkImage src={t.artwork} alt="" seed={t.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-black/90 ring-2 ring-white/20 grid place-items-center">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center max-w-lg px-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t.title}</h1>
              <p className="text-sm text-white/70 mt-1">{t.artist}</p>
              {state.error && (
                <p className="mt-3 text-xs text-[oklch(0.78_0.18_30)]">{state.error}</p>
              )}
            </div>

            {/* Pro visualizer */}
            <Visualizer height={48} className="max-w-md w-full" variant="pro" />
          </div>

          {/* Lyrics/Queue panel */}
          <div 
            className="glass-glow rounded-3xl p-5 md:p-6 flex flex-col min-h-[320px] relative overflow-hidden" 
            data-no-drag
            onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              const delta = e.changedTouches[0].clientY - touchStartY.current;
              if (delta < -50 && tab === "queue") {
                setTab("lyrics");
                setPanelAnim("fadeSlideUp");
              } else if (delta > 50 && tab === "lyrics") {
                setTab("queue");
                setPanelAnim("fadeSlideDown");
              }
            }}
          >
            {/* Grabber pill */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />
            
            <div className="flex items-center justify-between mb-4 mt-2">
              <div className="text-sm font-semibold text-white/80 transition-all duration-300 relative">
                <span className={`absolute left-0 top-0 transition-opacity duration-300 ${tab === "lyrics" ? "opacity-100" : "opacity-0"}`}>
                  Lyrics
                </span>
                <span className={`transition-opacity duration-300 ${tab === "queue" ? "opacity-100" : "opacity-0"}`}>
                  Up next · {state.queue.length}
                </span>
              </div>
              <div className="text-[10px] text-white/40">
                {tab === "queue" ? "Swipe up for lyrics ↑" : "Swipe down for queue ↓"}
              </div>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 ${panelAnim}`} style={{ animationDuration: "400ms" }} onAnimationEnd={() => setPanelAnim("")}>
              {tab === "lyrics" ? (
                <LyricsPanel lyrics={lyrics} loading={lyricsLoading} position={state.position} />
              ) : (
                <div className="overflow-auto flex-1 space-y-2">
                  {/* Smart Shuffle toggle */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs text-white/50">{state.queue.length} tracks</span>
                    <button
                      type="button"
                      onClick={() => {
                        player?.toggleShuffleMode();
                        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
                      }}
                      className={`shuffle-float inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all spring-press ${
                        state.shuffleMode === "smart"
                          ? "bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] text-white glow-primary"
                          : "glass hover:bg-white/10 text-white/70"
                      }`}
                      aria-label="Smart Shuffle"
                    >
                      <Shuffle size={13} />
                      {state.shuffleMode === "smart" ? "Smart" : "Shuffle"}
                    </button>
                  </div>
                  {state.queue.length === 0 ? (
                    <div className="h-full grid place-items-center text-sm text-white/60 py-10">
                      Queue is empty. Tap a track to weave it in.
                    </div>
                  ) : state.queue.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 spring-in" style={{ animationDelay: `${Math.min(i, 30) * 30}ms` }}>
                      <span className="w-6 text-center text-xs text-white/40">{i + 1}</span>
                      <ArtworkImage src={q.artwork} alt="" seed={q.title} className="w-9 h-9 rounded-md object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{q.title}</div>
                        <div className="truncate text-xs text-white/50">{q.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky playback controls — anchored at bottom */}
        <div className="shrink-0 glass-deep border-t border-white/10 px-4 md:px-10" data-no-drag
             style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          
          {!prefs.isPremium && (
            <div className="mt-3 -mb-1 max-w-2xl mx-auto">
              <BannerAd />
            </div>
          )}

          {/* Seek bar */}
          <div className="w-full max-w-2xl mx-auto space-y-2 pt-3">
            <div
              ref={seekRef}
              data-no-drag
              onPointerDown={onSeekDown}
              onPointerMove={onSeekMove}
              onPointerUp={onSeekUp}
              onPointerCancel={onSeekUp}
              className="group relative h-3 -my-1 flex items-center cursor-pointer touch-none select-none"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={state.duration || 0}
              aria-valuenow={state.position}
            >
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] transition-[width] duration-100 seek-glow-bar"
                  style={{ width: `${state.duration > 0 ? (state.position / state.duration) * 100 : 0}%` }} />
              </div>
              <div className="absolute -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_oklch(0.72_0.22_330/0.6)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                   style={{ left: `${state.duration > 0 ? (state.position / state.duration) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-[11px] tabular-nums text-white/60">
              <span>{fmt(state.position)}</span><span>{fmt(state.duration)}</span>
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-center gap-3 pb-2">
            <button type="button" onClick={() => toggleLike(t.id)}
              className="w-11 h-11 grid place-items-center rounded-full glass hover:bg-white/10 spring-press">
              <Heart size={18} className={liked ? "fill-[oklch(0.78_0.22_330)] text-[oklch(0.78_0.22_330)]" : ""} />
            </button>
            <button type="button" onClick={() => player?.prev()}
              className="w-12 h-12 grid place-items-center rounded-full glass hover:bg-white/10 spring-press">
              <SkipBack size={20} />
            </button>
            <button type="button" onClick={() => player?.togglePlay()}
              className="w-16 h-16 grid place-items-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform shadow-2xl spring-press">
              {state.isPlaying ? <Pause size={26} className="fill-black" /> : <Play size={26} className="fill-black ml-0.5" />}
            </button>
            <button type="button" onClick={() => player?.next()}
              className="w-12 h-12 grid place-items-center rounded-full glass hover:bg-white/10 spring-press">
              <SkipForward size={20} />
            </button>
            <button type="button" onClick={() => player?.toggleAiDj()}
              aria-label="AI DJ"
              className={`w-11 h-11 grid place-items-center rounded-full transition-all spring-press ${state.aiDj ? "bg-gradient-to-br from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] text-white glow-primary" : "glass hover:bg-white/10"}`}>
              <Sparkles size={18} />
            </button>
            <button type="button" onClick={() => setFxOpen(true)}
              aria-label="Sound effects"
              className={`relative w-11 h-11 grid place-items-center rounded-full transition-all spring-press ${state.soundFx !== "normal" ? "bg-white/15 text-white ring-1 ring-[oklch(0.78_0.2_330/0.6)]" : "glass hover:bg-white/10"}`}>
              <SlidersHorizontal size={18} />
              {state.soundFx !== "normal" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[oklch(0.78_0.22_330)] ring-2 ring-black/70" />
              )}
            </button>
          </div>
        </div>
      </div>
      <SoundFxSheet open={fxOpen} onClose={() => setFxOpen(false)} />
    </div>
  );
}

function BeatPulse({ playing }: { playing: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Primary pulse */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
           style={{ background: "radial-gradient(circle, rgb(var(--art-1)/0.25), transparent 60%)",
                    animation: playing ? "pulse-glow 2.4s ease-in-out infinite" : undefined }} />
      {/* Concentric ring 1 */}
      <div className="absolute left-1/2 top-1/2 w-[400px] h-[400px] rounded-full border border-[oklch(0.72_0.22_330/0.1)]"
           style={{ animation: playing ? "ring-pulse 3s ease-out infinite" : undefined }} />
      {/* Concentric ring 2 */}
      <div className="absolute left-1/2 top-1/2 w-[500px] h-[500px] rounded-full border border-[oklch(0.7_0.2_200/0.08)]"
           style={{ animation: playing ? "ring-pulse-delayed 3.5s ease-out infinite 0.8s" : undefined }} />
    </div>
  );
}
