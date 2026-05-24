import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntry, Trade } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatR, pnlClass } from "@/lib/format";
import { computeKPIs } from "@/lib/stats";
import { Save, ChevronLeft, ChevronRight, Smile, Meh, Frown, Sun, BookOpen } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);

interface FormState {
  bias: string;
  triggerZone: string;
  stopOutRules: string;
  checkedNews: boolean;
  reviewedHTF: boolean;
  markedLevels: boolean;
  notedONH_ONL: boolean;
  setAlerts: boolean;
  whatWorked: string;
  whatToImprove: string;
  biggestMistake: string;
  oneThingTomorrow: string;
  flatBy1015: boolean;
  respected3R: boolean;
  threeIdeaMax: boolean;
  mood: number;
}

const empty: FormState = {
  bias: "", triggerZone: "", stopOutRules: "",
  checkedNews: false, reviewedHTF: false, markedLevels: false, notedONH_ONL: false, setAlerts: false,
  whatWorked: "", whatToImprove: "", biggestMistake: "", oneThingTomorrow: "",
  flatBy1015: false, respected3R: false, threeIdeaMax: false,
  mood: 3,
};

export default function JournalPage() {
  const [date, setDate] = useState(todayISO());
  const { toast } = useToast();
  const { data: entry } = useQuery<JournalEntry | null>({ queryKey: ["/api/journals/by-date", date] });
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { data: allJournals = [] } = useQuery<JournalEntry[]>({ queryKey: ["/api/journals"] });

  const [form, setForm] = useState<FormState>(empty);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (entry) {
      setForm({
        bias: entry.bias ?? "",
        triggerZone: entry.triggerZone ?? "",
        stopOutRules: entry.stopOutRules ?? "",
        checkedNews: !!entry.checkedNews,
        reviewedHTF: !!entry.reviewedHTF,
        markedLevels: !!entry.markedLevels,
        notedONH_ONL: !!entry.notedONH_ONL,
        setAlerts: !!entry.setAlerts,
        whatWorked: entry.whatWorked ?? "",
        whatToImprove: entry.whatToImprove ?? "",
        biggestMistake: entry.biggestMistake ?? "",
        oneThingTomorrow: entry.oneThingTomorrow ?? "",
        flatBy1015: !!entry.flatBy1015,
        respected3R: !!entry.respected3R,
        threeIdeaMax: !!entry.threeIdeaMax,
        mood: entry.mood ?? 3,
      });
    } else {
      setForm(empty);
    }
  }, [entry, date]);

  const dayTrades = useMemo(() => trades.filter(t => t.date === date), [trades, date]);
  const dayKpis = useMemo(() => computeKPIs(dayTrades), [dayTrades]);

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/journals", {
      date,
      ...form,
      checkedNews: form.checkedNews ? 1 : 0,
      reviewedHTF: form.reviewedHTF ? 1 : 0,
      markedLevels: form.markedLevels ? 1 : 0,
      notedONH_ONL: form.notedONH_ONL ? 1 : 0,
      setAlerts: form.setAlerts ? 1 : 0,
      flatBy1015: form.flatBy1015 ? 1 : 0,
      respected3R: form.respected3R ? 1 : 0,
      threeIdeaMax: form.threeIdeaMax ? 1 : 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journals/by-date", date] });
      toast({ title: "Journal saved" });
    },
  });

  function shiftDay(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  const MoodIcon = form.mood >= 4 ? Smile : form.mood <= 2 ? Frown : Meh;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5" /> Daily journal</h1>
          <p className="text-sm text-muted-foreground">Module 12 pre-market plan and post-session review</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} data-testid="button-prev-day"><ChevronLeft className="w-4 h-4" /></Button>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[160px]" data-testid="input-journal-date" />
          <Button variant="outline" size="icon" onClick={() => shiftDay(1)} data-testid="button-next-day"><ChevronRight className="w-4 h-4" /></Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-journal">
            <Save className="w-4 h-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="premarket" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="premarket" data-testid="tab-premarket">Pre-market plan</TabsTrigger>
              <TabsTrigger value="review" data-testid="tab-review">Post-session review</TabsTrigger>
            </TabsList>

            <TabsContent value="premarket" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">The three sentences (write by 9:30 ET)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>1. Bias</Label>
                    <Textarea rows={2} value={form.bias} onChange={e => update("bias", e.target.value)} placeholder='e.g. "Long bias — overnight ranged above prior day high, 1H structure intact, SPY confirming."' data-testid="input-bias" />
                  </div>
                  <div>
                    <Label>2. Trigger zone</Label>
                    <Textarea rows={2} value={form.triggerZone} onChange={e => update("triggerZone", e.target.value)} placeholder='e.g. "Long on VWAP reclaim around 20,840 with 4/4 confirmation. No entry above 20,920."' data-testid="input-trigger" />
                  </div>
                  <div>
                    <Label>3. Stop-out rules</Label>
                    <Textarea rows={2} value={form.stopOutRules} onChange={e => update("stopOutRules", e.target.value)} placeholder='e.g. "Two stops at the level = done. Max 3 ideas. Hard flat by 10:15 ET. -3R = shut down."' data-testid="input-stopout" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Pre-market checklist</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {([
                    ["checkedNews", "Checked economic calendar — no major event 9:30–9:45"],
                    ["reviewedHTF", "Reviewed 1H/4H higher-timeframe structure"],
                    ["markedLevels", "Marked key levels (POC, VWAP, IB, prior day H/L)"],
                    ["notedONH_ONL", "Noted overnight high (ONH) and overnight low (ONL)"],
                    ["setAlerts", "Set price alerts at trigger zones"],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border" data-testid={`pre-${k}`}>
                      <span className="text-sm">{label}</span>
                      <Switch checked={form[k]} onCheckedChange={v => update(k, v as any)} />
                    </label>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="review" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Reflection (write 10:15–10:45 ET)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>What worked today</Label>
                    <Textarea rows={3} value={form.whatWorked} onChange={e => update("whatWorked", e.target.value)} data-testid="input-worked" />
                  </div>
                  <div>
                    <Label>What to improve tomorrow</Label>
                    <Textarea rows={3} value={form.whatToImprove} onChange={e => update("whatToImprove", e.target.value)} data-testid="input-improve" />
                  </div>
                  <div>
                    <Label>Biggest mistake today</Label>
                    <Textarea rows={2} value={form.biggestMistake} onChange={e => update("biggestMistake", e.target.value)} data-testid="input-mistake" />
                  </div>
                  <div>
                    <Label>One thing to do better tomorrow</Label>
                    <Textarea rows={2} value={form.oneThingTomorrow} onChange={e => update("oneThingTomorrow", e.target.value)} data-testid="input-tomorrow" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Discipline check</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {([
                    ["flatBy1015", "Flat by 10:15 ET (hard cutoff)"],
                    ["respected3R", "Respected −3R daily loss limit"],
                    ["threeIdeaMax", "Stayed within 3-idea max"],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border" data-testid={`disc-${k}`}>
                      <span className="text-sm">{label}</span>
                      <Switch checked={form[k]} onCheckedChange={v => update(k, v as any)} />
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border md:col-span-2">
                    <Label className="m-0">Mood</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => update("mood", n)}
                          className={["w-7 h-7 rounded-md text-sm font-mono-num flex items-center justify-center", form.mood === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover-elevate"].join(" ")}
                          data-testid={`mood-${n}`}
                        >{n}</button>
                      ))}
                      <MoodIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column — today's stats + recent journals */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sun className="w-4 h-4" /> Today's performance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Trades" value={dayKpis.tradeCount} />
              <Row label="Net P&L" value={formatCurrency(dayKpis.netPnl)} tone={dayKpis.netPnl} />
              <Row label="R total" value={formatR(dayKpis.totalR)} tone={dayKpis.totalR} />
              <Row label="Win rate" value={dayKpis.tradeCount ? `${Math.round(dayKpis.winRate * 100)}%` : "—"} />
              <Separator className="my-2" />
              <div className="text-xs text-muted-foreground">Trades logged for {date}</div>
              {dayTrades.length === 0 && <div className="text-xs italic text-muted-foreground">No trades for this day.</div>}
              {dayTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                  <span className="font-mono-num">{t.timeEntry} · {t.symbol} {t.direction === "long" ? "L" : "S"}</span>
                  <span className={["font-mono-num", pnlClass(t.netPnl)].join(" ")}>{formatR(t.rMultiple)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent journals</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {allJournals.slice(0, 8).map(j => (
                  <button
                    key={j.id}
                    onClick={() => setDate(j.date)}
                    className="w-full text-left px-4 py-2 hover-elevate"
                    data-testid={`journal-recent-${j.date}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-mono-num">{j.date}</div>
                      <Badge variant="outline" className="text-[10px]">mood {j.mood}/5</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{j.bias || "(no bias set)"}</div>
                  </button>
                ))}
                {allJournals.length === 0 && (
                  <div className="px-4 py-6 text-xs text-muted-foreground text-center">No journal entries yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: any; tone?: number | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={["font-mono-num", tone != null ? pnlClass(tone) : ""].join(" ")}>{value}</span>
    </div>
  );
}
