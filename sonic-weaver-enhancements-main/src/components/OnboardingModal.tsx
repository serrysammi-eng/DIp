// Premium welcome popup for new users. Renders above the app shell with a
// blurred backdrop. Steps content is the same as before; only the shell changed
// from a full route to a centered modal / bottom sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { usePrefs } from "../lib/store";
import { Chip } from "./ui-kit";
import { Logo } from "./Logo";

const LANGS = [
  { code: "Hindi", hue: 330 }, { code: "Bhojpuri", hue: 40 },
  { code: "Haryanvi", hue: 120 }, { code: "Punjabi", hue: 280 },
  { code: "English", hue: 200 }, { code: "Tamil", hue: 160 },
  { code: "Telugu", hue: 60 }, { code: "Marathi", hue: 300 },
  { code: "Bengali", hue: 20 }, { code: "Gujarati", hue: 80 },
  { code: "Spanish", hue: 350 }, { code: "Korean", hue: 240 },
  { code: "Arabic", hue: 140 },
];

const GENRES = [
  "Bollywood", "Pop", "Hip-Hop", "Indie", "Rock", "EDM", "Lo-fi", "R&B",
  "Punjabi pop", "Bhangra", "Folk", "Classical", "Romantic", "Party",
  "Sad", "Workout", "Devotional", "K-Pop", "Latin", "Jazz",
];

/* ---------- Onboarding Canvas Particle System ---------- */

type VoidParticle = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  hue: number;
  scattered: boolean;
};

function useVoidCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particlesRef = useRef<VoidParticle[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999, pressed: false });
  const rafRef = useRef(0);

  const init = useCallback((w: number, h: number) => {
    const count = w < 500 ? 40 : 65;
    const hues = [200, 260, 280, 330];
    const particles: VoidParticle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      particles.push({
        x, y,
        originX: x,
        originY: y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.2 + 0.6,
        opacity: Math.random() * 0.5 + 0.2,
        hue: hues[Math.floor(Math.random() * hues.length)],
        scattered: false,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      w = rect?.width ?? canvas.clientWidth;
      h = rect?.height ?? canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) init(w, h);
    };
    resize();

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = e.clientX - rect.left;
      pointerRef.current.y = e.clientY - rect.top;
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressed: true,
      };
      // Scatter particles within 100px radius
      const px = pointerRef.current.x;
      const py = pointerRef.current.y;
      for (const p of particlesRef.current) {
        const dx = p.x - px;
        const dy = p.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist > 1) {
          const angle = Math.atan2(dy, dx);
          const force = (100 - dist) / 100 * 6;
          p.vx += Math.cos(angle) * force;
          p.vy += Math.sin(angle) * force;
          p.scattered = true;
        }
      }
    };

    const onPointerUp = () => {
      pointerRef.current.pressed = false;
    };

    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    canvas.addEventListener("pointerup", onPointerUp, { passive: true });
    canvas.addEventListener("pointerleave", () => {
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    }, { passive: true });

    const SCATTER_RADIUS = 100;
    const CONNECTION_DIST = 100;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const mx = pointerRef.current.x;
      const my = pointerRef.current.y;

      for (const p of particles) {
        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Pointer attraction/repulsion (subtle attract when hovering)
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SCATTER_RADIUS && dist > 1) {
          const force = (SCATTER_RADIUS - dist) / SCATTER_RADIUS * 0.012;
          // Subtle repulsion near cursor
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        // Spring back after scatter (~1 second recovery)
        if (p.scattered) {
          const sdx = p.originX - p.x;
          const sdy = p.originY - p.y;
          p.vx += sdx * 0.008;
          p.vy += sdy * 0.008;
          const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sDist < 2 && Math.abs(p.vx) < 0.3 && Math.abs(p.vy) < 0.3) {
            p.scattered = false;
          }
        }

        // Dampen
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Draw glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.7 0.18 ${p.hue} / ${p.opacity * 0.12})`;
        ctx.fill();

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.8 0.15 ${p.hue} / ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `oklch(0.75 0.15 280 / ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      ro.disconnect();
    };
  }, [init]);
}

/* ---------- Main Modal ---------- */

export function OnboardingModal() {
  const { prefs, setPrefs } = usePrefs();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefs.name);
  const [langs, setLangs] = useState<string[]>(prefs.languages);
  const [genres, setGenres] = useState<string[]>(prefs.genres);
  const [artists, setArtists] = useState<string[]>(prefs.artists);
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = requestAnimationFrame(() => setShow(true));
    // lock body scroll while popup open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, []);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    setShow(false);
    setTimeout(() => {
      setPrefs((p) => ({
        ...p,
        onboarded: true,
        hasSeenOnboarding: true,
        name: name.trim(),
        languages: langs,
        genres,
        artists,
      }));
    }, 280);
  };

  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return langs.length > 0;
    if (step === 2) return genres.length > 0;
    if (step === 3) return artists.length > 0;
    return true;
  }, [step, name, langs, genres, artists]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        style={{ opacity: show ? 1 : 0, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      />
      {/* aurora glow behind modal */}
      <div
        className="absolute inset-0 pointer-events-none aurora transition-opacity duration-500"
        style={{ opacity: show ? 0.5 : 0 }}
      />
      {/* floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="absolute rounded-full bg-white/30"
            style={{
              width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              filter: "blur(1px)",
              animation: `float ${6 + Math.random() * 6}s ease-in-out ${Math.random() * 4}s infinite`,
              opacity: 0.4 + Math.random() * 0.4,
            }} />
        ))}
      </div>

      {/* modal card */}
      <div
        className="relative w-full md:max-w-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col rounded-t-3xl md:rounded-3xl border border-white/10 shadow-2xl will-change-transform"
        style={{
          background: "linear-gradient(180deg, oklch(0.20 0.04 285 / 0.85), oklch(0.12 0.03 285 / 0.92))",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          transform: show ? "translateY(0) scale(1)" : "translateY(40px) scale(0.97)",
          opacity: show ? 1 : 0,
          transition: "transform 320ms cubic-bezier(0.32,0.72,0,1), opacity 280ms ease-out",
        }}
      >
        {/* mobile grabber */}
        <div className="md:hidden flex justify-center pt-2">
          <div className="w-10 h-1.5 rounded-full bg-white/25" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 md:p-6 md:pb-2">
          <Logo />
          <div className="text-xs text-white/60">Step {step + 1} of 5</div>
        </div>

        <div className="px-5 md:px-6 mt-3">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] transition-all duration-500"
              style={{ width: `${((step + 1) / 5) * 100}%` }} />
          </div>
        </div>

        {/* scrollable step content */}
        <div className="flex-1 overflow-auto px-5 md:px-8 pt-6 pb-4">
          <div key={step} className="fade-up">
            {step === 0 && <StepName name={name} setName={setName} />}
            {step === 1 && <StepLangs picked={langs} setPicked={setLangs} />}
            {step === 2 && <StepGenres picked={genres} setPicked={setGenres} />}
            {step === 3 && <StepArtists picked={artists} setPicked={setArtists} langs={langs} />}
            {step === 4 && <StepCelebrate name={name} />}
          </div>
        </div>

        <div className="px-5 md:px-8 py-4 md:py-5 border-t border-white/10 flex items-center justify-between gap-3"
             style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button onClick={prev} disabled={step === 0}
            className="text-sm text-white/60 disabled:opacity-30 hover:text-white px-2 py-2">
            Back
          </button>
          {step < 4 ? (
            <button onClick={next} disabled={!canNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 transition-transform shadow-lg">
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finish}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] text-white font-semibold glow-primary hover:scale-[1.03] active:scale-95 transition-transform">
              Ignite Your Sound <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Step 0: Enter the Void ---------- */

function StepName({ name, setName }: { name: string; setName: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useVoidCanvas(canvasRef);

  return (
    <div className="text-center">
      {/* Interactive canvas background */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-6" style={{ height: 200 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ background: "transparent" }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-lg"
            style={{ fontFamily: "'Urbanist', var(--font-display), sans-serif" }}
          >
            Enter the Void
          </h1>
          <p className="mt-2 text-white/70 text-sm md:text-base max-w-sm">
            Your personal music universe begins here. Shape it by touch.
          </p>
        </div>
      </div>
      <div className="max-w-md mx-auto">
        <input
          autoFocus value={name}
          onChange={(e) => {
            const v = e.target.value;
            setName(v.charAt(0).toUpperCase() + v.slice(1));
          }}
          placeholder="What should we call you?"
          className="w-full text-center text-xl md:text-2xl py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-[oklch(0.72_0.22_330)] focus:glow-primary transition-shadow text-white placeholder:text-white/30" />
      </div>
    </div>
  );
}

/* ---------- Step 1: Language Cards ---------- */

function StepLangs({ picked, setPicked }: { picked: string[]; setPicked: (v: string[]) => void }) {
  const toggle = (c: string) => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c]);
  return (
    <div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-white/50">Languages</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Pick your sound</h1>
        <p className="mt-2 text-white/60 text-sm">Choose every language you love. We'll mix across all of them.</p>
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {LANGS.map((l, i) => {
          const on = picked.includes(l.code);
          const abbr = l.code.slice(0, 2).toUpperCase();
          return (
            <button key={l.code} onClick={() => toggle(l.code)} type="button"
              style={{ animationDelay: `${i * 25}ms` }}
              className={`fade-up relative rounded-2xl p-3.5 text-left border transition-all duration-200 active:scale-[0.97] overflow-hidden ${
                on
                  ? "border-[oklch(0.78_0.22_330/0.7)] shadow-[0_0_0_1px_oklch(0.78_0.22_330/0.5),0_8px_24px_-8px_oklch(0.72_0.22_330/0.5)]"
                  : "border-white/10 hover:border-white/25 hover:-translate-y-0.5"
              }`}
            >
              {/* Gradient background based on hue */}
              <span aria-hidden className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: on
                    ? `linear-gradient(135deg, oklch(0.45 0.18 ${l.hue} / 0.5), oklch(0.3 0.12 ${(l.hue + 40) % 360} / 0.4))`
                    : `linear-gradient(135deg, oklch(0.25 0.08 ${l.hue} / 0.3), oklch(0.18 0.05 ${(l.hue + 40) % 360} / 0.2))`,
                }}
              />
              {/* Geometric pattern via CSS gradient */}
              <span aria-hidden className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.08]"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 20% 80%, oklch(0.9 0.2 ${l.hue}) 1px, transparent 1px),
                    radial-gradient(circle at 80% 20%, oklch(0.9 0.2 ${l.hue}) 1px, transparent 1px),
                    linear-gradient(${l.hue}deg, transparent 40%, oklch(0.8 0.15 ${l.hue} / 0.3) 50%, transparent 60%)
                  `,
                  backgroundSize: "20px 20px, 15px 15px, 100% 100%",
                }}
              />
              <div className="relative">
                <div
                  className="text-2xl font-bold drop-shadow-md"
                  style={{
                    fontFamily: "'Urbanist', var(--font-display), sans-serif",
                    color: `oklch(0.85 0.15 ${l.hue})`,
                  }}
                >
                  {abbr}
                </div>
                <div className="mt-1.5 font-semibold text-sm text-white">{l.code}</div>
                {on && <Check size={14} className="absolute top-0 right-0 text-[oklch(0.85_0.18_330)]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Step 2: Genres (unchanged) ---------- */

function StepGenres({ picked, setPicked }: { picked: string[]; setPicked: (v: string[]) => void }) {
  const toggle = (c: string) => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c]);
  return (
    <div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-white/50">Genres</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">What moves you?</h1>
        <p className="mt-2 text-white/60 text-sm">Pick anything that catches your ear.</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        {GENRES.map((g, i) => (
          <div key={g} style={{ animationDelay: `${i * 20}ms` }} className="fade-up">
            <Chip active={picked.includes(g)} onClick={() => toggle(g)}>{g}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Step 3: Artists (dynamic API fetch) ---------- */

type TrendingArtistResult = {
  name: string;
  image: string;
  listeners?: number;
};

function StepArtists({ picked, setPicked, langs }: { picked: string[]; setPicked: (v: string[]) => void; langs: string[] }) {
  const [pool, setPool] = useState<TrendingArtistResult[]>([]);
  const [loading, setLoading] = useState(true);
  const langsKey = useMemo(() => (langs.length ? langs : ["Hindi", "English", "Punjabi"]).join("|"), [langs]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const activeLangs = langs.length ? langs : ["Hindi", "English", "Punjabi"];

    Promise.all(
      activeLangs.map((lang) =>
        fetch(`/api/trending-artists?region=${encodeURIComponent(lang.toLowerCase())}&limit=7`)
          .then((r) => (r.ok ? r.json() : { artists: [] }))
          .then((j: { artists?: TrendingArtistResult[] }) => j.artists ?? [])
          .catch(() => [] as TrendingArtistResult[])
      )
    ).then((results) => {
      if (cancelled) return;
      // Deduplicate across languages
      const seen = new Set<string>();
      const deduped: TrendingArtistResult[] = [];
      for (const batch of results) {
        for (const a of batch) {
          const key = a.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(a);
          }
        }
      }
      setPool(deduped);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [langsKey]);

  const toggle = (n: string) => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);

  return (
    <div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-white/50">Artists</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Pick a few you love</h1>
        <p className="mt-2 text-white/60 text-sm">We'll seed your feed and queue with their sound.</p>
      </div>
      {loading ? (
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="text-center" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="aspect-square rounded-full bg-white/5 animate-pulse" />
              <div className="mt-2 h-3 w-3/4 mx-auto rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {pool.map((a, i) => {
            const on = picked.includes(a.name);
            return (
              <button key={a.name} onClick={() => toggle(a.name)} style={{ animationDelay: `${i * 30}ms` }} type="button"
                className="fade-up text-center group">
                <div className={`relative aspect-square rounded-full overflow-hidden ring-2 transition-all ${
                  on ? "ring-[oklch(0.78_0.2_330)] scale-[1.04] glow-primary" : "ring-white/10 group-hover:ring-white/30"
                }`}>
                  {a.image ? <img src={a.image} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full aurora" />}
                  {on && (
                    <div className="absolute inset-0 grid place-items-center bg-black/30">
                      <div className="w-7 h-7 rounded-full bg-[oklch(0.78_0.2_330)] grid place-items-center"><Check size={14} /></div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs md:text-sm font-medium truncate text-white">{a.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Step 4: Celebrate ---------- */

function StepCelebrate({ name }: { name: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <div className="text-center relative py-4">
      {mounted && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
                background: `hsl(${Math.random() * 360}, 90%, 70%)`,
                // @ts-expect-error css var
                "--dx": `${(Math.random() - 0.5) * 400}px`,
                "--dy": `${100 + Math.random() * 300}px`,
                animation: `particle 1.4s ${Math.random() * 0.5}s ease-out forwards`,
              }} />
          ))}
        </div>
      )}
      <div className="relative pop-in">
        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-[oklch(0.8_0.2_330)] to-[oklch(0.7_0.2_200)] grid place-items-center glow-primary">
          <Sparkles size={38} className="text-white" />
        </div>
        <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
          <span className="text-gradient">{name || "friend"}</span>, Your Soundscape Awaits
        </h1>
        <p className="mt-3 text-white/70 max-w-md mx-auto text-sm md:text-base">
          Your soundscape is ready. Press play and let it weave.
        </p>
      </div>
    </div>
  );
}
