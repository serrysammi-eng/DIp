import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { TrackRow } from "../components/TrackRow";
import { artistInfo, tracksFor, type ArtistInfo, type Track } from "../lib/providers";
import { Skeleton } from "../components/Cards";
import { rememberTrack, usePrefs } from "../lib/store";
import { Plus, Check } from "lucide-react";

export const Route = createFileRoute("/artist/$name")({ component: ArtistPage });

function compactNum(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return `${n}`;
}

function ArtistPage() {
  const { name } = useParams({ from: "/artist/$name" });
  const decoded = decodeURIComponent(name);
  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const { prefs, setPrefs } = usePrefs();
  const saved = prefs.savedArtists.includes(decoded);

  useEffect(() => {
    let c = false;
    (async () => {
      const [i, t] = await Promise.all([artistInfo(decoded), tracksFor(decoded)]);
      if (c) return;
      t.forEach(rememberTrack);
      setInfo(i); setTracks(t);
    })();
    return () => { c = true; };
  }, [decoded]);

  const toggleSave = () => setPrefs((p) => ({
    ...p,
    savedArtists: saved ? p.savedArtists.filter((x) => x !== decoded) : [...p.savedArtists, decoded],
  }));

  return (
    <AppLayout>
      <div>
        {/* Hero */}
        <div className="relative h-[42vh] min-h-[280px] overflow-hidden">
          <div className="absolute inset-0">
            {info?.image ? (
              <img src={info.image} alt={decoded} className="w-full h-full object-cover scale-110 blur-3xl opacity-60" />
            ) : <div className="absolute inset-0 aurora" />}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
          <div className="relative h-full flex items-end px-4 md:px-10 pb-6">
            <div className="flex items-end gap-5 md:gap-8" style={{ perspective: 1200 }}>
              <div className="relative shrink-0 float">
                <div className="absolute inset-0 rounded-full aurora opacity-70 blur-2xl scale-125" />
                <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden ring-2 ring-white/20 shadow-2xl"
                     style={{ transform: "rotateX(8deg) rotateY(-10deg)" }}>
                  {info?.image ? (
                    <img src={info.image} alt={decoded} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full skeleton" />
                  )}
                </div>
                {/* particles */}
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/70 float"
                      style={{
                        left: `${20 + Math.random() * 60}%`,
                        top: `${20 + Math.random() * 60}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: `${4 + Math.random() * 4}s`,
                      }} />
                  ))}
                </div>
              </div>
              <div className="min-w-0 pb-2">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Artist</div>
                <h1 className="mt-1 text-3xl md:text-5xl font-semibold tracking-tight">{decoded}</h1>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={toggleSave}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-transform active:scale-95 spring-press ${
                      saved ? "bg-white/10 border border-white/20" : "bg-white text-black hover:scale-105"
                    }`}>
                    {saved ? <Check size={14} /> : <Plus size={14} />} {saved ? "Saved" : "Save"}
                  </button>
                  {/* Use real listener count from API when available */}
                  {info?.listeners ? (
                    <span className="text-xs text-white/60">
                      {compactNum(info.listeners)} monthly listeners
                    </span>
                  ) : tracks ? (
                    <span className="text-xs text-white/60">
                      {tracks.length} tracks available
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-10 mt-2">
          <div className="glass-glow rounded-2xl p-2">
            {!tracks ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2.5">
                  <Skeleton className="w-11 h-11" />
                  <div className="flex-1"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/3 mt-2" /></div>
                </div>
              ))
            ) : tracks.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/60">No tracks available right now.</div>
            ) : (
              tracks.map((t, i) => (
                <div key={t.id} style={{ animationDelay: `${i * 25}ms` }} className="fade-up">
                  <TrackRow track={t} index={i} queue={tracks} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
