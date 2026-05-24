import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "primary";
  testid?: string;
}

export function KpiCard({ label, value, sub, tone = "neutral", testid }: Props) {
  const toneClass = tone === "positive" ? "pnl-positive" :
                    tone === "negative" ? "pnl-negative" :
                    tone === "primary"  ? "text-primary" : "";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground" data-testid={testid ? `label-${testid}` : undefined}>
          {label}
        </div>
        <div className={["mt-2 text-xl font-semibold font-mono-num", toneClass].join(" ")} data-testid={testid}>
          {value}
        </div>
        {sub != null && (
          <div className="mt-1 text-xs text-muted-foreground" data-testid={testid ? `sub-${testid}` : undefined}>
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
