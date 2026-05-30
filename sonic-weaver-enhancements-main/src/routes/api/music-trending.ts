import { createFileRoute } from "@tanstack/react-router";

type MusicResult = {
  videoId: string;
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
  url: string;
  album?: string;
  playCount?: number;
  popularity?: number;
};

type SaavnSong = {
  id: string;
  name?: string;
  title?: string;
  duration?: number | string;
  image?: Array<{ quality?: string; url?: string }> | string;
  album?: { name?: string } | string;
  playCount?: number | string;
  play_count?: number | string;
  primaryArtists?: string;
  artists?: { primary?: Array<{ name?: string }>; all?: Array<{ name?: string }> };
  downloadUrl?: Array<{ quality?: string; url?: string }>;
  download_url?: Array<{ quality?: string; link?: string; url?: string }>;
};

const SAAVN_API = "https://jiosaavn-apix.arcadopredator.workers.dev";

function text(value: unknown) {
  return String(value ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").trim();
}
function bestImage(image: SaavnSong["image"]) {
  if (typeof image === "string") return image;
  return image?.find((i) => i.quality === "500x500")?.url ?? image?.at(-1)?.url ?? "";
}
function bestAudio(song: SaavnSong) {
  const links: Array<{ quality?: string; url?: string; link?: string }> = [
    ...(song.downloadUrl ?? []),
    ...(song.download_url ?? []),
  ];
  return links
    .map((l) => ({ quality: Number.parseInt(l.quality ?? "0", 10), url: l.url ?? l.link }))
    .filter((l): l is { quality: number; url: string } => Boolean(l.url))
    .sort((a, b) => b.quality - a.quality)[0]?.url ?? "";
}
function artists(song: SaavnSong) {
  return (
    text(song.primaryArtists) ||
    song.artists?.primary?.map((a) => text(a.name)).filter(Boolean).join(", ") ||
    song.artists?.all?.map((a) => text(a.name)).filter(Boolean).join(", ") ||
    "Unknown artist"
  );
}
function normalize(song: SaavnSong): MusicResult | null {
  const url = bestAudio(song);
  const title = text(song.name ?? song.title);
  if (!song.id || !title || !url) return null;
  const album = typeof song.album === "string" ? song.album : song.album?.name;
  const playCount = Number(song.playCount ?? song.play_count) || undefined;
  return {
    videoId: song.id,
    title,
    uploader: artists(song),
    duration: Number(song.duration) || 0,
    thumbnail: bestImage(song.image),
    url,
    album: album ? text(album) : undefined,
    playCount,
    popularity: playCount ? Math.min(100, Math.round(Math.log10(Math.max(1, playCount)) * 15)) : undefined,
  };
}

// Curated "trending" — popular evergreen queries spanning Bollywood, movie OSTs, global pop.
// Acts as our stand-in for web-trending discovery; rotates so each call returns fresh-ish rows.
const TRENDING_QUERIES = [
  "trending hits 2025",
  "top bollywood",
  "new release",
  "viral songs",
  "top movie songs",
  "punjabi hits",
  "english top hits",
  "tamil hits",
  "love songs",
  "party hits",
];

async function fetchQuery(q: string, limit = 8): Promise<MusicResult[]> {
  try {
    const r = await fetch(`${SAAVN_API}/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return [];
    const json = (await r.json()) as { data?: { results?: SaavnSong[] } | SaavnSong[] };
    const songs = Array.isArray(json.data) ? json.data : json.data?.results ?? [];
    return songs.map(normalize).filter((x): x is MusicResult => Boolean(x));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/music-trending")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const mode = (params.get("mode") || "trending").slice(0, 32);
        const seed = (params.get("seed") || "").slice(0, 200);

        if (mode === "artist" && seed) {
          const results = await fetchQuery(seed, 50);
          return Response.json({ results });
        }
        if (mode === "based-on" && seed) {
          // Recommendations seeded by a track/artist the user just heard or liked
          const results = await fetchQuery(seed, 12);
          return Response.json({ results });
        }
        // Default: trending shelf — sample 2 random queries, dedupe, return top 12
        const picks = [...TRENDING_QUERIES].sort(() => Math.random() - 0.5).slice(0, 2);
        const lists = await Promise.all(picks.map((q) => fetchQuery(q, 8)));
        const seen = new Set<string>();
        const merged: MusicResult[] = [];
        for (const list of lists) {
          for (const t of list) {
            if (seen.has(t.videoId)) continue;
            seen.add(t.videoId);
            merged.push(t);
            if (merged.length >= 12) break;
          }
          if (merged.length >= 12) break;
        }
        return Response.json({ results: merged });
      },
    },
  },
});
