import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, TrendingDown, X } from "lucide-react";
import { useState } from "react";
import { computeRiskStatus, type RiskStatus } from "@/lib/stats";
import { formatCurrency, formatR } from "@/lib/format";
import type { Trade, Settings } from "@shared/schema";

interface Props {
  /** Show as a compact dashboard tile (default) or a wider trade-form banner. */
  variant?: "tile" | "banner";
  /** Hide entirely when status is "ok". Default: false for tile, true for banner. */
  hideWhenOk?: boolean;
}

export function RiskNudge({ variant = "tile", hideWhenOk }: Props) {
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const [dismissed, setDismissed] = useState(false);

  if (!settings || settings.riskNudgesEnabled === false) return null;

  const status = computeRiskStatus(trades, {
    dailyLimitR: settings.dailyLossLimitR ?? -2,
    maxLosses: settings.maxConsecutiveLosses ?? 3,
  });

  const shouldHide = hideWhenOk ?? variant === "banner";
  if (status.level === "ok" && shouldHide) return null;
  if (dismissed) return null;

  if (variant === "banner") {
    return <RiskBanner status={status} onDismiss={() => setDismissed(true)} />;
  }
  return <RiskTile status={status} />;
}

function toneClasses(level: RiskStatus["level"]) {
  switch (level) {
    case "alert":
      return {
        wrap: "border-destructive/40 bg-destructive/10",
        accent: "text-destructive",
        chip: "bg-destructive/20 text-destructive",
        icon: AlertTriangle,
      };
    case "caution":
      return {
        wrap: "border-amber-500/40 bg-amber-500/10",
        accent: "text-amber-500",
        chip: "bg-amber-500/20 text-amber-500",
        icon: TrendingDown,
      };
    default:
      return {
        wrap: "border-border bg-muted/30",
        accent: "text-muted-foreground",
        chip: "bg-muted text-muted-foreground",
        icon: Info,
      };
  }
}

function RiskTile({ status }: { status: RiskStatus }) {
  const t = toneClasses(status.level);
  const Icon = t.icon;
  const limitProgress = status.dailyLimitR === 0 ? 0 : Math.min(1, Math.max(0, status.todayR / status.dailyLimitR));

  return (
    <div className={`rounded-lg border p-4 ${t.wrap}`} data-testid="risk-nudge-tile">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${t.accent}`} />
          <span className="text-xs font-medium uppercase tracking-wider">Today's Risk</span>
        </div>
        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${t.chip}`}>
          {status.level === "ok" ? "On Track" : status.level === "caution" ? "Heads Up" : "Consider Stopping"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">R Today</div>
          <div className={`text-lg font-semibold font-mono-num ${status.todayR < 0 ? "pnl-negative" : status.todayR > 0 ? "pnl-positive" : ""}`}>
            {formatR(status.todayR)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">limit {status.dailyLimitR}R</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">P&amp;L Today</div>
          <div className={`text-lg font-semibold font-mono-num ${status.todayPnl < 0 ? "pnl-negative" : status.todayPnl > 0 ? "pnl-positive" : ""}`}>
            {formatCurrency(status.todayPnl)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{status.todayTrades} trades</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Loss Streak</div>
          <div className={`text-lg font-semibold font-mono-num ${status.consecutiveLosses >= status.maxLosses ? t.accent : ""}`}>
            {status.consecutiveLosses}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">max {status.maxLosses}</div>
        </div>
      </div>

      {/* Progress bar toward limit */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={`h-full transition-all ${status.level === "alert" ? "bg-destructive" : status.level === "caution" ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${limitProgress * 100}%` }}
        />
      </div>

      {status.reasons.length > 0 && (
        <div className="space-y-1 mt-3 pt-3 border-t border-border/50">
          {status.reasons.map((r, i) => (
            <div key={i} className="text-xs text-muted-foreground flex gap-2">
              <span className={t.accent}>•</span>
              <span>{r}</span>
            </div>
          ))}
          <div className="text-xs text-muted-foreground italic pt-1">
            Just a suggestion — step away, hydrate, review your plan. You decide.
          </div>
        </div>
      )}
    </div>
  );
}

function RiskBanner({ status, onDismiss }: { status: RiskStatus; onDismiss: () => void }) {
  const t = toneClasses(status.level);
  const Icon = t.icon;
  return (
    <div className={`rounded-lg border p-4 flex gap-3 ${t.wrap}`} data-testid="risk-nudge-banner">
      <Icon className={`h-5 w-5 ${t.accent} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-1">
          {status.level === "alert" ? "Heads up before you log this trade" : "Caution zone"}
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 mb-2">
          {status.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
          {status.level === "caution" && status.reasons.length === 0 && (
            <li>You're approaching your daily risk threshold ({formatR(status.todayR)} / {status.dailyLimitR}R).</li>
          )}
        </ul>
        <div className="text-xs text-muted-foreground italic">
          You can absolutely log this trade — just a moment to check: is this your plan, or is this tilt? Walking away is also a trade.
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
        data-testid="button-dismiss-risk-nudge"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
