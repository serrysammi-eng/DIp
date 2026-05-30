import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "../components/AppLayout";
import { Range, Segmented, Switch } from "../components/ui-kit";
import { usePrefs } from "../lib/store";
import { Info, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type AutomixTiming = "smart" | "end" | "intro" | "mid" | "best";
const AUTOMIX_OPTIONS: { value: AutomixTiming; label: string; desc: string }[] = [
  { value: "smart", label: "Smart Auto", desc: "Default. Picks the most natural DJ transition point automatically." },
  { value: "end",   label: "End Mix",    desc: "Mix near the outro. Prefers instrumental tails and avoids cutting vocals." },
  { value: "intro", label: "Intro Mix",  desc: "Bring the next song in earlier so its intro blends over the current outro." },
  { value: "mid",   label: "Mid-Song Mix", desc: "Transition during a safe breakdown or instrumental break mid-track." },
  { value: "best",  label: "Best Available", desc: "Flexible — uses intro, outro, or mid section depending on what sounds best." },
];

function SettingsPage() {
  const { prefs, setPrefs, resetOnboarding } = usePrefs();
  const s = prefs.settings;
  const upd = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) =>
    setPrefs((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));

  return (
    <AppLayout>
      <div className="px-4 md:px-10 pt-2 md:pt-6 max-w-3xl">
        <header className="fade-up">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-white/60 mt-1">Tune the experience to your taste.</p>
        </header>

        <Card title="Profile">
          <Row label="Display name">
            <input
              value={prefs.name}
              onChange={(e) => setPrefs((p) => ({ ...p, name: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-[oklch(0.72_0.22_330)] w-56"
              placeholder="Your name" />
          </Row>
          <Row label="Onboarding" hint="Reset to pick languages, genres, and artists again.">
            <button onClick={() => { resetOnboarding(); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm">
              <RefreshCw size={14} /> Reset preferences
            </button>
          </Row>
        </Card>

        {!prefs.isPremium && (
          <section className="mt-6 glass glass-glow rounded-3xl p-5 md:p-6 fade-up relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.72_0.22_330/0.15)] to-[oklch(0.7_0.2_200/0.15)] opacity-50" />
            <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-[oklch(0.72_0.22_330)]">👑</span> Unlock Premium
                </h2>
                <p className="text-sm text-white/70 mt-1 max-w-md">
                  Enjoy Sonic Weaver without limits. No ads, high-quality audio, and all future features for a one-time payment of ₹99.
                </p>
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-paywall"))}
                className="shrink-0 px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-[oklch(0.72_0.22_330)] to-[oklch(0.65_0.25_330)] text-white hover:scale-105 active:scale-95 transition-transform spring-press shadow-[0_4px_20px_oklch(0.72_0.22_330/0.3)]"
              >
                Go Premium — ₹99
              </button>
            </div>
          </section>
        )}

        <Card title="Audio">
          <Row label="Audio quality">
            <Segmented value={s.audioQuality} onChange={(v) => upd("audioQuality", v)}
              options={[{value:"auto",label:"Auto"},{value:"high",label:"High"},{value:"ultra",label:"Ultra"}]} />
          </Row>
          <Row label="Fade in" hint={`${s.fadeIn.toFixed(1)} seconds`}>
            <Range value={s.fadeIn} min={0} max={6} step={0.1} onChange={(v) => upd("fadeIn", v)} suffix="s" />
          </Row>
          <Row label="Fade out" hint={`${s.fadeOut.toFixed(1)} seconds`}>
            <Range value={s.fadeOut} min={0} max={6} step={0.1} onChange={(v) => upd("fadeOut", v)} suffix="s" />
          </Row>
          <Row label="Crossfade" hint={`${s.crossfade.toFixed(1)} seconds between tracks`}>
            <Range value={s.crossfade} min={0} max={12} step={0.5} onChange={(v) => upd("crossfade", v)} suffix="s" />
          </Row>
          <Row label="Smart Shuffle" hint="Prioritize trending and high-affinity tracks when shuffling.">
            <Segmented value={s.shuffleMode} onChange={(v) => upd("shuffleMode", v)}
              options={[{value:"off",label:"Off"},{value:"smart",label:"Smart"}]} />
          </Row>
        </Card>

        <Card title="AI DJ">
          <Row label="AI DJ Mode" hint="Real-time DJ-style automixing with filter sweeps, bass roll-off, and echo throws.">
            <Switch on={s.aiDj} onChange={(v) => upd("aiDj", v)} />
          </Row>

          <div className="py-4">
            <div className="text-sm font-medium">Automix Timing</div>
            <div className="text-xs text-white/50 mt-0.5">Choose when the AI DJ creates the mix between songs.</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AUTOMIX_OPTIONS.map((o) => {
                const on = s.automixTiming === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => upd("automixTiming", o.value)}
                    className={`text-left rounded-2xl p-3.5 border transition-all ${
                      on
                        ? "bg-gradient-to-br from-[oklch(0.72_0.22_330/0.18)] to-[oklch(0.7_0.2_200/0.12)] border-[oklch(0.72_0.22_330/0.6)] glow-primary"
                        : "glass border-white/10 hover:bg-white/10"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{o.label}</div>
                      {on && <div className="text-[10px] uppercase tracking-widest text-[oklch(0.82_0.18_330)]">Active</div>}
                    </div>
                    <div className="text-xs text-white/60 mt-1 leading-snug">{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Row label="Transition intensity">
            <Segmented value={s.djIntensity} onChange={(v) => upd("djIntensity", v)}
              options={[{value:"smooth",label:"Smooth"},{value:"balanced",label:"Balanced"},{value:"club",label:"Club"}]} />
          </Row>
          <Row label="Transition duration">
            <Segmented value={s.djDuration} onChange={(v) => upd("djDuration", v)}
              options={[{value:"short",label:"Short"},{value:"medium",label:"Medium"},{value:"long",label:"Long"}]} />
          </Row>
          <Row label="Effects intensity">
            <Segmented value={s.djEffects} onChange={(v) => upd("djEffects", v)}
              options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} />
          </Row>
          <Row label="Beat sync"><Switch on={s.beatSync} onChange={(v) => upd("beatSync", v)} /></Row>
          <Row label="Auto queue"><Switch on={s.autoQueue} onChange={(v) => upd("autoQueue", v)} /></Row>
        </Card>

        <Card title="Highlights">
          <Row label="Highlight Mode" hint="Play only the most popular part (hook/climax) of each song.">
            <Switch on={s.highlightMode} onChange={(v) => upd("highlightMode", v)} />
          </Row>
          <Row label="Highlight duration" hint={`${s.highlightDuration}s of the best part`}>
            <Range value={s.highlightDuration} min={15} max={60} step={5} onChange={(v) => upd("highlightDuration", v)} suffix="s" />
          </Row>
          <Row label="Auto-Mix Highlights" hint="Seamless DJ transitions between song highlights.">
            <Switch on={s.autoMixHighlights} onChange={(v) => upd("autoMixHighlights", v)} />
          </Row>
        </Card>

        <Card title="Appearance">
          <Row label="Theme">
            <Segmented value={s.theme} onChange={(v) => upd("theme", v)}
              options={[{value:"cosmic",label:"Cosmic"},{value:"ember",label:"Ember"},{value:"forest",label:"Forest"},{value:"noir",label:"Noir"}]} />
          </Row>
        </Card>

        <Card title="Notifications">
          <Row label="New releases from your artists"><Switch on={s.notifNew} onChange={(v) => upd("notifNew", v)} /></Row>
          <Row label="Tips & weekly mixes"><Switch on={s.notifTips} onChange={(v) => upd("notifTips", v)} /></Row>
        </Card>

        <Card title="Privacy">
          <Row label="Save listening history" hint="Powers 'Recently played' on Home."><Switch on={s.privacyHistory} onChange={(v) => upd("privacyHistory", v)} /></Row>
        </Card>

        <Card title="About">
          <div className="px-1 py-2 flex items-start gap-3 text-sm text-white/70">
            <Info size={16} className="mt-0.5 text-white/40" />
            <div>
              <div className="font-medium text-white">Sonic Weaver</div>
              <div>An original, cinematic music experience. Personalized for music lovers across Hindi, Bhojpuri, Haryanvi, Punjabi, English, and beyond.</div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 glass glass-glow rounded-3xl p-5 md:p-6 fade-up">
      <h2 className="text-sm uppercase tracking-widest text-white/50 mb-2">{title}</h2>
      <div className="divide-y divide-white/5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-white/50 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0 max-w-[60%]">{children}</div>
    </div>
  );
}
