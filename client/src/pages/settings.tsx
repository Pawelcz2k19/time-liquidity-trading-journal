import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save, Download, Upload, AlertTriangle } from "lucide-react";
import { SYMBOL_PRESETS } from "@/lib/format";
import type { Settings } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [form, setForm] = useState({
    accountSize: 50000,
    rptPercent: 1,
    defaultSymbol: "NQ",
    defaultPointValue: 20,
    defaultFeePerContract: 0.85,
    currency: "USD",
    timezone: "America/New_York",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        accountSize: settings.accountSize,
        rptPercent: settings.rptPercent,
        defaultSymbol: settings.defaultSymbol,
        defaultPointValue: settings.defaultPointValue,
        defaultFeePerContract: settings.defaultFeePerContract,
        currency: settings.currency,
        timezone: settings.timezone,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/settings", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
    },
  });

  async function handleExport() {
    try {
      const res = await fetch("/api/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message, variant: "destructive" });
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm(`This will REPLACE all current data with the contents of ${file.name}. Continue?`)) {
        return;
      }
      await apiRequest("POST", "/api/import", data);
      queryClient.invalidateQueries();
      toast({ title: "Backup imported", description: "All data has been restored from the file." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message, variant: "destructive" });
    }
  }

  function applySymbolPreset(symbol: string) {
    const preset = SYMBOL_PRESETS[symbol as keyof typeof SYMBOL_PRESETS];
    if (preset) {
      setForm((f) => ({
        ...f,
        defaultSymbol: symbol,
        defaultPointValue: preset.pointValue,
        defaultFeePerContract: preset.fee,
      }));
    } else {
      setForm((f) => ({ ...f, defaultSymbol: symbol }));
    }
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  const riskPerTrade = (form.accountSize * form.rptPercent) / 100;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure account size, risk, defaults, and manage your data backups.
        </p>
      </div>

      {/* Account & Risk */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account & Risk</CardTitle>
          <CardDescription>
            Used to compute risk-per-trade ($), suggested position size and Course-Score risk component.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Account Size ($)</Label>
              <Input
                type="number"
                value={form.accountSize}
                onChange={(e) => setForm({ ...form, accountSize: Number(e.target.value) })}
                data-testid="input-account-size"
              />
            </div>
            <div>
              <Label>Risk per Trade (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.rptPercent}
                onChange={(e) => setForm({ ...form, rptPercent: Number(e.target.value) })}
                data-testid="input-rpt-percent"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="PLN">PLN (zł)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md bg-primary/10 border border-primary/20 p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Calculated Risk per Trade</div>
            <div className="text-2xl font-semibold font-mono-num text-primary" data-testid="text-calculated-risk">
              ${riskPerTrade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {form.rptPercent}% × ${form.accountSize.toLocaleString()} account
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trade Defaults</CardTitle>
          <CardDescription>Auto-fill values when adding a new trade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Default Symbol</Label>
              <Select value={form.defaultSymbol} onValueChange={applySymbolPreset}>
                <SelectTrigger data-testid="select-default-symbol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SYMBOL_PRESETS).map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Point Value ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.defaultPointValue}
                onChange={(e) => setForm({ ...form, defaultPointValue: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Fee per Contract ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.defaultFeePerContract}
                onChange={(e) => setForm({ ...form, defaultFeePerContract: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">America/New_York (ET) — market hours</SelectItem>
                <SelectItem value="America/Chicago">America/Chicago (CT)</SelectItem>
                <SelectItem value="Europe/Warsaw">Europe/Warsaw (CET/CEST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <Separator />

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription>
            Export your entire journal as a JSON backup, or restore from one. Use this to migrate between devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExport} data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export Backup (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
              <Upload className="h-4 w-4 mr-2" />
              Import Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-destructive/10 border border-destructive/20 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <strong className="text-destructive">Warning:</strong> Importing a backup REPLACES all current trades, journal
              entries, playbooks and settings. Export first if you want to preserve current data.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Time-Liquidity Trading Journal</strong> — companion app to the
            Time-Liquidity course. Optimized for NQ/MNQ futures and the 9:30–10:15 ET window.
          </p>
          <p>Course-Score: 30 profitability + 30 rule-compliance + 20 risk + 20 journaling.</p>
        </CardContent>
      </Card>
    </div>
  );
}
