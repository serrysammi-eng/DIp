// Local-storage backed user preferences. SSR-safe.

// 10-band parametric EQ frequencies (Hz)
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export type EqBands = [number, number, number, number, number, number, number, number, number, number];

export type Prefs = {
  onboarded: boolean;
  name: string;
  languages: string[];
  genres: string[];
  artists: string[];
  liked: string[]; // track ids
  recent: string[]; // track ids most-recent-first
  savedArtists: string[];
  artistAffinity: Record<string, number>; // artist → affinity score (0-1)
  // Premium & auth fields
  isPremium: boolean;
  userEmail: string;
  userId: string;
  sessionExpiry: number; // timestamp (ms) — ad gateway session
  hasSeenOnboarding: boolean;
  settings: {
    audioQuality: "auto" | "high" | "ultra";
    fadeIn: number;     // seconds
    fadeOut: number;    // seconds
    crossfade: number;  // seconds
    aiDj: boolean;
    automixTiming: "smart" | "end" | "intro" | "mid" | "best";
    djIntensity: "smooth" | "balanced" | "club";
    djDuration: "short" | "medium" | "long";
    djEffects: "low" | "medium" | "high";
    beatSync: boolean;
    autoQueue: boolean;
    theme: "cosmic" | "ember" | "forest" | "noir";
    notifNew: boolean;
    notifTips: boolean;
    privacyHistory: boolean;
    highlightMode: boolean;
    highlightDuration: number;  // seconds (15-60)
    autoMixHighlights: boolean;
    shuffleMode: "off" | "smart";
  };
};

export const DEFAULT_EQ_BANDS: EqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const DEFAULT_PREFS: Prefs = {
  onboarded: false,
  name: "",
  languages: [],
  genres: [],
  artists: [],
  liked: [],
  recent: [],
  savedArtists: [],
  artistAffinity: {},
  isPremium: false,
  userEmail: "",
  userId: "",
  sessionExpiry: 0,
  hasSeenOnboarding: false,
  settings: {
    audioQuality: "high",
    fadeIn: 1.5,
    fadeOut: 1.5,
    crossfade: 3,
    aiDj: false,
    automixTiming: "smart",
    djIntensity: "balanced",
    djDuration: "medium",
    djEffects: "medium",
    beatSync: true,
    autoQueue: true,
    theme: "cosmic",
    notifNew: true,
    notifTips: false,
    privacyHistory: true,
    highlightMode: false,
    highlightDuration: 30,
    autoMixHighlights: true,
    shuffleMode: "off",
  },
};

const KEY = "sonic-weaver:prefs";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      artistAffinity: parsed.artistAffinity ?? {},
      settings: { ...DEFAULT_PREFS.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
}
