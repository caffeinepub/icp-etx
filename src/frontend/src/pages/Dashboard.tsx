import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  ActivitySquare,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  History,
  Layers,
  Package,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import TokenUniverseStatusCard from "../components/TokenUniverseStatusCard";
import { useBaskets } from "../hooks/useBaskets";
import { RiskTier, usePairTrades } from "../hooks/usePairTrades";
import {
  useAvailableICPBalance,
  useHoldings,
  useICPPrice,
  usePortfolioValue,
  useProfile,
  useRealizedPnL,
  useSwapReceipts,
  useTokenUniverse,
  useUnrealizedPnL,
} from "../hooks/useQueries";

const RISK_BADGE: Record<RiskTier, { label: string; className: string }> = {
  [RiskTier.conservative]: {
    label: "Conservative",
    className: "bg-primary/10 text-primary border-primary/30 text-[10px]",
  },
  [RiskTier.moderate]: {
    label: "Moderate",
    className: "bg-warning/10 text-warning border-warning/30 text-[10px]",
  },
  [RiskTier.aggressive]: {
    label: "Aggressive",
    className:
      "bg-destructive/10 text-destructive border-destructive/30 text-[10px]",
  },
};

const BASKET_RISK_BADGE: Record<string, string> = {
  Conservative: "bg-primary/10 text-primary border-primary/30",
  Moderate: "bg-warning/10 text-warning border-warning/30",
  Aggressive: "bg-destructive/10 text-destructive border-destructive/30",
};

const RISK_CONFIG: Record<string, { color: string; badgeClass: string }> = {
  Conservative: {
    color: "text-success",
    badgeClass: "bg-success/10 text-success border-success/30",
  },
  Moderate: {
    color: "text-primary",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
  },
  Aggressive: {
    color: "text-secondary",
    badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
  },
};

const ALLOCATION_COLORS = [
  "bg-[#00f5ff]",
  "bg-[#7b2fff]",
  "bg-[#00ff88]",
  "bg-[#f59e0b]",
  "bg-[#f97316]",
  "bg-[#ec4899]",
  "bg-[#06b6d4]",
  "bg-[#8b5cf6]",
];

const ALLOCATION_TEXT_COLORS = [
  "text-[#00f5ff]",
  "text-[#7b2fff]",
  "text-[#00ff88]",
  "text-[#f59e0b]",
  "text-[#f97316]",
  "text-[#ec4899]",
  "text-[#06b6d4]",
  "text-[#8b5cf6]",
];

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPnL(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value >= 0 ? `+$${formatted}` : `-$${formatted}`;
}

function timeAgo(timestampNs: bigint): string {
  const ms = Number(timestampNs) / 1_000_000;
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  glowClass,
  delay,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  glowClass: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="bg-card border-border shadow-card-glow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {label}
            </span>
            <Icon size={16} className={cn("opacity-70", glowClass)} />
          </div>
          <p className={cn("text-2xl font-bold font-mono-data", glowClass)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const quickActions = [
  {
    label: "Create Pair Trade",
    path: "/pair-trades/new" as const,
    icon: ArrowLeftRight,
    color: "text-primary",
    bg: "bg-primary/10 hover:bg-primary/20 border-primary/20 hover:border-primary/40 hover:shadow-neon-cyan",
  },
  {
    label: "Create Basket",
    path: "/baskets/new" as const,
    icon: Package,
    color: "text-secondary",
    bg: "bg-secondary/10 hover:bg-secondary/20 border-secondary/20 hover:border-secondary/40 hover:shadow-neon-purple",
  },
  {
    label: "Fund Wallet",
    path: "/wallet" as const,
    icon: Wallet,
    color: "text-success",
    bg: "bg-success/10 hover:bg-success/20 border-success/20 hover:border-success/40 hover:shadow-neon-green",
  },
  {
    label: "View Swap History",
    path: "/swap-history" as const,
    icon: History,
    color: "text-muted-foreground",
    bg: "bg-muted/50 hover:bg-muted border-border hover:border-border",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { displayName, riskPreference, isLoading } = useProfile();
  const { icpPriceUsd, isLoading: priceLoading } = useICPPrice();
  const { tokens } = useTokenUniverse();
  const { data: pairTrades, isLoading: tradesLoading } = usePairTrades();
  const { data: baskets, isLoading: basketsLoading } = useBaskets();
  const { data: swapReceipts, isLoading: receiptsLoading } = useSwapReceipts();
  const { data: portfolioValue, isLoading: portfolioLoading } =
    usePortfolioValue();
  const { data: realizedPnL, isLoading: realizedLoading } = useRealizedPnL();
  const { data: unrealizedPnL, isLoading: unrealizedLoading } =
    useUnrealizedPnL();
  const { data: availableICP, isLoading: availableLoading } =
    useAvailableICPBalance();
  const { data: holdings } = useHoldings();

  const [valueMode, setValueMode] = useState<"usd" | "icp">("usd");

  const name = displayName || "Trader";
  const riskConfig = RISK_CONFIG[riskPreference];
  const recentTrades = pairTrades
    ? [...pairTrades]
        .sort((a, b) => Number(b.createdAt - a.createdAt))
        .slice(0, 3)
    : [];
  const recentBaskets = baskets
    ? [...baskets].sort((a, b) => Number(b.createdAt - a.createdAt)).slice(0, 3)
    : [];
  const recentSwaps = swapReceipts
    ? [...swapReceipts]
        .sort((a, b) => Number(b.timestamp - a.timestamp))
        .slice(0, 5)
    : [];

  const portfolioUsd = portfolioValue ?? 0;
  const portfolioDisplay =
    valueMode === "usd"
      ? formatUsd(portfolioUsd)
      : icpPriceUsd > 0
        ? `${(portfolioUsd / icpPriceUsd).toFixed(4)} ICP`
        : "-- ICP";

  // Build allocation segments from holdings + live prices
  const allocationSegments = (() => {
    if (!holdings?.length || !tokens.length) return [];
    const segments = holdings
      .map((h) => {
        const token = tokens.find(
          (t) => t.address.toLowerCase() === h.tokenCanisterId.toLowerCase(),
        );
        const priceUsd = token?.priceUsd ?? 0;
        return { symbol: h.symbol, usd: h.balance * priceUsd };
      })
      .filter((s) => s.usd > 0);
    const total = segments.reduce((sum, s) => sum + s.usd, 0);
    if (total <= 0) return [];
    return segments
      .map((s) => ({ ...s, pct: (s.usd / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
  })();

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Welcome back to ICP ETX
            </p>
          </div>
          <div
            className="font-mono text-sm font-bold px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary"
            data-ocid="dashboard.icp-price.panel"
          >
            {priceLoading || icpPriceUsd === 0
              ? "ICP: --"
              : `ICP: $${icpPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
      </motion.div>

      {/* Hero Portfolio Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.02 }}
        className="mb-6"
        data-ocid="dashboard.portfolio.card"
      >
        <Card className="bg-card border-[#00f5ff]/30 shadow-[0_0_24px_rgba(0,245,255,0.12)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f5ff]/60 to-transparent" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  Total Portfolio Value
                </p>
                {portfolioLoading ? (
                  <Skeleton
                    className="h-10 w-48 mb-3"
                    data-ocid="dashboard.portfolio.loading_state"
                  />
                ) : (
                  <p className="text-4xl font-bold text-[#00f5ff] font-mono tracking-tight mb-3">
                    {portfolioDisplay}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    {unrealizedLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <>
                        {(unrealizedPnL ?? 0) >= 0 ? (
                          <TrendingUp size={14} className="text-[#00ff88]" />
                        ) : (
                          <TrendingDown size={14} className="text-[#ff3366]" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-mono font-semibold",
                            (unrealizedPnL ?? 0) >= 0
                              ? "text-[#00ff88]"
                              : "text-[#ff3366]",
                          )}
                          data-ocid="dashboard.unrealized-pnl.panel"
                        >
                          Unrealized: {formatPnL(unrealizedPnL ?? 0)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {realizedLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <>
                        {(realizedPnL ?? 0) >= 0 ? (
                          <TrendingUp size={14} className="text-[#00ff88]" />
                        ) : (
                          <TrendingDown size={14} className="text-[#ff3366]" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-mono font-semibold",
                            (realizedPnL ?? 0) >= 0
                              ? "text-[#00ff88]"
                              : "text-[#ff3366]",
                          )}
                          data-ocid="dashboard.realized-pnl.panel"
                        >
                          Realized: {formatPnL(realizedPnL ?? 0)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* USD / ICP toggle */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-muted/30 border border-border">
                <button
                  type="button"
                  onClick={() => setValueMode("usd")}
                  data-ocid="dashboard.portfolio.toggle"
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200",
                    valueMode === "usd"
                      ? "bg-[#00f5ff]/20 text-[#00f5ff] border border-[#00f5ff]/40"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setValueMode("icp")}
                  data-ocid="dashboard.portfolio.toggle"
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200",
                    valueMode === "icp"
                      ? "bg-[#00f5ff]/20 text-[#00f5ff] border border-[#00f5ff]/40"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  ICP
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Active Pair Trades"
          value={tradesLoading ? "..." : (pairTrades?.length ?? 0).toString()}
          subtitle="Your positions"
          icon={ArrowLeftRight}
          glowClass="text-success"
          delay={0.05}
        />
        <StatCard
          label="Active Baskets"
          value={basketsLoading ? "..." : (baskets?.length ?? 0).toString()}
          subtitle="Strategy portfolios"
          icon={Layers}
          glowClass="text-secondary"
          delay={0.1}
        />
        <StatCard
          label="Total Swaps"
          value={
            receiptsLoading ? "..." : (swapReceipts?.length ?? 0).toString()
          }
          subtitle="All time"
          icon={ActivitySquare}
          glowClass="text-primary"
          delay={0.15}
        />
        <StatCard
          label="Available ICP"
          value={
            availableLoading ? "..." : `${(availableICP ?? 0).toFixed(2)} ICP`
          }
          subtitle="Ready to trade"
          icon={Wallet}
          glowClass="text-[#00f5ff]"
          delay={0.2}
        />
      </div>

      {/* Allocation + Recent Swaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="bg-card border-border shadow-card-glow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                  Allocation
                </CardTitle>
                <BarChart3 size={16} className="text-muted-foreground/50" />
              </div>
            </CardHeader>
            <CardContent data-ocid="dashboard.allocation.panel">
              {portfolioLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full rounded-full" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                </div>
              ) : allocationSegments.length === 0 ? (
                <div
                  className="h-40 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border"
                  data-ocid="dashboard.allocation.empty_state"
                >
                  <BarChart3 size={32} className="text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Execute a swap to see your portfolio allocation
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex h-5 rounded-full overflow-hidden w-full gap-px">
                    {allocationSegments.map((seg, i) => (
                      <div
                        key={seg.symbol}
                        className={cn(
                          "transition-all duration-500",
                          ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
                        )}
                        style={{ width: `${seg.pct}%` }}
                        title={`${seg.symbol}: ${seg.pct.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {allocationSegments.map((seg, i) => (
                      <div
                        key={seg.symbol}
                        className="flex items-center justify-between text-xs"
                        data-ocid={`dashboard.allocation.item.${i + 1}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-sm flex-shrink-0",
                              ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
                            )}
                          />
                          <span
                            className={cn(
                              "font-semibold",
                              ALLOCATION_TEXT_COLORS[
                                i % ALLOCATION_TEXT_COLORS.length
                              ],
                            )}
                          >
                            {seg.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-mono">
                            {seg.pct.toFixed(1)}%
                          </span>
                          <span className="font-mono">
                            {formatUsd(seg.usd)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <Card className="bg-card border-border shadow-card-glow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Swaps
                </CardTitle>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/swap-history" })}
                  data-ocid="dashboard.recent-swaps.link"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  View All
                </button>
              </div>
            </CardHeader>
            <CardContent data-ocid="dashboard.recent-swaps.panel">
              {receiptsLoading ? (
                <div
                  className="space-y-2"
                  data-ocid="dashboard.recent-swaps.loading_state"
                >
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentSwaps.length === 0 ? (
                <div
                  className="h-40 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border"
                  data-ocid="dashboard.recent-swaps.empty_state"
                >
                  <History size={32} className="text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">
                    No swaps yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentSwaps.map((receipt, idx) => {
                    const pnl = receipt.realizedPnL ?? 0;
                    const receiptShort =
                      receipt.id.length > 8
                        ? `${receipt.id.slice(0, 8)}…`
                        : receipt.id;
                    return (
                      <div
                        key={receipt.id}
                        data-ocid={`dashboard.recent-swaps.item.${idx + 1}`}
                        className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-primary shrink-0">
                            {receiptShort}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {timeAgo(receipt.timestamp)}
                          </span>
                          <span className="text-xs text-foreground truncate hidden sm:block">
                            {receipt.tokenIn}{" "}
                            <ArrowRight
                              size={10}
                              className="inline text-muted-foreground"
                            />{" "}
                            {receipt.tokenOut}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold shrink-0 ml-2",
                            pnl >= 0 ? "text-[#00ff88]" : "text-[#ff3366]",
                          )}
                        >
                          {formatPnL(pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Profile + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.31 }}
          className="lg:col-span-1"
        >
          <Card className="bg-card border-border shadow-card-glow h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-7 bg-muted/50 rounded animate-pulse w-3/4" />
                  <div className="h-5 bg-muted/50 rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground mb-3">
                    GM, {name} 👋
                  </p>
                  {riskPreference && riskConfig && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Risk:
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs border", riskConfig.badgeClass)}
                        data-ocid="dashboard.risk.badge"
                      >
                        {riskPreference}
                      </Badge>
                    </div>
                  )}
                  {!riskPreference && (
                    <p className="text-sm text-muted-foreground">
                      Complete your profile to see your risk settings.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.34 }}
          className="lg:col-span-2"
        >
          <Card className="bg-card border-border shadow-card-glow h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => navigate({ to: action.path })}
                    data-ocid={`dashboard.${action.label.toLowerCase().replace(/ /g, "-")}.button`}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all duration-200 cursor-pointer",
                      action.bg,
                    )}
                  >
                    <action.icon size={22} className={action.color} />
                    <span className="text-xs font-medium text-foreground text-center leading-tight">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Pair Trades */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.37 }}
        className="mb-4"
      >
        <Card className="bg-card border-border shadow-card-glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Pair Trades
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate({ to: "/pair-trades" })}
                data-ocid="dashboard.pair-trades.link"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View All
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {tradesLoading ? (
              <div
                className="space-y-2"
                data-ocid="dashboard.recent-trades.loading_state"
              >
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted/20 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : recentTrades.length === 0 ? (
              <div
                className="py-6 text-center"
                data-ocid="dashboard.recent-trades.empty_state"
              >
                <p className="text-sm text-muted-foreground">
                  No pair trades yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTrades.map((trade, idx) => {
                  const badge = RISK_BADGE[trade.riskTier];
                  return (
                    <button
                      key={trade.id.toString()}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/pair-trades/$id",
                          params: { id: trade.id.toString() },
                        })
                      }
                      data-ocid={`dashboard.recent-trades.item.${idx + 1}`}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-primary/5 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-primary">
                          {trade.tokenASymbol}
                        </span>
                        <ArrowRight
                          size={14}
                          className="text-muted-foreground"
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {trade.tokenBSymbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          $
                          {trade.allocationUsd.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* My Baskets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mb-4"
      >
        <Card className="bg-card border-border shadow-card-glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                My Baskets
              </CardTitle>
              <button
                type="button"
                onClick={() => navigate({ to: "/baskets" })}
                data-ocid="dashboard.baskets.link"
                className="text-xs text-secondary hover:text-secondary/80 transition-colors"
              >
                View All
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {basketsLoading ? (
              <div
                className="space-y-2"
                data-ocid="dashboard.baskets.loading_state"
              >
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted/20 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : recentBaskets.length === 0 ? (
              <div
                className="py-6 text-center"
                data-ocid="dashboard.baskets.empty_state"
              >
                <p className="text-sm text-muted-foreground">No baskets yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentBaskets.map((basket, idx) => {
                  const riskCls =
                    BASKET_RISK_BADGE[basket.riskTier] ??
                    BASKET_RISK_BADGE.Conservative;
                  return (
                    <button
                      key={basket.id.toString()}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/baskets/$id",
                          params: { id: basket.id.toString() },
                        })
                      }
                      data-ocid={`dashboard.baskets.item.${idx + 1}`}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/5 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <Layers
                          size={14}
                          className="text-secondary flex-shrink-0"
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {basket.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {basket.slots.length} trades
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] border", riskCls)}
                        >
                          {basket.riskTier}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.43 }}
        className="mb-4"
        data-ocid="dashboard.token-universe.panel"
      >
        <TokenUniverseStatusCard />
      </motion.div>
    </div>
  );
}
