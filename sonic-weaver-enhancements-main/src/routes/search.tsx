import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon, X, TrendingUp, Music2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { TrackRow } from "../components/TrackRow";
import { ArtistCard, Skeleton, SectionTitle } from "../components/Cards";
import { search, fetchTrendingArtists, type Track, type ArtistInfo } from "../lib/providers";
import { rememberTrack } from "../lib/store";

export const Route = createFileRoute("/search")({ component: SearchPage });

const GENRES = [
  { label: "Bollywood", query: "bollywood hits", hue: 330 },
  { label: "Punjabi", query: "punjabi hits", hue: 280 },
  { label: "Hip-Hop", query: "hip hop hits", hue: 200 },
  { label: "Lo-Fi", query: "lo-fi chill", hue: 170 },
  { label: "Pop", query: "pop hits 2025", hue: 300 },
  { label: "Bhojpuri", query: "bhojpuri hits", hue: 40 },
  { label: "Haryanvi", query: "haryanvi hits", hue: 120 },
  { label: "Party", query: "party hits", hue: 260 },
  { label: "Romantic", query: "romantic songs", hue: 350 },
  { label: "Workout", query: "workout music", hue: 20 },
  { label: "Sad Songs", query: "sad songs hindi", hue: 240 },
  { label: "English", query: "english top hits", hue: 190 },
];

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendingArtists, setTrendingArtists] = useState<ArtistInfo[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(q, 350);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch trending artists on mount
  useEffect(() => {
    fetchTrendingArtists(10).then(setTrendingArtists);
  }, []);

  useEffect(() => {
    if (!debounced.trim()) { setResults(null); return; }
    let cancelled = false;
    setLoading(true);
    search(debounced).then((r) => {
      if (cancelled) return;
      r.forEach(rememberTrack);
      setResults(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <AppLayout>
      <div className="px-4 md:px-10 pt-2 md:pt-6">
        {/* Search bar */}
        <div className="sticky top-0 z-10 -mx-4 md:-mx-10 px-4 md:px-10 py-3 backdrop-blur-xl bg-background/60">
          <label className="glass-glow flex items-center gap-3 rounded-2xl px-4 py-3 focus-within:glow-primary transition-shadow">
            <SearchIcon size={18} className="text-white/60" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs, artists, albums…"
              className="flex-1 bg-transparent outline-none placeholder:text-white/40 text-[15px]" />
            {q && (
              <button onClick={() => setQ("")} className="w-7 h-7 grid place-items-center rounded-full hover:bg-white/10 spring-press">
                <X size={14} />
              </button>
            )}
          </label>
        </div>

        {!q.trim() ? (
          <div className="mt-6 space-y-8">
            {/* Top Trending Artists */}
            {trendingArtists && trendingArtists.length > 0 && (
              <section className="fade-up">
                <SectionTitle title="Top Artists Right Now" subtitle="Trending across genres" />
                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 md:mx-0 px-4 md:px-0 pb-2">
                  {trendingArtists.map((a, i) => (
                    <div key={a.name} className="shrink-0 w-24">
                      <ArtistCard name={a.name} image={a.image} listeners={a.listeners} index={i} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Genre Bubbles */}
            <section className="fade-up" style={{ animationDelay: "100ms" }}>
              <SectionTitle title="Browse by genre" subtitle="Tap to explore" />
              <div className="flex flex-wrap gap-2.5">
                {GENRES.map((g, i) => (
                  <button
                    key={g.label}
                    onClick={() => setQ(g.query)}
                    className="genre-bubble glass-glow px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 spring-press"
                    style={{
                      "--dur": `${3.5 + Math.random() * 3}s`,
                      "--delay": `${i * 0.15}s`,
                      borderColor: `oklch(0.7 0.18 ${g.hue} / 0.3)`,
                      boxShadow: `0 0 20px -5px oklch(0.7 0.18 ${g.hue} / 0.2)`,
                    } as React.CSSProperties}
                  >
                    <span className="inline-block mr-1.5" style={{ filter: `hue-rotate(${g.hue - 280}deg)` }}>
                      <Music2 size={13} className="inline" />
                    </span>
                    {g.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Trending searches text */}
            <section className="fade-up" style={{ animationDelay: "200ms" }}>
              <SectionTitle title="Quick searches" />
              <div className="flex flex-wrap gap-2">
                {["Arijit Singh", "Diljit Dosanjh", "Taylor Swift", "The Weeknd", "AP Dhillon", "Shubh"].map((t, i) => (
                  <button key={t} onClick={() => setQ(t)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="fade-up px-4 py-2 rounded-full glass hover:bg-white/10 text-sm spring-press">
                    {t}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : loading || !results ? (
          <div className="mt-6 glass-glow rounded-2xl p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-2.5">
                <Skeleton className="w-11 h-11" />
                <div className="flex-1"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/3 mt-2" /></div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="mt-12 text-center text-white/60">
            <div className="text-5xl mb-3">🎚️</div>
            <div className="font-medium">No results found</div>
            <div className="text-xs mt-1">Try a different search term.</div>
          </div>
        ) : (
          <div className="mt-6">
            {/* Results count + popularity note */}
            <div className="flex items-center gap-2 mb-3 px-1 text-xs text-white/50">
              <TrendingUp size={12} />
              <span>{results.length} results — sorted by popularity</span>
            </div>
            <div className="glass-glow rounded-2xl p-2">
              {results.map((t, i) => (
                <div key={t.id} style={{ animationDelay: `${i * 30}ms` }} className="fade-up relative">
                  {/* Top 3 badge */}
                  {i < 3 && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] text-[9px] font-bold text-white shadow-lg">
                        {i + 1}
                      </span>
                    </div>
                  )}
                  <TrackRow track={t} index={i} queue={results} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
  return d;
}
