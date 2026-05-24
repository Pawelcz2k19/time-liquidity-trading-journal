import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Trade } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatR, parseTags, pnlClass } from "@/lib/format";
import { PlusCircle, Search, Pencil, ArrowUpDown, Filter } from "lucide-react";
import { ImportFromImageButton } from "@/components/import-from-image";

type SortKey = "date" | "symbol" | "netPnl" | "rMultiple";
type SortDir = "asc" | "desc";

export default function TradesPage() {
  const { data: trades = [], isLoading } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("all");
  const [direction, setDirection] = useState("all");
  const [result, setResult] = useState("all"); // wins/losses/scratches
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const symbols = useMemo(() => Array.from(new Set(trades.map(t => t.symbol))).sort(), [trades]);

  const filtered = useMemo(() => {
    let out = trades;
    if (symbol !== "all") out = out.filter(t => t.symbol === symbol);
    if (direction !== "all") out = out.filter(t => t.direction === direction);
    if (result === "wins") out = out.filter(t => (t.netPnl ?? 0) > 0);
    if (result === "losses") out = out.filter(t => (t.netPnl ?? 0) < 0);
    if (result === "scratches") out = out.filter(t => (t.netPnl ?? 0) === 0 && t.status === "closed");
    if (result === "open") out = out.filter(t => t.status === "open");
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(t =>
        t.symbol.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q) ||
        parseTags(t.setupTags).some(x => x.toLowerCase().includes(q)) ||
        parseTags(t.mistakeTags).some(x => x.toLowerCase().includes(q))
      );
    }
    out = [...out].sort((a, b) => {
      let av: any = a[sortKey], bv: any = b[sortKey];
      if (sortKey === "date") {
        av = a.date + a.timeEntry; bv = b.date + b.timeEntry;
      }
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [trades, search, symbol, direction, result, sortKey, sortDir]);

  const delMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/trades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Trade deleted" });
    },
  });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  // Filter summary
  const summary = useMemo(() => {
    const closed = filtered.filter(t => t.status === "closed");
    const net = closed.reduce((s, t) => s + (t.netPnl ?? 0), 0);
    const wins = closed.filter(t => (t.netPnl ?? 0) > 0).length;
    const r = closed.reduce((s, t) => s + (t.rMultiple ?? 0), 0);
    return { count: closed.length, net, winRate: closed.length ? wins / closed.length : 0, r };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Trade log</h1>
          <p className="text-sm text-muted-foreground">{trades.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportFromImageButton />
          <Link href="/trades/new" data-testid="link-new-trade-top">
            <Button><PlusCircle className="w-4 h-4 mr-1" /> New trade</Button>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search symbol, notes, tags..."
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-[120px]" data-testid="filter-symbol"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All symbols</SelectItem>
              {symbols.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="w-[110px]" data-testid="filter-direction"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">L/S</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className="w-[120px]" data-testid="filter-result"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="wins">Wins</SelectItem>
              <SelectItem value="losses">Losses</SelectItem>
              <SelectItem value="scratches">Scratch</SelectItem>
              <SelectItem value="open">Open</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Filtered total:</span>
            <span className={["font-mono-num font-medium", pnlClass(summary.net)].join(" ")} data-testid="text-filter-pnl">{formatCurrency(summary.net)}</span>
            <span className={["font-mono-num", pnlClass(summary.r)].join(" ")} data-testid="text-filter-r">{formatR(summary.r)} total</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("date")}>
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("symbol")}>Symbol</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead className="text-right">Entry / Exit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("rMultiple")}>R</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("netPnl")}>Net P&L</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No trades match. <Link href="/trades/new" className="underline">Log your first trade</Link>.
                </TableCell></TableRow>
              )}
              {filtered.map(t => {
                const setups = parseTags(t.setupTags);
                const mistakes = parseTags(t.mistakeTags);
                return (
                  <TableRow key={t.id} data-testid={`row-trade-${t.id}`}>
                    <TableCell className="font-mono-num">{t.date}</TableCell>
                    <TableCell className="font-mono-num text-xs text-muted-foreground">{t.timeEntry}{t.timeExit ? `–${t.timeExit}` : ""}</TableCell>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={t.direction === "long" ? "default" : "secondary"} className="font-mono-num">{t.direction}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono-num text-xs">{t.entryPrice.toFixed(2)} / {t.exitPrice != null ? t.exitPrice.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right font-mono-num">{t.quantity}</TableCell>
                    <TableCell className={["text-right font-mono-num", pnlClass(t.rMultiple)].join(" ")}>{formatR(t.rMultiple)}</TableCell>
                    <TableCell className={["text-right font-mono-num font-medium", pnlClass(t.netPnl)].join(" ")} data-testid={`pnl-${t.id}`}>
                      {t.status === "open" ? <Badge variant="outline">open</Badge> : formatCurrency(t.netPnl)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {setups.slice(0, 2).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                        {mistakes.slice(0, 1).map(m => <Badge key={m} variant="destructive" className="text-[10px]">{m}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/trades/${t.id}`} data-testid={`edit-${t.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3 h-3" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
