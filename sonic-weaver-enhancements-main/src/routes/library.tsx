import { createFileRoute } from "@tanstack/react-router";
import { Heart, Music2, Clock, User2 } from "lucide-react";
import { useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { TrackRow } from "../components/TrackRow";
import { ArtistCard, SectionTitle } from "../components/Cards";
import { usePrefs, getTrack } from "../lib/store";
import type { Track } from "../lib/providers";

export const Route = createFileRoute("/library")({ component: Library });

const TABS = [
  { id: "liked", label: "Liked", Icon: Heart },
  { id: "artists", label: "Artists", Icon: User2 },
  { id: "recent", label: "Recently played", Icon: Clock },
  { id: "playlists", label: "Playlists", Icon: Music2 },
] as const;

function Library() {
  const { prefs } = usePrefs();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("liked");

  const liked = prefs.liked.map(getTrack).filter((t): t is Track => !!t);
  const recent = prefs.recent.map(getTrack).filter((t): t is Track => !!t);

  return (
    <AppLayout>
      <div className="px-4 md:px-10 pt-2 md:pt-6">
        <header className="fade-up">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Your library</h1>
          <p className="text-sm text-white/60 mt-1">Everything you've loved, saved, and played.</p>
        </header>
        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-4 md:mx-0 px-4 md:px-0">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all spring-press ${
                tab === id ? "bg-white text-black border-transparent" : "glass hover:bg-white/10 border-white/10"
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "liked" && (
            liked.length ? (
              <div className="glass-glow rounded-2xl p-2">
                {liked.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={liked} />)}
              </div>
            ) : <Empty title="Nothing liked yet" body="Tap the heart on any track to start your collection." />
          )}
          {tab === "recent" && (
            recent.length ? (
              <div className="glass-glow rounded-2xl p-2">
                {recent.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={recent} />)}
              </div>
            ) : <Empty title="No history yet" body="Play something — your recents will live here." />
          )}
          {tab === "artists" && (
            prefs.artists.length ? (
              <div>
                <SectionTitle title="Saved artists" />
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {prefs.artists.map((n, i) => <ArtistCard key={n} name={n} image="" index={i} />)}
                </div>
              </div>
            ) : <Empty title="No saved artists" body="Pick favorites during onboarding or save from artist pages." />
          )}
          {tab === "playlists" && (
            <Empty title="Playlists arriving soon" body="Curated mixes generated from your taste are on the way." />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-glow rounded-3xl p-10 text-center">
      <div className="mx-auto w-16 h-16 rounded-full aurora mb-4" />
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-white/60 mt-1">{body}</p>
    </div>
  );
}
