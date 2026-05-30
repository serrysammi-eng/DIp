import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { BannerAd } from "../components/BannerAd";
import { SectionTitle, TrackCard, ArtistCard, Skeleton } from "../components/Cards";
import { TrackRow } from "../components/TrackRow";
import { artistInfo, trending, tracksFor, fetchTrendingArtists, type Track, type ArtistInfo } from "../lib/providers";
import { usePrefs, rememberTrack, getTrack } from "../lib/store";

export const Route = createFileRoute("/app")({ component: Home });

function useGreeting() {
  const [g, setG] = useState<{ title: string; subtitle: string }>({ title: "Welcome", subtitle: "" });
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) {
      setG({ title: "Midnight Chill", subtitle: "Wind down with your favorites" });
    } else if (h < 10) {
      setG({ title: "Morning Energy", subtitle: "Start your day with fresh beats" });
    } else if (h < 14) {
      setG({ title: "Daytime Flow", subtitle: "Stay in the groove" });
    } else if (h < 18) {
      setG({ title: "Afternoon Vibes", subtitle: "Soundtrack your afternoon" });
    } else if (h < 21) {
      setG({ title: "Evening Sessions", subtitle: "Unwind with your perfect mix" });
    } else {
      setG({ title: "Late Night Mode", subtitle: "Deep cuts for the night owls" });
    }
  }, []);
  return g;
}

function Home() {
  const { prefs } = usePrefs();
  const greeting = useGreeting();
  const [trend, setTrend] = useState<Track[] | null>(null);
  const [forYou, setForYou] = useState<Track[] | null>(null);
  const [byLang, setByLang] = useState<Track[] | null>(null);
  const [artists, setArtists] = useState<ArtistInfo[] | null>(null);
  const [trendingArtists, setTrendingArtists] = useState<ArtistInfo[] | null>(null);

  // Stable dependency strings to avoid re-fetching on every render
  const artistsKey = useMemo(() => prefs.artists.join("|"), [prefs.artists]);
  const langsKey = useMemo(() => prefs.languages.join("|"), [prefs.languages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, fy, bl, ar] = await Promise.all([
        trending(),
        prefs.artists.length
          ? tracksFor(prefs.artists[Math.floor(Math.random() * prefs.artists.length)])
          : trending(),
        prefs.languages.length
          ? tracksFor(`${prefs.languages[0]} top songs`)
          : Promise.resolve<Track[]>([]),
        Promise.all((prefs.artists.length ? prefs.artists : ["Arijit Singh", "Diljit Dosanjh", "Taylor Swift", "Shubh"]).slice(0, 8).map(artistInfo)),
      ]);
      if (cancelled) return;
      [...(t ?? []), ...(fy ?? []), ...(bl ?? [])].forEach(rememberTrack);
      setTrend(t); setForYou(fy); setByLang(bl); setArtists(ar);
    })();
    return () => { cancelled = true; };
  }, [artistsKey, langsKey]);

  // Fetch trending artists separately
  useEffect(() => {
    fetchTrendingArtists(8).then(setTrendingArtists);
  }, []);

  const recent = prefs.recent.map(getTrack).filter((t): t is Track => !!t).slice(0, 8);

  // Mix user artists with trending artists (70% user, 30% trending)
  const mixedArtists = useMemo(() => {
    if (!artists && !trendingArtists) return null;
    const userArtists = artists ?? [];
    const trendArtists = trendingArtists ?? [];
    const userCount = Math.ceil(userArtists.length * 0.7);
    const trendCount = Math.max(2, 8 - userCount);
    const seen = new Set<string>();
    const mixed: ArtistInfo[] = [];

    for (const a of userArtists.slice(0, userCount)) {
      if (!seen.has(a.name.toLowerCase())) { seen.add(a.name.toLowerCase()); mixed.push(a); }
    }
    for (const a of trendArtists) {
      if (mixed.length >= 8) break;
      if (!seen.has(a.name.toLowerCase())) { seen.add(a.name.toLowerCase()); mixed.push(a); }
    }
    return mixed.length > 0 ? mixed : null;
  }, [artists, trendingArtists]);

  return (
    <AppLayout>
      <div className="px-4 md:px-10 pt-2 md:pt-6 space-y-10">
        <header className="fade-up">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">{greeting.title}</div>
          <h1 className="mt-2 text-3xl md:text-5xl font-semibold tracking-tight">
            <span className="text-gradient">{prefs.name || "Welcome"}</span>
            <span className="text-white/80">, let's weave some sound.</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {greeting.subtitle}{prefs.languages.length ? ` — ${prefs.languages.slice(0, 3).join(", ")}` : ""}
          </p>
        </header>

        {!prefs.isPremium && <BannerAd />}

        <Section title="Recommended for you" subtitle="Hand-picked from your taste">
          <TrackGrid items={forYou} />
        </Section>

        {byLang && byLang.length > 0 && (
          <Section title={`Trending in ${prefs.languages[0]}`}>
            <TrackGrid items={byLang} />
          </Section>
        )}

        {/* Mixed artists: user favorites + trending discoveries */}
        {mixedArtists && mixedArtists.length > 0 && (
          <Section title="Artists for you" subtitle="Your favorites mixed with what's trending">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {mixedArtists.map((a, i) => <ArtistCard key={a.name} name={a.name} image={a.image} listeners={a.listeners} index={i} />)}
            </div>
          </Section>
        )}

        {/* Trending artists section */}
        {trendingArtists && trendingArtists.length > 0 && (
          <Section title="Trending now" subtitle="Top artists people are listening to">
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 md:mx-0 px-4 md:px-0 pb-2">
              {trendingArtists.map((a, i) => (
                <div key={a.name} className="shrink-0 w-24">
                  <ArtistCard name={a.name} image={a.image} listeners={a.listeners} index={i} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {recent.length > 0 && (
          <Section title="Recently played">
            <div className="glass-glow rounded-2xl p-2 divide-y divide-white/5">
              {recent.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={recent} />)}
            </div>
          </Section>
        )}

        <Section title="New discoveries" subtitle="Fresh sounds across languages">
          <TrackGrid items={trend} />
        </Section>
      </div>
    </AppLayout>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="fade-up">
      <SectionTitle title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}

function TrackGrid({ items }: { items: Track[] | null }) {
  if (!items) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3">
            <Skeleton className="aspect-square" />
            <Skeleton className="h-3 mt-2 w-3/4" />
            <Skeleton className="h-3 mt-2 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="glass-glow rounded-2xl p-6 text-sm text-white/60 text-center">Nothing here yet. Try a different search.</div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1">
      {items.slice(0, 12).map((t, i) => <TrackCard key={t.id} track={t} queue={items} index={i} />)}
    </div>
  );
}
