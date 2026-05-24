import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Trade } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { groupBy, rDistribution, pnlByHour, tagKeys, computeKPIs } from "@/lib/stats";
import { formatCurrency, formatR, pnlClass } from "@/lib/format";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const kpis = useMemo(() => computeKPIs(trades), [trades]);

  const bySymbol  = useMemo(() => groupBy(trades, tagKeys.symbol).sort((a, b) => b.pnl - a.pnl), [trades]);
  const bySetup   = useMemo(() => groupBy(trades, tagKeys.setup).sort((a, b) => b.pnl - a.pnl), [trades]);
  const byMistake = useMemo(() => groupBy(trades, tagKeys.mistake).sort((a, b) => a.pnl - b.pnl), [trades]);
  const byDay     = useMemo(() => groupBy(trades, tagKeys.dayOfWeek), [trades]);
  const byHour    = useMemo(() => pnlByHour(trades), [trades]);
  const rDist     = useMemo(() => rDistribution(trades), [trades]);

  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map(d => byDay.find(b => b.key === d) ?? { key: d, pnl: 0, trades: 0, wins: 0, losses: 0, rTotal: 0, winRate: 0, avgR: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Reports</h1>
        <p className="text-sm text-muted-foreground">Cross-cut your edge by symbol, setup, mistake, day, and hour.</p>
      </div>

      {trades.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Log trades to see reports.</CardContent></Card>
      ) : (
        <>
          {/* Top summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Trades" value={kpis.tradeCount} />
            <Stat label="Win rate" value={`${Math.round(kpis.winRate * 100)}%`} />
            <Stat label="Avg R" value={formatR(kpis.avgR)} tone={kpis.avgR} />
            <Stat label="Expectancy" value={formatCurrency(kpis.expectancy)} tone={kpis.expectancy} />
            <Stat label="PF" value={isFinite(kpis.profitFactor) ? kpis.profitFactor.toFixed(2) : "∞"} />
          </div>

          {/* R distribution */}
          <Card>
            <CardHeader><CardTitle className="text-base">R-multiple distribution</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rDist} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 6 }} />
                  <Bar dataKey="count">
                    {rDist.map((b, i) => (
                      <Cell key={i} fill={b.bucket.startsWith("-") || b.bucket.startsWith("≤") ? "hsl(0 72% 55%)" : "hsl(158 64% 48%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Two-column reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TagReport title="P&L by symbol" rows={bySymbol} testid="report-symbol" />
            <TagReport title="Best setups" rows={bySetup} testid="report-setup" highlight="best" />
            <TagReport title="Worst mistakes" rows={byMistake} testid="report-mistake" highlight="worst" />
            <Card>
              <CardHeader><CardTitle className="text-base">By day of week</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderedDays} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="key" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 6 }} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="pnl">
                      {orderedDays.map((d, i) => (
                        <Cell key={i} fill={d.pnl >= 0 ? "hsl(158 64% 48%)" : "hsl(0 72% 55%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">P&L by entry hour (ET)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byHour} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 6 }} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="pnl">
                    {byHour.map((b, i) => (
                      <Cell key={i} fill={b.pnl >= 0 ? "hsl(158 64% 48%)" : "hsl(0 72% 55%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={["text-lg font-semibold font-mono-num mt-1", tone != null ? pnlClass(tone) : ""].join(" ")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TagReport({ title, rows, testid, highlight }: {
  title: string;
  rows: { key: string; pnl: number; trades: number; wins: number; losses: number; winRate: number; avgR: number; }[];
  testid: string;
  highlight?: "best" | "worst";
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">No data yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.slice(0, 8).map((r, i) => (
              <div key={r.key} className="px-4 py-2 flex items-center justify-between gap-3" data-testid={`${testid}-row-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.key}</div>
                  <div className="text-[11px] text-muted-foreground font-mono-num">{r.trades} trades · {Math.round(r.winRate * 100)}% wins · {formatR(r.avgR)} avg</div>
                </div>
                <div className={["text-sm font-mono-num font-medium", pnlClass(r.pnl)].join(" ")}>{formatCurrency(r.pnl)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
