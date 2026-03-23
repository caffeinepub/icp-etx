import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Bitcoin,
  CheckCircle2,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
// Inline QR code (simplified deterministic pattern)
function QRCodeSVG({
  value,
  size,
  bgColor,
  fgColor,
}: {
  value: string;
  size: number;
  bgColor: string;
  fgColor: string;
}) {
  const hash = value
    .split("")
    .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const cells = 21;
  const cell = size / cells;
  // Build rects as pre-computed data to avoid index-key issues
  type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
    id: string;
  };
  const rects: Rect[] = [];
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const idx = row * cells + col;
      const on = ((hash * (idx + 1) * 2654435761) >>> 0) % 3 !== 0;
      if (on) {
        rects.push({
          x: col * cell,
          y: row * cell,
          w: cell,
          h: cell,
          fill: fgColor,
          id: `b${row}-${col}`,
        });
      }
    }
  }
  const markers: Rect[] = [];
  for (const [cr, cc] of [
    [0, 0],
    [14, 0],
    [0, 14],
  ] as [number, number][]) {
    markers.push({
      x: cc * cell,
      y: cr * cell,
      w: 7 * cell,
      h: 7 * cell,
      fill: fgColor,
      id: `mo${cr}${cc}`,
    });
    markers.push({
      x: (cc + 1) * cell,
      y: (cr + 1) * cell,
      w: 5 * cell,
      h: 5 * cell,
      fill: bgColor,
      id: `mi${cr}${cc}`,
    });
    markers.push({
      x: (cc + 2) * cell,
      y: (cr + 2) * cell,
      w: 3 * cell,
      h: 3 * cell,
      fill: fgColor,
      id: `mc${cr}${cc}`,
    });
  }
  return (
    <svg
      role="img"
      aria-label={`QR code for ${value}`}
      width={size}
      height={size}
      style={{ background: bgColor }}
      viewBox={`0 0 ${size} ${size}`}
    >
      <title>QR code</title>
      {rects.map((r) => (
        <rect
          key={r.id}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={r.fill}
        />
      ))}
      {markers.map((r) => (
        <rect
          key={r.id}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { FundingEntry } from "../backend";
import { FundingEntryType } from "../backend";
import SwapExecutionDialog from "../components/SwapExecutionDialog";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  buildPriceMap,
  useBtcDepositAddress,
  useCanisterId,
  useDepositBtc,
  useDepositEth,
  useEthDepositAddress,
  useFundingEntries,
  useGrantTradingPermission,
  useHoldings,
  useICPPrice,
  usePortfolioValue,
  useRealizedPnL,
  useSwapReceipts,
  useSyncBalances,
  useTokenUniverse,
  useTradingPermissionExpiry,
  useUniqueDepositAddress,
  useWithdrawWithDenomination,
} from "../hooks/useQueries";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function truncate(s: string, n = 12): string {
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

// ─── HoldingCard ─────────────────────────────────────────────────────────────

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

      <div className="h-1 rounded-full" style={{ background: "#1e1e2e" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: "linear-gradient(90deg, #00f5ff, #7b2fff)",
          }}
        />
      </div>

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

// ─── AddressCard ─────────────────────────────────────────────────────────────

function AddressCard({
  chain,
  label,
  badge,
  subtitle,
  address,
  isLoading,
  qrColor,
  accentColor,
  onCopy,
  onTrigger,
  triggerLabel,
  isTriggerPending,
  icon,
  error,
  onRetry,
}: {
  chain: string;
  label: string;
  badge: string;
  subtitle: string;
  address: string;
  isLoading: boolean;
  qrColor: string;
  accentColor: string;
  onCopy: () => void;
  onTrigger?: () => void;
  triggerLabel?: string;
  isTriggerPending?: boolean;
  icon: React.ReactNode;
  error?: string;
  onRetry?: () => void;
}) {
  const [localCopied, setLocalCopied] = useState(false);

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setLocalCopied(true);
    onCopy();
    setTimeout(() => setLocalCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border p-5 space-y-4"
      style={{
        background: "#12121a",
        borderColor: `${accentColor}33`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: `${accentColor}1a`,
              border: `1px solid ${accentColor}44`,
              color: accentColor,
            }}
          >
            {icon}
          </div>
          <div>
            <p className="font-bold text-sm text-white">{label}</p>
            <p className="text-xs" style={{ color: "#6b7280" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <Badge
          className="text-xs font-semibold"
          style={{
            background: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}44`,
          }}
        >
          {badge}
        </Badge>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        {isLoading ? (
          <div
            className="w-[148px] h-[148px] rounded-xl flex items-center justify-center"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
          >
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: accentColor }}
            />
          </div>
        ) : address ? (
          <div
            className="p-3 rounded-xl"
            style={{
              background: "#0a0a0f",
              border: "1px solid #1e1e2e",
              boxShadow: `0 0 24px ${accentColor}26`,
            }}
          >
            <QRCodeSVG
              value={address}
              size={140}
              bgColor="#0a0a0f"
              fgColor={qrColor}
            />
          </div>
        ) : (
          <div
            className="w-[148px] h-[148px] rounded-xl flex items-center justify-center text-xs text-center px-3"
            style={{
              background: "#0a0a0f",
              border: "1px solid #1e1e2e",
              color: "#6b7280",
            }}
          >
            Address unavailable
          </div>
        )}
      </div>

      {/* Address box */}
      <div
        className="flex items-center gap-2 rounded-xl p-3"
        style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
      >
        <code
          className="flex-1 text-xs break-all font-mono"
          style={{ color: accentColor }}
        >
          {isLoading ? "Fetching address..." : address || "Address unavailable"}
        </code>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 w-9 h-9 p-0"
          onClick={handleCopy}
          disabled={!address || isLoading}
          data-ocid={`wallet.deposit.${chain.toLowerCase()}.upload_button`}
        >
          <AnimatePresence mode="wait">
            {localCopied ? (
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
                <Copy className="w-4 h-4" style={{ color: "#9ca3af" }} />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {/* Error + individual retry */}
      {error && (
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: "#ff3366" }}>
            ❌ {error}
          </p>
          {onRetry && (
            <Button
              size="sm"
              className="w-full text-xs font-semibold"
              style={{
                background: "rgba(255,51,102,0.12)",
                color: "#ff3366",
                border: "1px solid rgba(255,51,102,0.35)",
              }}
              onClick={onRetry}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry This Address
            </Button>
          )}
        </div>
      )}

      {/* Trigger conversion button */}
      {onTrigger && triggerLabel && (
        <Button
          className="w-full text-sm font-semibold"
          style={{
            background: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}44`,
          }}
          onClick={onTrigger}
          disabled={isTriggerPending}
          data-ocid={`wallet.deposit.${chain.toLowerCase()}.primary_button`}
        >
          {isTriggerPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {isTriggerPending ? "Processing..." : triggerLabel}
        </Button>
      )}
    </motion.div>
  );
}

// ─── IIReAuthModal ────────────────────────────────────────────────────────────

function IIReAuthModal({
  isOpen,
  withdrawAmount,
  outputToken,
  destination,
  onCancel,
  onConfirm,
  isConfirming,
}: {
  isOpen: boolean;
  withdrawToken: string;
  withdrawAmount: string;
  outputToken: string;
  destination: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,10,15,0.92)" }}
          data-ocid="wallet.withdraw.modal"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-5"
            style={{ background: "#12121a", borderColor: "#1e1e2e" }}
          >
            {/* Icon + title */}
            <div className="flex flex-col items-center text-center gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(0,245,255,0.1)",
                  border: "1px solid rgba(0,245,255,0.3)",
                }}
              >
                <Shield className="w-7 h-7" style={{ color: "#00f5ff" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Verify Your Identity
                </h2>
                <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
                  For security, please re-authenticate with Internet Identity
                  before withdrawing.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
            >
              <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
                Withdrawal Summary
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "#9ca3af" }}>Amount</span>
                  <span className="font-semibold text-white">
                    {withdrawAmount} tokens
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#9ca3af" }}>Output as</span>
                  <span className="font-semibold" style={{ color: "#00f5ff" }}>
                    {outputToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#9ca3af" }}>To</span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: "#9ca3af" }}
                  >
                    {truncate(destination, 8)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs"
              style={{
                background: "rgba(247,147,26,0.08)",
                border: "1px solid rgba(247,147,26,0.2)",
                color: "#f7931a",
              }}
            >
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This action will transfer tokens from your smart wallet. Verify
                the destination address carefully — blockchain transactions are
                irreversible.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 font-semibold"
                style={{
                  background: "transparent",
                  borderColor: "#1e1e2e",
                  color: "#9ca3af",
                }}
                onClick={onCancel}
                disabled={isConfirming}
                data-ocid="wallet.withdraw.cancel_button"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-bold"
                style={{
                  background: isConfirming
                    ? "rgba(0,245,255,0.2)"
                    : "linear-gradient(135deg, #00f5ff, #00b8c0)",
                  color: isConfirming ? "#00f5ff" : "#0a0a0f",
                  border: "1px solid rgba(0,245,255,0.4)",
                }}
                onClick={onConfirm}
                disabled={isConfirming}
                data-ocid="wallet.withdraw.confirm_button"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Confirm with Internet Identity
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type OutputToken = "ICP" | "ckBTC" | "ckETH" | "Individual";

export default function WalletPage() {
  const [currency, setCurrency] = useState<"USD" | "ICP">("USD");
  const [activeTab, setActiveTab] = useState("overview");
  const [icpError, setIcpError] = useState<string | null>(null);
  const [btcError, setBtcError] = useState<string | null>(null);
  const [ethError, setEthError] = useState<string | null>(null);
  // Debug panel state
  const [icpRawResponse, setIcpRawResponse] = useState<string>("");
  const [btcRawResponse, setBtcRawResponse] = useState<string>("");
  const [ethRawResponse, setEthRawResponse] = useState<string>("");
  const [icpTestError, setIcpTestError] = useState<string>("");
  const [btcTestError, setBtcTestError] = useState<string>("");
  const [ethTestError, setEthTestError] = useState<string>("");
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTokenIn, setSwapTokenIn] = useState<string | undefined>();

  // Withdraw state
  const [withdrawToken, setWithdrawToken] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [withdrawOutputToken, setWithdrawOutputToken] =
    useState<OutputToken>("Individual");
  const [showIIModal, setShowIIModal] = useState(false);
  const [isIIConfirming, setIsIIConfirming] = useState(false);
  const pendingWithdrawRef = useRef(false);

  // Data hooks
  const { data: portfolioValueUsd = 0 } = usePortfolioValue();
  const { data: holdings = [] } = useHoldings();
  const { data: swapReceipts = [] } = useSwapReceipts();
  const { data: fundingEntries = [] } = useFundingEntries();
  const { data: canisterId = "" } = useCanisterId();
  const { icpPriceUsd = 0 } = useICPPrice();
  const { data: realizedPnL = 0 } = useRealizedPnL();
  const { tokens } = useTokenUniverse();
  const syncBalances = useSyncBalances();
  const withdrawWithDenomination = useWithdrawWithDenomination();

  // Deposit address hooks
  const {
    data: icpAddress = "",
    isLoading: icpAddrLoading,
    refetch: refetchIcp,
  } = useUniqueDepositAddress();
  const {
    data: btcAddress = "",
    isLoading: btcAddrLoading,
    refetch: refetchBtc,
  } = useBtcDepositAddress();
  const {
    data: ethAddress = "",
    isLoading: ethAddrLoading,
    refetch: refetchEth,
  } = useEthDepositAddress();
  const depositBtc = useDepositBtc();
  const depositEth = useDepositEth();
  const grantPermission = useGrantTradingPermission();
  const { data: permissionExpiry } = useTradingPermissionExpiry();

  // II auth
  const { login, loginStatus, identity } = useInternetIdentity();
  const { actor } = useActor();

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

  // Watch loginStatus to trigger withdrawal after II re-auth
  useEffect(() => {
    if (loginStatus === "success" && pendingWithdrawRef.current) {
      pendingWithdrawRef.current = false;
      setIsIIConfirming(false);
      setShowIIModal(false);
      executeWithdrawal();
    } else if (loginStatus === "loginError" && pendingWithdrawRef.current) {
      pendingWithdrawRef.current = false;
      setIsIIConfirming(false);
      toast.error("Identity verification failed. Withdrawal cancelled.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginStatus]);

  // Debug: log deposit addresses as they load
  useEffect(() => {
    if (icpAddress) console.log("✅ ICP Address loaded:", icpAddress);
  }, [icpAddress]);
  useEffect(() => {
    if (btcAddress) console.log("✅ BTC Address loaded:", btcAddress);
  }, [btcAddress]);
  useEffect(() => {
    if (ethAddress) console.log("✅ ETH Address loaded:", ethAddress);
  }, [ethAddress]);

  // Force-fetch all deposit addresses: 8 retries, 1.2s delay, per-address tracking
  const depositMountedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount via ref guard
  useEffect(() => {
    if (!identity) return;
    if (depositMountedRef.current) return;
    depositMountedRef.current = true;

    const MAX = 8;
    const DELAY = 1200;

    const retryAddr = async (
      name: string,
      fetchFn: () => Promise<unknown>,
      check: () => boolean,
      onError: (msg: string) => void,
      clearError: () => void,
    ) => {
      clearError();
      for (let attempt = 1; attempt <= MAX; attempt++) {
        console.log(`🔄 Attempt ${attempt}/${MAX} for ${name}`);
        try {
          await fetchFn();
          if (check()) {
            console.log(`✅ Loaded ${name}`);
            clearError();
            return;
          }
        } catch (e) {
          console.log(`❌ Failed ${name} attempt ${attempt}:`, e);
        }
        if (attempt < MAX) await new Promise((r) => setTimeout(r, DELAY));
      }
      const msg = `Failed to load after ${MAX} attempts`;
      console.log(`❌ Failed ${name}: ${msg}`);
      onError(msg);
    };

    retryAddr(
      "ICP",
      () => refetchIcp(),
      () => !!icpAddress,
      (m) => setIcpError(m),
      () => setIcpError(null),
    );
    retryAddr(
      "BTC",
      () => refetchBtc(),
      () => !!btcAddress,
      (m) => setBtcError(m),
      () => setBtcError(null),
    );
    retryAddr(
      "ETH",
      () => refetchEth(),
      () => !!ethAddress,
      (m) => setEthError(m),
      () => setEthError(null),
    );
  }, [actor, identity]);

  const retryIcp = useCallback(async () => {
    setIcpError(null);
    const MAX = 8;
    const DELAY = 1200;
    for (let i = 1; i <= MAX; i++) {
      console.log(`🔄 Attempt ${i}/${MAX} for ICP`);
      try {
        await refetchIcp();
        if (icpAddress) {
          console.log("✅ Loaded ICP");
          return;
        }
      } catch (e) {
        console.log(`❌ Failed ICP attempt ${i}:`, e);
      }
      if (i < MAX) await new Promise((r) => setTimeout(r, DELAY));
    }
    setIcpError(`Failed to load after ${MAX} attempts`);
  }, [refetchIcp, icpAddress]);

  const retryBtc = useCallback(async () => {
    setBtcError(null);
    const MAX = 8;
    const DELAY = 1200;
    for (let i = 1; i <= MAX; i++) {
      console.log(`🔄 Attempt ${i}/${MAX} for BTC`);
      try {
        await refetchBtc();
        if (btcAddress) {
          console.log("✅ Loaded BTC");
          return;
        }
      } catch (e) {
        console.log(`❌ Failed BTC attempt ${i}:`, e);
      }
      if (i < MAX) await new Promise((r) => setTimeout(r, DELAY));
    }
    setBtcError(`Failed to load after ${MAX} attempts`);
  }, [refetchBtc, btcAddress]);

  const retryEth = useCallback(async () => {
    setEthError(null);
    const MAX = 8;
    const DELAY = 1200;
    for (let i = 1; i <= MAX; i++) {
      console.log(`🔄 Attempt ${i}/${MAX} for ETH`);
      try {
        await refetchEth();
        if (ethAddress) {
          console.log("✅ Loaded ETH");
          return;
        }
      } catch (e) {
        console.log(`❌ Failed ETH attempt ${i}:`, e);
      }
      if (i < MAX) await new Promise((r) => setTimeout(r, DELAY));
    }
    setEthError(`Failed to load after ${MAX} attempts`);
  }, [refetchEth, ethAddress]);

  const testIcpAddress = useCallback(async () => {
    setIcpTestError("");
    setIcpRawResponse("Testing...");
    try {
      console.log("[Debug] Testing ICP address...", {
        actor: !!actor,
        identity: !!identity,
      });
      const result = await (actor as any).getUniqueDepositAddress();
      const raw = String(result ?? "null/undefined");
      console.log("[Debug] ICP raw response:", raw);
      setIcpRawResponse(raw);
      setIcpTestError("");
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      console.error("[Debug] ICP test error:", errMsg);
      setIcpRawResponse("");
      setIcpTestError(errMsg);
    }
  }, [actor, identity]);

  const testBtcAddress = useCallback(async () => {
    setBtcTestError("");
    setBtcRawResponse("Testing...");
    try {
      console.log("[Debug] Testing BTC address...", {
        actor: !!actor,
        identity: !!identity,
      });
      const result = await (actor as any).getBtcDepositAddress();
      const raw = String(result ?? "null/undefined");
      console.log("[Debug] BTC raw response:", raw);
      setBtcRawResponse(raw);
      setBtcTestError("");
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      console.error("[Debug] BTC test error:", errMsg);
      setBtcRawResponse("");
      setBtcTestError(errMsg);
    }
  }, [actor, identity]);

  const testEthAddress = useCallback(async () => {
    setEthTestError("");
    setEthRawResponse("Testing...");
    try {
      console.log("[Debug] Testing ETH address...", {
        actor: !!actor,
        identity: !!identity,
      });
      const result = await (actor as any).getEthDepositAddress();
      const raw = String(result ?? "null/undefined");
      console.log("[Debug] ETH raw response:", raw);
      setEthRawResponse(raw);
      setEthTestError("");
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      console.error("[Debug] ETH test error:", errMsg);
      setEthRawResponse("");
      setEthTestError(errMsg);
    }
  }, [actor, identity]);

  const runAllTests = useCallback(async () => {
    setIsTestRunning(true);
    console.log("[Debug] Running all tests...");
    await Promise.all([testIcpAddress(), testBtcAddress(), testEthAddress()]);
    setIsTestRunning(false);
    console.log("[Debug] All tests complete");
  }, [testIcpAddress, testBtcAddress, testEthAddress]);

  function executeWithdrawal() {
    if (!withdrawToken || !withdrawAmount || !withdrawDest) return;
    const amount = Number.parseFloat(withdrawAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    withdrawWithDenomination.mutate(
      {
        sourceToken: withdrawToken,
        amount,
        outputToken: withdrawOutputToken,
        destination: withdrawDest,
      },
      {
        onSuccess: (msg) => {
          toast.success(
            typeof msg === "string" ? msg : "Withdrawal submitted!",
          );
          setWithdrawAmount("");
          setWithdrawDest("");
        },
        onError: (err) => {
          toast.error(String(err));
        },
      },
    );
  }

  function handleWithdrawNow() {
    if (!withdrawToken || !withdrawAmount || !withdrawDest) return;
    setShowIIModal(true);
  }

  function handleIIConfirm() {
    setIsIIConfirming(true);
    // If identity already exists, proceed directly
    if (identity) {
      pendingWithdrawRef.current = false;
      setIsIIConfirming(false);
      setShowIIModal(false);
      executeWithdrawal();
    } else {
      pendingWithdrawRef.current = true;
      login();
    }
  }

  function handleIICancel() {
    pendingWithdrawRef.current = false;
    setIsIIConfirming(false);
    setShowIIModal(false);
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
        {/* ── Hero Card ──────────────────────────────────────────────── */}
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
                  border: `1px solid ${
                    realizedPnL >= 0
                      ? "rgba(0,255,136,0.25)"
                      : "rgba(255,51,102,0.25)"
                  }`,
                }}
              >
                {holdings.length} assets
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
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

          {/* ── Overview Tab ──────────────────────────────────────────── */}
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

          {/* ── Deposit Tab ───────────────────────────────────────────── */}
          <TabsContent value="deposit" className="mt-4 space-y-4">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-2"
            >
              <h2
                className="text-xl font-bold text-white"
                style={{ textShadow: "0 0 20px rgba(0,245,255,0.25)" }}
              >
                Multi-Chain Deposit
              </h2>
              <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
                Receive ICP, Bitcoin, or Ethereum directly to your smart wallet
              </p>
              <p
                className="text-xs mt-2 font-semibold"
                style={{ color: "#00f5ff", opacity: 0.8 }}
              >
                Addresses generated once per Internet Identity — persistent
                forever
              </p>
            </motion.div>

            {/* ICP / ICRC-1 Card */}
            <AddressCard
              chain="icp"
              label="ICP / ICRC-1 Tokens"
              badge="Native"
              subtitle="Send ICP or any ICRC-1 token from NNS, NFID, or any ICP wallet"
              address={icpAddress || canisterId}
              isLoading={icpAddrLoading && !canisterId}
              qrColor="#00f5ff"
              accentColor="#00f5ff"
              onCopy={() => toast.success("ICP deposit address copied!")}
              icon={<Wallet className="w-4 h-4" />}
              error={icpError ?? undefined}
              onRetry={retryIcp}
            />

            {/* Bitcoin Card */}
            <AddressCard
              chain="btc"
              label="Bitcoin (BTC)"
              badge="Auto-Convert"
              subtitle="Send BTC here — automatically converted to ckBTC"
              address={btcAddress}
              isLoading={btcAddrLoading}
              qrColor="#f7931a"
              accentColor="#f7931a"
              onCopy={() => toast.success("Bitcoin deposit address copied!")}
              error={btcError ?? undefined}
              onRetry={retryBtc}
              onTrigger={() =>
                depositBtc.mutate(undefined, {
                  onSuccess: (msg) =>
                    toast.success(
                      typeof msg === "string"
                        ? msg
                        : "ckBTC conversion triggered!",
                    ),
                  onError: (e) => toast.error(String(e)),
                })
              }
              triggerLabel="Trigger ckBTC Conversion"
              isTriggerPending={depositBtc.isPending}
              icon={<Bitcoin className="w-4 h-4" />}
            />

            {/* Ethereum Card */}
            <AddressCard
              chain="eth"
              label="Ethereum (ETH)"
              badge="Auto-Convert"
              subtitle="Send ETH here — automatically converted to ckETH"
              address={ethAddress}
              isLoading={ethAddrLoading}
              qrColor="#627eea"
              accentColor="#627eea"
              onCopy={() => toast.success("Ethereum deposit address copied!")}
              error={ethError ?? undefined}
              onRetry={retryEth}
              onTrigger={() =>
                depositEth.mutate(undefined, {
                  onSuccess: (msg) =>
                    toast.success(
                      typeof msg === "string"
                        ? msg
                        : "ckETH conversion triggered!",
                    ),
                  onError: (e) => toast.error(String(e)),
                })
              }
              triggerLabel="Trigger ckETH Conversion"
              isTriggerPending={depositEth.isPending}
              icon={
                <span
                  className="text-xs font-bold"
                  style={{ color: "#627eea" }}
                >
                  Ξ
                </span>
              }
            />

            {/* Grant 24hr Trading Permission */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 space-y-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,245,255,0.08), rgba(0,245,255,0.04))",
                border: "1px solid rgba(0,245,255,0.35)",
                boxShadow: "0 0 20px rgba(0,245,255,0.08)",
              }}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: "#00f5ff" }} />
                <span className="font-bold text-white text-sm">
                  24hr Trading Permission
                </span>
              </div>
              <p className="text-xs" style={{ color: "#9ca3af" }}>
                Required for autonomous agent trades. Grant once every 24 hours.
              </p>
              {permissionExpiry &&
              Number(permissionExpiry) > Date.now() * 1_000_000 ? (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{
                    background: "rgba(0,255,136,0.1)",
                    color: "#00ff88",
                    border: "1px solid rgba(0,255,136,0.25)",
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Permission active until{" "}
                  {new Date(
                    Number(permissionExpiry) / 1_000_000,
                  ).toLocaleString()}
                </div>
              ) : (
                <Button
                  className="w-full font-bold text-sm py-2"
                  style={{
                    background: "linear-gradient(135deg, #00f5ff, #00c8d4)",
                    color: "#0a0a0f",
                    boxShadow: "0 0 16px rgba(0,245,255,0.4)",
                    border: "none",
                  }}
                  onClick={() =>
                    grantPermission.mutate(undefined, {
                      onSuccess: () =>
                        toast.success("✅ 24hr trading permission granted!"),
                      onError: (e) => toast.error(String(e)),
                    })
                  }
                  disabled={!identity || grantPermission.isPending}
                  data-ocid="wallet.deposit.primary_button"
                >
                  {grantPermission.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {grantPermission.isPending
                    ? "Granting..."
                    : "Grant 24hr Trading Permission"}
                </Button>
              )}
            </motion.div>

            {/* Refresh Addresses */}
            <Button
              className="w-full font-semibold text-base py-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(123,47,255,0.25), rgba(0,245,255,0.15))",
                color: "#00f5ff",
                border: "1px solid rgba(0,245,255,0.4)",
                boxShadow: "0 0 16px rgba(0,245,255,0.15)",
              }}
              onClick={() => {
                retryIcp();
                retryBtc();
                retryEth();
              }}
              disabled={icpAddrLoading || btcAddrLoading || ethAddrLoading}
              data-ocid="wallet.deposit.secondary_button"
            >
              {icpAddrLoading || btcAddrLoading || ethAddrLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {icpAddrLoading || btcAddrLoading || ethAddrLoading
                ? "Loading addresses..."
                : "Force Refresh All 3 Addresses"}
            </Button>

            {/* Refresh Balances */}
            <Button
              className="w-full font-semibold"
              style={{
                background: "rgba(0,245,255,0.08)",
                color: "#00f5ff",
                border: "1px solid rgba(0,245,255,0.2)",
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

            {/* ── Debug Panel ───────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 space-y-4 mt-4"
              style={{
                background: "rgba(255,255,0,0.04)",
                border: "1px solid rgba(255,255,0,0.25)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold"
                  style={{ color: "#facc15" }}
                >
                  🔬 DEBUG PANEL
                </span>
              </div>
              {/* Principal & Actor Status */}
              <div
                className="space-y-1 text-xs font-mono"
                style={{ color: "#9ca3af" }}
              >
                <div>
                  <span style={{ color: "#facc15" }}>
                    Current II Principal:{" "}
                  </span>
                  <span style={{ color: "#fff", wordBreak: "break-all" }}>
                    {identity?.getPrincipal().toString() ?? "Not authenticated"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#facc15" }}>Actor Status: </span>
                  <span
                    style={{
                      color: !identity
                        ? "#facc15"
                        : actor
                          ? "#00ff88"
                          : "#ef4444",
                    }}
                  >
                    {!identity
                      ? "Authenticating..."
                      : actor
                        ? "Ready"
                        : "Not Ready"}
                  </span>
                </div>
              </div>
              {/* ICP Test */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: "rgba(0,245,255,0.06)",
                  border: "1px solid rgba(0,245,255,0.2)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: "#00f5ff" }}
                  >
                    ICP Address Test
                  </span>
                  <Button
                    size="sm"
                    className="text-xs px-3 py-1 h-7"
                    style={{
                      background: "rgba(0,245,255,0.15)",
                      color: "#00f5ff",
                      border: "1px solid rgba(0,245,255,0.4)",
                    }}
                    onClick={testIcpAddress}
                    disabled={!identity}
                  >
                    Test ICP Address
                  </Button>
                </div>
                {icpRawResponse && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#9ca3af" }}
                  >
                    <span style={{ color: "#facc15" }}>Raw Response: </span>
                    <span style={{ color: "#fff", wordBreak: "break-all" }}>
                      {icpRawResponse}
                    </span>
                  </div>
                )}
                {icpTestError && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#ef4444", wordBreak: "break-all" }}
                  >
                    ❌ Error: {icpTestError}
                  </div>
                )}
              </div>
              {/* BTC Test */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: "rgba(247,147,26,0.06)",
                  border: "1px solid rgba(247,147,26,0.2)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: "#f7931a" }}
                  >
                    BTC Address Test
                  </span>
                  <Button
                    size="sm"
                    className="text-xs px-3 py-1 h-7"
                    style={{
                      background: "rgba(247,147,26,0.15)",
                      color: "#f7931a",
                      border: "1px solid rgba(247,147,26,0.4)",
                    }}
                    onClick={testBtcAddress}
                    disabled={!identity}
                  >
                    Test BTC Address
                  </Button>
                </div>
                {btcRawResponse && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#9ca3af" }}
                  >
                    <span style={{ color: "#facc15" }}>Raw Response: </span>
                    <span style={{ color: "#fff", wordBreak: "break-all" }}>
                      {btcRawResponse}
                    </span>
                  </div>
                )}
                {btcTestError && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#ef4444", wordBreak: "break-all" }}
                  >
                    ❌ Error: {btcTestError}
                  </div>
                )}
              </div>
              {/* ETH Test */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: "rgba(98,126,234,0.06)",
                  border: "1px solid rgba(98,126,234,0.2)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: "#627eea" }}
                  >
                    ETH Address Test
                  </span>
                  <Button
                    size="sm"
                    className="text-xs px-3 py-1 h-7"
                    style={{
                      background: "rgba(98,126,234,0.15)",
                      color: "#627eea",
                      border: "1px solid rgba(98,126,234,0.4)",
                    }}
                    onClick={testEthAddress}
                    disabled={!identity}
                  >
                    Test ETH Address
                  </Button>
                </div>
                {ethRawResponse && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#9ca3af" }}
                  >
                    <span style={{ color: "#facc15" }}>Raw Response: </span>
                    <span style={{ color: "#fff", wordBreak: "break-all" }}>
                      {ethRawResponse}
                    </span>
                  </div>
                )}
                {ethTestError && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: "#ef4444", wordBreak: "break-all" }}
                  >
                    ❌ Error: {ethTestError}
                  </div>
                )}
              </div>
              {/* Run All Tests Button */}
              <Button
                className="w-full font-bold text-sm py-2"
                style={{
                  background: isTestRunning
                    ? "rgba(250,204,21,0.1)"
                    : "linear-gradient(135deg, rgba(250,204,21,0.2), rgba(250,204,21,0.1))",
                  color: "#facc15",
                  border: "1px solid rgba(250,204,21,0.4)",
                  boxShadow: "0 0 12px rgba(250,204,21,0.1)",
                }}
                onClick={runAllTests}
                disabled={!identity || isTestRunning}
              >
                {isTestRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>🔬 Run All Tests</>
                )}
              </Button>
            </motion.div>
          </TabsContent>

          {/* ── Withdraw Tab ──────────────────────────────────────────── */}
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
                  className="w-7 h-7 mb-2"
                  style={{ color: "#00f5ff" }}
                />
                <h2 className="text-lg font-bold text-white">
                  Withdraw Tokens
                </h2>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  Transfer tokens from your smart wallet. II re-auth required.
                </p>
              </div>

              {/* Token selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
                  Select Token
                </p>
                {holdings.length === 0 ? (
                  <p
                    className="text-sm py-2"
                    style={{ color: "#6b7280" }}
                    data-ocid="wallet.withdraw.empty_state"
                  >
                    No holdings to withdraw.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {holdings.map((h) => {
                      const isSelected = withdrawToken === h.tokenCanisterId;
                      return (
                        <button
                          type="button"
                          key={h.tokenCanisterId}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                          style={{
                            background: isSelected
                              ? "rgba(0,245,255,0.15)"
                              : "#0a0a0f",
                            border: `1px solid ${
                              isSelected ? "rgba(0,245,255,0.5)" : "#1e1e2e"
                            }`,
                            color: isSelected ? "#00f5ff" : "#9ca3af",
                          }}
                          onClick={() => setWithdrawToken(h.tokenCanisterId)}
                          data-ocid="wallet.withdraw.radio"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: isSelected
                                ? "rgba(0,245,255,0.2)"
                                : "rgba(255,255,255,0.05)",
                              color: isSelected ? "#00f5ff" : "#6b7280",
                            }}
                          >
                            {h.symbol.slice(0, 2)}
                          </div>
                          {h.symbol}
                          <span
                            className="text-xs"
                            style={{
                              color: isSelected ? "#00f5ff99" : "#4b5563",
                            }}
                          >
                            {fmt(h.balance, 4)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {withdrawToken && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4"
                >
                  {/* Amount */}
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
                      style={{
                        borderColor: "#1e1e2e",
                        background: "#0a0a0f",
                      }}
                      data-ocid="wallet.withdraw.input"
                    />
                  </div>

                  {/* Withdraw as dropdown */}
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#6b7280" }}
                    >
                      Withdraw as
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {(
                        ["Individual", "ICP", "ckBTC", "ckETH"] as OutputToken[]
                      ).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                          style={{
                            background:
                              withdrawOutputToken === opt
                                ? "rgba(0,245,255,0.15)"
                                : "#0a0a0f",
                            border: `1px solid ${
                              withdrawOutputToken === opt
                                ? "rgba(0,245,255,0.5)"
                                : "#1e1e2e"
                            }`,
                            color:
                              withdrawOutputToken === opt
                                ? "#00f5ff"
                                : "#9ca3af",
                          }}
                          onClick={() => setWithdrawOutputToken(opt)}
                          data-ocid="wallet.withdraw.select"
                        >
                          {opt === "Individual" ? "As-Is" : opt}
                        </button>
                      ))}
                    </div>
                    {withdrawOutputToken !== "Individual" && (
                      <p className="text-xs" style={{ color: "#f7931a" }}>
                        ⚡ Conversion requires active 24h trading permission.
                      </p>
                    )}
                  </div>

                  {/* Destination */}
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#6b7280" }}
                    >
                      Destination Principal
                    </p>
                    <Input
                      placeholder="Enter destination wallet principal"
                      value={withdrawDest}
                      onChange={(e) => setWithdrawDest(e.target.value)}
                      className="bg-transparent border text-white text-sm font-mono"
                      style={{
                        borderColor: withdrawDest
                          ? "rgba(0,245,255,0.3)"
                          : "#1e1e2e",
                        background: "#0a0a0f",
                      }}
                      data-ocid="wallet.withdraw.textarea"
                    />
                  </div>

                  {/* Withdraw Now button */}
                  <Button
                    className="w-full font-bold text-base py-5"
                    style={{
                      background:
                        withdrawAmount &&
                        Number.parseFloat(withdrawAmount) > 0 &&
                        withdrawDest
                          ? "linear-gradient(135deg, #00f5ff, #00b8c0)"
                          : "rgba(0,245,255,0.1)",
                      color:
                        withdrawAmount &&
                        Number.parseFloat(withdrawAmount) > 0 &&
                        withdrawDest
                          ? "#0a0a0f"
                          : "#00f5ff66",
                      border: "1px solid rgba(0,245,255,0.3)",
                    }}
                    disabled={
                      !withdrawAmount ||
                      Number.parseFloat(withdrawAmount) <= 0 ||
                      !withdrawDest ||
                      withdrawWithDenomination.isPending
                    }
                    onClick={handleWithdrawNow}
                    data-ocid="wallet.withdraw.submit_button"
                  >
                    {withdrawWithDenomination.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" /> Withdraw Now
                      </>
                    )}
                  </Button>

                  {withdrawWithDenomination.isSuccess && (
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
                  {withdrawWithDenomination.isError && (
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
                      {String(withdrawWithDenomination.error)}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── Activity Tab ──────────────────────────────────────────── */}
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

      {/* ── Floating New Swap Button ─────────────────────────────────────── */}
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

      {/* ── Swap Dialog ─────────────────────────────────────────────────── */}
      <SwapExecutionDialog
        open={swapDialogOpen}
        onClose={() => setSwapDialogOpen(false)}
        tokenInAddress={swapTokenIn}
      />

      {/* ── II Re-Auth Modal ─────────────────────────────────────────────── */}
      <IIReAuthModal
        isOpen={showIIModal}
        withdrawToken={withdrawToken}
        withdrawAmount={withdrawAmount}
        outputToken={withdrawOutputToken}
        destination={withdrawDest}
        onCancel={handleIICancel}
        onConfirm={handleIIConfirm}
        isConfirming={isIIConfirming}
      />
    </div>
  );
}
