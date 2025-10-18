import * as cheerio from "cheerio";

const BASE = "https://www.bizbuysell.com/colorado-businesses-for-sale";
const UA = "Mozilla/5.0";

const pageUrl = (q, page) =>
  page <= 1 ? `${BASE}/?q=${q}` : `${BASE}/${page}/?q=${q}`;

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Request failed ${r.status} for ${url}`);
  return await r.text();
}

function parseListings(html) {
  const $ = cheerio.load(html);
  const cards = $("[data-listing-id], .listing-item, .js-listing-card");
  const out = [];
  cards.each((_, el) => {
    const card = $(el);
    const id = (card.attr("data-listing-id") || card.attr("id") || "").trim();
    const pick = (sel) => {
      const e = card.find(sel).first();
      return e.length ? e.text().trim() : "";
    };
    let link = "";
    const a = card.find("a[href*='/businesses-for-sale/']").first();
    if (a.length) link = (a.attr("href") || "").trim();
    out.push({
      id,
      title: pick(".listing-title, a.listing-title, h2, h3"),
      price: pick(".listing-price, .price, [data-price]"),
      location: pick(".listing-location, .location"),
      url: link
    });
  });
  return out;
}

function estimatePages(html) {
  const $ = cheerio.load(html);
  const text = [
    $(".results-count").text(),
    $("[data-results-count]").text(),
    $("body").text()
  ].join(" ");
  const m = text.match(/(\d{1,6})/);
  const total = m ? parseInt(m[1], 10) : null;
  return { total, perPage: 20 };
}

export default async function handler(req, res) {
  try {
    const { q, start_page, end_page, throttle_sec } = req.query;
    if (!q) return res.status(400).json({ error: "Missing q" });

    const sp = Math.max(1, parseInt(start_page || "1", 10));
    const throttle = Math.max(0, Math.min(5, parseFloat(throttle_sec || "1")));

    const html1 = await fetchHtml(pageUrl(q, 1));
    const p1 = parseListings(html1);
    const meta = estimatePages(html1);
    const pages = Math.ceil((meta.total || p1.length || 20) / (p1.length || 20)) || 1;
    const ep = Math.max(sp, parseInt(end_page || pages, 10));

    const seen = new Set();
    const all = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    for (let p = sp; p <= ep; p++) {
      const html = p === 1 ? html1 : await fetchHtml(pageUrl(q, p));
      const listings = parseListings(html);
      for (const L of listings) {
        const key = L.id || L.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push({ ...L, page: p });
      }
      if (p < ep && throttle > 0) await sleep(throttle * 1000);
    }

    res.status(200).json({
      query: q, start_page: sp, end_page: ep,
      estimated_total_results: meta.total ?? null,
      per_page_observed: p1.length || 20,
      count: all.length,
      listings: all
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
