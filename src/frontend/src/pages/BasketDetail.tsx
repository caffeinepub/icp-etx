import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowRight,
  Edit2,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import SwapExecutionDialog from "../components/SwapExecutionDialog";
import { useBasket, useDeleteBasket } from "../hooks/useBaskets";
import { usePairTrades } from "../hooks/usePairTrades";
import {
  useAnalyzeAndDecide,
  useBasketDrift,
  useSwapReceipts,
  useToggleAgent,
  useTokenUniverse,
  useUpdateScalpingMode,
} from "../hooks/useQueries";

import { computeEMACrossover, computeMACD, computeRSI } from "@/lib/indicators";

function buildSyntheticPricesForIndicators(
  priceUsd: number,
  priceChange24h: number | null,
  points = 30,
): number[] {
  const change24h = priceChange24h ?? 0;
  const volatility = Math.abs(change24h) * 0.03;
  const prices: number[] = [];
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trend = priceUsd * (1 - (change24h / 100) * (1 - progress));
    const noise =
      (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * priceUsd * volatility * 0.5;
    prices.push(Math.max(trend + noise, 0.000001));
  }
  prices[prices.length - 1] = priceUsd;
  return prices;
}

const NEON_COLORS = [
  "#00f5ff",
  "#7b2fff",
  "#00ff88",
  "#ff3366",
  "#f59e0b",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
  "#ef4444",
];

const RISK_BADGE: Record<string, string> = {
  Conservative: "bg-primary/10 text-primary border-primary/30",
  Moderate: "bg-warning/10 text-warning border-warning/30",
  Aggressive: "bg-destructive/10 text-destructive border-destructive/30",
};

const FREQ_CAP: Record<string, number> = {
  Conservative: 30,
  Moderate: 100,
  Aggressive: 300,
};

function formatDate(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDriftColor(driftBps: number): string {
  if (driftBps < 200) return "#00ff88";
  if (driftBps < 500) return "#f59e0b";
  return "#ff3366";
}

function getDriftLabel(driftBps: number): string {
  if (driftBps < 200) return "On target";
  if (driftBps < 500) return "Minor drift";
  return "Needs rebalance";
}

export default function BasketDetail() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = BigInt(params.id ?? "0");
  const navigate = useNavigate();

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapTokenIn, setSwapTokenIn] = useState<string | undefined>();
  const [swapTokenOut, setSwapTokenOut] = useState<string | undefined>();
  const [agentActive, setAgentActive] = useState(false);
  const [scalpingMode, setScalpingMode] = useState(false);
  const toggleAgentMutation = useToggleAgent();
  const updateScalpingModeMutation = useUpdateScalpingMode();

  const { data: basket, isLoading } = useBasket(id);
  const analyzeAndDecideMutation = useAnalyzeAndDecide();
  const { tokens } = useTokenUniverse();
  const { data: swapReceipts = [] } = useSwapReceipts();
  const agentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (agentActive) {
      agentIntervalRef.current = setInterval(
        () => {
          const focusAssetId: string = (basket as any)?.focusAsset ?? "";
          let focusAssetPrice = 0;
          let indicatorSummary = "RSI=N/A, MACD=N/A, EMA=N/A";
          if (focusAssetId) {
            const token = tokens.find((t) => t.address === focusAssetId);
            focusAssetPrice = token?.priceUsd ?? 0;
            if (token?.priceUsd) {
              const prices = buildSyntheticPricesForIndicators(
                token.priceUsd,
                token.priceChange24h ?? null,
              );
              const rsi = computeRSI(prices);
              const macd = computeMACD(prices);
              const ema = computeEMACrossover(prices, 10, 20);
              indicatorSummary = [
                `RSI=${rsi != null ? rsi.toFixed(1) : "N/A"}`,
                `MACD=${macd ? (macd.histogram > 0 ? "bullish" : "bearish") : "N/A"}`,
                `EMA=${ema?.crossover ?? "N/A"}`,
              ].join(", ");
            }
          }
          console.log(
            "[Agent] Basket ID",
            String(id),
            "| focusAsset:",
            focusAssetId || "(none)",
            `| price: $${focusAssetPrice.toFixed(4)}`,
            "| indicators:",
            indicatorSummary,
          );
          analyzeAndDecideMutation.mutate({
            id,
            isPairTrade: false,
            focusAssetPrice,
            indicatorSummary,
          });
        },
        scalpingMode ? 30_000 : 60_000,
      );
    } else {
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
        agentIntervalRef.current = null;
      }
    }
    return () => {
      if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: mutate is stable
  }, [
    agentActive,
    scalpingMode,
    basket,
    tokens,
    id,
    analyzeAndDecideMutation.mutate,
  ]);

  const { data: pairTrades } = usePairTrades();
  const deleteMutation = useDeleteBasket();
  const {
    data: driftData,
    isLoading: isDriftLoading,
    refetch: refetchDrift,
  } = useBasketDrift(id);

  async function handleDelete() {
    await deleteMutation.mutateAsync(id);
    navigate({ to: "/baskets" });
  }

  function handleRebalanceNow() {
    // Find highest drift slot
    if (!driftData || driftData.length === 0) {
      setSwapOpen(true);
      return;
    }
    const highest = driftData.reduce((a, b) =>
      b.driftBps > a.driftBps ? b : a,
    );
    const slotIdx = Number(highest.slotIndex);
    const entry = slotsWithTrades?.[slotIdx];
    if (entry?.trade) {
      setSwapTokenIn(entry.trade.tokenAAddress);
      setSwapTokenOut(entry.trade.tokenBAddress);
    }
    setSwapOpen(true);
  }

  if (isLoading) {
    return (
      <div
        className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4"
        data-ocid="basket-detail.loading_state"
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="text-center py-20">
          <Layers size={40} className="text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Basket not found.</p>
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/baskets" })}
            className="mt-4"
          >
            ← Back to Baskets
          </Button>
        </div>
      </div>
    );
  }

  const thresholdPct = Number(basket.rebalanceThresholdBps) / 100;
  const riskCls = RISK_BADGE[basket.riskTier] ?? RISK_BADGE.Conservative;
  const freqCap = FREQ_CAP[basket.riskTier] ?? 30;

  const slotsWithTrades = basket.slots.map((slot) => ({
    slot,
    trade: pairTrades?.find((t) => t.id === slot.pairTradeId) ?? null,
  }));

  const riskExplanation =
    basket.riskTier === "Aggressive"
      ? "This basket is Aggressive because it contains at least one Aggressive pair trade."
      : basket.riskTier === "Moderate"
        ? "This basket is Moderate because it contains at least one Moderate pair trade."
        : "All pair trades in this basket are Conservative.";

  // Determine overall balance status
  const maxDriftBps =
    driftData && driftData.length > 0
      ? Math.max(...driftData.map((d) => Number(d.driftBps)))
      : 0;
  const isBalanced = !driftData || driftData.length === 0 || maxDriftBps < 200;

  return (
    <>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {basket.name}
              </h1>
              {basket.description && (
                <p className="text-muted-foreground text-sm mt-1">
                  {basket.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-xs border", riskCls)}
                >
                  {basket.riskTier}
                </Badge>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded border border-border bg-card">
                  Rebalance at ±{thresholdPct}%
                </span>
                <span className="text-xs text-muted-foreground">
                  Created {formatDate(basket.createdAt)}
                </span>
              </div>

              {/* Status Badge */}
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  {isBalanced ? (
                    <motion.span
                      key="balanced"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
                      style={{
                        color: "#00ff88",
                        borderColor: "#00ff8840",
                        backgroundColor: "#00ff8810",
                      }}
                      data-ocid="basket-detail.status.panel"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "#00ff88" }}
                      />
                      Balanced ✓
                    </motion.span>
                  ) : (
                    <motion.span
                      key="drift"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
                      style={{
                        color: "#ff3366",
                        borderColor: "#ff336640",
                        backgroundColor: "#ff336610",
                        animation: "pulse 2s infinite",
                      }}
                      data-ocid="basket-detail.status.panel"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: "#ff3366" }}
                      />
                      Drift detected — Rebalance recommended
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Rebalance Now Button */}
              <Button
                onClick={handleRebalanceNow}
                data-ocid="basket-detail.rebalance.primary_button"
                className="gap-2 font-semibold"
                style={{
                  backgroundColor: "#00f5ff",
                  color: "#0a0a0f",
                  boxShadow: "0 0 12px #00f5ff60, 0 0 24px #00f5ff30",
                  border: "none",
                }}
              >
                <Zap size={15} />
                Rebalance Now
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: "/baskets/$id/edit",
                    params: { id: id.toString() },
                  })
                }
                data-ocid="basket-detail.edit.button"
                className="border-secondary/30 text-secondary hover:bg-secondary/10 gap-1.5"
              >
                <Edit2 size={14} />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-ocid="basket-detail.delete.open_modal_button"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <Zap size={14} className="hidden" />
                    <span>Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  className="bg-card border-border"
                  data-ocid="basket-detail.delete.dialog"
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Basket?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{basket.name}&quot;.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-ocid="basket-detail.delete.cancel_button">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      data-ocid="basket-detail.delete.confirm_button"
                      className="bg-destructive text-white hover:bg-destructive/90"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Delete Basket"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.div>

        {/* AI Agent Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          data-ocid="basket-detail.agent.panel"
        >
          <div
            style={{ background: "#12121a", border: "1px solid #1e1e2e" }}
            className="rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-white font-semibold text-sm">AI Agent</p>
              <p
                className={`text-xs font-medium mt-0.5 ${agentActive ? "text-[#00ff88]" : "text-gray-500"}`}
              >
                {agentActive ? "Agent Running" : "Agent Paused"}
              </p>
            </div>
            <button
              type="button"
              data-ocid="basket-detail.agent.toggle"
              onClick={() => {
                const next = !agentActive;
                setAgentActive(next);
                toggleAgentMutation.mutate({
                  id,
                  isPairTrade: false,
                  enabled: next,
                });
              }}
              disabled={toggleAgentMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${agentActive ? "bg-[#00f5ff]" : "bg-gray-700"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${agentActive ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        </motion.div>

        {/* Scalping/Arbitrage Mode Toggle — only for 3-token baskets */}
        {basket?.slots && basket.slots.length === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4"
            style={{
              background: "#12121a",
              borderColor: scalpingMode ? "#7b2fff" : "#1e1e2e",
            }}
            data-ocid="basket-detail.scalping.panel"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Scalping / Arbitrage Mode
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#888" }}>
                  3-token triangular arbitrage · 30s cycle · 0.5% slippage
                </div>
                {scalpingMode && (
                  <div
                    className="text-xs mt-1 font-medium"
                    style={{ color: "#7b2fff" }}
                  >
                    ⚡ Scalping Active — 30s cycles
                  </div>
                )}
              </div>
              <button
                type="button"
                data-ocid="basket-detail.scalping.toggle"
                onClick={() => {
                  const next = !scalpingMode;
                  setScalpingMode(next);
                  updateScalpingModeMutation.mutate({ id, enabled: next });
                }}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                style={{
                  background: scalpingMode ? "#7b2fff" : "#1e1e2e",
                  border: "1px solid",
                  borderColor: scalpingMode ? "#7b2fff" : "#333",
                }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full transition-transform"
                  style={{
                    background: "#fff",
                    transform: scalpingMode
                      ? "translateX(24px)"
                      : "translateX(4px)",
                    boxShadow: scalpingMode ? "0 0 8px #7b2fff" : "none",
                  }}
                />
              </button>
            </div>
          </motion.div>
        )}

        {/* Last Agent Action Banner */}
        {agentActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-lg border border-[#00f5ff30] bg-[#00f5ff10] p-3 flex items-center gap-2"
          >
            <Zap className="h-4 w-4 text-[#00f5ff] flex-shrink-0" />
            {swapReceipts.length > 0 ? (
              (() => {
                const r = [...swapReceipts].sort(
                  (a, b) => Number(b.timestamp) - Number(a.timestamp),
                )[0];
                const symOut =
                  tokens.find((t) => t.address === r.tokenOut)?.symbol ??
                  r.tokenOut.slice(0, 6);
                const price =
                  tokens.find((t) => t.address === r.tokenOut)?.priceUsd ?? 0;
                return (
                  <span className="text-[#00f5ff] text-xs font-medium">
                    Agent just BOUGHT {Number(r.amountOut).toFixed(2)} {symOut}{" "}
                    @ ${price.toFixed(2)} — {r.id}
                  </span>
                );
              })()
            ) : (
              <span className="text-[#00f5ff80] text-xs">
                No agent actions yet — waiting for first signal...
              </span>
            )}
          </motion.div>
        )}

        {/* Agent Activity Log */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#00f5ff]" />
              Agent Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {swapReceipts.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">
                No activity yet
              </p>
            ) : (
              <div className="space-y-2">
                {[...swapReceipts]
                  .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                  .slice(0, 3)
                  .map((r) => {
                    const symIn =
                      tokens.find((t) => t.address === r.tokenIn)?.symbol ??
                      r.tokenIn.slice(0, 6);
                    const symOut =
                      tokens.find((t) => t.address === r.tokenOut)?.symbol ??
                      r.tokenOut.slice(0, 6);
                    const msAgo = Date.now() - Number(r.timestamp) / 1_000_000;
                    const minAgo = Math.floor(msAgo / 60000);
                    const timeLabel =
                      minAgo < 1
                        ? "just now"
                        : minAgo < 60
                          ? `${minAgo} min ago`
                          : `${Math.floor(minAgo / 60)}h ago`;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-[#0a0a0f] border border-[#1e1e2e]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00ff8820] text-[#00ff88]">
                            BUY
                          </span>
                          <span className="text-gray-300">
                            {Number(r.amountOut).toFixed(4)} {symOut}
                          </span>
                          <span className="text-gray-600">←</span>
                          <span className="text-gray-500">
                            {Number(r.amountIn).toFixed(4)} {symIn}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-[#00f5ff] font-mono">{r.id}</div>
                          <div className="text-gray-600">{timeLabel}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Allocation Bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex rounded-lg overflow-hidden h-7 w-full mb-3">
                  {basket.slots.map((slot, i) => {
                    const pct = Number(slot.targetWeightBps) / 100;
                    const trade = pairTrades?.find(
                      (t) => t.id === slot.pairTradeId,
                    );
                    return (
                      <div
                        key={slot.pairTradeId.toString()}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: NEON_COLORS[i % NEON_COLORS.length],
                        }}
                        title={`${
                          trade
                            ? `${trade.tokenASymbol}→${trade.tokenBSymbol}`
                            : slot.slotLabel
                        }: ${pct}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {basket.slots.map((slot, i) => {
                    const pct = Number(slot.targetWeightBps) / 100;
                    const trade = pairTrades?.find(
                      (t) => t.id === slot.pairTradeId,
                    );
                    const label =
                      slot.slotLabel ||
                      (trade
                        ? `${trade.tokenASymbol}→${trade.tokenBSymbol}`
                        : `Slot ${i + 1}`);
                    return (
                      <div
                        key={slot.pairTradeId.toString()}
                        className="flex items-center gap-1"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor:
                              NEON_COLORS[i % NEON_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {label}:{" "}
                          <span className="font-mono text-foreground">
                            {pct}%
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Drift Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.13 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="text-muted-foreground" />
                    <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                      Live Drift
                    </CardTitle>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchDrift()}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    data-ocid="basket-detail.drift.button"
                  >
                    <RefreshCw size={11} />
                    Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDriftLoading ? (
                  <div
                    className="space-y-3"
                    data-ocid="basket-detail.drift.loading_state"
                  >
                    {basket.slots.map((slot) => (
                      <div
                        key={slot.pairTradeId.toString()}
                        className="space-y-1.5"
                      >
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full rounded" />
                      </div>
                    ))}
                  </div>
                ) : !driftData || driftData.length === 0 ? (
                  <div
                    className="text-center py-6 text-sm text-muted-foreground"
                    data-ocid="basket-detail.drift.empty_state"
                  >
                    <RefreshCw size={18} className="mx-auto mb-2 opacity-30" />
                    Drift data unavailable — prices loading
                  </div>
                ) : (
                  basket.slots.map((slot, i) => {
                    const trade = pairTrades?.find(
                      (t) => t.id === slot.pairTradeId,
                    );
                    const label =
                      slot.slotLabel ||
                      (trade
                        ? `${trade.tokenASymbol}→${trade.tokenBSymbol}`
                        : `Slot ${i + 1}`);
                    const targetPct = Number(slot.targetWeightBps) / 100;

                    // Find drift for this slot index
                    const driftEntry = driftData.find(
                      (d) => Number(d.slotIndex) === i,
                    );
                    const driftBps = driftEntry
                      ? Number(driftEntry.driftBps)
                      : 0;
                    const direction = driftEntry?.direction ?? "On target";
                    const driftPct = (driftBps / 100).toFixed(1);

                    const barColor = getDriftColor(driftBps);
                    const barWidthPct = Math.min((driftBps / 1000) * 100, 100);
                    const statusLabel = getDriftLabel(driftBps);

                    return (
                      <div
                        key={slot.pairTradeId.toString()}
                        data-ocid={`basket-detail.drift.item.${i + 1}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">
                              {label}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              Target: {targetPct}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <span
                              className="text-sm font-mono font-semibold"
                              style={{ color: barColor }}
                            >
                              {driftPct}%
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full border"
                              style={{
                                color: barColor,
                                borderColor: `${barColor}40`,
                                backgroundColor: `${barColor}12`,
                              }}
                            >
                              {direction || statusLabel}
                            </span>
                          </div>
                        </div>
                        {/* Bar Track */}
                        <div
                          className="w-full rounded-full h-2.5 overflow-hidden"
                          style={{ backgroundColor: "#1e1e2e" }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidthPct}%` }}
                            transition={{
                              duration: 0.7,
                              ease: "easeOut",
                              delay: i * 0.06,
                            }}
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: barColor,
                              boxShadow:
                                driftBps > 0
                                  ? `0 0 8px ${barColor}, 0 0 16px ${barColor}40`
                                  : "none",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Slots Table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Label
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Token Pair
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Target
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Current
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Drift
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          {" "}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slotsWithTrades.map(({ slot, trade }, i) => {
                        const pct = Number(slot.targetWeightBps) / 100;
                        const label =
                          slot.slotLabel ||
                          (trade
                            ? `${trade.tokenASymbol}→${trade.tokenBSymbol}`
                            : `Slot ${i + 1}`);
                        const driftEntry = driftData?.find(
                          (d) => Number(d.slotIndex) === i,
                        );
                        const driftBps = driftEntry
                          ? Number(driftEntry.driftBps)
                          : 0;
                        const driftPct =
                          driftBps > 0
                            ? `${(driftBps / 100).toFixed(1)}%`
                            : "--";
                        const driftColor =
                          driftBps > 0 ? getDriftColor(driftBps) : undefined;

                        return (
                          <TableRow
                            key={slot.pairTradeId.toString()}
                            className="border-border hover:bg-muted/5"
                            data-ocid={`basket-detail.slots.row.${i + 1}`}
                          >
                            <TableCell className="text-sm font-medium text-foreground">
                              {label}
                            </TableCell>
                            <TableCell>
                              {trade ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-primary text-sm font-semibold">
                                    {trade.tokenASymbol}
                                  </span>
                                  <ArrowRight
                                    size={10}
                                    className="text-muted-foreground"
                                  />
                                  <span className="text-foreground text-sm">
                                    {trade.tokenBSymbol}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Trade #{slot.pairTradeId.toString()}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-foreground">
                              {pct}%
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              --
                            </TableCell>
                            <TableCell
                              className="text-sm font-mono"
                              style={driftColor ? { color: driftColor } : {}}
                            >
                              {driftPct}
                            </TableCell>
                            <TableCell>
                              {driftBps >= 200 ? (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full border"
                                  style={{
                                    color: getDriftColor(driftBps),
                                    borderColor: `${getDriftColor(driftBps)}40`,
                                    backgroundColor: `${getDriftColor(driftBps)}12`,
                                  }}
                                >
                                  {getDriftLabel(driftBps)}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                                  On Target
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {trade && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate({
                                      to: "/pair-trades/$id",
                                      params: { id: trade.id.toString() },
                                    })
                                  }
                                  className="text-xs text-primary hover:text-primary/70 flex items-center gap-1"
                                >
                                  View <ExternalLink size={10} />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Risk Summary */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-muted-foreground" />
                  <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                    Risk Summary
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs border", riskCls)}
                  >
                    {basket.riskTier}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {riskExplanation}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trade frequency cap:{" "}
                  <span className="text-foreground font-semibold">
                    Up to {freqCap} trades/month
                  </span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <SwapExecutionDialog
        open={swapOpen}
        onClose={() => {
          setSwapOpen(false);
          setSwapTokenIn(undefined);
          setSwapTokenOut(undefined);
        }}
        tokenInAddress={swapTokenIn}
        tokenOutAddress={swapTokenOut}
        riskTier={basket.riskTier}
      />
    </>
  );
}
