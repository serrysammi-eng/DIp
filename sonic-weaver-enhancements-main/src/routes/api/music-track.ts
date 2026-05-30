import { createFileRoute } from "@tanstack/react-router";

type SaavnSong = {
  downloadUrl?: Array<{ quality?: string; url?: string }>;
  download_url?: Array<{ quality?: string; link?: string; url?: string }>;
};

const SAAVN_API = "https://jiosaavn-apix.arcadopredator.workers.dev";

// Allow any saavncdn.com host (aac, c, h, etc.)
const ALLOWED_HOST = /^https:\/\/[a-z0-9-]+\.saavncdn\.com\//i;

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

async function lookupUrl(id: string) {
  const res = await fetch(`${SAAVN_API}/api/songs/${encodeURIComponent(id)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("Song lookup failed");
  const json = (await res.json()) as { data?: SaavnSong[] };
  const url = bestAudio(json.data?.[0] ?? {});
  if (!url) throw new Error("Song has no playable audio");
  return url;
}

async function streamAudio(request: Request, audioUrl: string) {
  // Forward Range so seeking works and the browser can request partial content
  const range = request.headers.get("range");
  const upstreamHeaders: Record<string, string> = { accept: "audio/*" };
  if (range) upstreamHeaders["range"] = range;

  const upstream = await fetch(audioUrl, { headers: upstreamHeaders });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Audio unavailable", { status: 502 });
  }
  if (!upstream.body) return new Response("Audio unavailable", { status: 502 });

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "audio/mp4");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=86400");
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("content-length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("content-range", cr);

  return new Response(upstream.body, { status: upstream.status, headers });
}

export const Route = createFileRoute("/api/music-track")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const rawUrl = params.get("url");
        const id = params.get("id");

        let audioUrl = "";
        try {
          audioUrl = rawUrl?.startsWith("https://")
            ? rawUrl
            : id ? await lookupUrl(id.slice(0, 80)) : "";
        } catch {
          return new Response("Audio unavailable", { status: 502 });
        }

        if (!audioUrl || !ALLOWED_HOST.test(audioUrl)) {
          return new Response("Invalid audio URL", { status: 400 });
        }

        try {
          return await streamAudio(request, audioUrl);
        } catch {
          return new Response("Audio unavailable", { status: 502 });
        }
      },
      HEAD: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const rawUrl = params.get("url");
        if (!rawUrl || !ALLOWED_HOST.test(rawUrl)) {
          return new Response(null, { status: 400 });
        }
        const upstream = await fetch(rawUrl, { method: "HEAD" });
        const headers = new Headers();
        headers.set("content-type", upstream.headers.get("content-type") || "audio/mp4");
        headers.set("accept-ranges", "bytes");
        const cl = upstream.headers.get("content-length");
        if (cl) headers.set("content-length", cl);
        return new Response(null, { status: upstream.ok ? 200 : 502, headers });
      },
    },
  },
});
