import { Skeleton } from "@/components/ui/skeleton";
import { useTradeFrequencyStatus } from "@/hooks/useQueries";
import { useProfile } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";

interface TradeFrequencyBarProps {
  compact?: boolean;
}

export default function TradeFrequencyBar({
  compact = false,
}: TradeFrequencyBarProps) {
  const { data, isLoading } = useTradeFrequencyStatus();
  const { riskPreference } = useProfile();

  if (isLoading) {
    return (
      <Skeleton
        className={cn("h-4 rounded", compact ? "w-32" : "w-full h-8")}
      />
    );
  }

  // Fallback data if backend doesn't have the method yet
  const usedRaw = data?.usedThisMonth ?? 0;
  const limitRaw =
    data?.limitThisMonth ??
    (riskPreference === "Aggressive"
      ? 300
      : riskPreference === "Conservative"
        ? 30
        : 100);
  const resetsAtRaw = data?.resetsAt ?? 0;

  const used = Number(usedRaw);
  const limit = Number(limitRaw);
  const resetsAt = Number(resetsAtRaw);

  const pctUsed = limit > 0 ? (used / limit) * 100 : 0;

  const daysUntilReset =
    resetsAt > 0
      ? Math.max(
          0,
          Math.ceil(
            (resetsAt / 1_000_000 - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        )
      : 30;

  const barColor =
    pctUsed >= 100
      ? "bg-muted"
      : pctUsed >= 85
        ? "bg-destructive"
        : pctUsed >= 60
          ? "bg-warning"
          : "bg-success";

  const isBlocked = pctUsed >= 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-ocid="trade-freq.panel">
        <div className="flex-1 h-1.5 rounded-full bg-card overflow-hidden min-w-[80px]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              barColor,
            )}
            style={{ width: `${Math.min(pctUsed, 100)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
          {used}/{limit}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-ocid="trade-freq.panel">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">
          {used} / {limit} trades this month
          <span className="ml-1.5 text-muted-foreground">
            ({riskPreference || "Moderate"})
          </span>
        </span>
        <span className="text-muted-foreground text-xs">
          Resets in {daysUntilReset}d
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-card border border-border overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            barColor,
          )}
          style={{ width: `${Math.min(pctUsed, 100)}%` }}
        />
      </div>
      {isBlocked ? (
        <p className="text-xs text-muted-foreground">
          Monthly trade limit reached. Resets in {daysUntilReset} days.
        </p>
      ) : pctUsed >= 85 ? (
        <p className="text-xs text-destructive">⚠ Near monthly limit</p>
      ) : pctUsed >= 60 ? (
        <p className="text-xs text-warning">Approaching monthly limit</p>
      ) : null}
    </div>
  );
}
