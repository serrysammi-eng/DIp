// Multi-provider music abstraction.
// Audio source: JioSaavn ONLY (via our /api proxy). No iTunes anywhere.
// Artist images + lyrics fetched via server proxies that try several free no-key sources.
// Provider identities never leak into the UI.

import { searchPiped, fetchTrending, type PipedResult } from "../piped";

export type Track = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  album?: string;
  duration: number; // seconds
  streamUrl: string;
  playCount?: number;
  popularity?: number; // 0-100 normalized
};

export type ArtistInfo = {
  name: string;
  image: string;
  listeners?: number;
  monthlyListeners?: number;
};

export type LyricLine = { time: number; text: string };
export type LyricsResult = { synced?: LyricLine[]; plain?: string } | null;

function fromPiped(p: PipedResult): Track {
  return {
    id: p.videoId,
    title: p.title,
    artist: p.uploader,
    artwork: p.thumbnail,
    album: p.album,
    duration: p.duration,
    streamUrl: p.url,
    playCount: p.playCount,
    popularity: p.popularity,
  };
}

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase().split(",")[0].trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function search(query: string): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const r = await searchPiped(q);
    const tracks = dedupe(r.map(fromPiped));
    // Sort by popularity/playCount descending
    tracks.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    return tracks.slice(0, 24);
  } catch {
    return [];
  }
}

export async function trending(): Promise<Track[]> {
  try {
    const r = await fetchTrending("trending");
    return dedupe(r.map(fromPiped));
  } catch {
    return [];
  }
}

export async function tracksFor(seed: string): Promise<Track[]> {
  try {
    const r = await fetchTrending("artist", seed);
    return dedupe(r.map(fromPiped));
  } catch {
    return [];
  }
}

const artistCache = new Map<string, Promise<ArtistInfo>>();

export function artistInfo(name: string): Promise<ArtistInfo> {
  const key = name.trim().toLowerCase();
  if (!key) return Promise.resolve({ name, image: "" });
  const cached = artistCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    try {
      const r = await fetch(`/api/artist-image?name=${encodeURIComponent(name)}`);
      if (!r.ok) return { name, image: "" };
      const j = (await r.json()) as { image?: string; listeners?: number };
      return { name, image: j.image || "", listeners: j.listeners };
    } catch {
      return { name, image: "" };
    }
  })();
  artistCache.set(key, p);
  return p;
}

export async function fetchLyrics(
  artist: string,
  title: string,
  album?: string,
): Promise<LyricsResult> {
  try {
    const params = new URLSearchParams({ artist, title });
    if (album) params.set("album", album);
    const r = await fetch(`/api/lyrics?${params}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { synced?: LyricLine[]; plain?: string };
    if (!j.synced?.length && !j.plain) return null;
    return { synced: j.synced, plain: j.plain };
  } catch {
    return null;
  }
}

export async function fetchTrendingArtists(limit = 10): Promise<ArtistInfo[]> {
  try {
    const r = await fetch(`/api/trending-artists?limit=${limit}`);
    if (!r.ok) return [];
    const j = (await r.json()) as { artists?: ArtistInfo[] };
    return j.artists ?? [];
  } catch {
    return [];
  }
}
