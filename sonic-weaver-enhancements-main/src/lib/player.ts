// Singleton audio manager with two decks routed through a persistent AudioContext.
//
// Real club-style DJ transitions:
//   • Pre-loads the next track silently on the idle deck.
//   • Tracks rolling energy (RMS) of the current song and detects genuine
//     energy drops (declining window past 60% of duration) for Smart Auto / Best.
//   • For Intro / End / Mid each mode has its own trigger rule.
//   • Before crossfading, briefly scans the incoming track's energy at several
//     candidate positions and seeks to the highest-energy point (chorus/drop).
//     Intro mode forces position 0.
//   • Executes the transition with: gain crossfade, low-pass sweep on outgoing,
//     high-pass sweep on incoming, bass shelf cut on outgoing, bass shelf
//     return on incoming. Short echo throw only on the last seconds of the
//     outgoing deck. DynamicsCompressor on master prevents clipping.
//
// Plus: master Sound-FX chain (3-band EQ + per-preset extras) so the user can
// shape playback in real time without touching deck logic.
import type { Track } from "./providers";
import { EQ_FREQUENCIES, type EqBands } from "./prefs";

type Listener = () => void;

export type AutomixTiming = "smart" | "end" | "intro" | "mid" | "best";

export type SoundFxPreset =
  | "normal" | "techno" | "club" | "bass" | "late-night"
  | "podcast" | "bass-monster" | "acoustic-live"
  | "3d-normal" | "3d-concert" | "3d-bass" | "3d-techno"
  | "lofi" | "orbit-plus";

export type CustomEq = EqBands;

export type PlayerState = {
  current: Track | null;
  next: Track | null;
  queue: Track[];
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  isCrossfading: boolean;
  aiDj: boolean;
  fullscreen: boolean;
  analyser: AnalyserNode | null;
  art: { r: number; g: number; b: number }[];
  error: string | null;
  highlightMode: boolean;
  highlightActive: boolean; // true when currently playing a highlight segment
  soundFx: SoundFxPreset;
  customEq: CustomEq;
  shuffleMode: "off" | "smart";
};

export type PlayerSettings = {
  fadeIn: number;
  fadeOut: number;
  crossfade: number;
  aiDj: boolean;
  automixTiming: AutomixTiming;
  highlightMode: boolean;
  highlightDuration: number;
  autoMixHighlights: boolean;
};

type Deck = {
  el: HTMLAudioElement;
  gain: GainNode;
  filter: BiquadFilterNode;     // lowpass sweep
  hp: BiquadFilterNode;          // highpass for intro fade-in
  bass: BiquadFilterNode;        // low-shelf for bass roll
  analyser: AnalyserNode;        // per-deck RMS
  src: MediaElementAudioSourceNode;
  // Echo tail
  echoSend: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  echoOut: GainNode;
};

const FX_KEY = "sonic-weaver:fx";
const EQ_KEY = "sonic-weaver:fx-eq";
const DJMODE_KEY = "sonic-weaver:dj-mode";

function proxiedUrl(t: Track): string {
  if (t.streamUrl.startsWith("http")) {
    return `/api/music-track?url=${encodeURIComponent(t.streamUrl)}`;
  }
  return t.streamUrl;
}

function equalPowerOut(steps = 48): number[] {
  const arr = new Array<number>(steps);
  for (let i = 0; i < steps; i++) arr[i] = Math.cos(((i / (steps - 1)) * Math.PI) / 2);
  return arr;
}
function equalPowerIn(steps = 48): number[] {
  const arr = new Array<number>(steps);
  for (let i = 0; i < steps; i++) arr[i] = Math.sin(((i / (steps - 1)) * Math.PI) / 2);
  return arr;
}

class Player {
  state: PlayerState = {
    current: null, next: null, queue: [],
    isPlaying: false, position: 0, duration: 0,
    volume: 0.85, isLoading: false, isCrossfading: false,
    aiDj: false, fullscreen: false, analyser: null, art: [], error: null,
    highlightMode: false, highlightActive: false,
    soundFx: "normal", customEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    shuffleMode: "off",
  };
  settings: PlayerSettings = {
    fadeIn: 1.2, fadeOut: 1.2, crossfade: 6, aiDj: false, automixTiming: "smart",
    highlightMode: false, highlightDuration: 30, autoMixHighlights: true,
  };

  private ctx: AudioContext | null = null;
  private decks: [Deck | null, Deck | null] = [null, null];
  private masterAnalyser: AnalyserNode | null = null;
  private active: 0 | 1 = 0;
  private listeners = new Set<Listener>();
  private raf = 0;
  private xfadeStarted = false;
  private rmsBuf = new Uint8Array(0);

  // ─── Energy tracking ────────────────────────────────────────────────────
  private energyHist: { t: number; e: number }[] = []; // {time-in-song, energy}
  private peakEnergy = 0;
  private energySampleAcc = 0; // accumulator for 500ms sampling

  // Mid-song mix one-shot per track
  private midMixTried = false;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Pre-loading next track ────────────────────────────────────────────
  private preloadedId: string | null = null;

  // ─── Master FX chain (Sound Effects) ────────────────────────────────────
  private fxIn: GainNode | null = null;      // sink for all decks
  private eqBands: BiquadFilterNode[] = [];   // 10-band parametric EQ
  private fxExtra: AudioNode | null = null;  // swappable preset insert
  private fxExtraIn: GainNode | null = null; // permanent connect point
  private fxExtraOut: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private orbitOsc: { osc: OscillatorNode; oscY: OscillatorNode; panner: PannerNode } | null = null;

  // ─── BPM estimation ────────────────────────────────────────────────────
  private bpmOnsets: number[] = [];  // timestamps of detected onsets
  private lastRms = 0;
  private estimatedBpm = 120;

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.state = { ...this.state }; for (const l of this.listeners) l(); }
  getState = () => this.state;

  // ─── Audio graph setup ─────────────────────────────────────────────────
  private ensureCtx() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new C();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;
    this.state.analyser = this.masterAnalyser;

    // fxIn — all decks connect here
    this.fxIn = this.ctx.createGain();

    // 10-band parametric EQ: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
    const qValues = [1.4, 1.4, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.4];
    this.eqBands = EQ_FREQUENCIES.map((freq, i) => {
      const f = this.ctx!.createBiquadFilter();
      // Use lowshelf for the lowest band, highshelf for the highest, peaking for the rest
      if (i === 0) { f.type = "lowshelf"; }
      else if (i === EQ_FREQUENCIES.length - 1) { f.type = "highshelf"; }
      else { f.type = "peaking"; f.Q.value = qValues[i]; }
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });

    this.fxExtraIn = this.ctx.createGain();
    this.fxExtraOut = this.ctx.createGain();
    // default: passthrough
    this.fxExtra = this.ctx.createGain();
    this.fxExtraIn.connect(this.fxExtra).connect(this.fxExtraOut);
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -10;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.18;

    // fxIn → 10-band EQ → fxExtraIn → ...extra... → fxExtraOut → masterAnalyser → comp → destination
    let lastNode: AudioNode = this.fxIn;
    for (const band of this.eqBands) {
      lastNode.connect(band);
      lastNode = band;
    }
    lastNode.connect(this.fxExtraIn);
    this.fxExtraOut.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.comp).connect(this.ctx.destination);

    // Restore persisted prefs
    try {
      const fx = localStorage.getItem(FX_KEY) as SoundFxPreset | null;
      if (fx) this.state.soundFx = fx;
      const eq = localStorage.getItem(EQ_KEY);
      if (eq) {
        const parsed = JSON.parse(eq);
        // Migration: old 3-band format → 10-band
        if (parsed && typeof parsed === "object" && "bass" in parsed) {
          this.state.customEq = [parsed.bass, parsed.bass, parsed.bass * 0.7, 0, 0, parsed.mid, parsed.mid, 0, parsed.treble * 0.7, parsed.treble] as EqBands;
        } else if (Array.isArray(parsed) && parsed.length === 10) {
          this.state.customEq = parsed as EqBands;
        }
      }
      const dj = localStorage.getItem(DJMODE_KEY) as AutomixTiming | null;
      if (dj) this.settings.automixTiming = dj;
    } catch { /* ignore */ }
    this.applyCustomEqInternal();
    this.applyFxPresetInternal(this.state.soundFx);

    return this.ctx;
  }

  private makeDeck(): Deck {
    const ctx = this.ensureCtx();
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 22050;
    filter.Q.value = 0.7;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 20;
    hp.Q.value = 0.7;
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 180;
    bass.gain.value = 0;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;

    // Echo bus
    const echoSend = ctx.createGain();
    echoSend.gain.value = 0;
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.38;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 1.0;

    // Dry path: src → filter → hp → bass → gain → analyser + fxIn
    src.connect(filter).connect(hp).connect(bass).connect(gain);
    gain.connect(analyser);
    gain.connect(this.fxIn!);
    // Wet path: gain → echoSend → delay (with feedback) → echoOut → fxIn
    gain.connect(echoSend);
    echoSend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(echoOut);
    echoOut.connect(this.fxIn!);

    return { el, gain, filter, hp, bass, analyser, src, echoSend, delay, feedback, echoOut };
  }

  private deck(i: 0 | 1) {
    if (!this.decks[i]) this.decks[i] = this.makeDeck();
    return this.decks[i]!;
  }

  // ─── Public API ────────────────────────────────────────────────────────
  applySettings(s: Partial<PlayerSettings>) {
    Object.assign(this.settings, s);
    if (typeof s.aiDj === "boolean") { this.state.aiDj = s.aiDj; this.emit(); }
    if (s.automixTiming) {
      try { localStorage.setItem(DJMODE_KEY, s.automixTiming); } catch { /* ignore */ }
    }
    if (typeof s.highlightMode === "boolean") {
      this.state.highlightMode = s.highlightMode;
      if (!s.highlightMode) {
        // Disable highlight mode: clear timer, let song play fully
        if (this.highlightTimer) { clearTimeout(this.highlightTimer); this.highlightTimer = null; }
        this.state.highlightActive = false;
      }
      this.emit();
    }
  }

  setVolume(v: number) {
    this.state.volume = Math.max(0, Math.min(1, v));
    const d = this.decks[this.active];
    if (d && this.ctx && !this.state.isCrossfading) {
      d.gain.gain.setTargetAtTime(this.state.volume, this.ctx.currentTime, 0.05);
    }
    this.emit();
  }

  setFullscreen(open: boolean) { this.state.fullscreen = open; this.emit(); }

  toggleAiDj() {
    this.state.aiDj = !this.state.aiDj;
    this.settings.aiDj = this.state.aiDj;
    this.emit();
  }

  // Sound FX
  setSoundFxPreset(p: SoundFxPreset) {
    this.state.soundFx = p;
    try { localStorage.setItem(FX_KEY, p); } catch { /* ignore */ }
    this.applyFxPresetInternal(p);
    this.emit();
  }
  setCustomEq(eq: Partial<Record<number, number>> | EqBands) {
    if (Array.isArray(eq)) {
      this.state.customEq = eq;
    } else {
      // Support index-based updates: { 0: 5, 3: -2 }
      const bands = [...this.state.customEq] as EqBands;
      for (const [k, v] of Object.entries(eq)) {
        const idx = Number(k);
        if (idx >= 0 && idx < 10 && typeof v === "number") bands[idx] = v;
      }
      this.state.customEq = bands;
    }
    try { localStorage.setItem(EQ_KEY, JSON.stringify(this.state.customEq)); } catch { /* ignore */ }
    this.applyCustomEqInternal();
    this.emit();
  }

  private applyCustomEqInternal() {
    if (!this.ctx || this.eqBands.length === 0) return;
    const t = this.ctx.currentTime;
    const presetGains = this.presetEqGains(this.state.soundFx);
    for (let i = 0; i < 10; i++) {
      const band = this.eqBands[i];
      if (!band) continue;
      const combined = Math.max(-24, Math.min(24, (presetGains[i] ?? 0) + (this.state.customEq[i] ?? 0)));
      band.gain.setTargetAtTime(combined, t, 0.04);
    }
  }

  // 10-band preset gains: [32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz]
  private presetEqGains(p: SoundFxPreset): number[] {
    switch (p) {
      case "techno":        return [4, 5, 3, 0, -1, -1, 1, 3, 5, 6];
      case "club":          return [5, 6, 5, 2, 0, 0, 1, 2, 3, 3];
      case "bass":          return [8, 9, 7, 4, 1, 0, 0, 0, -1, -1];
      case "late-night":    return [-4, -5, -4, -1, 1, 3, 2, 0, -2, -4];
      case "podcast":       return [-6, -7, -5, -2, 2, 6, 5, 2, -1, -3];
      case "bass-monster":  return [10, 12, 10, 6, 1, -1, -2, -2, -1, -1];
      case "acoustic-live": return [1, 2, 2, 1, 1, 2, 2, 2, 2, 2];
      case "3d-bass":       return [6, 8, 6, 3, 0, 0, 0, 1, 1, 1];
      case "3d-techno":     return [4, 5, 3, 0, -1, -1, 1, 3, 5, 6];
      case "lofi":          return [2, 3, 3, 1, 0, -1, -2, -4, -6, -8];
      default:              return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
  }

  // Swap the optional preset-insert node (convolver / panner / etc.)
  private applyFxPresetInternal(p: SoundFxPreset) {
    if (!this.ctx || !this.fxExtraIn || !this.fxExtraOut) return;
    const ctx = this.ctx;

    // Stop any prior orbit oscillator
    if (this.orbitOsc) {
      try { this.orbitOsc.osc.stop(); this.orbitOsc.oscY.stop(); } catch { /* ignore */ }
      this.orbitOsc = null;
    }
    // Disconnect old extra
    try { this.fxExtraIn.disconnect(); } catch { /* ignore */ }
    if (this.fxExtra) { try { this.fxExtra.disconnect(); } catch { /* ignore */ } }

    const buildSpatial = (room: "small" | "hall" | "orbit"): AudioNode => {
      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 10;
      panner.rolloffFactor = 1;
      panner.positionX.value = 0;
      panner.positionY.value = 0;
      panner.positionZ.value = -1;

      // simple convolver-based reverb via a synthesized impulse
      const len = room === "hall" ? 2.4 : room === "orbit" ? 1.6 : 0.9;
      const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, room === "hall" ? 2.2 : 3.0);
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const dry = ctx.createGain();
      dry.gain.value = room === "hall" ? 0.7 : 0.8;
      const wet = ctx.createGain();
      wet.gain.value = room === "hall" ? 0.45 : 0.22;
      const merger = ctx.createGain();
      // route: in -> panner -> [dry + (conv -> wet)] -> merger
      const inN = ctx.createGain();
      inN.connect(panner);
      panner.connect(dry).connect(merger);
      panner.connect(conv).connect(wet).connect(merger);

      // expose merger as output but we want a single audionode entry. Wrap.
      const wrap = ctx.createGain();
      // Connect inN as the "entry" by creating a ChannelMerger? Simpler:
      // we return inN and chain merger out externally.
      (wrap as unknown as { __in?: GainNode; __out?: GainNode }).__in = inN;
      (wrap as unknown as { __in?: GainNode; __out?: GainNode }).__out = merger;

      if (room === "orbit") {
        // Orbit Plus — rotate panner position slowly
        const osc = ctx.createOscillator();
        const oscY = ctx.createOscillator();
        osc.frequency.value = 0.08; // very slow
        oscY.frequency.value = 0.06;
        const radX = ctx.createGain(); radX.gain.value = 2;
        const radY = ctx.createGain(); radY.gain.value = 0.6;
        osc.connect(radX).connect(panner.positionX);
        oscY.connect(radY).connect(panner.positionZ);
        osc.start(); oscY.start();
        this.orbitOsc = { osc, oscY, panner };
      }
      return wrap;
    };

    let extra: AudioNode;
    let extraIn: AudioNode;
    let extraOut: AudioNode;

    switch (p) {
      case "3d-normal":
      case "3d-bass":
      case "3d-techno": {
        const w = buildSpatial("small");
        const wm = w as unknown as { __in: AudioNode; __out: AudioNode };
        extra = w; extraIn = wm.__in; extraOut = wm.__out;
        break;
      }
      case "3d-concert": {
        const w = buildSpatial("hall");
        const wm = w as unknown as { __in: AudioNode; __out: AudioNode };
        extra = w; extraIn = wm.__in; extraOut = wm.__out;
        break;
      }
      case "orbit-plus": {
        const w = buildSpatial("orbit");
        const wm = w as unknown as { __in: AudioNode; __out: AudioNode };
        extra = w; extraIn = wm.__in; extraOut = wm.__out;
        break;
      }
      case "lofi": {
        // Lo-fi: lowpass + slight wobble via LFO on a gain
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3600;
        const wob = ctx.createGain();
        wob.gain.value = 1;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 4.5; // gentle wobble
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain).connect(wob.gain);
        lfo.start();
        lp.connect(wob);
        const w = ctx.createGain();
        (w as unknown as { __in: AudioNode; __out: AudioNode }).__in = lp;
        (w as unknown as { __in: AudioNode; __out: AudioNode }).__out = wob;
        extra = w; extraIn = lp; extraOut = wob;
        break;
      }
      case "club":
      case "acoustic-live": {
        // Light room reverb
        const w = buildSpatial("small");
        const wm = w as unknown as { __in: AudioNode; __out: AudioNode };
        extra = w; extraIn = wm.__in; extraOut = wm.__out;
        break;
      }
      default: {
        const g = ctx.createGain();
        extra = g; extraIn = g; extraOut = g;
      }
    }

    this.fxExtra = extra;
    this.fxExtraIn.connect(extraIn);
    extraOut.connect(this.fxExtraOut);

    // Re-apply EQ since preset baseline gains changed
    this.applyCustomEqInternal();
  }

  // ─── Playback ──────────────────────────────────────────────────────────
  async playTrack(track: Track, queue: Track[] = []) {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* ignore */ } }

    const seen = new Set<string>([`${track.title.toLowerCase()}::${track.artist.toLowerCase().split(",")[0].trim()}`]);
    this.state.queue = [];
    for (const t of queue) {
      if (t.id === track.id) continue;
      const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase().split(",")[0].trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        this.state.queue.push(t);
      }
    }
    this.state.isLoading = true;
    this.state.error = null;
    this.state.current = track;
    this.state.duration = track.duration || 0;
    this.state.position = 0;
    this.xfadeStarted = false;
    this.midMixTried = false;
    this.energyHist = [];
    this.peakEnergy = 0;
    this.energySampleAcc = 0;
    this.preloadedId = null;
    this.emit();

    const url = proxiedUrl(track);

    // Fade out previous deck
    const prev = this.decks[this.active];
    if (prev && !prev.el.paused) {
      const t = ctx.currentTime;
      prev.gain.gain.cancelScheduledValues(t);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, t);
      prev.gain.gain.linearRampToValueAtTime(0, t + this.settings.fadeOut);
      const stash = prev;
      setTimeout(() => { try { stash.el.pause(); stash.el.removeAttribute("src"); stash.el.load(); } catch { /* ignore */ } }, this.settings.fadeOut * 1000 + 60);
    }

    this.active = (this.active === 0 ? 1 : 0) as 0 | 1;
    const d = this.deck(this.active);
    d.el.src = url;
    const t0 = ctx.currentTime;
    d.filter.frequency.cancelScheduledValues(t0);
    d.filter.frequency.setValueAtTime(22050, t0);
    d.hp.frequency.cancelScheduledValues(t0);
    d.hp.frequency.setValueAtTime(20, t0);
    d.bass.gain.cancelScheduledValues(t0);
    d.bass.gain.setValueAtTime(0, t0);
    d.gain.gain.cancelScheduledValues(t0);
    d.gain.gain.setValueAtTime(0, t0);
    d.echoSend.gain.cancelScheduledValues(t0);
    d.echoSend.gain.setValueAtTime(0, t0);

    const updateTime = () => {
      this.state.position = d.el.currentTime;
      if (Number.isFinite(d.el.duration)) this.state.duration = d.el.duration;
      this.emit();
    };
    d.el.ontimeupdate = updateTime;
    d.el.onseeking = updateTime;
    d.el.onseeked = updateTime;
    d.el.ondurationchange = () => {
      if (Number.isFinite(d.el.duration)) { this.state.duration = d.el.duration; this.emit(); }
    };
    d.el.onloadedmetadata = () => {
      if (Number.isFinite(d.el.duration)) { this.state.duration = d.el.duration; this.emit(); }
    };
    d.el.onplay = () => { this.state.isPlaying = true; this.emit(); };
    d.el.onpause = () => { this.state.isPlaying = false; this.emit(); };
    d.el.onended = () => this.onTrackEnded();
    d.el.onerror = () => {
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.error = "This track couldn't load. Try another version or skip to the next song.";
      this.emit();
    };
    d.el.onstalled = () => { /* network paused — let buffering recover */ };

    try {
      await d.el.play();
      this.state.isLoading = false;
      this.state.isPlaying = true;
      // In highlight mode, keep the deck SILENT — findAndSeekToHighlight will fade in after scanning.
      // In normal mode, fade in as usual.
      if (this.settings.highlightMode) {
        d.gain.gain.setValueAtTime(0, ctx.currentTime);
        d.el.muted = true; // Double safety: mute element during highlight scan
      } else {
        d.gain.gain.linearRampToValueAtTime(this.state.volume, ctx.currentTime + this.settings.fadeIn);
      }
      this.emit();
      this.startLoop();
    } catch (e) {
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.error = "Playback failed. Try another track or check your connection.";
      this.emit();
      console.warn("playback failed", e);
    }

    this.extractArt(track.artwork);

    // Highlight mode: scan for high-energy section and set duration limit
    if (this.settings.highlightMode) {
      this.state.highlightActive = true;
      this.emit();
      // Wait for metadata to load, then scan for the hook
      const waitForDuration = () => {
        const d = this.decks[this.active];
        if (!d) return;
        const dur = Number.isFinite(d.el.duration) ? d.el.duration : track.duration;
        if (dur > 0) {
          // Scan energy at multiple positions to find the hook/climax
          // The deck is already muted — findAndSeekToHighlight will fade in once the hook is found
          this.findAndSeekToHighlight(d, dur);
        } else {
          // Retry after a short delay if duration not yet available
          setTimeout(waitForDuration, 300);
        }
      };
      setTimeout(waitForDuration, 500);
    }
  }

  togglePlay() {
    const d = this.decks[this.active];
    if (!d) return;
    if (d.el.paused) { d.el.play().catch(() => { /* ignore */ }); this.state.isPlaying = true; }
    else { d.el.pause(); this.state.isPlaying = false; }
    this.emit();
  }

  seek(pct: number) {
    const d = this.decks[this.active];
    if (!d) return;
    const dur = Number.isFinite(d.el.duration) ? d.el.duration : this.state.duration;
    if (!dur || dur <= 0) return;
    const clamped = Math.max(0, Math.min(1, pct));
    d.el.currentTime = dur * clamped;
    this.state.position = d.el.currentTime;
    if (dur - this.state.position > (this.state.aiDj ? 10 : this.settings.crossfade) + 1) {
      this.xfadeStarted = false;
    }
    this.emit();
  }

  next() {
    const q = this.state.queue;
    if (q.length === 0) return;
    const [head, ...rest] = q;
    this.playTrack(head, rest);
  }

  prev() {
    const d = this.decks[this.active];
    if (d) { d.el.currentTime = 0; this.state.position = 0; this.emit(); }
  }

  enqueue(tracks: Track[]) {
    const seen = new Set<string>(
      [this.state.current, ...this.state.queue]
        .filter((t): t is Track => !!t)
        .map(t => `${t.title.toLowerCase()}::${t.artist.toLowerCase().split(",")[0].trim()}`)
    );
    const unique: Track[] = [];
    for (const t of tracks) {
      const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase().split(",")[0].trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    this.state.queue = [...this.state.queue, ...unique];
    this.emit();
  }

  private onTrackEnded() {
    if (this.state.queue.length) this.next();
    else { this.state.isPlaying = false; this.emit(); }
  }

  // ─── Energy analysis ────────────────────────────────────────────────────
  private rmsFromAnalyser(a: AnalyserNode): number {
    const n = a.fftSize;
    if (this.rmsBuf.length !== n) this.rmsBuf = new Uint8Array(n);
    a.getByteTimeDomainData(this.rmsBuf);
    let sum = 0;
    for (let i = 0; i < n; i++) { const v = (this.rmsBuf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / n);
  }

  private sampleEnergy(pos: number) {
    const d = this.decks[this.active];
    if (!d) return;
    const e = this.rmsFromAnalyser(d.analyser);
    if (e > this.peakEnergy) this.peakEnergy = e;
    this.energyHist.push({ t: pos, e });
    if (this.energyHist.length > 800) this.energyHist.shift();

    // BPM onset detection: detect energy spikes for beat tracking
    const threshold = this.lastRms * 1.3 + 0.02;
    if (e > threshold && e > 0.05) {
      this.bpmOnsets.push(performance.now());
      if (this.bpmOnsets.length > 60) this.bpmOnsets.shift();
      this.estimateBpm();
    }
    this.lastRms = e * 0.7 + this.lastRms * 0.3; // smoothed RMS
  }

  private estimateBpm() {
    if (this.bpmOnsets.length < 8) return;
    const intervals: number[] = [];
    for (let i = 1; i < this.bpmOnsets.length; i++) {
      intervals.push(this.bpmOnsets[i] - this.bpmOnsets[i - 1]);
    }
    // Filter out intervals outside plausible BPM range (60-200 BPM → 300-1000ms)
    const valid = intervals.filter(i => i > 300 && i < 1000);
    if (valid.length < 4) return;
    const median = valid.sort((a, b) => a - b)[Math.floor(valid.length / 2)];
    const bpm = Math.round(60000 / median);
    if (bpm >= 60 && bpm <= 200 && Math.abs(bpm - this.estimatedBpm) > 5) {
      this.estimatedBpm = bpm;
      // Set CSS custom properties for fluid gradients
      if (typeof document !== "undefined") {
        const speed = Math.max(0.5, Math.min(2.5, bpm / 120));
        document.documentElement.style.setProperty("--bpm-speed", speed.toFixed(2));
      }
    }
  }

  private startLoop() {
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const tick = () => {
      const d = this.decks[this.active];
      if (!d) return;
      const now = performance.now();
      const dt = now - last;
      last = now;

      const dur = this.state.duration || 0;
      const pos = d.el.currentTime;
      const remaining = dur - pos;

      if (this.state.isPlaying && dur > 0) {
        this.energySampleAcc += dt;
        if (this.energySampleAcc >= 500) {
          this.energySampleAcc = 0;
          this.sampleEnergy(pos);
        }
      }

      // Preload next 2 tracks once we're past 15% of the song
      if (this.state.queue.length > 0 && !this.preloadedId && pos / Math.max(1, dur) > 0.15) {
        this.preloadNext();
      }

      this.maybeStartTransition(remaining, pos, dur);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // Silently load the next track on the idle deck so it's buffered & ready.
  // Also warm the CDN cache for the track after that.
  private preloadNext() {
    const upcoming = this.state.queue[0];
    if (!upcoming) return;
    this.preloadedId = upcoming.id;
    const idleIdx = (this.active === 0 ? 1 : 0) as 0 | 1;
    const inc = this.deck(idleIdx);
    try {
      inc.gain.gain.value = 0;
      inc.el.muted = false;
      inc.el.src = proxiedUrl(upcoming);
      inc.el.load();
    } catch { /* ignore */ }
    // Warm CDN cache for track #2 if available
    const second = this.state.queue[1];
    if (second) {
      try { fetch(proxiedUrl(second), { method: "HEAD" }).catch(() => {}); } catch { /* ignore */ }
    }
    // Notify Service Worker to pre-cache audio
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      const urls = [proxiedUrl(upcoming)];
      if (second) urls.push(proxiedUrl(second));
      navigator.serviceWorker.controller.postMessage({ type: "PRECACHE_AUDIO", urls });
    }
  }

  // ─── DJ transition decision engine ─────────────────────────────────────
  private maybeStartTransition(remaining: number, pos: number, dur: number) {
    if (this.xfadeStarted || this.state.queue.length === 0 || dur <= 0) return;
    const aiDj = this.state.aiDj;
    const baseXf = aiDj ? Math.max(this.settings.crossfade, 8) : this.settings.crossfade;

    if (!aiDj) {
      if (remaining <= baseXf && remaining > 0) {
        this.xfadeStarted = true;
        this.beginTransition(baseXf, "normal");
      }
      return;
    }

    const mode = this.settings.automixTiming;
    const peak = this.peakEnergy || 0.1;

    // Helper — detect a genuine declining-energy window in the last `seconds`
    const decliningWindow = (seconds: number) => {
      const cutoff = pos - seconds;
      const window = this.energyHist.filter((p) => p.t >= cutoff);
      if (window.length < 4) return false;
      const first = window[0].e, last = window[window.length - 1].e;
      const ratio = last / Math.max(0.01, first);
      const lowVsPeak = last < peak * 0.55;
      return ratio < 0.85 && lowVsPeak;
    };

    // Intro Mix — same trigger as Smart but inject next track from second 0
    if (mode === "intro") {
      const past60 = pos / dur > 0.60;
      if (past60 && (decliningWindow(7) || remaining <= 18)) {
        this.xfadeStarted = true;
        this.djLog(mode, pos, dur, "intro trigger");
        this.beginTransition(Math.min(12, Math.max(baseXf, 9)), "dj-intro", { forceEntry: 0 });
      }
      return;
    }

    // End Mix — wait until the last 20s regardless of energy
    if (mode === "end") {
      if (remaining <= 20) {
        this.xfadeStarted = true;
        this.djLog(mode, pos, dur, "last-20s trigger");
        this.beginTransition(Math.min(12, Math.max(baseXf, 9)), "dj-end");
      }
      return;
    }

    // Mid-Song Mix — find earliest sustained low-energy past 30% of song
    if (mode === "mid" && !this.midMixTried && dur >= 90) {
      const minPos = dur * 0.30;
      if (pos >= minPos) {
        const window = this.energyHist.filter((p) => p.t >= pos - 5);
        if (window.length >= 8) {
          const avg = window.reduce((a, b) => a + b.e, 0) / window.length;
          if (avg < peak * 0.50) {
            this.midMixTried = true;
            this.xfadeStarted = true;
            this.djLog(mode, pos, dur, "mid breakdown detected");
            this.beginTransition(Math.min(12, Math.max(baseXf, 9)), "dj-mid");
            return;
          }
        }
        // Fall back to smart if no breakdown by 75%
        if (pos / dur > 0.75) this.midMixTried = true;
      }
      if (this.midMixTried) {
        // fall through to smart logic
      } else {
        return;
      }
    }

    // Smart / Best — past 60% + declining 5–8s window
    const past60 = pos / dur > 0.60;
    if (past60 && decliningWindow(6)) {
      this.xfadeStarted = true;
      this.djLog(mode, pos, dur, "smart energy drop");
      this.beginTransition(Math.min(12, Math.max(baseXf, 9)), "dj-end");
      return;
    }
    // Hard cap so we never miss the close
    if (remaining <= baseXf) {
      this.xfadeStarted = true;
      this.djLog(mode, pos, dur, "hard cap");
      this.beginTransition(baseXf, "dj-end");
    }
  }

  private djLog(mode: string, pos: number, dur: number, reason: string) {
    if (typeof window === "undefined") return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[AI DJ]", { mode, pos: +pos.toFixed(1), dur: +dur.toFixed(1), reason, peak: +this.peakEnergy.toFixed(3) });
    }
  }

  // Briefly play the incoming track muted at candidate positions and pick the
  // one with the highest energy. Returns chosen seek offset.
  // FIXED: Also mute the HTML element to prevent any audio leak during scanning.
  private async scanIncomingEntry(inc: Deck, dur: number, force?: number): Promise<number> {
    if (typeof force === "number") return force;
    const candidates = [15, 25, 35, 45, 60].filter((p) => p < Math.max(20, (dur || 200) - 25));
    if (candidates.length === 0) return 0;
    let best = candidates[0];
    let bestE = 0;
    inc.gain.gain.value = 0;
    inc.el.muted = true; // Safety: mute the element so zero audio can leak
    for (const p of candidates) {
      try {
        inc.el.currentTime = p;
        await new Promise<void>((res) => setTimeout(res, 220));
        const e = this.rmsFromAnalyser(inc.analyser);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug("[AI DJ] scan", { pos: p, e: +e.toFixed(3) });
        }
        if (e > bestE) { bestE = e; best = p; }
      } catch { /* ignore */ }
    }
    inc.el.muted = false; // Un-mute before the crossfade begins
    return best;
  }

  private async beginTransition(
    xf: number,
    kind: "normal" | "dj-end" | "dj-intro" | "dj-mid",
    opts?: { forceEntry?: number },
  ) {
    const ctx = this.ctx!;
    const cur = this.decks[this.active]!;
    const upcoming = this.state.queue[0];
    if (!upcoming) { this.xfadeStarted = false; return; }

    const incomingIdx = (this.active === 0 ? 1 : 0) as 0 | 1;
    const inc = this.deck(incomingIdx);
    // Make sure inc is loaded (preload may not have happened on short tracks)
    if (this.preloadedId !== upcoming.id) {
      inc.el.src = proxiedUrl(upcoming);
      inc.el.load();
    }
    inc.gain.gain.value = 0;

    // Per-mode effect profile.
    const profile = (() => {
      switch (kind) {
        case "normal":   return { incLP: 22050, incHP: 20,  incBass: 0,   outLPEnd: 22050, outBassEnd: 0,   echoPeak: 0.0, hpRamp: 0.6 };
        case "dj-end":   return { incLP: 22050, incHP: 800, incBass: -6,  outLPEnd: 200,   outBassEnd: -12, echoPeak: 0.18, hpRamp: 0.5 };
        case "dj-intro": return { incLP: 22050, incHP: 400, incBass: -8,  outLPEnd: 280,   outBassEnd: -16, echoPeak: 0.16, hpRamp: 0.5 };
        case "dj-mid":   return { incLP: 22050, incHP: 600, incBass: -8,  outLPEnd: 240,   outBassEnd: -14, echoPeak: 0.20, hpRamp: 0.5 };
      }
    })();

    // Start playing incoming muted so we can scan its energy
    try { await inc.el.play(); }
    catch {
      this.xfadeStarted = false;
      return;
    }

    let entry = 0;
    if (kind !== "normal") {
      entry = await this.scanIncomingEntry(inc, this.state.duration, opts?.forceEntry);
      try { inc.el.currentTime = entry; } catch { /* ignore */ }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[AI DJ] entry chosen", { entry, kind });
      }
    }

    const t0 = ctx.currentTime;
    inc.filter.frequency.cancelScheduledValues(t0);
    inc.filter.frequency.setValueAtTime(profile.incLP, t0);
    inc.hp.frequency.cancelScheduledValues(t0);
    inc.hp.frequency.setValueAtTime(profile.incHP, t0);
    inc.bass.gain.cancelScheduledValues(t0);
    inc.bass.gain.setValueAtTime(profile.incBass, t0);
    inc.echoSend.gain.cancelScheduledValues(t0);
    inc.echoSend.gain.setValueAtTime(0, t0);

    this.state.isCrossfading = true;
    this.emit();

    const vol = this.state.volume;
    const outCurve = new Float32Array(equalPowerOut(48).map((v) => v * cur.gain.gain.value));
    const inCurve = new Float32Array(equalPowerIn(48).map((v) => v * vol));

    cur.gain.gain.cancelScheduledValues(t0);
    cur.gain.gain.setValueCurveAtTime(outCurve, t0, xf);
    inc.gain.gain.cancelScheduledValues(t0);
    inc.gain.gain.setValueCurveAtTime(inCurve, t0, xf);

    if (kind !== "normal") {
      // Outgoing — lowpass sweep down + bass cut
      cur.filter.frequency.cancelScheduledValues(t0);
      cur.filter.frequency.setValueAtTime(Math.max(2000, cur.filter.frequency.value), t0);
      cur.filter.frequency.exponentialRampToValueAtTime(profile.outLPEnd, t0 + xf);
      cur.bass.gain.cancelScheduledValues(t0);
      cur.bass.gain.linearRampToValueAtTime(profile.outBassEnd, t0 + xf);

      // Short echo only on the last seconds of outgoing
      if (profile.echoPeak > 0) {
        const tailStart = t0 + Math.max(0, xf - 2);
        cur.echoSend.gain.cancelScheduledValues(t0);
        cur.echoSend.gain.setValueAtTime(0, t0);
        cur.echoSend.gain.linearRampToValueAtTime(profile.echoPeak, tailStart + 0.6);
        cur.echoSend.gain.linearRampToValueAtTime(0, t0 + xf + 0.3);
      }

      // Incoming — open HP back to floor, return bass shelf to 0
      inc.hp.frequency.exponentialRampToValueAtTime(20, t0 + xf * profile.hpRamp);
      inc.bass.gain.linearRampToValueAtTime(0, t0 + xf);
    }

    setTimeout(() => {
      try { cur.el.pause(); cur.el.removeAttribute("src"); cur.el.load(); } catch { /* ignore */ }
      try {
        const tn = ctx.currentTime;
        cur.filter.frequency.cancelScheduledValues(tn);
        cur.filter.frequency.setValueAtTime(22050, tn);
        cur.hp.frequency.cancelScheduledValues(tn);
        cur.hp.frequency.setValueAtTime(20, tn);
        cur.bass.gain.cancelScheduledValues(tn);
        cur.bass.gain.setValueAtTime(0, tn);
        cur.echoSend.gain.cancelScheduledValues(tn);
        cur.echoSend.gain.setValueAtTime(0, tn);
      } catch { /* ignore */ }
      this.active = incomingIdx;
      this.state.current = upcoming;
      this.state.queue = this.state.queue.slice(1);
      this.state.isCrossfading = false;
      this.xfadeStarted = false;
      this.midMixTried = false;
      this.energyHist = [];
      this.peakEnergy = 0;
      this.preloadedId = null;
      this.state.position = inc.el.currentTime;
      this.state.duration = Number.isFinite(inc.el.duration) ? inc.el.duration : upcoming.duration;
      this.emit();
      this.extractArt(upcoming.artwork);
    }, xf * 1000 + 60);
  }

  private async extractArt(url: string) {
    if (!url || typeof document === "undefined") return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
      const cv = document.createElement("canvas");
      cv.width = 24; cv.height = 24;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;
      let r1=0,g1=0,b1=0,r2=0,g2=0,b2=0,n1=0,n2=0;
      for (let i = 0; i < data.length; i += 4) {
        const r=data[i],g=data[i+1],b=data[i+2];
        const lum = 0.299*r + 0.587*g + 0.114*b;
        if (lum > 110) { r1+=r;g1+=g;b1+=b;n1++; } else { r2+=r;g2+=g;b2+=b;n2++; }
      }
      const c1 = n1 ? { r:r1/n1|0, g:g1/n1|0, b:b1/n1|0 } : { r:200,g:80,b:180 };
      const c2 = n2 ? { r:r2/n2|0, g:g2/n2|0, b:b2/n2|0 } : { r:80,g:60,b:160 };
      this.state.art = [c1, c2];
      document.documentElement.style.setProperty("--art-1", `${c1.r} ${c1.g} ${c1.b}`);
      document.documentElement.style.setProperty("--art-2", `${c2.r} ${c2.g} ${c2.b}`);
      this.emit();
    } catch { /* ignore cors */ }
  }

  private async findAndSeekToHighlight(d: Deck, dur: number) {
    // Enhanced: scan at 12+ positions (every 5% from 15%-85%), take 3 consecutive RMS samples.
    // CRITICAL FIX: Mute the deck BEFORE any seeking to eliminate scrubbing noise.
    const positions: number[] = [];
    for (let pct = 0.15; pct <= 0.85; pct += 0.05) {
      const pos = Math.floor(pct * dur);
      if (pos < dur - 10) positions.push(pos);
    }
    
    if (positions.length === 0) return;

    const ctx = this.ctx;
    if (!ctx) return;

    // ── SILENT SEEKING: Mute the deck completely before we start scanning ──
    const savedVolume = this.state.volume;
    const t0 = ctx.currentTime;
    d.gain.gain.cancelScheduledValues(t0);
    d.gain.gain.setValueAtTime(0, t0); // Hard mute — user hears nothing

    // Also mute the HTML element as a safety net against any audio leak
    d.el.muted = true;

    // Brief scan: measure energy at each candidate with multi-sample averaging
    let bestPos = positions[0];
    let bestEnergy = 0;
    
    for (const pos of positions) {
      try {
        d.el.currentTime = pos;
        // Wait for the seek to settle; the analyser still gets data even while muted
        await new Promise<void>(res => setTimeout(res, 120));
        // Take 3 consecutive samples and average for noise reduction
        let totalE = 0;
        for (let s = 0; s < 3; s++) {
          totalE += this.rmsFromAnalyser(d.analyser);
          if (s < 2) await new Promise<void>(res => setTimeout(res, 60));
        }
        const avgEnergy = totalE / 3;
        if (avgEnergy > bestEnergy) {
          bestEnergy = avgEnergy;
          bestPos = pos;
        }
      } catch { /* ignore */ }
    }

    // Seek to the highest-energy position (2s before for natural lead-in)
    try { d.el.currentTime = Math.max(0, bestPos - 2); } catch { /* ignore */ }
    this.state.position = d.el.currentTime;
    this.emit();

    // ── SMOOTH FADE-IN: Un-mute the element and ramp gain up gracefully ──
    d.el.muted = false;
    const tNow = ctx.currentTime;
    d.gain.gain.cancelScheduledValues(tNow);
    d.gain.gain.setValueAtTime(0, tNow);
    // Smooth 0.6s fade-in to the hook — feels premium and seamless
    d.gain.gain.linearRampToValueAtTime(savedVolume, tNow + 0.6);

    if (import.meta.env.DEV) {
      console.debug("[Highlight] Playing hook at", bestPos, "energy:", bestEnergy.toFixed(3));
    }

    // Set timer to end highlight and transition to next
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    
    // Also monitor for energy drops during highlight playback
    const highlightStart = performance.now();
    const dropCheckInterval = setInterval(() => {
      if (!this.state.highlightActive) { clearInterval(dropCheckInterval); return; }
      const elapsed = (performance.now() - highlightStart) / 1000;
      if (elapsed < 10) return; // Don't check in the first 10s
      
      // Check for sustained energy drop (instrumental/beat break)
      const recent = this.energyHist.slice(-6);
      if (recent.length >= 4) {
        const avgRecent = recent.reduce((a, b) => a + b.e, 0) / recent.length;
        if (avgRecent < bestEnergy * 0.35) {
          // Energy dropped significantly — trigger early crossfade
          clearInterval(dropCheckInterval);
          if (this.highlightTimer) { clearTimeout(this.highlightTimer); this.highlightTimer = null; }
          if (this.state.queue.length > 0) {
            const xf = 3; // 3-second crossfade on energy drop
            this.xfadeStarted = true;
            this.beginTransition(xf, this.state.aiDj ? "dj-end" : "normal");
          }
        }
      }
    }, 500);

    this.highlightTimer = setTimeout(() => {
      clearInterval(dropCheckInterval);
      this.highlightTimer = null;
      if (this.settings.autoMixHighlights && this.state.queue.length > 0) {
        // Seamless transition to next highlight
        const xf = Math.min(4, this.settings.crossfade);
        this.xfadeStarted = true;
        this.beginTransition(xf, this.state.aiDj ? "dj-end" : "normal");
      } else if (this.state.queue.length > 0) {
        this.next();
      } else {
        this.state.highlightActive = false;
        this.emit();
      }
    }, this.settings.highlightDuration * 1000);
  }

  // ─── Smart Shuffle ──────────────────────────────────────────────────────
  toggleShuffleMode() {
    this.state.shuffleMode = this.state.shuffleMode === "off" ? "smart" : "off";
    if (this.state.shuffleMode === "smart" && this.state.queue.length > 1) {
      this.smartShuffle();
    }
    this.emit();
  }

  private smartShuffle(affinity?: Record<string, number>) {
    if (this.state.queue.length <= 1) return;
    const affinityMap = affinity ?? {};
    const currentArtist = this.state.current?.artist?.toLowerCase().split(",")[0].trim() ?? "";

    // Score each track
    const scored = this.state.queue.map(t => {
      const artist = t.artist.toLowerCase().split(",")[0].trim();
      const artistAff = affinityMap[artist] ?? 0.5;
      const popularityScore = (t.playCount ?? 0) > 0 ? Math.log10(t.playCount!) / 8 : 0.3;
      const sameArtistPenalty = artist === currentArtist ? 0.3 : 1.0;
      const score = (popularityScore * 0.4 + artistAff * 0.6) * sameArtistPenalty;
      return { track: t, score: Math.max(0.01, score) };
    });

    // Weighted random shuffle
    const shuffled: Track[] = [];
    const remaining = [...scored];
    while (remaining.length > 0) {
      const total = remaining.reduce((s, r) => s + r.score, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < remaining.length; i++) {
        r -= remaining[i].score;
        if (r <= 0) { idx = i; break; }
      }
      shuffled.push(remaining[idx].track);
      remaining.splice(idx, 1);
    }

    this.state.queue = shuffled;
    this.emit();
  }

  applyShuffleAffinity(affinity: Record<string, number>) {
    if (this.state.shuffleMode === "smart") {
      this.smartShuffle(affinity);
    }
  }
}

let _player: Player | null = null;
export function getPlayer(): Player {
  if (!_player) _player = new Player();
  return _player;
}
