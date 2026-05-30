export type PipedResult = {
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

export async function searchPiped(query: string): Promise<PipedResult[]> {
  const q = query.trim();
  if (!q) return [];

  const res = await fetch(`/api/music-search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as { results?: PipedResult[] };
  return data.results ?? [];
}

export async function fetchTrending(
  mode: "trending" | "artist" | "based-on" = "trending",
  seed?: string,
): Promise<PipedResult[]> {
  const params = new URLSearchParams({ mode });
  if (seed) params.set("seed", seed);
  try {
    const res = await fetch(`/api/music-trending?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: PipedResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function fetchPipedTrack(trackIdOrUrl: string): Promise<{
  buffer: ArrayBuffer;
  mime: string;
}> {
  const url = trackIdOrUrl.startsWith("http")
    ? `/api/music-track?url=${encodeURIComponent(trackIdOrUrl)}`
    : `/api/music-track?id=${encodeURIComponent(trackIdOrUrl)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio fetch failed (${res.status})`);
  const buffer = await res.arrayBuffer();
  const mime = res.headers.get("content-type") || "audio/mp4";
  return { buffer, mime };
}
