import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UnifiedToken } from "@/types/tokenUniverse";
import { Search, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTokenSearch, useTokenUniverse } from "../hooks/useQueries";

interface TokenSelectorProps {
  onSelect?: (token: UnifiedToken) => void;
  placeholder?: string;
  excludeAddress?: string;
}

function PriceChange({ change }: { change: number | null }) {
  if (change === null)
    return <span className="text-muted-foreground text-xs">--</span>;
  const positive = change >= 0;
  return (
    <span
      className={cn(
        "text-xs font-mono font-medium",
        positive ? "text-success" : "text-destructive",
      )}
    >
      {positive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
    </span>
  );
}

function DexBadges({ icpswap, kong }: { icpswap: boolean; kong: boolean }) {
  return (
    <div className="flex gap-1">
      {icpswap && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/15 text-secondary border border-secondary/30">
          ICPSwap
        </span>
      )}
      {kong && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success border border-success/30">
          KongSwap
        </span>
      )}
    </div>
  );
}

function TokenRow({
  token,
  onClick,
}: {
  token: UnifiedToken;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 hover:border-l-2 hover:border-primary transition-all text-left group"
    >
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-primary">
          {token.symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary truncate">
            {token.symbol}
          </span>
          <DexBadges
            icpswap={token.icpswapAvailable}
            kong={token.kongswapAvailable}
          />
        </div>
        <p className="text-xs text-muted-foreground truncate">{token.name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-mono text-foreground">
          {token.priceUsd !== null
            ? `$${token.priceUsd < 0.01 ? token.priceUsd.toExponential(2) : token.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
            : "--"}
        </p>
        <PriceChange change={token.priceChange24h} />
      </div>
    </button>
  );
}

const SKELETON_KEYS = ["sk-a", "sk-b", "sk-c", "sk-d"];

export default function TokenSelector({
  onSelect,
  placeholder = "Search tokens...",
  excludeAddress,
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { isLoading } = useTokenUniverse();
  const allResults = useTokenSearch(searchQuery);
  const results = excludeAddress
    ? allResults.filter(
        (t) => t.address.toLowerCase() !== excludeAddress.toLowerCase(),
      )
    : allResults;
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col">
      <div className="relative mb-2">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          data-ocid="token-selector.search_input"
          className="pl-9 bg-background border-border focus:border-primary/50 focus:ring-primary/20"
        />
      </div>

      {!hasQuery && !isLoading && (
        <div className="flex items-center gap-1.5 px-1 mb-1">
          <TrendingUp size={12} className="text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground/60">
            Top Tokens by Liquidity
          </span>
        </div>
      )}

      <div
        className="overflow-y-auto border border-border rounded-lg bg-background"
        style={{ maxHeight: 400 }}
        data-ocid="token-selector.list"
      >
        {isLoading ? (
          <div className="p-3 space-y-3">
            {SKELETON_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            data-ocid="token-selector.empty_state"
          >
            <Search size={28} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No tokens found matching your search
            </p>
          </div>
        ) : (
          results.map((token) => (
            <TokenRow
              key={token.address}
              token={token}
              onClick={() => {
                onSelect?.(token);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
