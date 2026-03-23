import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useTokenUniverse } from "../hooks/useQueries";

const SKELETON_KEYS = ["sk-dex", "sk-icpswap", "sk-kong"];

function StatusBadge({ status }: { status: "ok" | "unavailable" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        status === "ok"
          ? "bg-success/10 text-success border-success/30"
          : "bg-destructive/10 text-destructive border-destructive/30",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5",
          status === "ok" ? "bg-success" : "bg-destructive",
        )}
      />
      {status === "ok" ? "Live" : "Unavailable"}
    </span>
  );
}

export default function TokenUniverseStatusCard() {
  const {
    tokens,
    icpPriceUsd,
    isLoading,
    icpswapStatus,
    kongswapStatus,
    dexscreenerStatus,
    fetchedAt,
    refetch,
    coreFallbackActive,
  } = useTokenUniverse();

  const dexCount = tokens.filter((t) => t.priceUsd !== null).length;
  const icpswapCount = tokens.filter((t) => t.icpswapAvailable).length;
  const kongCount = tokens.filter((t) => t.kongswapAvailable).length;

  const formattedTime = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const sources = [
    { name: "DexScreener", status: dexscreenerStatus, count: dexCount },
    { name: "ICPSwap", status: icpswapStatus, count: icpswapCount },
    { name: "KongSwap", status: kongswapStatus, count: kongCount },
  ];

  return (
    <Card className="bg-card border-border shadow-card-glow">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
            Token Universe
          </span>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-sm font-bold text-primary"
              data-ocid="token-universe.icp-price.panel"
            >
              {isLoading || icpPriceUsd === 0
                ? "ICP: --"
                : `ICP: $${icpPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-ocid="token-universe.refresh.button"
              className="h-7 px-2 text-xs border-border hover:border-primary/50 hover:text-primary gap-1"
            >
              <RefreshCw
                size={12}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2 mb-3">
          {isLoading
            ? SKELETON_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))
            : sources.map((src) => (
                <div
                  key={src.name}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                  data-ocid={`token-universe.${src.name.toLowerCase()}.row`}
                >
                  <span className="text-sm text-muted-foreground w-28">
                    {src.name}
                  </span>
                  <StatusBadge status={src.status} />
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {src.status === "ok" ? `${src.count} tokens` : "--"}
                  </span>
                </div>
              ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <span data-ocid="token-universe.total.panel">
                <span className="text-primary font-bold font-mono">
                  {tokens.length}
                </span>{" "}
                <span className="text-muted-foreground">tokens available</span>
              </span>
            )}
          </span>
          {formattedTime && !isLoading && (
            <span className="text-xs text-muted-foreground/60">
              Updated {formattedTime}
            </span>
          )}
        </div>
        {(coreFallbackActive || tokens.length <= 5) && (
          <div
            className="mt-2 px-2 py-1 rounded text-xs font-mono"
            style={{
              background: "#1e1e2e",
              color: "#00f5ff",
              border: "1px solid #00f5ff40",
            }}
            data-ocid="token-universe.core-fallback.panel"
          >
            Core fallback active —{" "}
            {tokens.length <= 5 ? "5 core tokens" : `${tokens.length} tokens`}{" "}
            loaded
          </div>
        )}
      </CardContent>
    </Card>
  );
}
