import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { FundingEntry } from "../backend";
import { FundingEntryType } from "../backend";
import SwapExecutionDialog from "../components/SwapExecutionDialog";
import {
  buildPriceMap,
  useCanisterId,
  useFundingEntries,
  useHoldings,
  useICPPrice,
  usePortfolioValue,
  useRealizedPnL,
  useSwapReceipts,
  useSyncBalances,
  useTokenUniverse,
  useWithdraw,
} from "../hooks/useQueries";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtTs(ts: bigint | number): string {
  const ms = typeof ts === "bigint" ? Number(ts) / 1_000_000 : ts;
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── sub-components ─────────────────────────────────────────────────────────

function HoldingCard({
  holding,
  livePrice,
  totalValueUsd,
  onSwap,
  onWithdraw,
}: {
  holding: {
    tokenCanisterId: string;
    symbol: string;
    balance: number;
    costBasis: number;
  };
  livePrice: number;
  totalValueUsd: number;
  onSwap: () => void;
  onWithdraw: () => void;
}) {
  const holdingValueUsd = holding.balance * livePrice;
  const pct = totalValueUsd > 0 ? (holdingValueUsd / totalValueUsd) * 100 : 0;
  const pnlPct =
    holding.costBasis > 0
      ? ((livePrice - holding.costBasis) / holding.costBasis) * 100
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: "#12121a", borderColor: "#1e1e2e" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "rgba(0,245,255,0.12)",
              color: "#00f5ff",
              border: "1px solid rgba(0,245,255,0.25)",
            }}
          >
            {holding.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#00f5ff" }}>
              {holding.symbol}
            </p>
            <p className="text-xs" style={{ color: "#6b7280" }}>
              {fmt(holding.balance, 6)} tokens
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm text-white">
            {fmtUsd(holdingValueUsd)}
          </p>
          {pnlPct !== null && (
            <p
              className="text-xs"
              style={{ color: pnlPct >= 0 ? "#00ff88" : "#ff3366" }}
            >
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-2 gap-2 text-xs"
        style={{ color: "#9ca3af" }}
      >
        <div>
          <span className="block" style={{ color: "#6b7280" }}>
            Price
          </span>
          <span className="text-white">
            {livePrice > 0 ? fmtUsd(livePrice) : "—"}
          </span>
        </div>
        <div>
          <span className="block" style={{ color: "#6b7280" }}>
            Portfolio %
          </span>
          <span className="text-white">{pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Portfolio bar */}
      <div className="h-1 rounded-full" style={{ background: "#1e1e2e" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: "linear-gradient(90deg, #00f5ff, #7b2fff)",
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 text-xs font-semibold"
          style={{
            background: "rgba(0,245,255,0.12)",
            color: "#00f5ff",
            border: "1px solid rgba(0,245,255,0.3)",
          }}
          onClick={onSwap}
          data-ocid="wallet.holding.swap_button"
        >
          <ArrowRightLeft className="w-3 h-3 mr-1" /> Swap
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs font-semibold"
          style={{
            background: "rgba(123,47,255,0.12)",
            color: "#7b2fff",
            border: "1px solid rgba(123,47,255,0.3)",
          }}
          onClick={onWithdraw}
          data-ocid="wallet.holding.withdraw_button"
        >
          <ArrowUpFromLine className="w-3 h-3 mr-1" /> Withdraw
        </Button>
      </div>
    </motion.div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [currency, setCurrency] = useState<"USD" | "ICP">("USD");
  const [activeTab, setActiveTab] = useState("overview");
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTokenIn, setSwapTokenIn] = useState<string | undefined>();
  const [withdrawToken, setWithdrawToken] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: portfolioValueUsd = 0 } = usePortfolioValue();
  const { data: holdings = [] } = useHoldings();
  const { data: swapReceipts = [] } = useSwapReceipts();
  const { data: fundingEntries = [] } = useFundingEntries();
  const { data: canisterId = "" } = useCanisterId();
  const { icpPriceUsd = 0 } = useICPPrice();
  const { data: realizedPnL = 0 } = useRealizedPnL();
  const { tokens } = useTokenUniverse();
  const syncBalances = useSyncBalances();
  const withdraw = useWithdraw();

  const priceMap = useMemo(() => new Map(buildPriceMap(tokens)), [tokens]);

  const portfolioValueICP =
    icpPriceUsd > 0 ? portfolioValueUsd / icpPriceUsd : 0;
  const displayValue =
    currency === "USD"
      ? fmtUsd(portfolioValueUsd)
      : `${fmt(portfolioValueICP, 4)} ICP`;

  // Activity: merge swaps + funding, sort newest first, take 10
  const activityItems = useMemo(() => {
    const swaps = swapReceipts.map((r) => ({
      type: "swap" as const,
      ts: Number(r.timestamp) / 1_000_000,
      data: r,
    }));
    const funding = fundingEntries.map((e) => ({
      type: "funding" as const,
      ts: Number(e.timestamp) / 1_000_000,
      data: e,
    }));
    return [...swaps, ...funding].sort((a, b) => b.ts - a.ts).slice(0, 10);
  }, [swapReceipts, fundingEntries]);

  const selectedHolding = holdings.find(
    (h) => h.tokenCanisterId === withdrawToken,
  );

  function handleCopy() {
    if (!canisterId) return;
    navigator.clipboard.writeText(canisterId);
    setCopied(true);
    toast.success("Deposit address copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWithdraw() {
    if (!withdrawToken || !withdrawAmount) return;
    const amount = Number.parseFloat(withdrawAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    withdraw.mutate(
      {
        tokenCanisterId: withdrawToken,
        amount,
        destination: withdrawDest || undefined,
      },
      {
        onSuccess: (msg) => {
          toast.success(
            typeof msg === "string" ? msg : "Withdrawal submitted!",
          );
          setWithdrawAmount("");
        },
        onError: (err) => {
          toast.error(String(err));
        },
      },
    );
  }

  function openSwapFor(tokenCanisterId: string) {
    setSwapTokenIn(tokenCanisterId);
    setSwapDialogOpen(true);
  }

  function openWithdrawFor(tokenCanisterId: string) {
    setWithdrawToken(tokenCanisterId);
    setActiveTab("withdraw");
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0a0a0f" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* ── Hero Card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #12121a 0%, #0f0f1a 100%)",
            borderColor: "#1e1e2e",
          }}
          data-ocid="wallet.panel"
        >
          {/* glow bg */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20"
            style={{ background: "#00f5ff" }}
          />
          <div
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-3xl opacity-10"
            style={{ background: "#7b2fff" }}
          />

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4" style={{ color: "#00f5ff" }} />
                <span
                  className="text-sm font-medium"
                  style={{ color: "#9ca3af" }}
                >
                  Total Wallet Value
                </span>
              </div>
              {/* USD/ICP toggle */}
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: "rgba(0,245,255,0.12)",
                  color: "#00f5ff",
                  border: "1px solid rgba(0,245,255,0.25)",
                }}
                onClick={() =>
                  setCurrency((c) => (c === "USD" ? "ICP" : "USD"))
                }
                data-ocid="wallet.toggle"
              >
                {currency === "USD" ? "USD" : "ICP"}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <p
              className="text-4xl font-bold tracking-tight my-2"
              style={{
                color: "#00f5ff",
                textShadow: "0 0 24px rgba(0,245,255,0.4)",
              }}
            >
              {displayValue}
            </p>

            {/* PnL row */}
            <div className="flex items-center gap-3 mt-1">
              <div
                className="flex items-center gap-1 text-sm font-medium"
                style={{ color: realizedPnL >= 0 ? "#00ff88" : "#ff3366" }}
              >
                {realizedPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                Realized PnL: {realizedPnL >= 0 ? "+" : ""}
                {fmtUsd(realizedPnL)}
              </div>
              <Badge
                className="text-xs"
                style={{
                  background:
                    realizedPnL >= 0
                      ? "rgba(0,255,136,0.12)"
                      : "rgba(255,51,102,0.12)",
                  color: realizedPnL >= 0 ? "#00ff88" : "#ff3366",
                  border: `1px solid ${realizedPnL >= 0 ? "rgba(0,255,136,0.25)" : "rgba(255,51,102,0.25)"}`,
                }}
              >
                {holdings.length} assets
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="w-full rounded-xl p-1"
            style={{ background: "#12121a", border: "1px solid #1e1e2e" }}
          >
            {[
              {
                value: "overview",
                label: "Overview",
                icon: <Wallet className="w-3.5 h-3.5" />,
              },
              {
                value: "deposit",
                label: "Deposit",
                icon: <ArrowDownToLine className="w-3.5 h-3.5" />,
              },
              {
                value: "withdraw",
                label: "Withdraw",
                icon: <ArrowUpFromLine className="w-3.5 h-3.5" />,
              },
              {
                value: "activity",
                label: "Activity",
                icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
              },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 text-xs flex items-center justify-center gap-1.5 rounded-lg transition-all data-[state=active]:text-black"
                style={{
                  color: activeTab === tab.value ? "#0a0a0f" : "#6b7280",
                  background:
                    activeTab === tab.value ? "#00f5ff" : "transparent",
                }}
                data-ocid={`wallet.${tab.value}.tab`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Overview Tab ───────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {holdings.length === 0 ? (
              <div
                className="rounded-xl border p-10 text-center"
                style={{ background: "#12121a", borderColor: "#1e1e2e" }}
                data-ocid="wallet.empty_state"
              >
                <Wallet
                  className="w-10 h-10 mx-auto mb-3"
                  style={{ color: "#1e1e2e" }}
                />
                <p className="text-white font-semibold">No holdings yet</p>
                <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                  Deposit tokens or execute a swap to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {holdings.map((holding) => {
                  const livePrice = priceMap.get(holding.tokenCanisterId) ?? 0;
                  return (
                    <HoldingCard
                      key={holding.tokenCanisterId}
                      holding={holding}
                      livePrice={livePrice}
                      totalValueUsd={portfolioValueUsd}
                      onSwap={() => openSwapFor(holding.tokenCanisterId)}
                      onWithdraw={() =>
                        openWithdrawFor(holding.tokenCanisterId)
                      }
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Deposit Tab ────────────────────────────────────────── */}
          <TabsContent value="deposit" className="mt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border p-6 space-y-6"
              style={{ background: "#12121a", borderColor: "#1e1e2e" }}
              data-ocid="wallet.deposit.panel"
            >
              <div className="text-center">
                <ArrowDownToLine
                  className="w-8 h-8 mx-auto mb-2"
                  style={{ color: "#00f5ff" }}
                />
                <h2 className="text-lg font-bold text-white">
                  Your Deposit Address
                </h2>
                <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
                  Send any ICRC-1 token to this address from NNS, Plug, NFID, or
                  any ICP wallet
                </p>
              </div>

              {/* QR Code */}
              {canisterId && (
                <div className="flex justify-center">
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: "#0a0a0f",
                      border: "1px solid #1e1e2e",
                    }}
                  >
                    <QRCodeSVG
                      value={canisterId}
                      size={180}
                      bgColor="#0a0a0f"
                      fgColor="#00f5ff"
                      level="M"
                    />
                  </div>
                </div>
              )}

              {/* Address box */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
                  Canister Principal
                </p>
                <div
                  className="flex items-center gap-2 rounded-xl p-3"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                >
                  <code
                    className="flex-1 text-sm break-all font-mono"
                    style={{ color: "#00f5ff" }}
                  >
                    {canisterId || "Loading..."}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 w-9 h-9 p-0"
                    onClick={handleCopy}
                    data-ocid="wallet.deposit.upload_button"
                  >
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.span
                          key="check"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                        >
                          <CheckCircle2
                            className="w-4 h-4"
                            style={{ color: "#00ff88" }}
                          />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                        >
                          <Copy
                            className="w-4 h-4"
                            style={{ color: "#9ca3af" }}
                          />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </div>
              </div>

              {/* Refresh Balances */}
              <Button
                className="w-full font-semibold"
                style={{
                  background: "rgba(0,245,255,0.12)",
                  color: "#00f5ff",
                  border: "1px solid rgba(0,245,255,0.3)",
                }}
                onClick={() =>
                  syncBalances.mutate(undefined, {
                    onSuccess: () => toast.success("Balances refreshed!"),
                    onError: (e) => toast.error(String(e)),
                  })
                }
                disabled={syncBalances.isPending}
                data-ocid="wallet.deposit.primary_button"
              >
                {syncBalances.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {syncBalances.isPending ? "Refreshing..." : "Refresh Balances"}
              </Button>

              {syncBalances.isSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg p-3 text-sm"
                  style={{
                    background: "rgba(0,255,136,0.08)",
                    color: "#00ff88",
                    border: "1px solid rgba(0,255,136,0.2)",
                  }}
                  data-ocid="wallet.deposit.success_state"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Balances synced from ledger
                </motion.div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── Withdraw Tab ───────────────────────────────────────── */}
          <TabsContent value="withdraw" className="mt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border p-6 space-y-5"
              style={{ background: "#12121a", borderColor: "#1e1e2e" }}
              data-ocid="wallet.withdraw.panel"
            >
              <div>
                <ArrowUpFromLine
                  className="w-8 h-8 mb-2"
                  style={{ color: "#7b2fff" }}
                />
                <h2 className="text-lg font-bold text-white">
                  Withdraw Tokens
                </h2>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  Transfer tokens from this canister to any ICP wallet.
                </p>
              </div>

              {/* Token selector list */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
                  Select Token
                </p>
                {holdings.length === 0 ? (
                  <p className="text-sm" style={{ color: "#6b7280" }}>
                    No holdings to withdraw.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {holdings.map((h) => {
                      const livePrice = priceMap.get(h.tokenCanisterId) ?? 0;
                      const val = h.balance * livePrice;
                      const isSelected = withdrawToken === h.tokenCanisterId;
                      return (
                        <button
                          type="button"
                          key={h.tokenCanisterId}
                          className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all"
                          style={{
                            background: isSelected
                              ? "rgba(123,47,255,0.15)"
                              : "#0a0a0f",
                            border: `1px solid ${isSelected ? "rgba(123,47,255,0.5)" : "#1e1e2e"}`,
                          }}
                          onClick={() => setWithdrawToken(h.tokenCanisterId)}
                          data-ocid={"wallet.withdraw.radio"}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: isSelected
                                ? "rgba(123,47,255,0.2)"
                                : "rgba(255,255,255,0.04)",
                              color: isSelected ? "#7b2fff" : "#9ca3af",
                            }}
                          >
                            {h.symbol.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">
                              {h.symbol}
                            </p>
                            <p
                              className="text-xs truncate"
                              style={{ color: "#6b7280" }}
                            >
                              {fmt(h.balance, 6)} available
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              {fmtUsd(val)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Amount + destination */}
              {withdrawToken && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p
                        className="text-xs font-medium"
                        style={{ color: "#6b7280" }}
                      >
                        Amount
                      </p>
                      {selectedHolding && (
                        <button
                          type="button"
                          className="text-xs font-semibold"
                          style={{ color: "#00f5ff" }}
                          onClick={() =>
                            setWithdrawAmount(String(selectedHolding.balance))
                          }
                        >
                          MAX {fmt(selectedHolding.balance, 6)}
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-transparent border text-white"
                      style={{ borderColor: "#1e1e2e", background: "#0a0a0f" }}
                      data-ocid="wallet.withdraw.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#6b7280" }}
                    >
                      Destination Principal
                    </p>
                    <Input
                      placeholder="Leave blank to withdraw to your account"
                      value={withdrawDest}
                      onChange={(e) => setWithdrawDest(e.target.value)}
                      className="bg-transparent border text-white text-sm font-mono"
                      style={{ borderColor: "#1e1e2e", background: "#0a0a0f" }}
                      data-ocid="wallet.withdraw.textarea"
                    />
                  </div>

                  <Button
                    className="w-full font-bold text-base py-5"
                    style={{
                      background:
                        withdrawAmount && Number.parseFloat(withdrawAmount) > 0
                          ? "linear-gradient(135deg, #7b2fff, #5b0fd4)"
                          : "rgba(123,47,255,0.2)",
                      color: "#ffffff",
                      border: "1px solid rgba(123,47,255,0.4)",
                    }}
                    disabled={
                      !withdrawAmount ||
                      Number.parseFloat(withdrawAmount) <= 0 ||
                      withdraw.isPending
                    }
                    onClick={handleWithdraw}
                    data-ocid="wallet.withdraw.submit_button"
                  >
                    {withdraw.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="w-4 h-4 mr-2" /> Withdraw
                        Now
                      </>
                    )}
                  </Button>

                  {withdraw.isSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 rounded-lg p-3 text-sm"
                      style={{
                        background: "rgba(0,255,136,0.08)",
                        color: "#00ff88",
                        border: "1px solid rgba(0,255,136,0.2)",
                      }}
                      data-ocid="wallet.withdraw.success_state"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Withdrawal submitted successfully
                    </motion.div>
                  )}
                  {withdraw.isError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 rounded-lg p-3 text-sm"
                      style={{
                        background: "rgba(255,51,102,0.08)",
                        color: "#ff3366",
                        border: "1px solid rgba(255,51,102,0.2)",
                      }}
                      data-ocid="wallet.withdraw.error_state"
                    >
                      <XCircle className="w-4 h-4 shrink-0" />
                      {String(withdraw.error)}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── Activity Tab ───────────────────────────────────────── */}
          <TabsContent value="activity" className="mt-4">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: "#12121a", borderColor: "#1e1e2e" }}
              data-ocid="wallet.activity.panel"
            >
              <div
                className="px-5 py-4 border-b"
                style={{ borderColor: "#1e1e2e" }}
              >
                <h2 className="font-bold text-white">Recent Activity</h2>
                <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                  Latest {activityItems.length} transactions
                </p>
              </div>

              {activityItems.length === 0 ? (
                <div
                  className="p-10 text-center"
                  data-ocid="wallet.activity.empty_state"
                >
                  <ArrowRightLeft
                    className="w-8 h-8 mx-auto mb-2"
                    style={{ color: "#1e1e2e" }}
                  />
                  <p className="text-sm text-white">No activity yet</p>
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                    Swaps and deposits will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#1e1e2e" }}>
                  {activityItems.map((item, idx) => {
                    if (item.type === "swap") {
                      const r = item.data as {
                        id: string;
                        timestamp: bigint;
                        tokenIn: string;
                        amountIn: number;
                        tokenOut: string;
                        amountOut: number;
                        route: string;
                        realizedPnL?: number;
                      };
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="flex items-start gap-3 px-5 py-4"
                          data-ocid={`wallet.activity.item.${idx + 1}`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "rgba(0,245,255,0.12)" }}
                          >
                            <ArrowRightLeft
                              className="w-3.5 h-3.5"
                              style={{ color: "#00f5ff" }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">
                              {r.tokenIn} → {r.tokenOut}
                            </p>
                            <p className="text-xs" style={{ color: "#6b7280" }}>
                              {fmt(r.amountIn, 4)} → {fmt(r.amountOut, 4)} ·{" "}
                              {fmtTs(r.timestamp)}
                            </p>
                            {r.realizedPnL !== undefined &&
                              r.realizedPnL !== 0 && (
                                <p
                                  className="text-xs mt-0.5"
                                  style={{
                                    color:
                                      r.realizedPnL >= 0
                                        ? "#00ff88"
                                        : "#ff3366",
                                  }}
                                >
                                  PnL: {r.realizedPnL >= 0 ? "+" : ""}
                                  {fmtUsd(r.realizedPnL)}
                                </p>
                              )}
                          </div>
                          <div className="text-right shrink-0">
                            <Badge
                              className="text-xs"
                              style={{
                                background: "rgba(0,245,255,0.1)",
                                color: "#00f5ff",
                                border: "1px solid rgba(0,245,255,0.2)",
                              }}
                            >
                              {r.id}
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    }
                    const e = item.data as FundingEntry;
                    const isStaking =
                      e.entryType === FundingEntryType.stakingReward;
                    return (
                      <motion.div
                        key={String(e.id)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-start gap-3 px-5 py-4"
                        data-ocid={`wallet.activity.item.${idx + 1}`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: isStaking
                              ? "rgba(123,47,255,0.12)"
                              : "rgba(0,255,136,0.12)",
                          }}
                        >
                          {isStaking ? (
                            <Zap
                              className="w-3.5 h-3.5"
                              style={{ color: "#7b2fff" }}
                            />
                          ) : (
                            <Plus
                              className="w-3.5 h-3.5"
                              style={{ color: "#00ff88" }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {isStaking ? "Staking Reward" : "Deposit"}
                          </p>
                          <p className="text-xs" style={{ color: "#6b7280" }}>
                            {fmt(e.amountICP, 4)} ICP
                            {e.note ? ` · ${e.note}` : ""} ·{" "}
                            {fmtTs(e.timestamp)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#00ff88" }}
                          >
                            +{fmt(e.amountICP, 4)} ICP
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Floating New Swap Button ──────────────────────────────────── */}
      <motion.button
        type="button"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-20 right-5 sm:bottom-8 sm:right-8 flex items-center gap-2 rounded-full px-5 py-3 font-bold text-sm shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #00f5ff, #00b8c0)",
          color: "#0a0a0f",
          boxShadow: "0 0 24px rgba(0,245,255,0.5), 0 4px 24px rgba(0,0,0,0.4)",
          zIndex: 50,
        }}
        onClick={() => {
          setSwapTokenIn(undefined);
          setSwapDialogOpen(true);
        }}
        data-ocid="wallet.open_modal_button"
      >
        <Zap className="w-4 h-4" />
        New Swap
      </motion.button>

      {/* ── Swap Dialog ──────────────────────────────────────────────── */}
      <SwapExecutionDialog
        open={swapDialogOpen}
        onClose={() => setSwapDialogOpen(false)}
        tokenInAddress={swapTokenIn}
      />
    </div>
  );
}
