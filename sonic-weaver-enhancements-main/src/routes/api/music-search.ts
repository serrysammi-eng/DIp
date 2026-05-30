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
  artists?: {
    primary?: Array<{ name?: string }>;
    all?: Array<{ name?: string }>;
  };
  downloadUrl?: Array<{ quality?: string; url?: string }>;
  download_url?: Array<{ quality?: string; link?: string; url?: string }>;
};

const SAAVN_API = "https://jiosaavn-apix.arcadopredator.workers.dev";

function text(value: unknown) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .trim();
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
  const album = typeof song.album === "string" ? song.album : song.album?.name;
  return (
    text(song.primaryArtists) ||
    song.artists?.primary?.map((a) => text(a.name)).filter(Boolean).join(", ") ||
    song.artists?.all?.map((a) => text(a.name)).filter(Boolean).join(", ") ||
    text(album) ||
    "Unknown artist"
  );
}

function normalizeSong(song: SaavnSong): MusicResult | null {
  const url = bestAudio(song);
  const title = text(song.name ?? song.title);
  if (!song.id || !title || !url) return null;
  const album = typeof song.album === "string" ? song.album : song.album?.name;
  const playCount = Number(song.playCount ?? song.play_count) || undefined;
  const popularity = playCount ? Math.min(100, Math.round(Math.log10(Math.max(1, playCount)) * 15)) : undefined;
  return {
    videoId: song.id,
    title,
    uploader: artists(song),
    duration: Number(song.duration) || 0,
    thumbnail: bestImage(song.image),
    url,
    album: album ? text(album) : undefined,
    playCount,
    popularity,
  };
}

export const Route = createFileRoute("/api/music-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120);
        if (!query) return Response.json({ results: [] });

        const upstream = `${SAAVN_API}/api/search/songs?query=${encodeURIComponent(query)}&limit=20`;
        const res = await fetch(upstream, { headers: { accept: "application/json" } });
        if (!res.ok) return Response.json({ results: [] }, { status: 502 });

        const json = await res.json() as { data?: { results?: SaavnSong[] } | SaavnSong[] };
        const songs = Array.isArray(json.data) ? json.data : json.data?.results ?? [];
        const results = songs.map(normalizeSong).filter(Boolean);
        // Sort by playCount descending for popularity ranking
        results.sort((a, b) => ((b as MusicResult).playCount ?? 0) - ((a as MusicResult).playCount ?? 0));
        return Response.json({ results: results.slice(0, 20) });
      },
    },
  },
});