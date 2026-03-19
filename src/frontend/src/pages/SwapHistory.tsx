import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSwapReceipts, useTokenUniverse } from "@/hooks/useQueries";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  History,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import type { SwapReceipt } from "../backend";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(canisterId: string): string {
  if (!canisterId) return "?";
  return `${canisterId.slice(0, 5)}...${canisterId.slice(-3)}`;
}

function formatNum(n: number, decimals = 4): string {
  if (n === 0) return "0";
  if (Math.abs(n) < 0.0001) return n.toExponential(2);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

function extractReceiptNum(id: string): string {
  const match = id.match(/^(EXEC-\d+|SIM-\d+)/i);
  return match ? match[1] : id.slice(0, 12);
}

function extractDexTxHash(id: string): string | null {
  // Format: EXEC-N-dexTxId
  const parts = id.split("-");
  if (parts.length >= 3) {
    const hash = parts.slice(2).join("-");
    if (hash && hash.length > 3) return hash;
  }
  return null;
}

function parseDex(route: string): "KongSwap" | "ICPSwap" | "Unknown" {
  if (route.startsWith("KongSwap")) return "KongSwap";
  if (route.startsWith("ICPSwap")) return "ICPSwap";
  return "Unknown";
}

function formatRoute(route: string): string {
  if (route.startsWith("KongSwap-"))
    return route.replace("KongSwap-", "KongSwap ");
  if (route.startsWith("ICPSwap-Direct:")) return "ICPSwap Direct";
  if (route.startsWith("ICPSwap-ViaICP:")) return "ICPSwap Via ICP";
  return route;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type QuickRange = "7d" | "30d" | "90d" | "all";

interface Filters {
  search: string;
  route: string;
  quickRange: QuickRange;
  dateFrom: string;
  dateTo: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RouteBadge({ route }: { route: string }) {
  const dex = parseDex(route);
  if (dex === "KongSwap")
    return (
      <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs font-mono">
        KongSwap
      </Badge>
    );
  if (dex === "ICPSwap")
    return (
      <Badge className="bg-secondary/15 text-secondary border border-secondary/30 text-xs font-mono">
        ICPSwap
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs font-mono">
      {route}
    </Badge>
  );
}

function PnLBadge({ pnl }: { pnl: number }) {
  if (pnl === 0)
    return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const isPos = pnl > 0;
  return (
    <span
      className={`font-mono text-xs font-semibold ${
        isPos ? "neon-text-green" : "neon-text-red"
      }`}
    >
      {isPos ? "+" : ""}
      {formatNum(pnl, 2)}
    </span>
  );
}

function ImpactBadge({ pct }: { pct: number }) {
  const color =
    pct < 1
      ? "text-muted-foreground"
      : pct < 2
        ? "text-yellow-400"
        : "neon-text-red";
  return (
    <span className={`font-mono text-xs ${color}`}>{pct.toFixed(2)}%</span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 p-1 rounded hover:bg-muted/40 transition-colors text-muted-foreground hover:text-primary"
      title="Copy"
    >
      {copied ? (
        <Check size={12} className="text-green-400" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({
  receipt,
  tokenSymbol,
  onClose,
}: {
  receipt: SwapReceipt;
  tokenSymbol: (id: string) => string;
  onClose: () => void;
}) {
  const txHash = extractDexTxHash(receipt.id);
  const dex = parseDex(receipt.route);
  const rate = receipt.amountIn > 0 ? receipt.amountOut / receipt.amountIn : 0;
  const inSym = tokenSymbol(receipt.tokenIn);
  const outSym = tokenSymbol(receipt.tokenOut);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg bg-card border-border shadow-2xl"
        data-ocid="swap_history.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History size={18} className="text-primary" />
            Receipt Detail
          </DialogTitle>
        </DialogHeader>

        {/* Receipt ID */}
        <div className="rounded-md bg-muted/30 border border-border px-3 py-2 flex items-center justify-between">
          <span className="font-mono text-xs text-primary break-all">
            {receipt.id}
          </span>
          <CopyButton text={receipt.id} />
        </div>

        {/* Date */}
        <p className="text-xs text-muted-foreground">
          {formatTimestamp(receipt.timestamp)}
        </p>

        {/* Swap summary */}
        <div className="rounded-lg bg-muted/20 border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You Paid</p>
              <p className="font-mono font-semibold text-foreground">
                {formatNum(receipt.amountIn)} {inSym}
              </p>
            </div>
            <div className="text-primary text-lg">→</div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You Received</p>
              <p className="font-mono font-semibold text-foreground">
                {formatNum(receipt.amountOut)} {outSym}
              </p>
            </div>
          </div>
          <div className="border-t border-border pt-2 text-xs text-muted-foreground">
            Rate: 1 {inSym} = {formatNum(rate, 6)} {outSym}
          </div>
        </div>

        {/* Cost basis & PnL */}
        <div className="rounded-lg bg-muted/20 border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Cost Basis & PnL
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount In</span>
            <span className="font-mono">
              {formatNum(receipt.amountIn)} {inSym}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Out</span>
            <span className="font-mono">
              {formatNum(receipt.amountOut)} {outSym}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2 mt-1">
            <span className="text-muted-foreground">Realized PnL</span>
            <span
              className={`font-mono font-bold ${
                receipt.realizedPnL > 0
                  ? "neon-text-green"
                  : receipt.realizedPnL < 0
                    ? "neon-text-red"
                    : "text-muted-foreground"
              }`}
            >
              {receipt.realizedPnL === 0
                ? "—"
                : `${receipt.realizedPnL > 0 ? "+" : ""}${formatNum(receipt.realizedPnL, 4)}`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            PnL = amountOut − (amountIn × cost basis)
          </p>
        </div>

        {/* Route */}
        <div className="rounded-lg bg-muted/20 border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Route
          </p>
          <div className="flex items-center gap-2">
            <RouteBadge route={receipt.route} />
            <span className="text-xs text-muted-foreground">
              {formatRoute(receipt.route)}
            </span>
          </div>
          {txHash && (
            <a
              href={
                dex === "KongSwap"
                  ? `https://kongswap.io/txs/${txHash}`
                  : `https://info.icpswap.com/transaction/${txHash}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              data-ocid="swap_history.link"
            >
              <ExternalLink size={11} /> View on DEX
            </a>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Price Impact</span>
            <ImpactBadge pct={receipt.priceImpactPct} />
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full mt-1"
          onClick={onClose}
          data-ocid="swap_history.close_button"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SwapHistory() {
  const { data: receipts = [], isLoading } = useSwapReceipts();
  const { tokens } = useTokenUniverse();

  const [selectedReceipt, setSelectedReceipt] = useState<SwapReceipt | null>(
    null,
  );
  const [filters, setFilters] = useState<Filters>({
    search: "",
    route: "all",
    quickRange: "all",
    dateFrom: "",
    dateTo: "",
  });

  // Resolve canister ID → symbol
  const tokenSymbol = useCallback(
    (id: string): string => {
      const t = tokens.find(
        (tk) => tk.address.toLowerCase() === id.toLowerCase(),
      );
      return t?.symbol ?? shortId(id);
    },
    [tokens],
  );

  // Filter logic
  const filtered = useMemo(() => {
    let result = [...receipts].sort(
      (a, b) => Number(b.timestamp) - Number(a.timestamp),
    );

    if (filters.quickRange !== "all") {
      const days =
        filters.quickRange === "7d"
          ? 7
          : filters.quickRange === "30d"
            ? 30
            : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      result = result.filter((r) => Number(r.timestamp) / 1_000_000 >= cutoff);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      result = result.filter((r) => Number(r.timestamp) / 1_000_000 >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_400_000;
      result = result.filter((r) => Number(r.timestamp) / 1_000_000 <= to);
    }

    if (filters.route !== "all") {
      result = result.filter((r) => parseDex(r.route) === filters.route);
    }

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          tokenSymbol(r.tokenIn).toLowerCase().includes(q) ||
          tokenSymbol(r.tokenOut).toLowerCase().includes(q),
      );
    }

    return result;
  }, [receipts, filters, tokenSymbol]);

  const hasFilters =
    filters.search ||
    filters.route !== "all" ||
    filters.quickRange !== "all" ||
    filters.dateFrom ||
    filters.dateTo;

  // CSV export
  const handleExport = () => {
    const header =
      "ID,Date,TokenIn,AmountIn,TokenOut,AmountOut,Route,PriceImpactPct,RealizedPnL";
    const rows = filtered.map((r) =>
      [
        r.id,
        formatTimestamp(r.timestamp),
        tokenSymbol(r.tokenIn),
        r.amountIn,
        tokenSymbol(r.tokenOut),
        r.amountOut,
        r.route,
        r.priceImpactPct,
        r.realizedPnL,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swap-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () =>
    setFilters({
      search: "",
      route: "all",
      quickRange: "all",
      dateFrom: "",
      dateTo: "",
    });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History size={22} className="text-primary" />
            Swap History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            All executed on-chain receipts — EXEC-XXXX
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="neon-border-cyan text-primary hover:bg-primary/10 flex items-center gap-2 shrink-0"
          onClick={handleExport}
          disabled={filtered.length === 0}
          data-ocid="swap_history.secondary_button"
        >
          <Download size={14} />
          Export CSV
        </Button>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm pb-3 mb-4"
      >
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          {/* Row 1: search + route */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                placeholder="Search ID, token..."
                className="pl-8 bg-muted/30 border-border h-9 text-sm"
                data-ocid="swap_history.search_input"
              />
            </div>
            <Select
              value={filters.route}
              onValueChange={(v) => setFilters((f) => ({ ...f, route: v }))}
            >
              <SelectTrigger
                className="w-36 h-9 bg-muted/30 border-border text-sm"
                data-ocid="swap_history.select"
              >
                <SelectValue placeholder="All DEXes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DEXes</SelectItem>
                <SelectItem value="KongSwap">KongSwap</SelectItem>
                <SelectItem value="ICPSwap">ICPSwap</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: quick range pills + date inputs */}
          <div className="flex flex-wrap items-center gap-2">
            {(["7d", "30d", "90d", "all"] as QuickRange[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    quickRange: r,
                    dateFrom: "",
                    dateTo: "",
                  }))
                }
                data-ocid="swap_history.tab"
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filters.quickRange === r
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {r === "all" ? "All Time" : r.toUpperCase()}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateFrom: e.target.value,
                    quickRange: "all",
                  }))
                }
                className="h-8 text-xs bg-muted/30 border border-border rounded px-2 text-foreground"
                data-ocid="swap_history.input"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateTo: e.target.value,
                    quickRange: "all",
                  }))
                }
                className="h-8 text-xs bg-muted/30 border border-border rounded px-2 text-foreground"
                data-ocid="swap_history.input"
              />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                data-ocid="swap_history.cancel_button"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "ID",
                    "Date",
                    "From → To",
                    "Amount In",
                    "Amount Out",
                    "Route",
                    "PnL",
                    "Impact",
                  ].map((col) => (
                    <th
                      key={col}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr
                      key={`skel-row-${i}`}
                      className="border-b border-border/50"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <td key={`skel-cell-${j}`} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div
                        className="flex flex-col items-center justify-center py-20 gap-4"
                        data-ocid="swap_history.empty_state"
                      >
                        <div className="w-16 h-16 rounded-full bg-muted/40 border border-border flex items-center justify-center">
                          <History
                            size={28}
                            className="text-muted-foreground"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-semibold text-foreground mb-1">
                            {hasFilters
                              ? "No matching receipts"
                              : "No swaps yet"}
                          </p>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            {hasFilters
                              ? "Try adjusting your filters."
                              : "Execute your first trade to see history here."}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      onClick={() => setSelectedReceipt(r)}
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors group"
                      data-ocid={`swap_history.row.item.${idx + 1}`}
                    >
                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-primary group-hover:neon-text-cyan transition-all">
                          {extractReceiptNum(r.id)}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(r.timestamp)}
                        </span>
                      </td>
                      {/* From → To */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground whitespace-nowrap">
                          {tokenSymbol(r.tokenIn)}
                          <span className="text-muted-foreground mx-1">→</span>
                          {tokenSymbol(r.tokenOut)}
                        </span>
                      </td>
                      {/* Amount In */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-foreground">
                          {formatNum(r.amountIn)}
                        </span>
                      </td>
                      {/* Amount Out */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-foreground">
                          {formatNum(r.amountOut)}
                        </span>
                      </td>
                      {/* Route */}
                      <td className="px-4 py-3">
                        <RouteBadge route={r.route} />
                      </td>
                      {/* PnL */}
                      <td className="px-4 py-3">
                        <PnLBadge pnl={r.realizedPnL} />
                      </td>
                      {/* Impact */}
                      <td className="px-4 py-3">
                        <ImpactBadge pct={r.priceImpactPct} />
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50 text-xs text-muted-foreground">
              Showing {filtered.length} of {receipts.length} receipts
            </div>
          )}
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <DetailModal
            receipt={selectedReceipt}
            tokenSymbol={tokenSymbol}
            onClose={() => setSelectedReceipt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
