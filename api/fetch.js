export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  const r = await fetch(target, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    redirect: "follow",
  });

  const html = await r.text();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

