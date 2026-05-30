// Professional-grade equalizer component with 64-bar spectrum visualizer,
// preset modes, and 10-band parametric EQ with glowing knob-style sliders.
import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/store";
import type { SoundFxPreset } from "../lib/player";
import { EQ_FREQUENCIES } from "../lib/prefs";

type EqPreset = {
  id: string;
  label: string;
  icon: string;
  eq: number[]; // 10-band gains
  fxPreset?: SoundFxPreset;
};

const EQ_PRESETS: EqPreset[] = [
  { id: "flat",       label: "Flat",       icon: "─",  eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "bass-boost", label: "Bass Boost", icon: "▼",  eq: [8, 9, 7, 4, 1, 0, 0, 0, -1, -2], fxPreset: "bass" },
  { id: "chill",      label: "Chill",      icon: "◐",  eq: [-2, -1, 0, 1, 2, 3, 2, 0, -2, -4], fxPreset: "late-night" },
  { id: "electronic", label: "Electronic", icon: "◇",  eq: [4, 5, 3, 0, -1, -1, 1, 3, 5, 6], fxPreset: "techno" },
  { id: "vocal",      label: "Vocal",      icon: "○",  eq: [-3, -4, -2, 0, 2, 5, 4, 2, 0, -1], fxPreset: "podcast" },
  { id: "lofi",       label: "Lo-Fi",      icon: "◌",  eq: [2, 3, 3, 1, 0, -1, -2, -4, -6, -8], fxPreset: "lofi" },
  { id: "club",       label: "Club",       icon: "◈",  eq: [5, 6, 5, 2, 0, 0, 1, 2, 3, 3], fxPreset: "club" },
  { id: "live",       label: "Live",       icon: "◎",  eq: [1, 2, 2, 1, 1, 2, 2, 2, 2, 2], fxPreset: "acoustic-live" },
];

const FREQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

function SpectrumVisualizer({ height = 100 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = usePlayer();

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const analyser = state.analyser;
    const dpr = window.devicePixelRatio || 1;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(64);

    const resize = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);

      if (analyser && state.isPlaying) analyser.getByteFrequencyData(data);
      else for (let i = 0; i < data.length; i++) data[i] = Math.max(0, data[i] - 6);

      const bars = 64;
      const gap = 2;
      const bw = (w - gap * (bars - 1)) / bars;
      const halfH = h * 0.55; // Main bars use top 55%, reflection uses bottom

      for (let i = 0; i < bars; i++) {
        const rawVal = data[Math.floor((i / bars) * data.length)] / 255;
        const val = Math.pow(rawVal, 0.85); // Slight boost to lower values
        const bh = Math.max(2, val * halfH);
        const x = i * (bw + gap);
        const y = halfH - bh;

        // Main bar gradient (magenta → cyan)
        const grad = ctx.createLinearGradient(x, y, x, halfH);
        const hue1 = 330 - (i / bars) * 130; // magenta to cyan
        grad.addColorStop(0, `oklch(0.82 0.2 ${hue1} / 0.95)`);
        grad.addColorStop(0.5, `oklch(0.72 0.22 ${hue1} / 0.85)`);
        grad.addColorStop(1, `oklch(0.6 0.18 ${hue1} / 0.7)`);
        ctx.fillStyle = grad;

        // Rounded top
        const r = Math.min(bw / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + bw - r, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
        ctx.lineTo(x + bw, halfH);
        ctx.lineTo(x, halfH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();

        // Peak glow
        if (val > 0.7) {
          ctx.shadowColor = `oklch(0.8 0.22 ${hue1} / 0.6)`;
          ctx.shadowBlur = 12;
          ctx.fillRect(x, y, bw, 2);
          ctx.shadowBlur = 0;
        }

        // Reflection (mirrored below, faded)
        const reflH = bh * 0.35;
        const reflGrad = ctx.createLinearGradient(x, halfH + 2, x, halfH + 2 + reflH);
        reflGrad.addColorStop(0, `oklch(0.7 0.15 ${hue1} / 0.2)`);
        reflGrad.addColorStop(1, `oklch(0.7 0.15 ${hue1} / 0)`);
        ctx.fillStyle = reflGrad;
        ctx.fillRect(x, halfH + 2, bw, reflH);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [state.analyser, state.isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, width: "100%" }}
      className="rounded-xl"
    />
  );
}

function EqBandSlider({
  label, value, hue, onChange,
}: { label: string; value: number; hue: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-white/45 font-medium">{label}</span>
      <div className="relative h-28 w-6 flex items-center justify-center">
        <div className="absolute inset-x-0 h-full flex items-center justify-center">
          <div className="w-0.5 h-full rounded-full bg-white/10 relative overflow-hidden">
            {/* Fill */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-100"
              style={{
                height: `${((value + 12) / 24) * 100}%`,
                background: `linear-gradient(to top, oklch(0.72 0.22 ${hue}), oklch(0.7 0.2 ${(hue + 120) % 360}))`,
              }}
            />
          </div>
        </div>
        <input
          type="range"
          min={-12} max={12} step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute h-full w-6 cursor-pointer opacity-0"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
        />
        {/* Thumb indicator */}
        <div
          className="absolute w-5 h-2.5 rounded-full bg-white pointer-events-none transition-[bottom] duration-100"
          style={{
            bottom: `${((value + 12) / 24) * 100}%`,
            transform: "translateY(50%)",
            boxShadow: `0 0 10px oklch(0.72 0.22 ${hue} / 0.5)`,
          }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-white/55 font-medium">
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

// EQ curve visualization connecting the band values
function EqCurve({ bands }: { bands: number[] }) {
  const points = bands.map((v, i) => {
    const x = (i / (bands.length - 1)) * 100;
    const y = 50 - (v / 12) * 40; // Map -12..+12 to 90..10
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full h-8 mt-1 mb-2 opacity-60" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="url(#eq-curve-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="eq-curve-grad" x1="0" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.22 330)" />
          <stop offset="100%" stopColor="oklch(0.72 0.2 200)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ProEqualizer() {
  const { state, player } = usePlayer();

  const activePreset = EQ_PRESETS.find(
    p => {
      for (let i = 0; i < 10; i++) {
        if ((p.eq[i] ?? 0) !== (state.customEq[i] ?? 0)) return false;
      }
      return true;
    }
  )?.id ?? "custom";

  const applyPreset = (preset: EqPreset) => {
    player?.setCustomEq(preset.eq as [number, number, number, number, number, number, number, number, number, number]);
    if (preset.fxPreset) {
      player?.setSoundFxPreset(preset.fxPreset);
    }
  };

  return (
    <div className="space-y-5">
      {/* Spectrum Visualizer */}
      <div className="glass-glow rounded-2xl p-3 overflow-hidden">
        <SpectrumVisualizer height={120} />
      </div>

      {/* Preset Mode Buttons */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/45 mb-2">Preset Modes</div>
        <div className="grid grid-cols-4 gap-2">
          {EQ_PRESETS.map((p) => {
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`relative p-2.5 rounded-xl border text-center transition-all spring-press ${
                  active
                    ? "border-transparent bg-gradient-to-br from-[oklch(0.78_0.2_330/0.3)] to-[oklch(0.72_0.2_200/0.3)] glow-primary"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="text-lg mb-0.5">{p.icon}</div>
                <div className="text-[11px] font-medium truncate">{p.label}</div>
                {active && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[oklch(0.78_0.22_330)] ring-2 ring-black/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 10-Band EQ Sliders */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/45 mb-1">10-Band Parametric EQ</div>
        <EqCurve bands={[...state.customEq]} />
        <div className="flex items-center justify-between gap-1">
          {EQ_FREQUENCIES.map((freq, i) => (
            <EqBandSlider
              key={freq}
              label={FREQ_LABELS[i]}
              hue={330 - (i / 9) * 130}
              value={state.customEq[i] ?? 0}
              onChange={(v) => player?.setCustomEq({ [i]: v })}
            />
          ))}
        </div>
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={() => player?.setCustomEq([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])}
            className="text-xs text-white/50 hover:text-white underline underline-offset-2 transition-colors"
          >
            Reset to flat
          </button>
        </div>
      </div>
    </div>
  );
}
