import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, BarChart, Bar, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Plus, Upload, X, DollarSign, BarChart3, Wallet, Trash2, Sun, Moon, Calendar, Newspaper, ExternalLink } from "lucide-react";
import * as Papa from "papaparse";
import confetti from "canvas-confetti";

const FINNHUB_API_KEY = "d67t5tpr01qobepj8tb0d67t5tpr01qobepj8tbg";

// Map display tickers to Finnhub API symbols when they differ
const FINNHUB_SYMBOLS: Record<string, string> = {
  BRKB: "BRK.B",
  VTSAX: "VTI",
};

// Multiply Finnhub price to approximate the display ticker's actual price
const PRICE_MULTIPLIERS: Record<string, number> = {
  VTSAX: 0.487,
};

const fetchFinnhubQuote = async (displayTicker: string): Promise<{ price: number; change: number; changePct: number } | null> => {
  const apiSymbol = FINNHUB_SYMBOLS[displayTicker] || displayTicker;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(apiSymbol)}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) {
      console.warn(`[Finnhub] ${displayTicker} (${apiSymbol}): HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data || data.c === 0 || data.c === undefined) {
      console.warn(`[Finnhub] ${displayTicker} (${apiSymbol}): no price data`, data);
      return null;
    }
    const mult = PRICE_MULTIPLIERS[displayTicker] || 1;
    return { price: data.c * mult, change: data.d * mult, changePct: data.dp };
  } catch (err) {
    console.error(`[Finnhub] ${displayTicker} (${apiSymbol}): fetch error`, err);
    return null;
  }
};

// ── Theme ──

interface Theme {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  modalBg: string;
  modalBorder: string;
  overlayBg: string;
  hoverBg: string;
  pillBg: string;
  pillBorder: string;
  codeBg: string;
  text: string;
  textBold: string;
  textMuted: string;
  textDim: string;
  gridStroke: string;
  tooltipBg: string;
  tooltipBorder: string;
  scrollThumb: string;
  shadow: string;
  tickerBadgeBg: string;
}

const darkTheme: Theme = {
  pageBg: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.06)",
  inputBg: "#0f172a",
  inputBorder: "#334155",
  modalBg: "#1e293b",
  modalBorder: "#334155",
  overlayBg: "rgba(0,0,0,0.7)",
  hoverBg: "rgba(255,255,255,0.03)",
  pillBg: "rgba(255,255,255,0.04)",
  pillBorder: "#334155",
  codeBg: "#0f172a",
  text: "#e2e8f0",
  textBold: "#fff",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  gridStroke: "#1e293b",
  tooltipBg: "#1e293b",
  tooltipBorder: "#334155",
  scrollThumb: "#334155",
  shadow: "none",
  tickerBadgeBg: "linear-gradient(135deg, #a78bfa33, #f472b633)",
};

const lightTheme: Theme = {
  pageBg: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
  modalBg: "#ffffff",
  modalBorder: "#e2e8f0",
  overlayBg: "rgba(0,0,0,0.3)",
  hoverBg: "rgba(0,0,0,0.02)",
  pillBg: "rgba(0,0,0,0.04)",
  pillBorder: "#cbd5e1",
  codeBg: "#f1f5f9",
  text: "#334155",
  textBold: "#1e293b",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  gridStroke: "#e2e8f0",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  scrollThumb: "#cbd5e1",
  shadow: "0 1px 3px rgba(0,0,0,0.1)",
  tickerBadgeBg: "linear-gradient(135deg, #a78bfa44, #f472b644)",
};

// ── Colors & Constants ──

const ACCOUNT_COLORS: Record<string, { bg: string; text: string; dot: string; light: string }> = {
  Fidelity: { bg: "from-emerald-500 to-teal-600", text: "text-emerald-400", dot: "bg-emerald-400", light: "#34d399" },
  Chase: { bg: "from-blue-500 to-indigo-600", text: "text-blue-400", dot: "bg-blue-400", light: "#60a5fa" },
  IBKR: { bg: "from-orange-500 to-red-500", text: "text-orange-400", dot: "bg-orange-400", light: "#fb923c" },
};

const TICKER_COLORS = [
  "#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa",
  "#fb923c", "#f87171", "#2dd4bf", "#818cf8", "#e879f9",
  "#4ade80", "#facc15", "#38bdf8", "#fb7185", "#a3e635",
];

// ── Sector Classification ──

const SECTOR_MAP: Record<string, string> = {
  NVDA: "Semiconductors", MU: "Semiconductors", INTC: "Semiconductors", ASML: "Semiconductors",
  KXIAY: "Semiconductors", COHU: "Semiconductors", TER: "Semiconductors",
  RKLB: "Space/Defense",
  SAABY: "Automotive/EV", QS: "Automotive/EV",
  VTSAX: "Index/ETF",
  BRKB: "Finance",
  MSFT: "Tech", AAPL: "Tech", SNDK: "Tech",
  UAMY: "Critical Minerals", LYSDY: "Critical Minerals", KRKNF: "Critical Minerals", FCX: "Critical Minerals",
  RNMBY: "Consumer", SMERY: "Consumer", SHWDY: "Consumer",
  ABAT: "Battery/Energy",
};

const SECTOR_COLORS: Record<string, string> = {
  "Semiconductors": "#60a5fa",
  "Space/Defense": "#f472b6",
  "Automotive/EV": "#34d399",
  "Index/ETF": "#fbbf24",
  "Finance": "#a78bfa",
  "Tech": "#38bdf8",
  "Critical Minerals": "#fb923c",
  "Consumer": "#e879f9",
  "Battery/Energy": "#4ade80",
};

// ── Helpers ──

const simulatePrice = (basePrice: number) => {
  const change = (Math.random() - 0.48) * 0.02;
  return +(basePrice * (1 + change)).toFixed(2);
};

const formatMoney = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
};

const formatPct = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(n)) return "0.00%";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

// ── Mood ──

const getMood = (plPct: number): { emoji: string; text: string } => {
  if (plPct >= 5) return { emoji: "🚀", text: "To the moon!" };
  if (plPct >= 1) return { emoji: "😄", text: "Feeling good!" };
  if (plPct >= -1) return { emoji: "😐", text: "Meh." };
  if (plPct >= -5) return { emoji: "😰", text: "This is fine..." };
  return { emoji: "💀", text: "Pain." };
};

// ── Sparkline ──

const Sparkline = ({ ticker, plPct }: { ticker: string; plPct: number }) => {
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed = ((seed << 5) - seed + ticker.charCodeAt(i)) | 0;
  const rand = () => { seed = (seed * 16807 + 1) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };

  const w = 56, h = 20, pts = 8;
  const direction = plPct >= 0 ? -1 : 1;
  const coords: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const x = (i / (pts - 1)) * w;
    const trend = (i / (pts - 1)) * direction * h * 0.5;
    const noise = (rand() - 0.5) * h * 0.25;
    coords.push([x, Math.max(2, Math.min(h - 2, h / 2 + trend + noise))]);
  }
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const color = plPct >= 0 ? "#34d399" : "#f87171";
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
};

// ── Types ──

interface Position {
  id: number;
  ticker: string;
  shares: number;
  avgCost: number;
  account: string;
}

interface PriceData {
  current: number;
  prev: number;
  change: number;
  changePct: number;
}

interface NewsItem {
  headline: string;
  source: string;
  datetime: number;
  url: string;
  ticker: string;
}

interface EarningsEvent {
  symbol: string;
  date: string;
  hour: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

// ── Default Positions ──

const defaultPositions: Position[] = [
  { id: 1, ticker: "RKLB", shares: 523, avgCost: 38.14, account: "Chase" },
  { id: 2, ticker: "NVDA", shares: 181.79665, avgCost: 153.99, account: "Chase" },
  { id: 3, ticker: "SAABY", shares: 799, avgCost: 27.16, account: "Chase" },
  { id: 4, ticker: "MU", shares: 43.36685, avgCost: 332.66, account: "Chase" },
  { id: 5, ticker: "VTSAX", shares: 98.233, avgCost: 134.51, account: "Chase" },
  { id: 6, ticker: "BRKB", shares: 28.10829, avgCost: 486.49, account: "Chase" },
  { id: 7, ticker: "QS", shares: 1481.85422, avgCost: 10.24, account: "Chase" },
  { id: 8, ticker: "SNDK", shares: 18, avgCost: 195.94, account: "Chase" },
  { id: 9, ticker: "INTC", shares: 215.92714, avgCost: 41.12, account: "Chase" },
  { id: 10, ticker: "MSFT", shares: 18.03129, avgCost: 495.94, account: "Chase" },
  { id: 11, ticker: "UAMY", shares: 876, avgCost: 9.03, account: "Chase" },
  { id: 12, ticker: "RNMBY", shares: 17, avgCost: 390.13, account: "Chase" },
  { id: 13, ticker: "AAPL", shares: 22.82144, avgCost: 254.16, account: "Chase" },
  { id: 14, ticker: "KXIAY", shares: 320, avgCost: 11.68, account: "Chase" },
  { id: 15, ticker: "ASML", shares: 3, avgCost: 1435, account: "Chase" },
  { id: 16, ticker: "LYSDY", shares: 325, avgCost: 13.65, account: "Chase" },
  { id: 17, ticker: "SMERY", shares: 18, avgCost: 181.9, account: "Chase" },
  { id: 18, ticker: "SHWDY", shares: 37, avgCost: 66.69, account: "Chase" },
  { id: 19, ticker: "COHU", shares: 73, avgCost: 33.79, account: "Chase" },
  { id: 20, ticker: "ABAT", shares: 500, avgCost: 2.59, account: "Chase" },
  { id: 21, ticker: "FCX", shares: 22.73364, avgCost: 61.89, account: "Chase" },
  { id: 22, ticker: "TER", shares: 8, avgCost: 251, account: "Fidelity" },
  { id: 23, ticker: "KRKNF", shares: 450, avgCost: 4.25, account: "Fidelity" },
];

// ── Storage ──

const STORAGE_KEY = "portfolio-positions";
const HISTORY_KEY = "portfolio-history";
const THEME_KEY = "portfolio-theme";
const ATH_KEY = "portfolio-ath";

const loadPositions = (): Position[] => {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return defaultPositions;
};
const savePositions = (positions: Position[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)); } catch {}
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const loadHistory = (): Record<string, number> => {
  try { const s = localStorage.getItem(HISTORY_KEY); if (s) return JSON.parse(s); } catch {}
  return {};
};
const saveSnapshot = (value: number) => {
  try {
    const h = loadHistory();
    h[todayKey()] = +value.toFixed(2);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {}
};
const getHistoryChartData = (): { date: string; value: number }[] =>
  Object.entries(loadHistory())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({ date: new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: v }));

const loadATH = (): number => {
  try { const v = localStorage.getItem(ATH_KEY); return v ? +v : 0; } catch { return 0; }
};

const loadTheme = (): "dark" | "light" => {
  try { const v = localStorage.getItem(THEME_KEY); if (v === "light" || v === "dark") return v; } catch {}
  return "dark";
};

const PL_KEY = "portfolio-daily-pl";
const loadDailyPLStore = (): Record<string, number> => {
  try { const s = localStorage.getItem(PL_KEY); if (s) return JSON.parse(s); } catch {}
  return {};
};
const saveDailyPLEntry = (value: number) => {
  try {
    const data = loadDailyPLStore();
    data[todayKey()] = +value.toFixed(2);
    localStorage.setItem(PL_KEY, JSON.stringify(data));
  } catch {}
};

const basePrices: Record<string, number> = {
  AAPL: 192.5, MSFT: 415.8, GOOGL: 155.2, AMZN: 190.4,
  NVDA: 520.3, TSLA: 260.1, META: 510.2, SPY: 525.6,
  QQQ: 460.3, AMD: 165.8, NFLX: 630.5, DIS: 112.4,
  V: 280.3, JPM: 198.5, BA: 210.7,
};

// ── Component ──

export default function App() {
  const [positions, setPositions] = useState<Position[]>(loadPositions);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [portfolioHistory, setPortfolioHistory] = useState<{ date: string; value: number }[]>(getHistoryChartData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("All");
  const [, setTick] = useState(0);
  const [newPos, setNewPos] = useState({ ticker: "", shares: "", avgCost: "", account: "Fidelity" });
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(positions.reduce((max, p) => Math.max(max, p.id), 0) + 1);
  const [dataSource, setDataSource] = useState<"connecting" | "live" | "simulated">("connecting");
  const [themeMode, setThemeMode] = useState<"dark" | "light">(loadTheme);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [dailyPLData, setDailyPLData] = useState<Record<string, number>>(loadDailyPLStore);

  const t = themeMode === "dark" ? darkTheme : lightTheme;

  // Persist theme
  useEffect(() => { try { localStorage.setItem(THEME_KEY, themeMode); } catch {} }, [themeMode]);

  // Persist positions
  useEffect(() => { savePositions(positions); }, [positions]);

  const fetchAllPrices = useCallback(async (tickers: string[]) => {
    const results: (Awaited<ReturnType<typeof fetchFinnhubQuote>>)[] = [];
    for (const tk of tickers) {
      results.push(await fetchFinnhubQuote(tk));
      if (tickers.length > 1) await new Promise((r) => setTimeout(r, 300));
    }
    let anyLive = false;
    setPrices((prev) => {
      const updated = { ...prev };
      tickers.forEach((tk, i) => {
        const quote = results[i];
        if (quote) {
          anyLive = true;
          updated[tk] = { current: quote.price, prev: prev[tk]?.current ?? quote.price, change: quote.change, changePct: quote.changePct };
        } else if (updated[tk]) {
          const old = updated[tk].current;
          const np = simulatePrice(old);
          const chg = np - old;
          updated[tk] = { current: np, prev: old, change: updated[tk].change + chg, changePct: ((np - (old - updated[tk].change)) / (old - updated[tk].change)) * 100 };
        }
      });
      return updated;
    });
    setDataSource(anyLive ? "live" : "simulated");
    setTick((x) => x + 1);
  }, []);

  // Initialize prices
  useEffect(() => {
    const tickers = [...new Set(positions.map((p) => p.ticker))];
    const initial: Record<string, PriceData> = {};
    tickers.forEach((tk) => {
      const base = basePrices[tk] || 100 + Math.random() * 400;
      initial[tk] = { current: base, prev: base, change: 0, changePct: 0 };
    });
    setPrices(initial);
    fetchAllPrices(tickers);
  }, []);

  // Refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      const tickers = [...new Set(positions.map((p) => p.ticker))];
      fetchAllPrices(tickers);
    }, 30000);
    return () => clearInterval(interval);
  }, [positions, fetchAllPrices]);

  // Ensure new tickers get prices
  useEffect(() => {
    const tickers = [...new Set(positions.map((p) => p.ticker))];
    setPrices((prev) => {
      const updated = { ...prev };
      let changed = false;
      tickers.forEach((tk) => {
        if (!updated[tk]) {
          const base = basePrices[tk] || 100 + Math.random() * 400;
          updated[tk] = { current: base, prev: base, change: 0, changePct: 0 };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [positions]);

  // Daily snapshot + ATH confetti
  const allValue = positions.reduce((s, p) => s + (prices[p.ticker]?.current || 0) * p.shares, 0);
  const snapshotRecorded = useRef(false);
  const athFired = useRef(false);

  useEffect(() => {
    if (allValue > 0 && !snapshotRecorded.current && dataSource === "live") {
      snapshotRecorded.current = true;
      saveSnapshot(allValue);
      setPortfolioHistory(getHistoryChartData());
    }
  }, [allValue, dataSource]);

  useEffect(() => {
    if (allValue > 0 && !athFired.current && dataSource === "live") {
      const prevATH = loadATH();
      if (allValue > prevATH) {
        localStorage.setItem(ATH_KEY, String(+allValue.toFixed(2)));
        if (prevATH > 0) {
          athFired.current = true;
          confetti({ particleCount: 200, spread: 80, origin: { y: 0.3 } });
        }
      }
    }
  }, [allValue, dataSource]);

  const filtered = selectedAccount === "All" ? positions : positions.filter((p) => p.account === selectedAccount);

  const totalValue = filtered.reduce((s, p) => s + (prices[p.ticker]?.current || 0) * p.shares, 0);
  const totalCost = filtered.reduce((s, p) => s + p.avgCost * p.shares, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const mood = getMood(totalPLPct);

  const accountBreakdown = ["Fidelity", "Chase", "IBKR"].map((acc) => {
    const ap = positions.filter((p) => p.account === acc);
    const value = ap.reduce((s, p) => s + (prices[p.ticker]?.current || 0) * p.shares, 0);
    return { name: acc, value: +value.toFixed(2) };
  }).filter((a) => a.value > 0);

  const pieData = filtered.map((p, i) => ({
    name: p.ticker,
    value: +((prices[p.ticker]?.current || 0) * p.shares).toFixed(2),
    color: TICKER_COLORS[i % TICKER_COLORS.length],
  })).filter((d) => d.value > 0);

  // Best / worst performers
  const { gainers, losers } = useMemo(() => {
    const withPL = positions
      .map((p) => {
        const price = prices[p.ticker]?.current || 0;
        const plPct = p.avgCost > 0 ? ((price - p.avgCost) / p.avgCost) * 100 : 0;
        return { ticker: p.ticker, plPct, price };
      })
      .filter((p) => p.price > 0);
    const sorted = [...withPL].sort((a, b) => b.plPct - a.plPct);
    return {
      gainers: sorted.filter((p) => p.plPct > 0).slice(0, 3),
      losers: sorted.filter((p) => p.plPct < 0).reverse().slice(0, 3),
    };
  }, [positions, prices]);

  // ── Sector Data ──
  const sectorData = useMemo(() => {
    const sectors: Record<string, number> = {};
    filtered.forEach((p) => {
      const sector = SECTOR_MAP[p.ticker] || "Other";
      const value = (prices[p.ticker]?.current || 0) * p.shares;
      sectors[sector] = (sectors[sector] || 0) + value;
    });
    return Object.entries(sectors)
      .map(([name, value]) => ({ name, value: +value.toFixed(2), color: SECTOR_COLORS[name] || "#94a3b8" }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filtered, prices]);

  // ── Top 5 Holdings by value (for news) ──
  const top5Tickers = useMemo(() => {
    const tickerValues: Record<string, number> = {};
    positions.forEach((p) => {
      const value = (prices[p.ticker]?.current || 0) * p.shares;
      tickerValues[p.ticker] = (tickerValues[p.ticker] || 0) + value;
    });
    return Object.entries(tickerValues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ticker]) => ticker);
  }, [positions, prices]);

  // ── News Feed ──
  const newsFetched = useRef(false);
  useEffect(() => {
    if (top5Tickers.length === 0 || newsFetched.current) return;
    if (!prices[top5Tickers[0]] || prices[top5Tickers[0]].current === 0) return;
    newsFetched.current = true;

    const doFetch = async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const allNews: NewsItem[] = [];

      for (const ticker of top5Tickers) {
        const apiSymbol = FINNHUB_SYMBOLS[ticker] || ticker;
        try {
          const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(apiSymbol)}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              allNews.push(...data.slice(0, 4).map((d: any) => ({
                headline: d.headline,
                source: d.source,
                datetime: d.datetime,
                url: d.url,
                ticker,
              })));
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }

      setNews(allNews.sort((a, b) => b.datetime - a.datetime).slice(0, 10));
      setNewsLoading(false);
    };

    doFetch();
  }, [top5Tickers, prices]);

  // ── Earnings Calendar ──
  const earningsFetched = useRef(false);
  useEffect(() => {
    if (positions.length === 0 || earningsFetched.current) return;
    earningsFetched.current = true;

    const doFetch = async () => {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const tickers = [...new Set(positions.map((p) => p.ticker))];
      const apiToDisplay: Record<string, string> = {};
      tickers.forEach((tk) => { apiToDisplay[FINNHUB_SYMBOLS[tk] || tk] = tk; });
      const apiSymbols = new Set(Object.keys(apiToDisplay));

      try {
        const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          if (data.earningsCalendar) {
            const items = data.earningsCalendar
              .filter((e: any) => apiSymbols.has(e.symbol))
              .map((e: any) => ({
                symbol: apiToDisplay[e.symbol] || e.symbol,
                date: e.date,
                hour: e.hour || "",
                epsEstimate: e.epsEstimate ?? null,
                revenueEstimate: e.revenueEstimate ?? null,
              }));
            setEarnings(items.sort((a: EarningsEvent, b: EarningsEvent) => a.date.localeCompare(b.date)));
          }
        }
      } catch {}
      setEarningsLoading(false);
    };

    doFetch();
  }, [positions]);

  // ── Daily P&L Tracking ──
  const plRecorded = useRef(false);
  useEffect(() => {
    if (allValue > 0 && !plRecorded.current && dataSource === "live") {
      plRecorded.current = true;
      saveDailyPLEntry(allValue);
      setDailyPLData(loadDailyPLStore());
    }
  }, [allValue, dataSource]);

  // ── Daily P&L Chart Data ──
  const plChartData = useMemo(() => {
    const entries = Object.entries(dailyPLData).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length < 2) return [];
    return entries.slice(1).map(([date, value], i) => {
      const change = value - entries[i][1];
      return {
        date: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pl: +change.toFixed(2),
        fill: change >= 0 ? "#34d399" : "#f87171",
      };
    });
  }, [dailyPLData]);

  const handleAdd = () => {
    if (!newPos.ticker || !newPos.shares || !newPos.avgCost) return;
    setPositions((prev) => [
      ...prev,
      { id: nextId.current++, ticker: newPos.ticker.toUpperCase(), shares: +newPos.shares, avgCost: +newPos.avgCost, account: newPos.account },
    ]);
    setNewPos({ ticker: "", shares: "", avgCost: "", account: "Fidelity" });
    setShowAddModal(false);
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const np = (results.data as Record<string, string>[])
          .filter((r) => r.ticker && r.shares && r.avgCost)
          .map((r) => ({
            id: nextId.current++,
            ticker: (r.ticker || r.Ticker || r.TICKER || "").toUpperCase(),
            shares: +(r.shares || r.Shares || r.SHARES || 0),
            avgCost: +(r.avgCost || r.avg_cost || r.cost || r.Cost || 0),
            account: r.account || r.Account || "Fidelity",
          }));
        setPositions((prev) => [...prev, ...np]);
        setShowCSVModal(false);
      },
    });
  };

  const removePosition = (id: number) => setPositions((prev) => prev.filter((p) => p.id !== id));

  const PerformerCard = ({ items, label, icon }: { items: { ticker: string; plPct: number; price: number }[]; label: string; icon: string }) => (
    <div style={{ flex: 1, background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: t.text }}>{icon} {label}</h3>
      {items.length === 0 ? (
        <div style={{ color: t.textDim, fontSize: 13 }}>No data yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((p) => (
            <div key={p.ticker} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: t.tickerBadgeBg, padding: "3px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: t.textBold, minWidth: 56, textAlign: "center" }}>{p.ticker}</span>
              <Sparkline ticker={p.ticker} plPct={p.plPct} />
              <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 13, color: p.plPct >= 0 ? "#34d399" : "#f87171" }}>{formatPct(p.plPct)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              📊 My Portfolio Tracker
            </h1>
            <p style={{ color: t.textMuted, margin: "4px 0 0", fontSize: 13 }}>
              {dataSource === "live" ? "Finnhub live prices" : dataSource === "simulated" ? "Simulated prices (API fallback)" : "Connecting to Finnhub..."} update every 30s • <span style={{ color: dataSource === "live" ? "#4ade80" : dataSource === "simulated" ? "#fbbf24" : t.textMuted }}>●</span> {dataSource === "live" ? "Live" : dataSource === "simulated" ? "Simulated" : "..."}
            </p>
          </div>
          {/* Mood */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "8px 16px", boxShadow: t.shadow }}>
            <span style={{ fontSize: 28, animation: "mood-bounce 2s ease-in-out infinite" }}>{mood.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, fontStyle: "italic" }}>{mood.text}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setThemeMode((m) => m === "dark" ? "light" : "dark")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 12, border: `1px solid ${t.pillBorder}`, background: t.pillBg, color: t.text, cursor: "pointer" }} title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setShowCSVModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${t.pillBorder}`, background: t.pillBg, color: t.text, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <Plus size={15} /> Add Position
          </button>
        </div>
      </div>

      {/* Account Filter Pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["All", "Fidelity", "Chase", "IBKR"].map((acc) => (
          <button key={acc} onClick={() => setSelectedAccount(acc)} style={{ padding: "6px 18px", borderRadius: 20, border: selectedAccount === acc ? "none" : `1px solid ${t.pillBorder}`, background: selectedAccount === acc ? (acc === "All" ? "linear-gradient(135deg, #a78bfa, #f472b6)" : `linear-gradient(135deg, ${ACCOUNT_COLORS[acc]?.light || "#a78bfa"}, ${ACCOUNT_COLORS[acc]?.light || "#f472b6"}88)`) : t.pillBg, color: selectedAccount === acc ? "#fff" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
            {acc}
          </button>
        ))}
      </div>

      {/* Top Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "linear-gradient(135deg, rgba(168,139,250,0.15), rgba(244,114,182,0.08))", borderRadius: 16, padding: 20, border: "1px solid rgba(168,139,250,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Wallet size={18} color="#a78bfa" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total Value</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.textBold }}>{formatMoney(totalValue)}</div>
        </div>
        <div style={{ background: totalPL >= 0 ? "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))" : "linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.05))", borderRadius: 16, padding: 20, border: totalPL >= 0 ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(248,113,113,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {totalPL >= 0 ? <TrendingUp size={18} color="#34d399" /> : <TrendingDown size={18} color="#f87171" />}
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total P&L</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: totalPL >= 0 ? "#34d399" : "#f87171" }}>
            {formatMoney(totalPL)}
          </div>
          <div style={{ fontSize: 14, color: totalPL >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
            {formatPct(totalPLPct)}
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05))", borderRadius: 16, padding: 20, border: "1px solid rgba(96,165,250,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} color="#60a5fa" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total Cost Basis</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.textBold }}>{formatMoney(totalCost)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))", borderRadius: 16, padding: 20, border: "1px solid rgba(251,191,36,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BarChart3 size={18} color="#fbbf24" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Positions</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.textBold }}>{filtered.length}</div>
          <div style={{ fontSize: 14, color: t.textMuted }}>across {selectedAccount === "All" ? "3 accounts" : "1 account"}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Portfolio Value Chart */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>📈 Portfolio Value</h3>
          {portfolioHistory.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: t.textDim, fontSize: 13 }}>
              No history yet — chart will grow as daily snapshots are recorded.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={portfolioHistory}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
                <XAxis dataKey="date" tick={{ fill: t.textDim, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: t.textDim, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 10, color: t.text, fontSize: 13 }} formatter={(v) => [formatMoney(v as number), "Value"]} />
                <Area type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2.5} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Allocation Pie */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>🎯 Allocation</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={pieData[i].color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 10, color: t.text, fontSize: 12 }} formatter={(v) => formatMoney(v as number)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {pieData.map((d, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textMuted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Sector Breakdown */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>🏭 Sectors</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {sectorData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 10, color: t.text, fontSize: 12 }} formatter={(v: any) => [formatMoney(v as number), ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {sectorData.map((d, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textMuted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Best / Worst Performers */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <PerformerCard items={gainers} label="Top Gainers" icon="🔥" />
        <PerformerCard items={losers} label="Top Losers" icon="📉" />
      </div>

      {/* Daily P&L Bar Chart */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>📊 Daily P&L</h3>
        {plChartData.length === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: t.textDim, fontSize: 13 }}>
            P&L tracking starts today — bars will appear as daily data accumulates.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={plChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
              <XAxis dataKey="date" tick={{ fill: t.textDim, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: t.textDim, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <ReferenceLine y={0} stroke={t.textDim} strokeDasharray="3 3" />
              <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 10, color: t.text, fontSize: 13 }} formatter={(v: any) => [formatMoney(v as number), "P&L"]} />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {plChartData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* News & Earnings Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* News Feed */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Newspaper size={16} /> News Feed
          </h3>
          {newsLoading ? (
            <div style={{ color: t.textDim, fontSize: 13, padding: "20px 0" }}>Loading news...</div>
          ) : news.length === 0 ? (
            <div style={{ color: t.textDim, fontSize: 13, padding: "20px 0" }}>No recent news available.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
              {news.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", padding: 12, borderRadius: 10, background: t.hoverBg, border: `1px solid ${t.cardBorder}`, transition: "background 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textBold, lineHeight: 1.4, marginBottom: 4 }}>{n.headline}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: t.textDim }}>
                        <span style={{ background: t.tickerBadgeBg, padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11, color: t.textBold }}>{n.ticker}</span>
                        <span>{n.source}</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{new Date(n.datetime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: t.textDim, flexShrink: 0, marginTop: 2 }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Earnings Calendar */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} /> Earnings Calendar
          </h3>
          {earningsLoading ? (
            <div style={{ color: t.textDim, fontSize: 13, padding: "20px 0" }}>Loading earnings data...</div>
          ) : earnings.length === 0 ? (
            <div style={{ color: t.textDim, fontSize: 13, padding: "20px 0" }}>No upcoming earnings found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
              {earnings.map((e, i) => {
                const daysUntil = Math.ceil((new Date(e.date + "T00:00:00").getTime() - Date.now()) / 86400000);
                const isWithin7 = daysUntil >= 0 && daysUntil <= 7;
                return (
                  <div key={i} style={{ padding: 10, borderRadius: 10, background: isWithin7 ? "rgba(251,191,36,0.1)" : t.hoverBg, border: `1px solid ${isWithin7 ? "rgba(251,191,36,0.3)" : t.cardBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ background: t.tickerBadgeBg, padding: "3px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: t.textBold }}>{e.symbol}</span>
                      <span style={{ fontSize: 12, color: isWithin7 ? "#fbbf24" : t.textMuted, fontWeight: isWithin7 ? 700 : 500 }}>
                        {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {isWithin7 && ` (${daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `in ${daysUntil}d`})`}
                      </span>
                    </div>
                    {(e.hour || e.epsEstimate !== null) && (
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 4 }}>
                        {e.hour === "bmo" ? "Before market open" : e.hour === "amc" ? "After market close" : e.hour}
                        {e.epsEstimate !== null && `${e.hour ? " · " : ""}EPS est: $${e.epsEstimate}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Account Breakdown Bar */}
      {selectedAccount === "All" && accountBreakdown.length > 0 && (
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>🏦 Account Breakdown</h3>
          <div style={{ display: "flex", gap: 12 }}>
            {accountBreakdown.map((acc) => {
              const pct = totalValue > 0 ? ((acc.value / totalValue) * 100).toFixed(1) : "0";
              return (
                <div key={acc.name} style={{ flex: 1, background: `linear-gradient(135deg, ${ACCOUNT_COLORS[acc.name]?.light}22, ${ACCOUNT_COLORS[acc.name]?.light}08)`, borderRadius: 12, padding: 16, border: `1px solid ${ACCOUNT_COLORS[acc.name]?.light}33`, cursor: "pointer", transition: "transform 0.2s", boxShadow: t.shadow }} onClick={() => setSelectedAccount(acc.name)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ACCOUNT_COLORS[acc.name]?.light, marginBottom: 4 }}>{acc.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.textBold }}>{formatMoney(acc.value)}</div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: themeMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: ACCOUNT_COLORS[acc.name]?.light, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>💼 Positions</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.gridStroke}` }}>
                {["Ticker", "Account", "Shares", "Avg Cost", "Price", "Market Value", "P&L", "P&L %", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: t.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const price = prices[p.ticker]?.current || 0;
                const value = price * p.shares;
                const pl = value - p.avgCost * p.shares;
                const plPct = p.avgCost > 0 ? (pl / (p.avgCost * p.shares)) * 100 : 0;
                const isUp = pl >= 0;
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${t.gridStroke}11`, transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverBg)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px", fontWeight: 700, color: t.textBold }}>
                      <span style={{ background: t.tickerBadgeBg, padding: "3px 10px", borderRadius: 8, fontSize: 13 }}>{p.ticker}</span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCOUNT_COLORS[p.account]?.light || t.textMuted }} />
                        <span style={{ color: t.textMuted, fontSize: 12 }}>{p.account}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: t.text }}>{p.shares}</td>
                    <td style={{ padding: "12px", color: t.textMuted }}>{formatMoney(p.avgCost)}</td>
                    <td style={{ padding: "12px", color: t.textBold, fontWeight: 600 }}>
                      {formatMoney(price)}
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4ade80", marginLeft: 6, animation: "pulse 2s infinite" }} />
                    </td>
                    <td style={{ padding: "12px", color: t.text, fontWeight: 600 }}>{formatMoney(value)}</td>
                    <td style={{ padding: "12px", color: isUp ? "#34d399" : "#f87171", fontWeight: 700 }}>{formatMoney(pl)}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ background: isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: isUp ? "#34d399" : "#f87171", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                        {formatPct(plPct)}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <button onClick={(e) => { e.stopPropagation(); removePosition(p.id); }} style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", padding: 4 }} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: t.textDim }}>
              No positions yet. Click "Add Position" or "Import CSV" to get started! 🚀
            </div>
          )}
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: 380, border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>➕ Add Position</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            {[
              { label: "Ticker Symbol", key: "ticker" as const, placeholder: "e.g. AAPL", type: "text" },
              { label: "Shares", key: "shares" as const, placeholder: "e.g. 10", type: "number" },
              { label: "Avg Cost per Share", key: "avgCost" as const, placeholder: "e.g. 150.00", type: "number" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>{label}</label>
                <input value={newPos[key]} onChange={(e) => setNewPos({ ...newPos, [key]: e.target.value })} placeholder={placeholder} type={type} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>Account</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Fidelity", "Chase", "IBKR"].map((acc) => (
                  <button key={acc} onClick={() => setNewPos({ ...newPos, account: acc })} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: newPos.account === acc ? "none" : `1px solid ${t.inputBorder}`, background: newPos.account === acc ? ACCOUNT_COLORS[acc]?.light : "transparent", color: newPos.account === acc ? "#000" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
                    {acc}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAdd} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Add to Portfolio 🚀
            </button>
          </div>
        </div>
      )}

      {/* CSV Modal */}
      {showCSVModal && (
        <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowCSVModal(false)}>
          <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: 420, border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>📄 Import CSV</h3>
              <button onClick={() => setShowCSVModal(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Upload a CSV with columns: <strong style={{ color: t.text }}>ticker, shares, avgCost, account</strong>
            </p>
            <div style={{ background: t.codeBg, borderRadius: 12, padding: 14, marginBottom: 16, fontFamily: "monospace", fontSize: 12, color: t.textDim, lineHeight: 1.8 }}>
              ticker,shares,avgCost,account<br />
              AAPL,10,178.50,Fidelity<br />
              MSFT,5,380.00,Chase<br />
              TSLA,8,245.00,IBKR
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `2px dashed ${t.inputBorder}`, background: "transparent", color: "#a78bfa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Choose CSV File 📁
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes mood-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
