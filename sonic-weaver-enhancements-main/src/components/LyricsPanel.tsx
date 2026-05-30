// Decoupled lyrics engine — renders inside an isolated scroll container
// with CSS containment to prevent viewport shift. Smooth scrolling uses
// requestAnimationFrame for 60fps fluidity.
import { useEffect, useRef, useMemo, useCallback } from "react";
import type { LyricLine } from "../lib/providers";

type LyricsData = { synced?: LyricLine[]; plain?: string } | null;

export function LyricsPanel({
  lyrics,
  loading,
  position,
}: {
  lyrics: LyricsData;
  loading: boolean;
  position: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRafRef = useRef<number>(0);

  const activeLine = useMemo(() => {
    if (!lyrics?.synced?.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].time <= position + 0.15) idx = i; else break;
    }
    return idx;
  }, [lyrics, position]);

  // rAF-based smooth scroll — never calls scrollIntoView which can escape containers
  const smoothScrollTo = useCallback((targetEl: HTMLDivElement) => {
    const container = containerRef.current;
    if (!container) return;

    cancelAnimationFrame(scrollRafRef.current);

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetCenter = targetRect.top + targetRect.height / 2;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const delta = targetCenter - containerCenter;

    const startScroll = container.scrollTop;
    const targetScroll = startScroll + delta;
    const startTime = performance.now();
    const duration = 300;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startScroll + (targetScroll - startScroll) * eased;
      if (progress < 1) {
        scrollRafRef.current = requestAnimationFrame(animate);
      }
    };

    scrollRafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (activeLine < 0) return;
    const el = lineRefs.current.get(activeLine);
    if (el) smoothScrollTo(el);
  }, [activeLine, smoothScrollTo]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(scrollRafRef.current);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2.5 p-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
        ))}
      </div>
    );
  }

  if (lyrics?.synced?.length) {
    return (
      <div
        ref={containerRef}
        className="lyrics-container overflow-y-auto flex-1 pr-1"
        style={{ willChange: "scroll-position" }}
      >
        <div className="space-y-2 py-8">
          {lyrics.synced.map((line, i) => (
            <div
              key={i}
              ref={(el) => { if (el) lineRefs.current.set(i, el); }}
              className={`text-[17px] leading-relaxed font-medium transition-all duration-300 ${
                i === activeLine
                  ? "text-white scale-[1.02] drop-shadow-[0_0_18px_oklch(0.78_0.22_330/0.5)]"
                  : i < activeLine ? "text-white/35" : "text-white/55"
              }`}
            >
              {line.text || "♪"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (lyrics?.plain) {
    return (
      <div ref={containerRef} className="lyrics-container overflow-y-auto flex-1 pr-1">
        <pre className="font-sans whitespace-pre-wrap text-[15px] leading-7 text-white/90">{lyrics.plain}</pre>
      </div>
    );
  }

  return (
    <div className="h-full grid place-items-center text-center text-sm text-white/60 py-10">
      <div>
        <div className="text-4xl mb-3">♪</div>
        Lyrics are not available for this song yet.<br />
        <span className="text-xs text-white/40">Try another track — the music keeps weaving.</span>
      </div>
    </div>
  );
}
