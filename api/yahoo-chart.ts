import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { symbol, interval, range } = req.query;

  if (!symbol || !interval || !range) {
    return res.status(400).json({ error: "Missing required query params: symbol, interval, range" });
  }

  const sym = Array.isArray(symbol) ? symbol[0] : symbol;
  const int = Array.isArray(interval) ? interval[0] : interval;
  const rng = Array.isArray(range) ? range[0] : range;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${encodeURIComponent(int)}&range=${encodeURIComponent(rng)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch from Yahoo Finance", details: err.message });
  }
}
