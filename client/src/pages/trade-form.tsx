import { useEffect, useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Trade, Playbook, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskNudge } from "@/components/risk-nudge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/tag-input";
import { formatCurrency, formatR, parseTags, stringifyTags, SETUP_TAGS, MISTAKE_TAGS, EMOTION_TAGS, SYMBOL_PRESETS, pnlClass } from "@/lib/format";
import { ArrowLeft, Save, Trash2, Camera, Star } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

interface FormState {
  date: string;
  timeEntry: string;
  timeExit: string;
  symbol: string;
  direction: "long" | "short";
  status: "open" | "closed";
  entryPrice: string;
  exitPrice: string;
  stopPrice: string;
  targetPrice: string;
  quantity: string;
  pointValue: string;
  feesTotal: string;
  playbookId: number | null;
  setupTags: string[];
  mistakeTags: string[];
  emotionTags: string[];
  withinWindow: boolean;
  followedPlan: boolean;
  fourFourCheck: boolean;
  movedStopTooEarly: boolean;
  scaledProperly: boolean;
  rating: number;
  notes: string;
  screenshotUrl: string | null;
}

function emptyForm(s?: Settings): FormState {
  return {
    date: todayISO(),
    timeEntry: nowHM(),
    timeExit: "",
    symbol: s?.defaultSymbol ?? "MNQ",
    direction: "long",
    status: "closed",
    entryPrice: "",
    exitPrice: "",
    stopPrice: "",
    targetPrice: "",
    quantity: "1",
    pointValue: String(s?.defaultPointValue ?? 2),
    feesTotal: "0",
    playbookId: null,
    setupTags: [],
    mistakeTags: [],
    emotionTags: [],
    withinWindow: true,
    followedPlan: true,
    fourFourCheck: false,
    movedStopTooEarly: false,
    scaledProperly: false,
    rating: 0,
    notes: "",
    screenshotUrl: null,
  };
}

export default function TradeForm() {
  const params = useParams<{ id?: string }>();
  const tradeId = params.id && params.id !== "new" ? Number(params.id) : null;
  const isEdit = tradeId != null;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: existingTrade } = useQuery<Trade>({
    queryKey: ["/api/trades", tradeId],
    enabled: isEdit,
  });
  const { data: playbooks = [] } = useQuery<Playbook[]>({ queryKey: ["/api/playbooks"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const [form, setForm] = useState<FormState>(emptyForm());
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (existingTrade) {
      setForm({
        date: existingTrade.date,
        timeEntry: existingTrade.timeEntry,
        timeExit: existingTrade.timeExit ?? "",
        symbol: existingTrade.symbol,
        direction: existingTrade.direction as "long" | "short",
        status: existingTrade.status as "open" | "closed",
        entryPrice: String(existingTrade.entryPrice),
        exitPrice: existingTrade.exitPrice != null ? String(existingTrade.exitPrice) : "",
        stopPrice: String(existingTrade.stopPrice),
        targetPrice: existingTrade.targetPrice != null ? String(existingTrade.targetPrice) : "",
        quantity: String(existingTrade.quantity),
        pointValue: String(existingTrade.pointValue),
        feesTotal: String(existingTrade.feesTotal ?? 0),
        playbookId: existingTrade.playbookId ?? null,
        setupTags: parseTags(existingTrade.setupTags),
        mistakeTags: parseTags(existingTrade.mistakeTags),
        emotionTags: parseTags(existingTrade.emotionTags),
        withinWindow: !!existingTrade.withinWindow,
        followedPlan: !!existingTrade.followedPlan,
        fourFourCheck: !!existingTrade.fourFourCheck,
        movedStopTooEarly: !!existingTrade.movedStopTooEarly,
        scaledProperly: !!existingTrade.scaledProperly,
        rating: existingTrade.rating ?? 0,
        notes: existingTrade.notes ?? "",
        screenshotUrl: existingTrade.screenshotUrl ?? null,
      });
    } else if (settings && !isEdit) {
      setForm(emptyForm(settings));
    }
  }, [existingTrade, settings, isEdit]);

  // Live derived values
  const derived = useMemo(() => {
    const entry = parseFloat(form.entryPrice);
    const stop = parseFloat(form.stopPrice);
    const exit = parseFloat(form.exitPrice);
    const qty = parseFloat(form.quantity);
    const pv = parseFloat(form.pointValue);
    const fees = parseFloat(form.feesTotal) || 0;
    if (isNaN(entry) || isNaN(stop) || isNaN(qty) || isNaN(pv) || qty <= 0 || pv <= 0) {
      return { risk: null, rR: null, gross: null, net: null, points: null };
    }
    const dir = form.direction === "long" ? 1 : -1;
    const riskPts = Math.abs(entry - stop);
    const risk = riskPts * pv * qty;
    if (isNaN(exit) || form.exitPrice === "") {
      return { risk, rR: null, gross: null, net: null, points: null };
    }
    const points = (exit - entry) * dir;
    const gross = points * pv * qty;
    const net = gross - fees;
    const rR = riskPts > 0 ? points / riskPts : 0;
    return { risk, rR, gross, net, points };
  }, [form.entryPrice, form.stopPrice, form.exitPrice, form.quantity, form.pointValue, form.feesTotal, form.direction]);

  // Suggested position size based on account & RPT
  const suggestedSize = useMemo(() => {
    if (!settings) return null;
    const entry = parseFloat(form.entryPrice);
    const stop = parseFloat(form.stopPrice);
    const pv = parseFloat(form.pointValue);
    if (isNaN(entry) || isNaN(stop) || isNaN(pv) || pv <= 0) return null;
    const riskPts = Math.abs(entry - stop);
    if (riskPts === 0) return null;
    const riskDollars = (settings.accountSize ?? 10000) * ((settings.rptPercent ?? 1) / 100);
    return riskDollars / (riskPts * pv);
  }, [form.entryPrice, form.stopPrice, form.pointValue, settings]);

  function payload() {
    return {
      date: form.date,
      timeEntry: form.timeEntry,
      timeExit: form.timeExit || null,
      symbol: form.symbol,
      direction: form.direction,
      status: form.status,
      entryPrice: parseFloat(form.entryPrice),
      exitPrice: form.exitPrice === "" ? null : parseFloat(form.exitPrice),
      stopPrice: parseFloat(form.stopPrice),
      targetPrice: form.targetPrice === "" ? null : parseFloat(form.targetPrice),
      quantity: parseFloat(form.quantity),
      pointValue: parseFloat(form.pointValue),
      feesTotal: parseFloat(form.feesTotal) || 0,
      playbookId: form.playbookId,
      setupTags: stringifyTags(form.setupTags),
      mistakeTags: stringifyTags(form.mistakeTags),
      emotionTags: stringifyTags(form.emotionTags),
      withinWindow: form.withinWindow ? 1 : 0,
      followedPlan: form.followedPlan ? 1 : 0,
      fourFourCheck: form.fourFourCheck ? 1 : 0,
      movedStopTooEarly: form.movedStopTooEarly ? 1 : 0,
      scaledProperly: form.scaledProperly ? 1 : 0,
      rating: form.rating,
      notes: form.notes,
      screenshotUrl: form.screenshotUrl,
    };
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return apiRequest("PATCH", `/api/trades/${tradeId}`, payload());
      }
      return apiRequest("POST", "/api/trades", payload());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: isEdit ? "Trade updated" : "Trade saved", description: "Your journal has been updated." });
      navigate("/trades");
    },
    onError: (err: any) => toast({ title: "Save failed", description: String(err?.message ?? err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/trades/${tradeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Trade deleted" });
      navigate("/trades");
    },
  });

  function onSymbolChange(sym: string) {
    update("symbol", sym);
    const preset = SYMBOL_PRESETS.find(s => s.symbol === sym);
    if (preset) update("pointValue", String(preset.pointValue));
  }

  function onScreenshot(file: File | null) {
    if (!file) { update("screenshotUrl", null); return; }
    const reader = new FileReader();
    reader.onload = () => update("screenshotUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/trades")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold">{isEdit ? "Edit trade" : "New trade"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} data-testid="button-delete">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.entryPrice || !form.stopPrice || !form.quantity} data-testid="button-save">
            <Save className="w-4 h-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save trade"}
          </Button>
        </div>
      </div>

      {!isEdit && <RiskNudge variant="banner" hideWhenOk={true} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Instrument & timing</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => update("date", e.target.value)} data-testid="input-date" />
              </div>
              <div>
                <Label>Entry (ET)</Label>
                <Input type="time" value={form.timeEntry} onChange={e => update("timeEntry", e.target.value)} data-testid="input-time-entry" />
              </div>
              <div>
                <Label>Exit (ET)</Label>
                <Input type="time" value={form.timeExit} onChange={e => update("timeExit", e.target.value)} data-testid="input-time-exit" />
              </div>
              <div>
                <Label>Symbol</Label>
                <Select value={form.symbol} onValueChange={onSymbolChange}>
                  <SelectTrigger data-testid="select-symbol"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYMBOL_PRESETS.map(s => (
                      <SelectItem key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={form.direction} onValueChange={v => update("direction", v as any)}>
                  <SelectTrigger data-testid="select-direction"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => update("status", v as any)}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity (contracts)</Label>
                <Input type="number" min="0" step="0.1" value={form.quantity} onChange={e => update("quantity", e.target.value)} data-testid="input-quantity" />
              </div>
              <div>
                <Label>$ per point</Label>
                <Input type="number" min="0" step="0.1" value={form.pointValue} onChange={e => update("pointValue", e.target.value)} data-testid="input-pv" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Prices</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Entry price</Label>
                <Input type="number" step="0.01" value={form.entryPrice} onChange={e => update("entryPrice", e.target.value)} data-testid="input-entry" />
              </div>
              <div>
                <Label>Stop price</Label>
                <Input type="number" step="0.01" value={form.stopPrice} onChange={e => update("stopPrice", e.target.value)} data-testid="input-stop" />
              </div>
              <div>
                <Label>Target price (optional)</Label>
                <Input type="number" step="0.01" value={form.targetPrice} onChange={e => update("targetPrice", e.target.value)} data-testid="input-target" />
              </div>
              <div>
                <Label>Exit price</Label>
                <Input type="number" step="0.01" value={form.exitPrice} onChange={e => update("exitPrice", e.target.value)} data-testid="input-exit" />
              </div>
              <div>
                <Label>Fees total ($)</Label>
                <Input type="number" step="0.01" value={form.feesTotal} onChange={e => update("feesTotal", e.target.value)} data-testid="input-fees" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Setup & playbook</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Playbook</Label>
                <Select
                  value={form.playbookId == null ? "none" : String(form.playbookId)}
                  onValueChange={v => update("playbookId", v === "none" ? null : Number(v))}
                >
                  <SelectTrigger data-testid="select-playbook"><SelectValue placeholder="Select a playbook..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(no playbook)</SelectItem>
                    {playbooks.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setup tags</Label>
                <TagInput value={form.setupTags} onChange={v => update("setupTags", v)} suggestions={SETUP_TAGS} placeholder="VWAP reclaim..." testIdPrefix="setup-tag" variant="secondary" />
              </div>
              <div>
                <Label>Mistake tags</Label>
                <TagInput value={form.mistakeTags} onChange={v => update("mistakeTags", v)} suggestions={MISTAKE_TAGS} placeholder="FOMO entry..." testIdPrefix="mistake-tag" variant="destructive" />
              </div>
              <div>
                <Label>Emotion tags</Label>
                <TagInput value={form.emotionTags} onChange={v => update("emotionTags", v)} suggestions={EMOTION_TAGS} placeholder="Calm..." testIdPrefix="emotion-tag" variant="secondary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Rule compliance (Module 12)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { k: "withinWindow",       label: "Within 9:30–10:15 ET window" },
                { k: "followedPlan",       label: "Followed pre-market plan" },
                { k: "fourFourCheck",      label: "4/4 confirmation fired" },
                { k: "scaledProperly",     label: "Scaled 20→50→100 correctly" },
                { k: "movedStopTooEarly",  label: "Moved stop too early (mistake)" },
              ].map(item => (
                <label key={item.k} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border" data-testid={`rule-${item.k}`}>
                  <span className="text-sm">{item.label}</span>
                  <Switch
                    checked={form[item.k as keyof FormState] as boolean}
                    onCheckedChange={v => update(item.k as keyof FormState, v as any)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes & screenshot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Notes</Label>
                <Textarea rows={5} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="What happened? What did you see? How did you feel?" data-testid="input-notes" />
              </div>
              <div>
                <Label>Trade rating</Label>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => update("rating", form.rating === n ? 0 : n)}
                      className="p-1"
                      data-testid={`rating-star-${n}`}
                    >
                      <Star className={["w-5 h-5", n <= form.rating ? "fill-primary text-primary" : "text-muted-foreground"].join(" ")} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Chart screenshot</Label>
                <div className="flex flex-col gap-2">
                  <Input type="file" accept="image/*" onChange={e => onScreenshot(e.target.files?.[0] ?? null)} data-testid="input-screenshot" />
                  {form.screenshotUrl && (
                    <div className="relative">
                      <img src={form.screenshotUrl} alt="Trade screenshot" className="rounded-md border border-border max-h-72 object-contain" />
                      <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => update("screenshotUrl", null)} data-testid="button-remove-screenshot">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live calculation panel */}
        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader><CardTitle className="text-base">Live calculation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Row label="Initial risk" value={derived.risk == null ? "—" : formatCurrency(derived.risk)} testid="calc-risk" />
              <Row label="Points result" value={derived.points == null ? "—" : derived.points.toFixed(2)} testid="calc-points" />
              <Row label="R-multiple" value={derived.rR == null ? "—" : formatR(derived.rR)} testid="calc-r" tone={derived.rR} />
              <Separator />
              <Row label="Gross P&L" value={derived.gross == null ? "—" : formatCurrency(derived.gross)} testid="calc-gross" tone={derived.gross} />
              <Row label="Fees" value={derived.gross == null ? "—" : formatCurrency(parseFloat(form.feesTotal) || 0)} testid="calc-fees" />
              <Row label="Net P&L" value={derived.net == null ? "—" : formatCurrency(derived.net)} testid="calc-net" tone={derived.net} big />
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>Account-suggested size:</span><span className="font-mono-num text-foreground" data-testid="calc-suggested-size">{suggestedSize == null ? "—" : suggestedSize.toFixed(2)} contracts</span></div>
                <div className="text-[10px]">Based on {settings?.rptPercent ?? 1}% of {formatCurrency(settings?.accountSize ?? 10000, settings?.currency ?? "USD")}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone, big, testid }: { label: string; value: any; tone?: number | null; big?: boolean; testid?: string }) {
  const cls = tone == null ? "" : pnlClass(tone);
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={[big ? "text-lg font-semibold" : "text-sm", "font-mono-num", cls].join(" ")} data-testid={testid}>{value}</span>
    </div>
  );
}
