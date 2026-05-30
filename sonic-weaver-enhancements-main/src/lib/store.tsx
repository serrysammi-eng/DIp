// React-side glue: PrefsProvider for personalization + usePlayer hook.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "./prefs";
import { getPlayer, type PlayerState } from "./player";
import type { Track } from "./providers";

type PrefsCtx = {
  prefs: Prefs;
  setPrefs: (updater: (p: Prefs) => Prefs) => void;
  toggleLike: (id: string) => void;
  isLiked: (id: string) => boolean;
  pushRecent: (id: string) => void;
  resetOnboarding: () => void;
  bumpAffinity: (artist: string, completed: boolean) => void;
  setPremium: (email: string) => void;
  restorePurchase: (email: string) => boolean;
  setSessionExpiry: () => void;
};
const Ctx = createContext<PrefsCtx | null>(null);

/** Remove all ad containers with a smooth fade for premium users */
export function applyPremiumUX() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("sonic-weaver:prefs")) {
    try {
      const p = JSON.parse(localStorage.getItem("sonic-weaver:prefs")!);
      if (p?.isPremium === true) {
        document.querySelectorAll('.ad-container, .banner-ad, #ad-gateway')
          .forEach(el => {
            (el as HTMLElement).style.transition = 'opacity 0.4s ease';
            (el as HTMLElement).style.opacity = '0';
            setTimeout(() => el.remove(), 400);
          });
        clearTimeout((window as unknown as { adGatewayTimer?: ReturnType<typeof setTimeout> }).adGatewayTimer);
      }
    } catch { /* ignore */ }
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setLocal] = useState<Prefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setLocal(loadPrefs()); setHydrated(true); }, []);

  // Apply premium UX on every load
  useEffect(() => {
    if (hydrated) applyPremiumUX();
  }, [hydrated]);

  // Sync settings into player on change
  useEffect(() => {
    if (!hydrated) return;
    const p = getPlayer();
    p.applySettings({
      fadeIn: prefs.settings.fadeIn,
      fadeOut: prefs.settings.fadeOut,
      crossfade: prefs.settings.crossfade,
      aiDj: prefs.settings.aiDj,
      automixTiming: prefs.settings.automixTiming,
      highlightMode: prefs.settings.highlightMode,
      highlightDuration: prefs.settings.highlightDuration,
      autoMixHighlights: prefs.settings.autoMixHighlights,
    });
  }, [hydrated, prefs.settings.fadeIn, prefs.settings.fadeOut, prefs.settings.crossfade, prefs.settings.aiDj, prefs.settings.automixTiming, prefs.settings.highlightMode, prefs.settings.highlightDuration, prefs.settings.autoMixHighlights]);

  const setPrefs: PrefsCtx["setPrefs"] = (updater) => {
    setLocal((cur) => { const next = updater(cur); savePrefs(next); return next; });
  };
  const toggleLike = (id: string) => setPrefs((p) => ({
    ...p,
    liked: p.liked.includes(id) ? p.liked.filter((x) => x !== id) : [id, ...p.liked].slice(0, 500),
  }));
  const isLiked = (id: string) => prefs.liked.includes(id);
  const pushRecent = (id: string) => setPrefs((p) => ({
    ...p,
    recent: [id, ...p.recent.filter((x) => x !== id)].slice(0, 60),
  }));
  const resetOnboarding = () => setPrefs(() => ({ ...DEFAULT_PREFS }));

  const bumpAffinity = (artist: string, completed: boolean) => {
    setPrefs((p) => {
      const key = artist.toLowerCase().split(",")[0].trim();
      const prev = p.artistAffinity[key] ?? 0.5;
      const delta = completed ? 0.05 : -0.03;
      const next = Math.max(0, Math.min(1, prev + delta));
      return { ...p, artistAffinity: { ...p.artistAffinity, [key]: next } };
    });
  };

  const setPremium = (email: string) => {
    setPrefs((p) => ({
      ...p,
      isPremium: true,
      userEmail: email,
      userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }));
    // Also set a standalone flag for quick checks
    try { localStorage.setItem("isPremium", "true"); } catch { /* ignore */ }
    applyPremiumUX();
  };

  const restorePurchase = (email: string): boolean => {
    // Mock: check if this email was previously premium
    try {
      const raw = localStorage.getItem("sonic-weaver:prefs");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.userEmail === email && saved.isPremium) {
          setPrefs((p) => ({ ...p, isPremium: true, userEmail: email, userId: saved.userId || p.userId }));
          localStorage.setItem("isPremium", "true");
          applyPremiumUX();
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  };

  const setSessionExpiry = () => {
    const expiry = Date.now() + 3 * 60 * 60 * 1000; // 3 hours
    setPrefs((p) => ({ ...p, sessionExpiry: expiry }));
  };

  const value = useMemo(() => ({
    prefs, setPrefs, toggleLike, isLiked, pushRecent, resetOnboarding,
    bumpAffinity, setPremium, restorePurchase, setSessionExpiry,
  }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

const emptySnap: PlayerState = {
  current: null, next: null, queue: [], isPlaying: false, position: 0, duration: 0,
  volume: 0.85, isLoading: false, isCrossfading: false, aiDj: false, fullscreen: false,
  analyser: null, art: [], error: null,
  soundFx: "normal", customEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  highlightMode: false, highlightActive: false,
  shuffleMode: "off",
};

export function usePlayer() {
  const p = useMemo(() => (typeof window === "undefined" ? null : getPlayer()), []);
  const state = useSyncExternalStore(
    (cb) => (p ? p.subscribe(cb) : () => {}),
    () => (p ? p.getState() : emptySnap),
    () => emptySnap,
  );
  return { state, player: p };
}

// Tiny cache so the same track instance is used app-wide.
const trackCache = new Map<string, Track>();
export function rememberTrack(t: Track) { trackCache.set(t.id, t); }
export function getTrack(id: string) { return trackCache.get(id) ?? null; }
