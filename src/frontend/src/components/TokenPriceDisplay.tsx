import { cn } from "@/lib/utils";
import { useProfile, useToken } from "../hooks/useQueries";

interface TokenPriceDisplayProps {
  address: string;
  showChange?: boolean;
  showDex?: boolean;
  className?: string;
}

export default function TokenPriceDisplay({
  address,
  showChange = false,
  showDex = false,
  className,
}: TokenPriceDisplayProps) {
  const token = useToken(address);
  const { preferredCurrency } = useProfile();

  if (!token) {
    return (
      <span
        className={cn("text-muted-foreground font-mono text-sm", className)}
      >
        --
      </span>
    );
  }

  const useICP = preferredCurrency === "ICP" && token.priceNative !== null;
  const priceDisplay = useICP
    ? token.priceNative !== null
      ? `${token.priceNative.toFixed(4)} ICP`
      : "--"
    : token.priceUsd !== null
      ? `$${token.priceUsd < 0.01 ? token.priceUsd.toExponential(2) : token.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
      : "--";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-mono text-sm text-foreground">{priceDisplay}</span>

      {showChange && (
        <span
          className={cn(
            "text-xs font-mono",
            token.priceChange24h === null
              ? "text-muted-foreground"
              : token.priceChange24h >= 0
                ? "text-success"
                : "text-destructive",
          )}
        >
          {token.priceChange24h === null
            ? "--"
            : `${token.priceChange24h >= 0 ? "▲" : "▼"} ${Math.abs(token.priceChange24h).toFixed(2)}%`}
        </span>
      )}

      {showDex && (
        <span className="inline-flex gap-1">
          {token.icpswapAvailable && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/15 text-secondary border border-secondary/30">
              ICPSwap
            </span>
          )}
          {token.kongswapAvailable && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success border border-success/30">
              KongSwap
            </span>
          )}
        </span>
      )}
    </span>
  );
}
