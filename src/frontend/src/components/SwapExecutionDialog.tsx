import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActor } from "@/hooks/useActor";
import {
  useAvailableICPBalance,
  useExecuteSwap,
  useHolding,
  useSwapQuote,
  useToken,
  useTokenSearch,
} from "@/hooks/useQueries";
import { useRouteComparison } from "@/hooks/useRouteComparison";
import { computeATR } from "@/lib/indicators";
import { cn } from "@/lib/utils";
import type { DEXRoute } from "@/types/dexRoutes";
import { PRICE_IMPACT_THRESHOLDS } from "@/types/dexRoutes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import TradeFrequencyBar from "./TradeFrequencyBar";

interface SwapExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  tokenInAddress?: string;
  tokenOutAddress?: string;
  amountInUsd?: number;
  riskTier?: string;
}

function getPriceImpactColor(impact: number, riskTier: string): string {
  const t =
    PRICE_IMPACT_THRESHOLDS[riskTier] ?? PRICE_IMPACT_THRESHOLDS.Moderate;
  if (impact <= t.green) return "text-success";
  if (impact <= t.yellow) return "text-warning";
  if (impact <= t.orange) return "text-amber-400";
  if (impact <= t.red) return "text-destructive";
  return "text-destructive font-bold";
}

const DEX_LABELS: Record<string, string> = {
  ICPSwap: "ICPSwap",
  KongSwap: "KongSwap",
  ViaICP_ICPSwap: "ICPSwap (via ICP)",
  ViaICP_KongSwap: "KongSwap (via ICP)",
};

function RouteRow({ route }: { route: DEXRoute }) {
  const isUnavailable = !route.available;
  const isBlocked = route.available && route.blockedByRisk;
  const isBest = route.recommended;

  return (
    <tr
      className={cn(
        "border-b border-border/50 text-sm transition-colors",
        isUnavailable && "opacity-30",
        isBlocked && "opacity-50",
        isBest && "bg-success/5",
      )}
    >
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-medium",
              isBest ? "text-success" : "text-foreground",
            )}
          >
            {DEX_LABELS[route.dex]}
          </span>
          {isBest && (
            <Badge className="text-[10px] px-1.5 py-0 bg-success/20 text-success border-success/30">
              Best
            </Badge>
          )}
          {isBlocked && route.blockReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock size={12} className="text-destructive cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">{route.blockReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="py-2 pr-3 text-right font-mono text-xs">
        {isUnavailable ? "—" : route.estimatedOutput.toFixed(4)}
      </td>
      <td className="py-2 pr-3 text-right text-xs">
        {isUnavailable ? "—" : `${route.estimatedSlippage.toFixed(2)}%`}
      </td>
      <td className="py-2 pr-3 text-right text-xs">
        {isUnavailable ? "—" : `$${route.fees.toFixed(2)}`}
      </td>
      <td className="py-2 pr-3 text-right text-xs">
        {isUnavailable ? "—" : `${route.liquidityDepthMultiple.toFixed(1)}x`}
      </td>
      <td className="py-2 text-right">
        {isUnavailable ? (
          <span className="text-xs text-muted-foreground">N/A</span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  isBest ? "bg-success" : "bg-primary/60",
                )}
                style={{ width: `${route.score}%` }}
              />
            </div>
            <span className="text-xs font-mono w-6 text-right">
              {route.score}
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}

type SlippageOption = 0.5 | 1 | 2 | "auto";

function TokenSelectorPopover({
  selectedAddress,
  onSelect,
  label,
  dataOcid,
}: {
  selectedAddress: string;
  onSelect: (address: string) => void;
  label: string;
  dataOcid?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const results = useTokenSearch(searchQuery);
  const selected = useToken(selectedAddress);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-ocid={dataOcid}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:border-cyan-500/50 transition-colors text-sm min-w-[140px] justify-between"
        >
          <span
            className={
              selected ? "text-foreground font-medium" : "text-muted-foreground"
            }
          >
            {selected ? `${selected.symbol}` : `Select ${label} token`}
          </span>
          <ChevronsUpDown
            size={14}
            className="text-muted-foreground shrink-0"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tokens..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No tokens found.</CommandEmpty>
            {results.map((token) => (
              <CommandItem
                key={token.address}
                value={token.address}
                onSelect={() => {
                  onSelect(token.address);
                  setOpen(false);
                  setSearchQuery("");
                }}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {token.symbol}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {token.name}
                  </span>
                </div>
                {token.priceUsd && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ${token.priceUsd.toFixed(4)}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SwapExecutionDialog({
  open,
  onClose,
  tokenInAddress = "",
  tokenOutAddress = "",
  amountInUsd = 0,
  riskTier = "Moderate",
}: SwapExecutionDialogProps) {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedTokenIn, setSelectedTokenIn] = useState(tokenInAddress);
  const [selectedTokenOut, setSelectedTokenOut] = useState(tokenOutAddress);

  useEffect(() => {
    if (open) {
      if (tokenInAddress) setSelectedTokenIn(tokenInAddress);
      if (tokenOutAddress) setSelectedTokenOut(tokenOutAddress);
    }
  }, [open, tokenInAddress, tokenOutAddress]);
  const [amount, setAmount] = useState(
    amountInUsd > 0 ? String(amountInUsd) : "",
  );
  const [slippage, setSlippage] = useState<SlippageOption>("auto");
  const [customSlippage, setCustomSlippage] = useState(1);
  const [routesOpen, setRoutesOpen] = useState(true);
  const [successReceipt, setSuccessReceipt] = useState<{
    id: string;
    amountIn: number;
    amountOut: number;
    tokenInSymbol: string;
    tokenOutSymbol: string;
    route: string;
  } | null>(null);

  // ── Token data ────────────────────────────────────────────────────────────
  const tokenIn = useToken(selectedTokenIn);
  const tokenOut = useToken(selectedTokenOut);
  const { data: holdingIn } = useHolding(selectedTokenIn);
  const { data: holdingOut } = useHolding(selectedTokenOut);
  const { data: availableICP } = useAvailableICPBalance();

  // ── Permission query ──────────────────────────────────────────────────────
  const permissionQuery = useQuery<bigint | null>({
    queryKey: ["tradingPermission"],
    queryFn: async () => {
      if (!actor) return null;
      try {
        const result = await (actor as any).getTradingPermissionExpiry();
        if (Array.isArray(result) && result.length > 0)
          return result[0] as bigint;
        if (result === null || result === undefined) return null;
        return result as bigint;
      } catch {
        return null;
      }
    },
    enabled: !!actor,
    refetchInterval: 30_000,
  });

  const permissionExpiry = permissionQuery.data ?? null;
  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
  const permissionActive =
    permissionExpiry !== null && permissionExpiry > nowNs;
  const permissionDate = permissionExpiry
    ? new Date(Number(permissionExpiry / BigInt(1_000_000)))
    : null;

  // ── Grant permission mutation ─────────────────────────────────────────────
  const grantPermission = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return (actor as any).grantTradingPermission();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tradingPermission"] });
    },
  });

  // ── Revoke permission mutation ────────────────────────────────────────────
  const revokePermission = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return (actor as any).revokeTradingPermission();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tradingPermission"] });
    },
  });

  // ── Swap quote ────────────────────────────────────────────────────────────
  const parsedAmount = Number.parseFloat(amount) || 0;
  const swapQuote = useSwapQuote(
    selectedTokenIn,
    parsedAmount,
    selectedTokenOut,
  );

  const effectiveSlippage =
    slippage === "auto"
      ? 0.5
      : typeof slippage === "number"
        ? slippage
        : customSlippage;
  const minReceived = swapQuote.data
    ? swapQuote.data * (1 - effectiveSlippage / 100)
    : null;

  // ── Route comparison ──────────────────────────────────────────────────────
  const { data: comparison } = useRouteComparison(
    selectedTokenIn || null,
    selectedTokenOut || null,
    parsedAmount,
  );

  // ── Price impact / ATR ────────────────────────────────────────────────────
  const syntheticPrices = useMemo(() => {
    if (!tokenIn?.priceUsd) return [];
    const base = tokenIn.priceUsd;
    const change = tokenIn.priceChange24h ?? 0;
    return Array.from(
      { length: 20 },
      (_, i) => base * (1 + (change / 100) * (i / 20)),
    );
  }, [tokenIn]);

  const atr = useMemo(() => {
    if (syntheticPrices.length < 15) return null;
    const raw = computeATR(syntheticPrices, 14);
    if (!raw || !tokenIn?.priceUsd) return null;
    return (raw / tokenIn.priceUsd) * 100;
  }, [syntheticPrices, tokenIn]);

  const bestRoute = comparison?.bestRoute;
  const priceImpact = bestRoute?.priceImpactPct ?? 0;
  const isViaICP = bestRoute?.dex.startsWith("ViaICP");

  // ── Execute swap ──────────────────────────────────────────────────────────
  const executeSwap = useExecuteSwap();

  function deriveRoute(): string {
    if (!bestRoute) return "KongSwap-Direct";
    const dex = bestRoute.dex;
    if (dex === "KongSwap") return "KongSwap-Direct";
    if (dex === "ViaICP_KongSwap") return "KongSwap-ViaICP";
    if (dex === "ICPSwap") return "ICPSwap-Direct";
    if (dex === "ViaICP_ICPSwap") return "ICPSwap-ViaICP";
    return "KongSwap-Direct";
  }

  function handleExecute() {
    if (!selectedTokenIn || !selectedTokenOut || parsedAmount <= 0) return;
    const route = deriveRoute();
    executeSwap.mutate(
      {
        tokenIn: selectedTokenIn,
        amountIn: parsedAmount,
        tokenOut: selectedTokenOut,
        route,
        priceImpactPct: bestRoute?.priceImpactPct ?? 0,
      },
      {
        onSuccess: (receiptId) => {
          setSuccessReceipt({
            id: receiptId,
            amountIn: parsedAmount,
            amountOut: swapQuote.data ?? 0,
            tokenInSymbol: tokenIn?.symbol ?? selectedTokenIn,
            tokenOutSymbol: tokenOut?.symbol ?? selectedTokenOut,
            route,
          });
        },
      },
    );
  }

  function handleDone() {
    setSuccessReceipt(null);
    setAmount("");
    executeSwap.reset();
    onClose();
  }

  // ── Max button ────────────────────────────────────────────────────────────
  const ICP_CANISTER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  function handleMax() {
    if (selectedTokenIn.toLowerCase() === ICP_CANISTER.toLowerCase()) {
      setAmount(String(availableICP ?? 0));
    } else {
      setAmount(String(holdingIn?.balance ?? 0));
    }
  }

  const canExecute =
    permissionActive &&
    parsedAmount > 0 &&
    !!selectedTokenIn &&
    !!selectedTokenOut &&
    !executeSwap.isPending;

  const errorMessage = executeSwap.isError
    ? (() => {
        const msg = (executeSwap.error as Error)?.message ?? "";
        if (
          msg.toLowerCase().includes("expired") ||
          msg.toLowerCase().includes("permission")
        ) {
          return "Permission expired — grant again";
        }
        return msg || "Swap failed. Please try again.";
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl bg-card border-border p-0 overflow-hidden"
        data-ocid="swap.dialog"
      >
        {/* Success overlay */}
        {successReceipt && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-card/98 backdrop-blur-sm p-8 text-center">
            <CheckCircle size={56} className="text-cyan-400 mb-4" />
            <p className="text-muted-foreground text-sm mb-1">Swap Executed</p>
            <p className="font-mono text-2xl text-cyan-400 font-bold tracking-wider mb-6">
              {successReceipt.id}
            </p>
            <div className="w-full max-w-sm space-y-2 mb-8 text-sm">
              <div className="flex justify-between p-3 rounded-lg bg-background border border-border">
                <span className="text-muted-foreground">You paid</span>
                <span className="font-semibold text-foreground">
                  {successReceipt.amountIn.toFixed(6)}{" "}
                  {successReceipt.tokenInSymbol}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-background border border-border">
                <span className="text-muted-foreground">You received</span>
                <span className="font-semibold text-green-400">
                  {successReceipt.amountOut.toFixed(6)}{" "}
                  {successReceipt.tokenOutSymbol}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-background border border-border">
                <span className="text-muted-foreground">Route</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {successReceipt.route}
                </span>
              </div>
            </div>
            <Button
              onClick={handleDone}
              className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 px-8"
              data-ocid="swap.success_state"
            >
              Done
            </Button>
          </div>
        )}

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-foreground">Execute Swap</DialogTitle>
            <div className="flex-1 max-w-[200px]">
              <TradeFrequencyBar compact />
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Permission card */}
          <div
            className="rounded-xl border border-red-500/50 bg-red-950/20 p-4 space-y-3"
            data-ocid="swap.panel"
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-red-400" />
              <span className="text-sm font-semibold text-red-400">
                Trading Permission
              </span>
            </div>

            {/* Grant button */}
            <Button
              onClick={() => grantPermission.mutate()}
              disabled={grantPermission.isPending}
              className="w-full bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 font-semibold"
              data-ocid="swap.primary_button"
            >
              {grantPermission.isPending ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />{" "}
                  Granting...
                </>
              ) : (
                "Grant 24-Hour Trading Permission"
              )}
            </Button>

            {/* Warning */}
            <p className="text-xs text-red-400/80 leading-relaxed">
              <strong className="text-red-400">⚠ WARNING:</strong> This
              authorizes the platform to move your tokens for the next 24 hours.
              You can revoke anytime. Only approve what you are willing to
              trade.
            </p>

            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                {permissionActive ? (
                  <>
                    <ShieldCheck size={13} className="text-green-400" />
                    <span className="text-green-400">
                      Permission active until{" "}
                      {permissionDate?.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} className="text-red-400" />
                    <span className="text-red-400">
                      Permission required — grant now
                    </span>
                  </>
                )}
              </div>

              {/* Revoke button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokePermission.mutate()}
                disabled={revokePermission.isPending}
                className="text-xs text-red-400/70 hover:text-red-400 hover:bg-red-950/40 h-7 px-2"
                data-ocid="swap.secondary_button"
              >
                {revokePermission.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  "Revoke All Permissions"
                )}
              </Button>
            </div>
          </div>

          {/* Swap form — disabled when no permission */}
          <div
            className={cn(
              "space-y-4 transition-opacity duration-200",
              !permissionActive && "opacity-50 pointer-events-none",
            )}
          >
            {/* From token row */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                From
              </p>
              <div className="flex items-center gap-2">
                <TokenSelectorPopover
                  selectedAddress={selectedTokenIn}
                  onSelect={setSelectedTokenIn}
                  label="from"
                  dataOcid="swap.select"
                />
                <div className="text-xs text-muted-foreground">
                  Balance:{" "}
                  <span className="text-foreground font-mono">
                    {(holdingIn?.balance ?? 0).toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-muted-foreground text-sm">↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* To token row */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                To
              </p>
              <div className="flex items-center gap-2">
                <TokenSelectorPopover
                  selectedAddress={selectedTokenOut}
                  onSelect={setSelectedTokenOut}
                  label="to"
                  dataOcid="swap.select"
                />
                <div className="text-xs text-muted-foreground">
                  Balance:{" "}
                  <span className="text-foreground font-mono">
                    {(holdingOut?.balance ?? 0).toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amount
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-background border-border font-mono"
                  min="0"
                  step="any"
                  data-ocid="swap.input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  className="shrink-0 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                  data-ocid="swap.secondary_button"
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Quote preview */}
            {parsedAmount > 0 && selectedTokenIn && selectedTokenOut && (
              <div className="rounded-lg bg-background border border-border p-3 space-y-1.5">
                {swapQuote.isLoading ? (
                  <div
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    data-ocid="swap.loading_state"
                  >
                    <Loader2 size={13} className="animate-spin" />
                    Fetching quote...
                  </div>
                ) : swapQuote.data ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">You pay</span>
                      <span className="font-mono text-foreground">
                        {parsedAmount.toFixed(6)} {tokenIn?.symbol ?? "?"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        You receive (est.)
                      </span>
                      <span className="font-mono text-green-400">
                        {swapQuote.data.toFixed(6)} {tokenOut?.symbol ?? "?"}
                      </span>
                    </div>
                    {minReceived !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Minimum received
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {minReceived.toFixed(6)} {tokenOut?.symbol ?? "?"}
                        </span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Slippage */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Slippage Tolerance
              </p>
              <div className="flex items-center gap-2">
                {([0.5, 1, 2, "auto"] as SlippageOption[]).map((opt) => (
                  <button
                    key={String(opt)}
                    type="button"
                    onClick={() => setSlippage(opt)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      slippage === opt
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                        : "bg-background border-border text-muted-foreground hover:border-cyan-500/30 hover:text-cyan-400",
                    )}
                  >
                    {opt === "auto" ? "Auto" : `${opt}%`}
                  </button>
                ))}
              </div>
              {slippage !== "auto" && typeof slippage === "number" && (
                <div className="flex items-center gap-3">
                  <Slider
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={[slippage]}
                    onValueChange={([v]) => {
                      const snapped = [0.5, 1, 2].find(
                        (s) => Math.abs(s - v) < 0.05,
                      );
                      if (snapped) {
                        setSlippage(snapped as SlippageOption);
                      } else {
                        setCustomSlippage(v);
                        setSlippage(v as SlippageOption);
                      }
                    }}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-cyan-400 w-12 text-right">
                    {slippage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* DEX Route Comparison */}
            <Collapsible open={routesOpen} onOpenChange={setRoutesOpen}>
              <CollapsibleTrigger
                className="flex items-center justify-between w-full text-left"
                data-ocid="swap.toggle"
              >
                <span className="text-sm font-semibold text-foreground">
                  DEX Route Comparison
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-muted-foreground transition-transform duration-200",
                    routesOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  {!selectedTokenIn || !selectedTokenOut ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Select tokens to see route comparison
                    </p>
                  ) : !comparison ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Computing routes...
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px]">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b border-border">
                              <th className="text-left pb-2 pr-3">DEX</th>
                              <th className="text-right pb-2 pr-3">
                                Est. Output
                              </th>
                              <th className="text-right pb-2 pr-3">Slippage</th>
                              <th className="text-right pb-2 pr-3">Fees</th>
                              <th className="text-right pb-2 pr-3">
                                Liq. Multiple
                              </th>
                              <th className="text-right pb-2">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparison.routes.map((r) => (
                              <RouteRow key={r.dex} route={r} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {comparison.outputSpreadPct > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Spread: {comparison.outputSpreadPct.toFixed(2)}%
                          between best and worst available route
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Price Impact */}
            {bestRoute && (
              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Price Impact
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "text-sm font-semibold cursor-help",
                            getPriceImpactColor(priceImpact, riskTier),
                          )}
                        >
                          {priceImpact.toFixed(2)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        <div className="text-xs space-y-1">
                          <p>
                            Pool liquidity: $
                            {bestRoute.liquidityDepth.toLocaleString(
                              undefined,
                              {
                                maximumFractionDigits: 0,
                              },
                            )}
                          </p>
                          <p>Trade size: ${parsedAmount.toLocaleString()}</p>
                          <p>Impact = {priceImpact.toFixed(2)}%</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {isViaICP && (
                  <p className="text-xs text-muted-foreground">
                    Hop 1 ({tokenIn?.symbol ?? "?"} → ICP):{" "}
                    {(priceImpact * 0.5).toFixed(2)}% · Hop 2 (ICP →{" "}
                    {tokenOut?.symbol ?? "?"}): {(priceImpact * 0.5).toFixed(2)}
                    %
                  </p>
                )}
                {atr !== null && atr > 3 && (
                  <p className="text-xs text-warning">
                    ⚠ Token is volatile (ATR: {atr.toFixed(1)}%). Estimates may
                    be less accurate.
                  </p>
                )}
              </div>
            )}

            {/* Execute button */}
            <Button
              onClick={handleExecute}
              disabled={!canExecute}
              className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 font-semibold py-5 text-base disabled:opacity-40"
              data-ocid="swap.primary_button"
            >
              {executeSwap.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> Executing
                  Swap...
                </>
              ) : (
                "Execute Real Swap"
              )}
            </Button>

            {/* Error display */}
            {errorMessage && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-red-400 text-sm"
                data-ocid="swap.error_state"
              >
                <AlertTriangle size={14} className="shrink-0" />
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground"
            data-ocid="swap.close_button"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
