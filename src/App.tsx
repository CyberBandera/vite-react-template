import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, BarChart, Bar, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Plus, Upload, X, DollarSign, BarChart3, Wallet, Trash2, Sun, Moon, Calendar, Newspaper, ExternalLink, Bell, Calculator, LayoutGrid, Table2, FileText } from "lucide-react";
import * as Papa from "papaparse";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";

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

const fetchSPYReturn = async (): Promise<number | null> => {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 365 * 86400;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=SPY&resolution=W&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.s !== "ok" || !data.c || data.c.length < 2) return null;
    return ((data.c[data.c.length - 1] - data.c[0]) / data.c[0]) * 100;
  } catch { return null; }
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
  if (plPct >= 5) return { emoji: "\u{1F680}", text: "To the moon!" };
  if (plPct >= 1) return { emoji: "\u{1F604}", text: "Feeling good!" };
  if (plPct >= -1) return { emoji: "\u{1F610}", text: "Meh." };
  if (plPct >= -5) return { emoji: "\u{1F630}", text: "This is fine..." };
  return { emoji: "\u{1F480}", text: "Pain." };
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

interface PriceAlert {
  id: number;
  ticker: string;
  targetPrice: number;
  direction: "above" | "below";
  triggered: boolean;
}

interface BadgeState {
  firstGreenDay: boolean;
  fiveBagger: boolean;
  diamondHands: boolean;
  quarterMilClub: boolean;
  diversified: boolean;
}

const BADGE_DEFS: { key: keyof BadgeState; icon: string; name: string; hint: string; check: (totalPL: number, positions: Position[], prices: Record<string, PriceData>) => boolean }[] = [
  { key: "firstGreenDay", icon: "\u{1F49A}", name: "First Green Day", hint: "Total P&L goes positive", check: (totalPL) => totalPL > 0 },
  { key: "fiveBagger", icon: "\u{1F3B0}", name: "Five Bagger", hint: "One position up 400%+", check: (_totalPL, positions, prices) => positions.some(p => { const price = prices[p.ticker]?.current || 0; return p.avgCost > 0 && ((price - p.avgCost) / p.avgCost) * 100 >= 400; }) },
  { key: "diamondHands", icon: "\u{1F48E}", name: "Diamond Hands", hint: "Hold a position down 20%+", check: (_totalPL, positions, prices) => positions.some(p => { const price = prices[p.ticker]?.current || 0; return p.avgCost > 0 && ((price - p.avgCost) / p.avgCost) * 100 <= -20; }) },
  { key: "quarterMilClub", icon: "\u{1F3C6}", name: "Quarter Mil Club", hint: "Portfolio value reaches $250k", check: (_totalPL, positions, prices) => { const total = positions.reduce((s, p) => s + (prices[p.ticker]?.current || 0) * p.shares, 0); return total >= 250000; } },
  { key: "diversified", icon: "\u{1F308}", name: "Diversified", hint: "10+ unique tickers", check: (_totalPL, positions) => new Set(positions.map(p => p.ticker)).size >= 10 },
];

const BADGES_KEY = "portfolio-badges";
const loadBadges = (): BadgeState => {
  try { const s = localStorage.getItem(BADGES_KEY); if (s) return JSON.parse(s); } catch {}
  return { firstGreenDay: false, fiveBagger: false, diamondHands: false, quarterMilClub: false, diversified: false };
};

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

const ALERTS_KEY = "portfolio-alerts";
const loadAlerts = (): PriceAlert[] => {
  try { const s = localStorage.getItem(ALERTS_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
};
const saveAlertsList = (alerts: PriceAlert[]) => {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch {}
};

// ── Treemap ──

const plColor = (pct: number): string => {
  if (pct >= 50) return "#15803d";
  if (pct >= 20) return "#16a34a";
  if (pct >= 5) return "#22c55e";
  if (pct >= 0) return "#4ade80";
  if (pct >= -5) return "#f87171";
  if (pct >= -20) return "#ef4444";
  if (pct >= -50) return "#dc2626";
  return "#991b1b";
};

interface TreemapRect {
  x: number; y: number; w: number; h: number;
  ticker: string; value: number; plPct: number;
}

const computeTreemap = (items: { ticker: string; value: number; plPct: number }[], width: number, height: number): TreemapRect[] => {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreemapRect[] = [];

  const layoutSlice = (items: typeof sorted, x: number, y: number, w: number, h: number) => {
    if (items.length === 0) return;
    if (items.length === 1) {
      rects.push({ x, y, w, h, ticker: items[0].ticker, value: items[0].value, plPct: items[0].plPct });
      return;
    }
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return;
    const isHoriz = w >= h;
    let sum = 0;
    let splitIdx = 1;
    for (let i = 0; i < items.length - 1; i++) {
      sum += items[i].value;
      if (sum >= total / 2) { splitIdx = i + 1; break; }
    }
    const first = items.slice(0, splitIdx);
    const second = items.slice(splitIdx);
    const ratio = first.reduce((s, i) => s + i.value, 0) / total;
    if (isHoriz) {
      layoutSlice(first, x, y, w * ratio, h);
      layoutSlice(second, x + w * ratio, y, w * (1 - ratio), h);
    } else {
      layoutSlice(first, x, y, w, h * ratio);
      layoutSlice(second, x, y + h * ratio, w, h * (1 - ratio));
    }
  };

  layoutSlice(sorted, 0, 0, width, height);
  return rects;
};

const basePrices: Record<string, number> = {
  AAPL: 192.5, MSFT: 415.8, GOOGL: 155.2, AMZN: 190.4,
  NVDA: 520.3, TSLA: 260.1, META: 510.2, SPY: 525.6,
  QQQ: 460.3, AMD: 165.8, NFLX: 630.5, DIS: 112.4,
  V: 280.3, JPM: 198.5, BA: 210.7,
};

// ── Candle Data ──

const fetchCandleData = async (displayTicker: string, timeframe: string): Promise<{ t: number; c: number }[] | null> => {
  const apiSymbol = FINNHUB_SYMBOLS[displayTicker] || displayTicker;
  const resolutionMap: Record<string, string> = { "1D": "5", "5D": "15", "1M": "60", "6M": "D", "1Y": "D" };
  const rangeMap: Record<string, number> = { "1D": 2 * 86400, "5D": 7 * 86400, "1M": 35 * 86400, "6M": 190 * 86400, "1Y": 370 * 86400 };
  const resolution = resolutionMap[timeframe] || "D";
  const range = rangeMap[timeframe] || 370 * 86400;
  const to = Math.floor(Date.now() / 1000);
  const from = to - range;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(apiSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
  console.log(`[Candle] ${displayTicker} (${apiSymbol}) tf=${timeframe} res=${resolution} from=${from} to=${to}`);
  console.log(`[Candle] URL: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Candle] ${displayTicker}: HTTP ${res.status} ${res.statusText}`);
      if (res.status === 429) {
        console.warn(`[Candle] Rate limited — waiting 2s and retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        const retry = await fetch(url);
        if (!retry.ok) { console.warn(`[Candle] ${displayTicker}: retry also failed HTTP ${retry.status}`); return null; }
        const retryData = await retry.json();
        console.log(`[Candle] ${displayTicker} retry response:`, retryData);
        if (retryData.s !== "ok" || !retryData.t || !retryData.c) return null;
        const mult = PRICE_MULTIPLIERS[displayTicker] || 1;
        return retryData.t.map((time: number, i: number) => ({ t: time, c: retryData.c[i] * mult }));
      }
      return null;
    }
    const data = await res.json();
    console.log(`[Candle] ${displayTicker} response: s=${data.s}, points=${data.t?.length ?? 0}`, data.s !== "ok" ? data : "");
    if (data.s !== "ok" || !data.t || !data.c) return null;
    const mult = PRICE_MULTIPLIERS[displayTicker] || 1;
    return data.t.map((time: number, i: number) => ({ t: time, c: data.c[i] * mult }));
  } catch (err) { console.error(`[Candle] ${displayTicker}: fetch error`, err); return null; }
};

// ── Correlation Helpers ──

const fetchRawCandles = async (displayTicker: string): Promise<number[] | null> => {
  const apiSymbol = FINNHUB_SYMBOLS[displayTicker] || displayTicker;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 35 * 86400;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(apiSymbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
  console.log(`[Correlation] Fetching ${displayTicker} (${apiSymbol})`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Correlation] ${displayTicker}: HTTP ${res.status}`);
      if (res.status === 429) {
        console.warn(`[Correlation] Rate limited — waiting 2s and retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        const retry = await fetch(url);
        if (!retry.ok) { console.warn(`[Correlation] ${displayTicker}: retry failed HTTP ${retry.status}`); return null; }
        const retryData = await retry.json();
        console.log(`[Correlation] ${displayTicker} retry: s=${retryData.s}, points=${retryData.c?.length ?? 0}`);
        if (retryData.s !== "ok" || !retryData.c) return null;
        return retryData.c;
      }
      return null;
    }
    const data = await res.json();
    console.log(`[Correlation] ${displayTicker}: s=${data.s}, points=${data.c?.length ?? 0}`);
    if (data.s !== "ok" || !data.c) return null;
    return data.c;
  } catch (err) { console.error(`[Correlation] ${displayTicker}: fetch error`, err); return null; }
};

const computeDailyReturns = (closes: number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
};

const computeCorrelation = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
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

  // Round 4 state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [badges, setBadges] = useState<BadgeState>(loadBadges);
  const [tickerModal, setTickerModal] = useState<string | null>(null);
  const [tickerModalTimeframe, setTickerModalTimeframe] = useState("1M");
  const [candleData, setCandleData] = useState<{ t: number; c: number }[] | null>(null);
  const [candleLoading, setCandleLoading] = useState(false);
  const [correlationData, setCorrelationData] = useState<{ tickers: string[]; matrix: number[][] } | null>(null);
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Round 3 state
  const [viewMode, setViewMode] = useState<"table" | "treemap">("table");
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [showAlertModal, setShowAlertModal] = useState<string | null>(null);
  const [alertTarget, setAlertTarget] = useState<{ price: string; direction: "above" | "below" }>({ price: "", direction: "above" });
  const [spyReturn, setSPYReturn] = useState<number | null>(null);
  const [whatIf, setWhatIf] = useState({ ticker: "", shares: "", price: "" });

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

  // ── S&P 500 Comparison ──
  const spyFetched = useRef(false);
  useEffect(() => {
    if (spyFetched.current) return;
    spyFetched.current = true;
    fetchSPYReturn().then(setSPYReturn);
  }, []);

  // ── Alert Checking ──
  useEffect(() => {
    if (alerts.length === 0) return;
    let changed = false;
    const updated = alerts.map((a) => {
      if (a.triggered) return a;
      const price = prices[a.ticker]?.current;
      if (!price) return a;
      const hit = a.direction === "above" ? price >= a.targetPrice : price <= a.targetPrice;
      if (hit) {
        changed = true;
        const msg = `${a.ticker} hit ${a.direction === "above" ? "above" : "below"} target: ${formatMoney(a.targetPrice)} (now ${formatMoney(price)})`;
        setAlertBanner(msg);
        setTimeout(() => setAlertBanner(null), 10000);
        if (typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            new Notification("Price Alert", { body: msg });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
        return { ...a, triggered: true };
      }
      return a;
    });
    if (changed) setAlerts(updated);
  }, [prices, alerts]);

  // Persist alerts
  useEffect(() => { saveAlertsList(alerts); }, [alerts]);

  // ── Mobile Resize Listener ──
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Badge Checking ──
  useEffect(() => {
    if (dataSource !== "live") return;
    setBadges(prev => {
      const updated = { ...prev };
      let changed = false;
      for (const def of BADGE_DEFS) {
        if (!updated[def.key] && def.check(totalPL, positions, prices)) {
          updated[def.key] = true;
          changed = true;
        }
      }
      if (changed) {
        try { localStorage.setItem(BADGES_KEY, JSON.stringify(updated)); } catch {}
      }
      return changed ? updated : prev;
    });
  }, [dataSource, totalPL, positions, prices]);

  // ── Candle Data Fetching ──
  useEffect(() => {
    if (!tickerModal) return;
    let cancelled = false;
    setCandleLoading(true);
    setCandleData(null);
    console.log(`[TickerModal] Opening ${tickerModal}, timeframe=${tickerModalTimeframe}`);
    // Small delay to avoid colliding with other Finnhub requests
    const timer = setTimeout(async () => {
      const data = await fetchCandleData(tickerModal, tickerModalTimeframe);
      if (!cancelled) {
        console.log(`[TickerModal] ${tickerModal} chart data: ${data ? data.length + " points" : "null"}`);
        setCandleData(data);
        setCandleLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tickerModal, tickerModalTimeframe]);

  // ── Correlation Heatmap ──
  const correlationFetched = useRef(false);
  useEffect(() => {
    if (correlationFetched.current || dataSource !== "live") return;
    const tickerValues: Record<string, number> = {};
    positions.forEach(p => {
      const value = (prices[p.ticker]?.current || 0) * p.shares;
      tickerValues[p.ticker] = (tickerValues[p.ticker] || 0) + value;
    });
    const topTickers = Object.entries(tickerValues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ticker]) => ticker);
    if (topTickers.length < 2) return;
    correlationFetched.current = true;
    setCorrelationLoading(true);
    const doFetch = async () => {
      console.log(`[Correlation] Starting fetch for ${topTickers.length} tickers:`, topTickers);
      const candlesMap: Record<string, number[]> = {};
      for (let idx = 0; idx < topTickers.length; idx++) {
        const ticker = topTickers[idx];
        console.log(`[Correlation] Fetching ${idx + 1}/${topTickers.length}: ${ticker}`);
        const closes = await fetchRawCandles(ticker);
        if (closes) candlesMap[ticker] = closes;
        if (idx < topTickers.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      const validTickers = topTickers.filter(tk => candlesMap[tk]);
      console.log(`[Correlation] Got data for ${validTickers.length}/${topTickers.length} tickers:`, validTickers);
      const returnsMap: Record<string, number[]> = {};
      validTickers.forEach(tk => { returnsMap[tk] = computeDailyReturns(candlesMap[tk]); });
      const matrix: number[][] = [];
      for (let i = 0; i < validTickers.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < validTickers.length; j++) {
          row.push(i === j ? 1 : computeCorrelation(returnsMap[validTickers[i]], returnsMap[validTickers[j]]));
        }
        matrix.push(row);
      }
      setCorrelationData({ tickers: validTickers, matrix });
      setCorrelationLoading(false);
    };
    doFetch();
  }, [dataSource, positions, prices]);

  // ── Ticker Detail Helper ──
  const getTickerDetails = useCallback((ticker: string) => {
    const tickerPositions = positions.filter(p => p.ticker === ticker);
    const totalShares = tickerPositions.reduce((s, p) => s + p.shares, 0);
    const totalCostBasis = tickerPositions.reduce((s, p) => s + p.avgCost * p.shares, 0);
    const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;
    const currentPrice = prices[ticker]?.current || 0;
    const marketValue = currentPrice * totalShares;
    const pl = marketValue - totalCostBasis;
    const plPct = totalCostBasis > 0 ? (pl / totalCostBasis) * 100 : 0;
    const sector = SECTOR_MAP[ticker] || "Other";
    return { ticker, totalShares, avgCost, currentPrice, marketValue, pl, plPct, sector, positions: tickerPositions };
  }, [positions, prices]);

  // ── PDF Export ──
  const handleExportPDF = useCallback(() => {
    setExportingPDF(true);
    try {
      const doc = new jsPDF();
      let y = 20;
      const pageHeight = 280;
      const checkPage = (needed: number) => {
        if (y + needed > pageHeight) { doc.addPage(); y = 20; }
      };
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Portfolio Report", 14, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 14, y);
      y += 14;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Portfolio Summary", 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      [`Total Value: ${formatMoney(totalValue)}`, `Total Cost: ${formatMoney(totalCost)}`, `Total P&L: ${formatMoney(totalPL)} (${formatPct(totalPLPct)})`, `Positions: ${positions.length}`].forEach(line => { doc.text(line, 14, y); y += 6; });
      y += 8;

      checkPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Gainers", 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (gainers.length === 0) { doc.text("No gainers", 14, y); y += 6; }
      else gainers.forEach(g => { doc.text(`${g.ticker}: ${formatPct(g.plPct)}`, 14, y); y += 6; });
      y += 4;

      checkPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Losers", 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (losers.length === 0) { doc.text("No losers", 14, y); y += 6; }
      else losers.forEach(l => { doc.text(`${l.ticker}: ${formatPct(l.plPct)}`, 14, y); y += 6; });
      y += 8;

      checkPage(60);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sector Breakdown", 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const sectorTotal = sectorData.reduce((s, d) => s + d.value, 0);
      sectorData.forEach(s => {
        const pct = sectorTotal > 0 ? ((s.value / sectorTotal) * 100).toFixed(1) : "0";
        doc.text(`${s.name}: ${formatMoney(s.value)} (${pct}%)`, 14, y);
        y += 6;
      });
      y += 8;

      checkPage(20);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("All Positions", 14, y);
      y += 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const cols = [14, 40, 65, 85, 110, 140, 170];
      ["Ticker", "Account", "Shares", "Avg Cost", "Price", "Value", "P&L %"].forEach((h, i) => doc.text(h, cols[i], y));
      y += 2;
      doc.setDrawColor(200);
      doc.line(14, y, 196, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      positions.forEach(p => {
        checkPage(8);
        const price = prices[p.ticker]?.current || 0;
        const value = price * p.shares;
        const plPctVal = p.avgCost > 0 ? ((price - p.avgCost) / p.avgCost) * 100 : 0;
        doc.text(p.ticker, cols[0], y);
        doc.text(p.account, cols[1], y);
        doc.text(p.shares.toFixed(2), cols[2], y);
        doc.text(formatMoney(p.avgCost), cols[3], y);
        doc.text(formatMoney(price), cols[4], y);
        doc.text(formatMoney(value), cols[5], y);
        doc.text(formatPct(plPctVal), cols[6], y);
        y += 6;
      });

      doc.save("portfolio-report.pdf");
    } catch (err) {
      console.error("PDF export error:", err);
    }
    setExportingPDF(false);
  }, [totalValue, totalCost, totalPL, totalPLPct, positions, prices, gainers, losers, sectorData]);

  // ── What-if Calculation ──
  const whatIfResult = useMemo(() => {
    const tk = whatIf.ticker.toUpperCase();
    const sh = parseFloat(whatIf.shares);
    const pr = parseFloat(whatIf.price);
    if (!tk || isNaN(sh) || isNaN(pr) || sh <= 0 || pr <= 0) return null;
    const tradeCost = sh * pr;
    const newCost = totalCost + tradeCost;
    const currentPrice = prices[tk]?.current || pr;
    const newValue = totalValue + sh * currentPrice;
    const newPL = newValue - newCost;
    const newPLPct = newCost > 0 ? (newPL / newCost) * 100 : 0;
    return { currentTotal: totalValue, currentCost: totalCost, currentPL: totalPL, currentPLPct: totalPLPct, newValue, newCost, newPL, newPLPct, tradeCost };
  }, [whatIf, totalValue, totalCost, totalPL, totalPLPct, prices]);

  // ── Treemap Data ──
  const treemapData = useMemo(() => {
    const byTicker: Record<string, { value: number; cost: number }> = {};
    filtered.forEach((p) => {
      const price = prices[p.ticker]?.current || 0;
      const value = price * p.shares;
      const cost = p.avgCost * p.shares;
      if (!byTicker[p.ticker]) byTicker[p.ticker] = { value: 0, cost: 0 };
      byTicker[p.ticker].value += value;
      byTicker[p.ticker].cost += cost;
    });
    return Object.entries(byTicker)
      .map(([ticker, { value, cost }]) => ({ ticker, value, plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 }))
      .filter((d) => d.value > 0);
  }, [filtered, prices]);

  const treemapRects = useMemo(() => computeTreemap(treemapData, 100, 100), [treemapData]);

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

  const handleAddAlert = () => {
    if (!showAlertModal || !alertTarget.price) return;
    const newAlert: PriceAlert = {
      id: Date.now(),
      ticker: showAlertModal,
      targetPrice: parseFloat(alertTarget.price),
      direction: alertTarget.direction,
      triggered: false,
    };
    setAlerts((prev) => [...prev, newAlert]);
    setShowAlertModal(null);
    setAlertTarget({ price: "", direction: "above" });
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const removeAlert = (id: number) => setAlerts((prev) => prev.filter((a) => a.id !== id));

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
      {/* Alert Banner */}
      {alertBanner && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000", padding: "12px 24px", borderRadius: 14, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 30px rgba(251,191,36,0.3)", maxWidth: "90vw" }}>
          <Bell size={18} />
          <span style={{ flex: 1 }}>{alertBanner}</span>
          <button onClick={() => setAlertBanner(null)} style={{ background: "none", border: "none", color: "#000", cursor: "pointer", padding: 2, flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", marginBottom: 28, gap: isMobile ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 14, flexDirection: isMobile ? "column" : "row" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, background: "linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              {"\u{1F4CA}"} My Portfolio Tracker
            </h1>
            <p style={{ color: t.textMuted, margin: "4px 0 0", fontSize: 13 }}>
              {dataSource === "live" ? "Finnhub live prices" : dataSource === "simulated" ? "Simulated prices (API fallback)" : "Connecting to Finnhub..."} update every 30s {"\u2022"} <span style={{ color: dataSource === "live" ? "#4ade80" : dataSource === "simulated" ? "#fbbf24" : t.textMuted }}>{"\u25CF"}</span> {dataSource === "live" ? "Live" : dataSource === "simulated" ? "Simulated" : "..."}
            </p>
          </div>
          {/* Mood */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: "8px 16px", boxShadow: t.shadow }}>
            <span style={{ fontSize: isMobile ? 22 : 28, animation: "mood-bounce 2s ease-in-out infinite" }}>{mood.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, fontStyle: "italic" }}>{mood.text}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: isMobile ? "center" : "flex-end", flexWrap: "wrap" }}>
          <button onClick={() => setThemeMode((m) => m === "dark" ? "light" : "dark")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: isMobile ? 44 : 38, borderRadius: 12, border: `1px solid ${t.pillBorder}`, background: t.pillBg, color: t.text, cursor: "pointer" }} title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={handleExportPDF} disabled={exportingPDF} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${t.pillBorder}`, background: t.pillBg, color: t.text, cursor: "pointer", fontSize: 13, fontWeight: 600, minHeight: isMobile ? 44 : undefined, opacity: exportingPDF ? 0.6 : 1 }}>
            <FileText size={15} /> {exportingPDF ? "Exporting..." : "Export PDF"}
          </button>
          <button onClick={() => setShowCSVModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${t.pillBorder}`, background: t.pillBg, color: t.text, cursor: "pointer", fontSize: 13, fontWeight: 600, minHeight: isMobile ? 44 : undefined }}>
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, minHeight: isMobile ? 44 : undefined }}>
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
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "linear-gradient(135deg, rgba(168,139,250,0.15), rgba(244,114,182,0.08))", borderRadius: 16, padding: isMobile ? 14 : 20, border: "1px solid rgba(168,139,250,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Wallet size={18} color="#a78bfa" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total Value</span>
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: t.textBold }}>{formatMoney(totalValue)}</div>
        </div>
        <div style={{ background: totalPL >= 0 ? "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))" : "linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.05))", borderRadius: 16, padding: isMobile ? 14 : 20, border: totalPL >= 0 ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(248,113,113,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {totalPL >= 0 ? <TrendingUp size={18} color="#34d399" /> : <TrendingDown size={18} color="#f87171" />}
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total P&L</span>
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: totalPL >= 0 ? "#34d399" : "#f87171" }}>
            {formatMoney(totalPL)}
          </div>
          <div style={{ fontSize: 14, color: totalPL >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
            {formatPct(totalPLPct)}
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05))", borderRadius: 16, padding: isMobile ? 14 : 20, border: "1px solid rgba(96,165,250,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} color="#60a5fa" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Total Cost Basis</span>
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: t.textBold }}>{formatMoney(totalCost)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))", borderRadius: 16, padding: isMobile ? 14 : 20, border: "1px solid rgba(251,191,36,0.2)", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BarChart3 size={18} color="#fbbf24" />
            <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>Positions</span>
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: t.textBold }}>{filtered.length}</div>
          <div style={{ fontSize: 14, color: t.textMuted }}>across {selectedAccount === "All" ? "3 accounts" : "1 account"}</div>
        </div>
      </div>

      {/* S&P 500 Comparison */}
      {spyReturn !== null && (
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F4CA}"} Portfolio vs S&P 500</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>Your Portfolio</div>
              <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: totalPLPct >= 0 ? "#34d399" : "#f87171" }}>{formatPct(totalPLPct)}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.textDim }}>vs</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>S&P 500 (1Y)</div>
              <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: spyReturn >= 0 ? "#34d399" : "#f87171" }}>{formatPct(spyReturn)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 14, background: totalPLPct > spyReturn ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${totalPLPct > spyReturn ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
              {totalPLPct > spyReturn ? <TrendingUp size={20} color="#34d399" /> : <TrendingDown size={20} color="#f87171" />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: totalPLPct > spyReturn ? "#34d399" : "#f87171" }}>
                  {totalPLPct > spyReturn ? "Beating" : "Trailing"} the market
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>by {formatPct(Math.abs(totalPLPct - spyReturn))}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Badges */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F3C5}"} Achievements</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
          {BADGE_DEFS.map(def => {
            const unlocked = badges[def.key];
            return (
              <div key={def.key} title={unlocked ? def.name : def.hint} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 14, minWidth: 90, textAlign: "center",
                background: unlocked ? "rgba(168,139,250,0.1)" : t.hoverBg,
                border: unlocked ? "1px solid rgba(168,139,250,0.4)" : `1px solid ${t.cardBorder}`,
                opacity: unlocked ? 1 : 0.4,
                filter: unlocked ? "none" : "grayscale(1)",
                transition: "all 0.3s",
              }}>
                <span style={{ fontSize: 28 }}>{unlocked ? def.icon : "\u{2753}"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: unlocked ? t.textBold : t.textDim }}>{unlocked ? def.name : "???"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "3fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Portfolio Value Chart */}
        <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F4C8}"} Portfolio Value</h3>
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
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F3AF}"} Allocation</h3>
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
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F3ED}"} Sectors</h3>
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
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexDirection: isMobile ? "column" : "row" }}>
        <PerformerCard items={gainers} label="Top Gainers" icon={"\u{1F525}"} />
        <PerformerCard items={losers} label="Top Losers" icon={"\u{1F4C9}"} />
      </div>

      {/* Daily P&L Bar Chart */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F4CA}"} Daily P&L</h3>
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

      {/* Correlation Heatmap */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F50D}"} Correlation Heatmap (30d)</h3>
        {correlationLoading ? (
          <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: t.textDim, fontSize: 13 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${t.cardBorder}`, borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading correlation data...
          </div>
        ) : !correlationData ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: t.textDim, fontSize: 13 }}>Correlation data will load after live prices connect.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${correlationData.tickers.length}, 1fr)`, gap: 2, minWidth: Math.max(400, correlationData.tickers.length * 55 + 60) }}>
              {/* Header row */}
              <div />
              {correlationData.tickers.map(tk => (
                <div key={`h-${tk}`} style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textAlign: "center", padding: "4px 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tk}</div>
              ))}
              {/* Data rows */}
              {correlationData.tickers.map((tk, i) => (
                <>
                  <div key={`r-${tk}`} style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, display: "flex", alignItems: "center", padding: "0 4px" }}>{tk}</div>
                  {correlationData.matrix[i].map((val, j) => {
                    const absVal = Math.abs(val);
                    const bg = val >= 0
                      ? `rgba(52,211,153,${(absVal * 0.6 + 0.05).toFixed(2)})`
                      : `rgba(248,113,113,${(absVal * 0.6 + 0.05).toFixed(2)})`;
                    return (
                      <div key={`c-${i}-${j}`} style={{
                        background: bg, borderRadius: 4, padding: "6px 2px", textAlign: "center",
                        fontSize: 10, fontWeight: 600, color: absVal > 0.3 ? "#fff" : t.textMuted,
                      }}>{val.toFixed(2)}</div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* News & Earnings Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 24 }}>
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
                        <span style={{ opacity: 0.5 }}>{"\u00B7"}</span>
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
                        {e.epsEstimate !== null && `${e.hour ? " \u00B7 " : ""}EPS est: $${e.epsEstimate}`}
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
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F3E6}"} Account Breakdown</h3>
          <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
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

      {/* What-if Calculator */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 24, boxShadow: t.shadow }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Calculator size={16} /> What-if Calculator
        </h3>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ display: "block", fontSize: 11, color: t.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Ticker</label>
            <input value={whatIf.ticker} onChange={(e) => setWhatIf({ ...whatIf, ticker: e.target.value })} placeholder="e.g. AAPL" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ display: "block", fontSize: 11, color: t.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Shares</label>
            <input value={whatIf.shares} onChange={(e) => setWhatIf({ ...whatIf, shares: e.target.value })} placeholder="e.g. 100" type="number" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ display: "block", fontSize: 11, color: t.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Buy Price</label>
            <input value={whatIf.price} onChange={(e) => setWhatIf({ ...whatIf, price: e.target.value })} placeholder="e.g. 150.00" type="number" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        {whatIfResult ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
            <div style={{ background: t.hoverBg, borderRadius: 12, padding: 16, border: `1px solid ${t.cardBorder}` }}>
              <div style={{ fontSize: 12, color: t.textDim, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Before</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.textBold, marginBottom: 4 }}>{formatMoney(whatIfResult.currentTotal)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: whatIfResult.currentPL >= 0 ? "#34d399" : "#f87171" }}>
                {formatMoney(whatIfResult.currentPL)} ({formatPct(whatIfResult.currentPLPct)})
              </div>
            </div>
            <div style={{ fontSize: 24, color: t.textDim }}>{"\u2192"}</div>
            <div style={{ background: t.hoverBg, borderRadius: 12, padding: 16, border: `1px solid ${t.cardBorder}` }}>
              <div style={{ fontSize: 12, color: t.textDim, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>After (+{whatIf.shares} {whatIf.ticker.toUpperCase()})</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.textBold, marginBottom: 4 }}>{formatMoney(whatIfResult.newValue)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: whatIfResult.newPL >= 0 ? "#34d399" : "#f87171" }}>
                {formatMoney(whatIfResult.newPL)} ({formatPct(whatIfResult.newPLPct)})
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: t.textDim, fontSize: 13, textAlign: "center", padding: "8px 0" }}>
            Enter a ticker, shares, and buy price to see the impact on your portfolio.
          </div>
        )}
      </div>

      {/* Positions Table / Treemap */}
      <div style={{ background: t.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>{"\u{1F4BC}"} Positions</h3>
          <div style={{ display: "flex", gap: 4, background: t.pillBg, borderRadius: 10, padding: 3, border: `1px solid ${t.pillBorder}` }}>
            <button onClick={() => setViewMode("table")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "none", background: viewMode === "table" ? "linear-gradient(135deg, #a78bfa, #f472b6)" : "transparent", color: viewMode === "table" ? "#fff" : t.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}>
              <Table2 size={13} /> Table
            </button>
            <button onClick={() => setViewMode("treemap")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "none", background: viewMode === "treemap" ? "linear-gradient(135deg, #a78bfa, #f472b6)" : "transparent", color: viewMode === "treemap" ? "#fff" : t.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}>
              <LayoutGrid size={13} /> Treemap
            </button>
          </div>
        </div>

        {viewMode === "treemap" ? (
          <div style={{ overflowX: isMobile ? "auto" : undefined }}>
            <div style={{ position: "relative", width: "100%", height: 420, borderRadius: 12, overflow: "hidden", minWidth: isMobile ? 600 : undefined }}>
              {treemapRects.map((r, i) => {
                const minDim = Math.min(r.w, r.h);
                const area = r.w * r.h;
                const tickerSize = Math.max(8, Math.min(32, minDim * 1.2));
                const pctSize = Math.max(8, Math.min(22, minDim * 0.85));
                const valSize = Math.max(8, Math.min(18, minDim * 0.7));
                const showPct = minDim > 8 && area > 60;
                const showVal = minDim > 12 && area > 150;
                return (
                  <div key={i} style={{
                    position: "absolute",
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                    height: `${r.h}%`,
                    background: plColor(r.plPct),
                    border: `1px solid ${themeMode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)"}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                    boxSizing: "border-box",
                    padding: 2,
                  }} title={`${r.ticker}: ${formatMoney(r.value)} (${formatPct(r.plPct)})`}
                    onClick={() => setTickerModal(r.ticker)}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    <div style={{ fontWeight: 800, fontSize: tickerSize, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)", lineHeight: 1.2, whiteSpace: "nowrap" }}>{r.ticker}</div>
                    {showPct && <div style={{ fontWeight: 600, fontSize: pctSize, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 2px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>{formatPct(r.plPct)}</div>}
                    {showVal && <div style={{ fontWeight: 500, fontSize: valSize, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.5)", marginTop: 1, whiteSpace: "nowrap" }}>{formatMoney(r.value)}</div>}
                  </div>
                );
              })}
              {treemapRects.length === 0 && (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: t.textDim, fontSize: 13 }}>
                  No position data to display.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.gridStroke}` }}>
                  {["Ticker", "Account", "Shares", "Avg Cost", "Price", "Market Value", "P&L", "P&L %", "Alert", ""].map((h) => (
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
                  const hasActiveAlert = alerts.some((a) => a.ticker === p.ticker && !a.triggered);
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${t.gridStroke}11`, transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverBg)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px", fontWeight: 700, color: t.textBold }}>
                        <span onClick={() => setTickerModal(p.ticker)} style={{ background: t.tickerBadgeBg, padding: "3px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>{p.ticker}</span>
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
                        <button onClick={(e) => { e.stopPropagation(); setShowAlertModal(p.ticker); setAlertTarget({ price: "", direction: "above" }); }} style={{ background: "none", border: "none", color: hasActiveAlert ? "#fbbf24" : t.textDim, cursor: "pointer", padding: 4 }} title="Set price alert">
                          <Bell size={14} fill={hasActiveAlert ? "#fbbf24" : "none"} />
                        </button>
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
                No positions yet. Click "Add Position" or "Import CSV" to get started! {"\u{1F680}"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Position Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: isMobile ? "95vw" : 380, border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>{"\u2795"} Add Position</h3>
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
              Add to Portfolio {"\u{1F680}"}
            </button>
          </div>
        </div>
      )}

      {/* CSV Modal */}
      {showCSVModal && (
        <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowCSVModal(false)}>
          <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: isMobile ? "95vw" : 420, border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>{"\u{1F4C4}"} Import CSV</h3>
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
              Choose CSV File {"\u{1F4C1}"}
            </button>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAlertModal(null)}>
          <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: isMobile ? "95vw" : 380, border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>{"\u{1F514}"} Price Alert — {showAlertModal}</h3>
              <button onClick={() => setShowAlertModal(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            {prices[showAlertModal] && (
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, padding: "10px 14px", background: t.hoverBg, borderRadius: 10, border: `1px solid ${t.cardBorder}` }}>
                Current price: <span style={{ fontWeight: 700, color: t.textBold }}>{formatMoney(prices[showAlertModal].current)}</span>
              </div>
            )}
            {alerts.filter((a) => a.ticker === showAlertModal).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: t.textDim, marginBottom: 8, fontWeight: 600 }}>Active Alerts</div>
                {alerts.filter((a) => a.ticker === showAlertModal).map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: a.triggered ? "rgba(251,191,36,0.1)" : t.hoverBg, marginBottom: 6, border: `1px solid ${t.cardBorder}` }}>
                    <span style={{ fontSize: 13, color: a.triggered ? t.textDim : t.text }}>
                      {a.direction === "above" ? "\u2191 Above" : "\u2193 Below"} {formatMoney(a.targetPrice)}
                      {a.triggered && <span style={{ marginLeft: 8, fontSize: 11, color: "#fbbf24" }}>Triggered</span>}
                    </span>
                    <button onClick={() => removeAlert(a.id)} style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", padding: 2 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>Target Price</label>
              <input value={alertTarget.price} onChange={(e) => setAlertTarget({ ...alertTarget, price: e.target.value })} placeholder="e.g. 200.00" type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>Direction</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["above", "below"] as const).map((dir) => (
                  <button key={dir} onClick={() => setAlertTarget({ ...alertTarget, direction: dir })} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: alertTarget.direction === dir ? "none" : `1px solid ${t.inputBorder}`, background: alertTarget.direction === dir ? (dir === "above" ? "#22c55e" : "#ef4444") : "transparent", color: alertTarget.direction === dir ? "#fff" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
                    {dir === "above" ? "\u2191 Above" : "\u2193 Below"}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAddAlert} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Set Alert {"\u{1F514}"}
            </button>
          </div>
        </div>
      )}

      {/* Ticker Detail Modal */}
      {tickerModal && (() => {
        const details = getTickerDetails(tickerModal);
        return (
          <div style={{ position: "fixed", inset: 0, background: t.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => { setTickerModal(null); setTickerModalTimeframe("1M"); }}>
            <div style={{ background: t.modalBg, borderRadius: 20, padding: 28, width: isMobile ? "95vw" : 560, maxHeight: "90vh", overflowY: "auto", border: `1px solid ${t.modalBorder}`, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.textBold }}>{tickerModal} <span style={{ fontSize: 13, fontWeight: 500, color: t.textMuted }}>{details.sector}</span></h3>
                <button onClick={() => { setTickerModal(null); setTickerModalTimeframe("1M"); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={20} /></button>
              </div>

              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: t.hoverBg, borderRadius: 10, padding: 12, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: t.textDim, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Price</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.textBold }}>{formatMoney(details.currentPrice)}</div>
                </div>
                <div style={{ background: t.hoverBg, borderRadius: 10, padding: 12, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: t.textDim, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Avg Cost</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.textBold }}>{formatMoney(details.avgCost)}</div>
                </div>
                <div style={{ background: t.hoverBg, borderRadius: 10, padding: 12, border: `1px solid ${t.cardBorder}`, gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <div style={{ fontSize: 11, color: t.textDim, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Market Value</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.textBold }}>{formatMoney(details.marketValue)}</div>
                </div>
              </div>

              {/* P&L Banner */}
              <div style={{ background: details.pl >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${details.pl >= 0 ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: details.pl >= 0 ? "#34d399" : "#f87171" }}>{formatMoney(details.pl)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: details.pl >= 0 ? "#34d399" : "#f87171" }}>{formatPct(details.plPct)}</span>
              </div>

              {/* Timeframe Buttons */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {["1D", "5D", "1M", "6M", "1Y"].map(tf => (
                  <button key={tf} onClick={() => setTickerModalTimeframe(tf)} style={{ padding: "6px 14px", borderRadius: 8, border: tickerModalTimeframe === tf ? "none" : `1px solid ${t.pillBorder}`, background: tickerModalTimeframe === tf ? "linear-gradient(135deg, #a78bfa, #f472b6)" : t.pillBg, color: tickerModalTimeframe === tf ? "#fff" : t.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, minHeight: isMobile ? 44 : undefined }}>
                    {tf}
                  </button>
                ))}
              </div>

              {/* Chart */}
              {candleLoading ? (
                <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: t.textDim, fontSize: 13 }}>
                  <div style={{ width: 28, height: 28, border: `3px solid ${t.cardBorder}`, borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Loading chart data...
                </div>
              ) : !candleData || candleData.length === 0 ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: t.textDim, fontSize: 13 }}>No chart data available for this timeframe.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={candleData}>
                    <defs>
                      <linearGradient id="tickerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={details.pl >= 0 ? "#34d399" : "#f87171"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={details.pl >= 0 ? "#34d399" : "#f87171"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
                    <XAxis dataKey="t" tick={{ fill: t.textDim, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => {
                      const d = new Date(v * 1000);
                      return tickerModalTimeframe === "1D" || tickerModalTimeframe === "5D"
                        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }} />
                    <YAxis tick={{ fill: t.textDim, fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 10, color: t.text, fontSize: 12 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "Price"]} labelFormatter={(v) => new Date((v as number) * 1000).toLocaleString()} cursor={{ stroke: t.textDim, strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="c" stroke={details.pl >= 0 ? "#34d399" : "#f87171"} strokeWidth={2} fill="url(#tickerGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* Position details */}
              {details.positions.length > 1 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: t.textDim, fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>Positions ({details.positions.length})</div>
                  {details.positions.map(pos => (
                    <div key={pos.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.gridStroke}11`, fontSize: 12 }}>
                      <span style={{ color: t.textMuted }}>{pos.account}: {pos.shares} shares</span>
                      <span style={{ color: t.textMuted }}>@ {formatMoney(pos.avgCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes mood-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
