// Premium Sound Effects bottom sheet. Two tabs: Presets + Pro EQ.
// All presets are real Web Audio nodes wired in player.ts. Switching is instant.
import { useEffect, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { usePlayer } from "../lib/store";
import type { SoundFxPreset } from "../lib/player";
import { ProEqualizer } from "./ProEqualizer";

type Preset = { id: SoundFxPreset; label: string; hint: string; group: "Tone" | "Spatial" | "Mood" };

const PRESETS: Preset[] = [
  { id: "normal",        label: "Normal",         hint: "Clean, unprocessed",     group: "Tone" },
  { id: "techno",        label: "Techno",         hint: "Punchy lows, bright highs", group: "Tone" },
  { id: "club",          label: "Club",           hint: "Wide, room ambience",    group: "Tone" },
  { id: "bass",          label: "Bass",           hint: "Deep low-end boost",     group: "Tone" },
  { id: "late-night",    label: "Late Night",     hint: "Soft, mid-forward",      group: "Mood" },
  { id: "podcast",       label: "Podcast Clarity",hint: "Voice-tuned EQ",         group: "Mood" },
  { id: "bass-monster",  label: "Bass Monster",   hint: "Extreme sub boost",      group: "Tone" },
  { id: "acoustic-live", label: "Acoustic Live",  hint: "Warm, small-room feel",  group: "Mood" },
  { id: "3d-normal",     label: "3D Normal",      hint: "Surround, balanced",     group: "Spatial" },
  { id: "3d-concert",    label: "3D Concert",     hint: "Hall reverb, wide",      group: "Spatial" },
  { id: "3d-bass",       label: "3D Bass",        hint: "Surround + deep bass",   group: "Spatial" },
  { id: "3d-techno",     label: "3D Techno",      hint: "Surround + techno EQ",   group: "Spatial" },
  { id: "lofi",          label: "Lo-Fi",          hint: "Warm wobble, soft top",  group: "Mood" },
  { id: "orbit-plus",    label: "Orbit Plus",     hint: "360° rotating audio",    group: "Spatial" },
];

export function SoundFxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, player } = usePlayer();
  const [tab, setTab] = useState<"effects" | "equalizer">("effects");
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ startY: number; pid: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    if (mounted) {
      setShow(false);
      setDragY(0);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  if (!mounted) return null;

  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, [role='slider']")) return;
    dragRef.current = { startY: e.clientY, pid: e.pointerId };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pid !== e.pointerId) return;
    const dy = e.clientY - dragRef.current.startY;
    setDragY(Math.max(0, dy));
  };
  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pid !== e.pointerId) return;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current = null;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (dy > 120) { setDragY(0); onClose(); } else setDragY(0);
  };

  const transform = show
    ? `translate3d(0, ${dragY}px, 0)`
    : `translate3d(0, 100%, 0)`;

  const groups: Preset["group"][] = ["Tone", "Spatial", "Mood"];

  return (
    <div className="fixed inset-0 z-[60]" aria-hidden={!show}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        style={{ opacity: show ? Math.max(0, 1 - dragY / 400) : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute left-0 right-0 bottom-0 max-h-[88vh] glass-strong rounded-t-3xl shadow-2xl will-change-transform overflow-hidden flex flex-col"
        style={{
          transform,
          transition: dragRef.current ? "none" : "transform 280ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div
          className="shrink-0 touch-none"
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="flex justify-center pt-2.5">
            <div className="w-12 h-1.5 rounded-full bg-white/25" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[oklch(0.78_0.2_330)]" />
              <h2 className="text-base font-semibold tracking-tight">Sound Effects</h2>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 grid place-items-center rounded-full glass hover:bg-white/10 active:scale-95 transition-transform spring-press">
              <X size={18} />
            </button>
          </div>
          <div className="px-5 pb-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5">
              {(["effects", "equalizer"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${tab === k ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>
                  {k === "effects" ? "Sound Effects" : "Pro Equalizer"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 pb-8">
          {tab === "effects" ? (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g}>
                  <div className="text-[10px] uppercase tracking-widest text-white/45 mb-2">{g === "Tone" ? "Presets" : g}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PRESETS.filter((p) => p.group === g).map((p) => {
                      const active = state.soundFx === p.id;
                      return (
                        <button key={p.id} type="button"
                          onClick={() => player?.setSoundFxPreset(p.id)}
                          className={`relative text-left p-3 rounded-2xl border transition-all overflow-hidden spring-press ${
                            active
                              ? "border-transparent bg-gradient-to-br from-[oklch(0.78_0.2_330/0.35)] to-[oklch(0.72_0.2_200/0.35)] glow-primary"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}>
                          <div className="text-sm font-semibold">{p.label}</div>
                          <div className="text-[11px] text-white/60 mt-0.5">{p.hint}</div>
                          {active && (
                            <div className="absolute top-2 right-2 text-[10px] font-medium uppercase tracking-wider text-white/90">On</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <ProEqualizer />
          )}
        </div>
      </div>
    </div>
  );
}
