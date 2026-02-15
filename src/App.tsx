import { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Plus, Upload, X, DollarSign, BarChart3, Wallet, Trash2 } from "lucide-react";
import * as Papa from "papaparse";

const FINNHUB_API_KEY = "d67t5tpr01qobepj8tbg";

// Tickers that have no Finnhub data — valued at avgCost only
const MANUAL_TICKERS = new Set(["VTSAX"]);

// Price divisors for tickers with unprocessed splits on Finnhub
const PRICE_DIVISORS: Record<string, number> = {
  KXIAY: 10,
};

const fetchFinnhubQuote = async (symbol: string): Promise<{ price: number; change: number; changePct: number } | null> => {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) {
      console.warn(`[Finnhub] ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data || data.c === 0 || data.c === undefined) {
      console.warn(`[Finnhub] ${symbol}: no price data`, data);
      return null;
    }
    const divisor = PRICE_DIVISORS[symbol] || 1;
    return { price: data.c / divisor, change: data.d / divisor, changePct: data.dp };
  } catch (err) {
    console.error(`[Finnhub] ${symbol}: fetch error`, err);
    return null;
  }
};

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

const generatePriceHistory = (basePrice: number, days = 30) => {
  const data = [];
  let price = basePrice * (0.85 + Math.random() * 0.15);
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    price = price * (1 + (Math.random() - 0.48) * 0.04);
    data.push({ date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), price: +price.toFixed(2) });
  }
  return data;
};

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

const defaultPositions: Position[] = [
  { id: 1, ticker: "RKLB", shares: 523, avgCost: 38.14, account: "Chase" },
  { id: 2, ticker: "NVDA", shares: 181.79665, avgCost: 153.99, account: "Chase" },
  { id: 3, ticker: "SAABY", shares: 799, avgCost: 27.16, account: "Chase" },
  { id: 4, ticker: "MU", shares: 43.36685, avgCost: 332.66, account: "Chase" },
  { id: 5, ticker: "VTSAX", shares: 98.233, avgCost: 134.51, account: "Chase" },
  { id: 6, ticker: "BRK.B", shares: 28.10829, avgCost: 486.49, account: "Chase" },
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

const STORAGE_KEY = "portfolio-positions";

const loadPositions = (): Position[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultPositions;
};

const savePositions = (positions: Position[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {}
};

const basePrices: Record<string, number> = {
  AAPL: 192.5, MSFT: 415.8, GOOGL: 155.2, AMZN: 190.4,
  NVDA: 520.3, TSLA: 260.1, META: 510.2, SPY: 525.6,
  QQQ: 460.3, AMD: 165.8, NFLX: 630.5, DIS: 112.4,
  V: 280.3, JPM: 198.5, BA: 210.7,
};

export default function App() {
  const [positions, setPositions] = useState<Position[]>(loadPositions);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, { date: string; price: number }[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("All");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [newPos, setNewPos] = useState({ ticker: "", shares: "", avgCost: "", account: "Fidelity" });
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(positions.reduce((max, p) => Math.max(max, p.id), 0) + 1);
  const [dataSource, setDataSource] = useState<"connecting" | "live" | "simulated">("connecting");

  // Persist positions to localStorage
  useEffect(() => {
    savePositions(positions);
  }, [positions]);

  const fetchAllPrices = useCallback(async (tickers: string[]) => {
    const fetchable = tickers.filter((t) => !MANUAL_TICKERS.has(t));
    const results = await Promise.all(fetchable.map((t) => fetchFinnhubQuote(t)));
    let anyLive = false;
    setPrices((prev) => {
      const updated = { ...prev };
      fetchable.forEach((t, i) => {
        const quote = results[i];
        if (quote) {
          anyLive = true;
          updated[t] = { current: quote.price, prev: prev[t]?.current ?? quote.price, change: quote.change, changePct: quote.changePct };
        } else if (updated[t]) {
          const old = updated[t].current;
          const newPrice = simulatePrice(old);
          const change = newPrice - old;
          updated[t] = { current: newPrice, prev: old, change: updated[t].change + change, changePct: ((newPrice - (old - updated[t].change)) / (old - updated[t].change)) * 100 };
        }
      });
      return updated;
    });
    if (fetchable.length > 0) setDataSource(anyLive ? "live" : "simulated");
    setTick((t) => t + 1);
  }, []);

  // Initialize prices
  useEffect(() => {
    const tickers = [...new Set(positions.map((p) => p.ticker))];
    const initial: Record<string, PriceData> = {};
    const histories: Record<string, { date: string; price: number }[]> = {};
    tickers.forEach((t) => {
      if (MANUAL_TICKERS.has(t)) {
        const pos = positions.find((p) => p.ticker === t);
        const base = pos?.avgCost || 0;
        initial[t] = { current: base, prev: base, change: 0, changePct: 0 };
        histories[t] = generatePriceHistory(base);
      } else {
        const base = basePrices[t] || 100 + Math.random() * 400;
        initial[t] = { current: base, prev: base, change: 0, changePct: 0 };
        histories[t] = generatePriceHistory(base);
      }
    });
    setPrices(initial);
    setPriceHistory(histories);
    // Kick off first live fetch
    fetchAllPrices(tickers);
  }, []);

  // Refresh prices from Finnhub every 15 seconds, fallback to simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const tickers = [...new Set(positions.map((p) => p.ticker))];
      fetchAllPrices(tickers);
    }, 15000);
    return () => clearInterval(interval);
  }, [positions, fetchAllPrices]);

  // Ensure new tickers get prices
  useEffect(() => {
    const tickers = [...new Set(positions.map((p) => p.ticker))];
    setPrices((prev) => {
      const updated = { ...prev };
      let changed = false;
      tickers.forEach((t) => {
        if (!updated[t]) {
          const base = basePrices[t] || 100 + Math.random() * 400;
          updated[t] = { current: base, prev: base, change: 0, changePct: 0 };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
    setPriceHistory((prev) => {
      const updated = { ...prev };
      let changed = false;
      tickers.forEach((t) => {
        if (!updated[t]) {
          const base = basePrices[t] || 100 + Math.random() * 400;
          updated[t] = generatePriceHistory(base);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [positions]);

  const filtered = selectedAccount === "All" ? positions : positions.filter((p) => p.account === selectedAccount);

  const totalValue = filtered.reduce((sum, p) => sum + (prices[p.ticker]?.current || 0) * p.shares, 0);
  const totalCost = filtered.reduce((sum, p) => sum + p.avgCost * p.shares, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const accountBreakdown = ["Fidelity", "Chase", "IBKR"].map((acc) => {
    const accPositions = positions.filter((p) => p.account === acc);
    const value = accPositions.reduce((s, p) => s + (prices[p.ticker]?.current || 0) * p.shares, 0);
    return { name: acc, value: +value.toFixed(2) };
  }).filter((a) => a.value > 0);

  const pieData = filtered.map((p, i) => ({
    name: p.ticker,
    value: +((prices[p.ticker]?.current || 0) * p.shares).toFixed(2),
    color: TICKER_COLORS[i % TICKER_COLORS.length],
  })).filter((d) => d.value > 0);

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
        const newPositions = (results.data as Record<string, string>[])
          .filter((r) => r.ticker && r.shares && r.avgCost)
          .map((r) => ({
            id: nextId.current++,
            ticker: (r.ticker || r.Ticker || r.TICKER || "").toUpperCase(),
            shares: +(r.shares || r.Shares || r.SHARES || 0),
            avgCost: +(r.avgCost || r.avg_cost || r.cost || r.Cost || 0),
            account: r.account || r.Account || "Fidelity",
          }));
        setPositions((prev) => [...prev, ...newPositions]);
        setShowCSVModal(false);
      },
    });
  };

  const removePosition = (id: number) => setPositions((prev) => prev.filter((p) => p.id !== id));

  const portfolioHistory = (() => {
    if (filtered.length === 0) return [];
    const days = 30;
    const data = [];
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      let total = 0;
      filtered.forEach((p) => {
        const hist = priceHistory[p.ticker];
        if (hist && hist[i]) total += hist[i].price * p.shares;
      });
      data.push({ date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: +total.toFixed(2) });
    }
    return data;
  })();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            📊 My Portfolio Tracker
          </h1>
          <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 13 }}>
            {dataSource === "live" ? "Finnhub live prices" : dataSource === "simulated" ? "Simulated prices (API fallback)" : "Connecting to Finnhub..."} update every 15s • <span style={{ color: dataSource === "live" ? "#4ade80" : dataSource === "simulated" ? "#fbbf24" : "#94a3b8" }}>●</span> {dataSource === "live" ? "Live" : dataSource === "simulated" ? "Simulated" : "..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowCSVModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: "1px solid #334155", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
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
          <button key={acc} onClick={() => setSelectedAccount(acc)} style={{ padding: "6px 18px", borderRadius: 20, border: selectedAccount === acc ? "none" : "1px solid #334155", background: selectedAccount === acc ? (acc === "All" ? "linear-gradient(135deg, #a78bfa, #f472b6)" : `linear-gradient(135deg, ${ACCOUNT_COLORS[acc]?.light || "#a78bfa"}, ${ACCOUNT_COLORS[acc]?.light || "#f472b6"}88)`) : "rgba(255,255,255,0.04)", color: selectedAccount === acc ? "#fff" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
            {acc}
          </button>
        ))}
      </div>

      {/* Top Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "linear-gradient(135deg, rgba(168,139,250,0.15), rgba(244,114,182,0.08))", borderRadius: 16, padding: 20, border: "1px solid rgba(168,139,250,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Wallet size={18} color="#a78bfa" />
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Total Value</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{formatMoney(totalValue)}</div>
        </div>
        <div style={{ background: totalPL >= 0 ? "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))" : "linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.05))", borderRadius: 16, padding: 20, border: totalPL >= 0 ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(248,113,113,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {totalPL >= 0 ? <TrendingUp size={18} color="#34d399" /> : <TrendingDown size={18} color="#f87171" />}
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Total P&L</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: totalPL >= 0 ? "#34d399" : "#f87171" }}>
            {formatMoney(totalPL)}
          </div>
          <div style={{ fontSize: 14, color: totalPL >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
            {formatPct(totalPLPct)}
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05))", borderRadius: 16, padding: 20, border: "1px solid rgba(96,165,250,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} color="#60a5fa" />
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Total Cost Basis</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{formatMoney(totalCost)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))", borderRadius: 16, padding: 20, border: "1px solid rgba(251,191,36,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BarChart3 size={18} color="#fbbf24" />
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Positions</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{filtered.length}</div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>across {selectedAccount === "All" ? "3 accounts" : "1 account"}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Portfolio Value Chart */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>📈 Portfolio Value (30d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={portfolioHistory}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 13 }} formatter={(v) => [formatMoney(v as number), "Value"]} />
              <Area type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2.5} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation Pie */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>🎯 Allocation</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 12 }} formatter={(v) => formatMoney(v as number)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {pieData.map((d, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#94a3b8" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Account Breakdown Bar */}
      {selectedAccount === "All" && accountBreakdown.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>🏦 Account Breakdown</h3>
          <div style={{ display: "flex", gap: 12 }}>
            {accountBreakdown.map((acc) => {
              const pct = totalValue > 0 ? ((acc.value / totalValue) * 100).toFixed(1) : "0";
              return (
                <div key={acc.name} style={{ flex: 1, background: `linear-gradient(135deg, ${ACCOUNT_COLORS[acc.name]?.light}22, ${ACCOUNT_COLORS[acc.name]?.light}08)`, borderRadius: 12, padding: 16, border: `1px solid ${ACCOUNT_COLORS[acc.name]?.light}33`, cursor: "pointer", transition: "transform 0.2s" }} onClick={() => setSelectedAccount(acc.name)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ACCOUNT_COLORS[acc.name]?.light, marginBottom: 4 }}>{acc.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{formatMoney(acc.value)}</div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: ACCOUNT_COLORS[acc.name]?.light, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticker Detail Chart */}
      {selectedTicker && priceHistory[selectedTicker] && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid rgba(168,139,250,0.2)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📊 {selectedTicker} — 30 Day Chart</h3>
            <button onClick={() => setSelectedTicker(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={18} /></button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={priceHistory[selectedTicker]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 13 }} formatter={(v) => [`$${v}`, "Price"]} />
              <Line type="monotone" dataKey="price" stroke="#f472b6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Positions Table */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>💼 Positions</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Ticker", "Account", "Shares", "Avg Cost", "Price", "Market Value", "P&L", "P&L %", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
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
                  <tr key={p.id} style={{ borderBottom: "1px solid #1e293b11", cursor: "pointer", transition: "background 0.15s" }} onClick={() => setSelectedTicker(p.ticker)} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#fff" }}>
                      <span style={{ background: "linear-gradient(135deg, #a78bfa33, #f472b633)", padding: "3px 10px", borderRadius: 8, fontSize: 13 }}>{p.ticker}</span>
                      {MANUAL_TICKERS.has(p.ticker) && (
                        <span title="No live data — using cost basis" style={{ marginLeft: 6, fontSize: 10, color: "#94a3b8", background: "rgba(148,163,184,0.15)", padding: "2px 6px", borderRadius: 6, fontWeight: 600, cursor: "help" }}>
                          manual
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCOUNT_COLORS[p.account]?.light || "#94a3b8" }} />
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>{p.account}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#e2e8f0" }}>{p.shares}</td>
                    <td style={{ padding: "12px", color: "#94a3b8" }}>{formatMoney(p.avgCost)}</td>
                    <td style={{ padding: "12px", color: "#fff", fontWeight: 600 }}>
                      {formatMoney(price)}
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4ade80", marginLeft: 6, animation: "pulse 2s infinite" }} />
                    </td>
                    <td style={{ padding: "12px", color: "#e2e8f0", fontWeight: 600 }}>{formatMoney(value)}</td>
                    <td style={{ padding: "12px", color: isUp ? "#34d399" : "#f87171", fontWeight: 700 }}>{formatMoney(pl)}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ background: isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: isUp ? "#34d399" : "#f87171", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                        {formatPct(plPct)}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <button onClick={(e) => { e.stopPropagation(); removePosition(p.id); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
              No positions yet. Click "Add Position" or "Import CSV" to get started! 🚀
            </div>
          )}
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: "#1e293b", borderRadius: 20, padding: 28, width: 380, border: "1px solid #334155" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>➕ Add Position</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
            </div>
            {[
              { label: "Ticker Symbol", key: "ticker" as const, placeholder: "e.g. AAPL", type: "text" },
              { label: "Shares", key: "shares" as const, placeholder: "e.g. 10", type: "number" },
              { label: "Avg Cost per Share", key: "avgCost" as const, placeholder: "e.g. 150.00", type: "number" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 5, fontWeight: 600 }}>{label}</label>
                <input value={newPos[key]} onChange={(e) => setNewPos({ ...newPos, [key]: e.target.value })} placeholder={placeholder} type={type} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 5, fontWeight: 600 }}>Account</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Fidelity", "Chase", "IBKR"].map((acc) => (
                  <button key={acc} onClick={() => setNewPos({ ...newPos, account: acc })} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: newPos.account === acc ? "none" : "1px solid #334155", background: newPos.account === acc ? ACCOUNT_COLORS[acc]?.light : "transparent", color: newPos.account === acc ? "#000" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowCSVModal(false)}>
          <div style={{ background: "#1e293b", borderRadius: 20, padding: 28, width: 420, border: "1px solid #334155" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📄 Import CSV</h3>
              <button onClick={() => setShowCSVModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Upload a CSV with columns: <strong style={{ color: "#e2e8f0" }}>ticker, shares, avgCost, account</strong>
            </p>
            <div style={{ background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 16, fontFamily: "monospace", fontSize: 12, color: "#64748b", lineHeight: 1.8 }}>
              ticker,shares,avgCost,account<br />
              AAPL,10,178.50,Fidelity<br />
              MSFT,5,380.00,Chase<br />
              TSLA,8,245.00,IBKR
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "2px dashed #334155", background: "transparent", color: "#a78bfa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Choose CSV File 📁
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>
    </div>
  );
}
