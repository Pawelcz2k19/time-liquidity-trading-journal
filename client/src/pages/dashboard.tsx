import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Trade, JournalEntry, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { RiskNudge } from "@/components/risk-nudge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { computeKPIs, equityCurve, dailyPnL, courseScore } from "@/lib/stats";
import { formatCurrency, formatNumber, formatR, formatPercent, pnlClass } from "@/lib/format";
import { PlusCircle, TrendingUp, TrendingDown, Calendar as CalendarIcon, ArrowRight, Award } from "lucide-react";

export default function Dashboard() {
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { data: journals = [] } = useQuery<JournalEntry[]>({ queryKey: ["/api/journals"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const kpis = useMemo(() => computeKPIs(trades), [trades]);
  const score = useMemo(() => courseScore(trades, journals), [trades, journals]);
  const curve = useMemo(() => equityCurve(trades), [trades]);
  const daily = useMemo(() => dailyPnL(trades), [trades]);

  const recent = useMemo(() => [...trades].slice(0, 8), [trades]);
  const currency = settings?.currency ?? "USD";

  // Build the last-12-weeks calendar heatmap data
  const cal = useMemo(() => buildCalendar(daily), [daily]);

  // Equity series with x-axis index
  const curveData = curve.map((p, i) => ({ idx: i + 1, equity: p.equity, date: p.date }));

  if (trades.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Performance overview · {kpis.tradeCount} closed trades</p>
        </div>
        <div className="flex gap-2">
          <Link href="/journal"><Button variant="outline" size="sm" data-testid="link-journal-cta">Today's journal <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          <Link href="/trades/new"><Button size="sm" data-testid="link-new-trade-dashboard"><PlusCircle className="w-4 h-4 mr-1" />New trade</Button></Link>
        </div>
      </div>

      {/* Daily risk awareness — soft nudge */}
      <RiskNudge variant="tile" hideWhenOk={false} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Net P&L"
          value={formatCurrency(kpis.netPnl, currency)}
          tone={kpis.netPnl > 0 ? "positive" : kpis.netPnl < 0 ? "negative" : "neutral"}
          sub={`${formatCurrency(kpis.totalFees, currency)} fees`}
          testid="kpi-net-pnl"
        />
        <KpiCard
          label="Win rate"
          value={formatPercent(kpis.winRate)}
          sub={`${kpis.winCount}W / ${kpis.lossCount}L`}
          testid="kpi-win-rate"
        />
        <KpiCard
          label="Profit factor"
          value={isFinite(kpis.profitFactor) ? formatNumber(kpis.profitFactor) : "∞"}
          sub={kpis.profitFactor >= 1.5 ? "Healthy" : kpis.profitFactor >= 1 ? "Marginal" : "Below 1.0"}
          tone={kpis.profitFactor >= 1.5 ? "positive" : kpis.profitFactor >= 1 ? "neutral" : "negative"}
          testid="kpi-profit-factor"
        />
        <KpiCard
          label="Avg R / trade"
          value={formatR(kpis.avgR)}
          sub={`${formatR(kpis.totalR)} total`}
          tone={kpis.avgR > 0 ? "positive" : "negative"}
          testid="kpi-avg-r"
        />
        <KpiCard
          label="Max drawdown"
          value={formatCurrency(-kpis.maxDrawdown, currency)}
          sub={formatPercent(kpis.maxDrawdownPct)}
          tone="negative"
          testid="kpi-max-dd"
        />
        <KpiCard
          label="Course-Score"
          value={`${score} / 100`}
          sub={<span className="flex items-center gap-1"><Award className="w-3 h-3" />{score >= 70 ? "Strong" : score >= 50 ? "Developing" : "Needs work"}</span>}
          tone="primary"
          testid="kpi-score"
        />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Avg win" value={formatCurrency(kpis.avgWin, currency)} tone="positive" />
        <KpiCard label="Avg loss" value={formatCurrency(kpis.avgLoss, currency)} tone="negative" />
        <KpiCard label="Largest win" value={formatCurrency(kpis.largestWin, currency)} tone="positive" />
        <KpiCard label="Largest loss" value={formatCurrency(kpis.largestLoss, currency)} tone="negative" />
        <KpiCard label="Best day" value={formatCurrency(kpis.bestDay, currency)} tone={kpis.bestDay > 0 ? "positive" : "neutral"} />
        <KpiCard
          label="Streak"
          value={kpis.currentStreak === 0 ? "—" : `${Math.abs(kpis.currentStreak)} ${kpis.currentStreak > 0 ? "wins" : "losses"}`}
          tone={kpis.currentStreak > 0 ? "positive" : kpis.currentStreak < 0 ? "negative" : "neutral"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Equity curve</CardTitle>
            <span className="text-xs text-muted-foreground">Cumulative net P&L · {kpis.tradeCount} trades</span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 6 }}
                  formatter={(v: number) => formatCurrency(v, currency)}
                  labelFormatter={(idx) => `Trade #${idx} (${curveData[(idx as number) - 1]?.date ?? ""})`}
                />
                <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#eqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="w-4 h-4" />Calendar — last 12 weeks</CardTitle></CardHeader>
          <CardContent>
            <CalendarHeatmap data={cal} currency={currency} />
          </CardContent>
        </Card>
      </div>

      {/* Daily P&L bar chart + Recent trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Daily P&L (last 30 trading days)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <DailyBars daily={daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent trades</CardTitle>
            <Link href="/trades"><Button variant="ghost" size="sm" data-testid="link-all-trades">All <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recent.map(t => (
                <Link key={t.id} href={`/trades/${t.id}`} data-testid={`recent-${t.id}`}>
                  <div className="flex items-center justify-between px-4 py-2.5 hover-elevate cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={["w-7 h-7 rounded-md flex items-center justify-center", (t.netPnl ?? 0) > 0 ? "bg-primary/15" : (t.netPnl ?? 0) < 0 ? "bg-destructive/15" : "bg-muted"].join(" ")}>
                        {(t.netPnl ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5 pnl-positive" /> : <TrendingDown className="w-3.5 h-3.5 pnl-negative" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.symbol} <span className="text-xs text-muted-foreground font-mono-num">{t.direction === "long" ? "L" : "S"}</span></div>
                        <div className="text-[11px] text-muted-foreground font-mono-num">{t.date} · {t.timeEntry}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={["text-sm font-mono-num font-medium", pnlClass(t.netPnl)].join(" ")}>{t.status === "open" ? <Badge variant="outline">open</Badge> : formatCurrency(t.netPnl, currency)}</div>
                      <div className={["text-[11px] font-mono-num", pnlClass(t.rMultiple)].join(" ")}>{formatR(t.rMultiple)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
        <PlusCircle className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">No trades yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">Log your first trade to see your equity curve, R-distribution, win rate, and Course-Score build up over time.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/trades/new"><Button data-testid="link-empty-new"><PlusCircle className="w-4 h-4 mr-1" />Log first trade</Button></Link>
        <Link href="/journal"><Button variant="outline" data-testid="link-empty-journal">Write today's plan</Button></Link>
      </div>
    </div>
  );
}

// ===== Calendar heatmap (12 weeks × 7 days) =====
interface CalCell { date: string; pnl: number; trades: number; }
function buildCalendar(daily: Record<string, { pnl: number; trades: number; rTotal: number; }>): CalCell[][] {
  const today = new Date();
  // Anchor on Sunday of current week
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  const dayOfWeek = end.getDay(); // 0 = Sun
  end.setDate(end.getDate() - dayOfWeek + 6); // upcoming Saturday
  const weeks = 12;
  const start = new Date(end);
  start.setDate(end.getDate() - (weeks * 7 - 1));

  const cells: CalCell[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const info = daily[iso];
    cells.push({ date: iso, pnl: info?.pnl ?? 0, trades: info?.trades ?? 0 });
  }
  // Build 12 columns (weeks) of 7 days
  const cols: CalCell[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7));
  return cols;
}

function CalendarHeatmap({ data, currency }: { data: CalCell[][]; currency: string }) {
  // Determine intensity scale
  const maxAbs = Math.max(1, ...data.flat().map(c => Math.abs(c.pnl)));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1 text-[9px] text-muted-foreground justify-between py-0.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="h-3 leading-3">{d}</div>)}
        </div>
        {data.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map(cell => {
              const intensity = Math.min(1, Math.abs(cell.pnl) / maxAbs);
              const isToday = cell.date === new Date().toISOString().slice(0, 10);
              const bg = cell.trades === 0
                ? "hsl(var(--muted) / 0.5)"
                : cell.pnl > 0
                  ? `hsl(158 64% ${55 - intensity * 25}% / ${0.35 + intensity * 0.5})`
                  : cell.pnl < 0
                    ? `hsl(0 72% ${60 - intensity * 25}% / ${0.35 + intensity * 0.5})`
                    : "hsl(var(--muted))";
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${formatCurrency(cell.pnl, currency)} (${cell.trades} trades)`}
                  className={["w-3 h-3 rounded-sm", isToday ? "ring-1 ring-primary" : ""].join(" ")}
                  style={{ background: bg }}
                  data-testid={`cal-${cell.date}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-3">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(0 72% 50% / 0.7)" }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(0 72% 60% / 0.4)" }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(var(--muted))" }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(158 64% 60% / 0.4)" }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(158 64% 35% / 0.85)" }} />
        <span>More</span>
      </div>
    </div>
  );
}

function DailyBars({ daily }: { daily: Record<string, { pnl: number; trades: number; rTotal: number; }> }) {
  const entries = Object.entries(daily)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, v]) => ({ date: date.slice(5), pnl: v.pnl }));

  if (entries.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No daily data yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={entries} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 6 }}
          formatter={(v: number) => formatCurrency(v)}
        />
        <Bar dataKey="pnl">
          {entries.map((e, i) => (
            <Cell key={i} fill={e.pnl >= 0 ? "hsl(158 64% 48%)" : "hsl(0 72% 55%)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
