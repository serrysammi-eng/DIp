// Artist image proxy. Sources: JioSaavn artist search → Wikipedia summary thumbnail.
// Returns { image, listeners? } with strong server-side caching. No keys required.
import { createFileRoute } from "@tanstack/react-router";

const SAAVN_API = "https://jiosaavn-apix.arcadopredator.workers.dev";

type SaavnArtist = {
  id?: string;
  name?: string;
  image?: Array<{ quality?: string; url?: string }> | string;
  role?: string;
  fanCount?: number | string;
  followerCount?: number | string;
};

function pickImage(image: SaavnArtist["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image.replace(/50x50|150x150/, "500x500");
  const best = image.find((i) => /500/.test(i.quality ?? "")) ?? image.at(-1);
  return (best?.url ?? "").replace(/50x50|150x150/, "500x500");
}

async function saavnArtist(name: string) {
  try {
    const r = await fetch(`${SAAVN_API}/api/search/artists?query=${encodeURIComponent(name)}&limit=5`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { data?: { results?: SaavnArtist[] } | SaavnArtist[] };
    const list = (Array.isArray(json.data) ? json.data : json.data?.results) ?? [];
    const lower = name.toLowerCase();
    const best =
      list.find((a) => (a.name ?? "").toLowerCase() === lower) ??
      list.find((a) => (a.name ?? "").toLowerCase().includes(lower)) ??
      list[0];
    if (!best) return null;
    const img = pickImage(best.image);
    if (!img || /default|defaultalb|placeholder/i.test(img)) return null;
    const listeners = Number(best.fanCount ?? best.followerCount) || undefined;
    return { image: img, listeners };
  } catch {
    return null;
  }
}

async function wikipediaImage(name: string) {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail?: { source?: string }; originalimage?: { source?: string } };
    const img = j.originalimage?.source ?? j.thumbnail?.source;
    return img ? { image: img } : null;
  } catch {
    return null;
  }
}

// Fallback: pull artwork off first track for that artist
async function trackArtFallback(name: string) {
  try {
    const r = await fetch(`${SAAVN_API}/api/search/songs?query=${encodeURIComponent(name)}&limit=1`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { results?: Array<{ image?: SaavnArtist["image"] }> } };
    const img = pickImage(j.data?.results?.[0]?.image);
    return img ? { image: img } : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/artist-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const name = new URL(request.url).searchParams.get("name")?.trim().slice(0, 120);
        if (!name) return Response.json({ image: "" });
        const found =
          (await saavnArtist(name)) ??
          (await wikipediaImage(name)) ??
          (await trackArtFallback(name)) ??
          { image: "" };
        return new Response(JSON.stringify({ name, ...found }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=86400, s-maxage=604800",
          },
        });
      },
    },
  },
});
