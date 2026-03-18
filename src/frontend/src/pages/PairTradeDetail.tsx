import SwapExecutionDialog from "@/components/SwapExecutionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit2,
  Loader2,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import TokenPriceDisplay from "../components/TokenPriceDisplay";
import {
  RiskTier,
  useDeletePairTrade,
  usePairTrade,
  useUpdatePairTrade,
} from "../hooks/usePairTrades";
import { useICPPrice } from "../hooks/useQueries";

const RISK_BADGE: Record<RiskTier, { label: string; className: string }> = {
  [RiskTier.conservative]: {
    label: "Conservative",
    className:
      "bg-primary/10 text-primary border-primary/30 shadow-[0_0_6px_rgba(0,245,255,0.2)]",
  },
  [RiskTier.moderate]: {
    label: "Moderate",
    className:
      "bg-warning/10 text-warning border-warning/30 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
  },
  [RiskTier.aggressive]: {
    label: "Aggressive",
    className:
      "bg-destructive/10 text-destructive border-destructive/30 shadow-[0_0_6px_rgba(255,51,102,0.2)]",
  },
};

const RISK_OPTIONS: {
  tier: RiskTier;
  label: string;
  cap: string;
  borderClass: string;
  activeClass: string;
  labelColor: string;
}[] = [
  {
    tier: RiskTier.conservative,
    label: "Conservative",
    cap: "30/month",
    borderClass: "border-primary/30 hover:border-primary/70",
    activeClass:
      "border-primary bg-primary/10 shadow-[0_0_10px_rgba(0,245,255,0.2)]",
    labelColor: "text-primary",
  },
  {
    tier: RiskTier.moderate,
    label: "Moderate",
    cap: "100/month",
    borderClass: "border-warning/30 hover:border-warning/70",
    activeClass:
      "border-warning bg-warning/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    labelColor: "text-warning",
  },
  {
    tier: RiskTier.aggressive,
    label: "Aggressive",
    cap: "300/month",
    borderClass: "border-destructive/30 hover:border-destructive/70",
    activeClass:
      "border-destructive bg-destructive/10 shadow-[0_0_10px_rgba(255,51,102,0.2)]",
    labelColor: "text-destructive",
  },
];

function formatDate(createdAt: bigint): string {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PairTradeDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const tradeId = BigInt(id || "0");

  const { data: trade, isLoading } = usePairTrade(tradeId);
  const updateMutation = useUpdatePairTrade();
  const deleteMutation = useDeletePairTrade();
  const { icpPriceUsd } = useICPPrice();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Edit form state
  const [editAllocationStr, setEditAllocationStr] = useState("");
  const [editRiskTier, setEditRiskTier] = useState<RiskTier>(
    RiskTier.conservative,
  );
  const [editNotes, setEditNotes] = useState("");
  const [swapOpen, setSwapOpen] = useState(false);
  const [editError, setEditError] = useState("");

  function startEdit() {
    if (!trade) return;
    setEditAllocationStr(trade.allocationUsd.toString());
    setEditRiskTier(trade.riskTier);
    setEditNotes(trade.notes);
    setEditError("");
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    if (!trade) return;
    const allocationUsd = Number.parseFloat(editAllocationStr) || 0;
    if (allocationUsd <= 0) {
      setEditError("Allocation must be greater than $0");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: trade.id,
        allocationUsd,
        riskTier: editRiskTier,
        notes: editNotes,
      });
      setIsEditing(false);
    } catch (_e) {
      setEditError("Failed to save changes.");
    }
  }

  async function handleDelete() {
    if (!trade) return;
    await deleteMutation.mutateAsync(trade.id);
    navigate({ to: "/pair-trades" });
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/pair-trades" })}
          className="gap-1.5 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Back
        </Button>
        <p className="text-muted-foreground">Pair trade not found.</p>
      </div>
    );
  }

  const riskBadge = RISK_BADGE[trade.riskTier];
  const editAllocation = Number.parseFloat(editAllocationStr) || 0;
  const icpEquiv =
    icpPriceUsd > 0 && trade.allocationUsd > 0
      ? trade.allocationUsd / icpPriceUsd
      : null;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4 mb-6"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/pair-trades" })}
          data-ocid="pair-trade-detail.back.button"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Pair Trade Details
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Created {formatDate(trade.createdAt)}
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-3xl font-bold text-primary">
                  {trade.tokenASymbol}
                </span>
                <ArrowRight size={24} className="text-muted-foreground" />
                <span className="text-3xl font-bold text-foreground">
                  {trade.tokenBSymbol}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" className={riskBadge.className}>
                  {riskBadge.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    trade.routeViaICP
                      ? "bg-secondary/10 text-secondary border-secondary/30"
                      : "bg-success/10 text-success border-success/30"
                  }
                >
                  {trade.routeViaICP ? "via ICP" : "Direct"}
                </Badge>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Estimated Value
                </p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  $
                  {trade.allocationUsd.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {icpEquiv !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ≈{" "}
                    <span className="text-primary font-mono">
                      {icpEquiv.toFixed(4)} ICP
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Prices */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Live Prices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="font-bold text-primary">
                  {trade.tokenASymbol}
                </span>
                <TokenPriceDisplay address={trade.tokenAAddress} showChange />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border">
                <span className="font-bold text-foreground">
                  {trade.tokenBSymbol}
                </span>
                <TokenPriceDisplay address={trade.tokenBAddress} showChange />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notes */}
        {trade.notes && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {trade.notes}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Inline Edit Form */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            data-ocid="pair-trade-detail.edit.panel"
          >
            <Card className="bg-card border-primary/30 shadow-[0_0_12px_rgba(0,245,255,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-primary uppercase tracking-wider">
                  Edit Trade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Allocation (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editAllocationStr}
                      onChange={(e) => setEditAllocationStr(e.target.value)}
                      data-ocid="pair-trade-detail.edit-allocation.input"
                      className="pl-7 bg-background border-border font-mono"
                    />
                  </div>
                  {icpPriceUsd > 0 && editAllocation > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈{" "}
                      <span className="text-primary font-mono">
                        {(editAllocation / icpPriceUsd).toFixed(4)} ICP
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Risk Tier
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {RISK_OPTIONS.map((opt) => {
                      const isActive = editRiskTier === opt.tier;
                      return (
                        <button
                          key={opt.tier}
                          type="button"
                          onClick={() => setEditRiskTier(opt.tier)}
                          data-ocid={`pair-trade-detail.edit-risk-${opt.tier}.button`}
                          className={cn(
                            "p-3 rounded-xl border-2 transition-all text-center",
                            isActive ? opt.activeClass : opt.borderClass,
                            "bg-card",
                          )}
                        >
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                isActive ? opt.labelColor : "text-foreground",
                              )}
                            >
                              {opt.label}
                            </span>
                            {isActive && (
                              <CheckCircle2
                                size={12}
                                className={opt.labelColor}
                              />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {opt.cap}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Notes
                  </Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes..."
                    data-ocid="pair-trade-detail.edit-notes.textarea"
                    className="bg-background border-border resize-none min-h-[80px]"
                  />
                </div>

                {editError && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="pair-trade-detail.edit.error_state"
                  >
                    {editError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    data-ocid="pair-trade-detail.edit.save_button"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    data-ocid="pair-trade-detail.edit.cancel_button"
                    className="flex-1 border-border"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {!isEditing && (
            <Button
              onClick={startEdit}
              variant="outline"
              data-ocid="pair-trade-detail.edit_button"
              className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2"
            >
              <Edit2 size={16} /> Edit
            </Button>
          )}
          <Button
            onClick={() => setSwapOpen(true)}
            data-ocid="pair-trade-detail.swap-now.button"
            className="flex-1 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 gap-2 font-semibold shadow-[0_0_12px_rgba(0,245,255,0.15)] hover:shadow-[0_0_20px_rgba(0,245,255,0.25)] transition-all duration-200"
          >
            <Zap size={16} /> Swap Now
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            data-ocid="pair-trade-detail.delete_button"
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
          >
            Delete
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {swapOpen && (
          <SwapExecutionDialog
            open={swapOpen}
            onClose={() => setSwapOpen(false)}
            tokenInAddress={trade.tokenAAddress}
            tokenOutAddress={trade.tokenBAddress}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent
          className="bg-card border-border"
          data-ocid="pair-trade-detail.delete.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Pair Trade?
            </DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-semibold text-foreground">
                {trade.tokenASymbol} → {trade.tokenBSymbol}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              data-ocid="pair-trade-detail.delete.cancel_button"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-ocid="pair-trade-detail.delete.confirm_button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
