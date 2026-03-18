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
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useBasket, useDeleteBasket } from "../hooks/useBaskets";
import { usePairTrades } from "../hooks/usePairTrades";

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

export default function BasketDetail() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = BigInt(params.id ?? "0");
  const navigate = useNavigate();

  const { data: basket, isLoading } = useBasket(id);
  const { data: pairTrades } = usePairTrades();
  const deleteMutation = useDeleteBasket();

  async function handleDelete() {
    await deleteMutation.mutateAsync(id);
    navigate({ to: "/baskets" });
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

  return (
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
            <div className="flex items-center gap-2 mt-2">
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
          </div>
          <div className="flex items-center gap-2">
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
                  <Trash2 size={14} />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                className="bg-card border-border"
                data-ocid="basket-detail.delete.dialog"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Basket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{basket.name}&quot;. This
                    action cannot be undone.
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
                      title={`${trade ? `${trade.tokenASymbol}→${trade.tokenBSymbol}` : slot.slotLabel}: ${pct}%`}
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
                          backgroundColor: NEON_COLORS[i % NEON_COLORS.length],
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
                          <TableCell className="text-sm text-muted-foreground">
                            --
                          </TableCell>
                          <TableCell>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                              On Target
                            </span>
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

        {/* Rebalancing */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-muted-foreground" />
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Rebalance Analysis
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Rebalancing analysis available after your first swap. Come back
                in Prompt 5.
              </p>
              <Button
                disabled
                title="Swap execution coming in Prompt 5"
                data-ocid="basket-detail.test-rebalance.button"
                variant="outline"
                className="border-border text-muted-foreground opacity-50 cursor-not-allowed"
              >
                Test Rebalance
              </Button>
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
  );
}
