// Multi-source lyrics proxy. Tries lrclib (synced + plain), then lyrics.ovh (plain).
// Returns { synced?: [{time, text}], plain?: string } — never reveals source.
import { createFileRoute } from "@tanstack/react-router";

type LrcLine = { time: number; text: string };

function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(raw)) !== null) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      const frac = m[3] ? Number("0." + m[3]) : 0;
      stamps.push(mm * 60 + ss + frac);
    }
    const text = raw.replace(re, "").trim();
    for (const t of stamps) out.push({ time: t, text });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

function cleanTitle(t: string) {
  return t
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\b(official|video|audio|lyrics|remix|slowed|reverb|remastered|hd|hq|feat\.?|ft\.?)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function lrclib(artist: string, title: string, album?: string) {
  try {
    const params = new URLSearchParams({ artist_name: artist, track_name: title });
    if (album) params.set("album_name", album);
    const r = await fetch(`https://lrclib.net/api/get?${params}`, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { syncedLyrics?: string; plainLyrics?: string };
    const synced = j.syncedLyrics ? parseLrc(j.syncedLyrics) : undefined;
    const plain = j.plainLyrics?.trim() || undefined;
    if (!synced?.length && !plain) return null;
    return { synced, plain };
  } catch {
    return null;
  }
}

async function lrclibSearch(artist: string, title: string) {
  try {
    const params = new URLSearchParams({ artist_name: artist, track_name: title });
    const r = await fetch(`https://lrclib.net/api/search?${params}`, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const arr = (await r.json()) as Array<{ id: number; syncedLyrics?: string; plainLyrics?: string }>;
    const hit = arr.find((x) => x.syncedLyrics) ?? arr.find((x) => x.plainLyrics);
    if (!hit) return null;
    const synced = hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : undefined;
    const plain = hit.plainLyrics?.trim() || undefined;
    if (!synced?.length && !plain) return null;
    return { synced, plain };
  } catch {
    return null;
  }
}

async function lyricsOvh(artist: string, title: string) {
  try {
    const r = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { lyrics?: string };
    const plain = j.lyrics?.trim();
    if (!plain || plain.length < 5) return null;
    return { plain };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/lyrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams;
        const artistRaw = (u.get("artist") || "").slice(0, 200);
        const titleRaw = (u.get("title") || "").slice(0, 200);
        const album = (u.get("album") || "").slice(0, 200) || undefined;
        if (!artistRaw || !titleRaw) return Response.json({});

        const primary = artistRaw.split(/,|&|feat\.?|ft\.?/i)[0].trim();
        const title = cleanTitle(titleRaw);

        const attempts: Array<() => Promise<{ synced?: LrcLine[]; plain?: string } | null>> = [
          () => lrclib(primary, title, album),
          () => lrclib(artistRaw, titleRaw, album),
          () => lrclibSearch(primary, title),
          () => lyricsOvh(primary, title),
          () => lyricsOvh(artistRaw, titleRaw),
        ];
        for (const a of attempts) {
          const res = await a();
          if (res && (res.synced?.length || res.plain)) {
            return new Response(JSON.stringify(res), {
              status: 200,
              headers: {
                "content-type": "application/json",
                "cache-control": "public, max-age=86400, s-maxage=604800",
              },
            });
          }
        }
        return Response.json({});
      },
    },
  },
});
