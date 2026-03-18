import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  type BasketSlot,
  useBasket,
  useUpdateBasket,
} from "../hooks/useBaskets";
import {
  type PairTrade,
  RiskTier,
  usePairTrades,
} from "../hooks/usePairTrades";

const RISK_BADGE: Record<string, string> = {
  [RiskTier.conservative]: "bg-primary/10 text-primary border-primary/30",
  [RiskTier.moderate]: "bg-warning/10 text-warning border-warning/30",
  [RiskTier.aggressive]:
    "bg-destructive/10 text-destructive border-destructive/30",
};

const RISK_LABEL: Record<string, string> = {
  [RiskTier.conservative]: "Conservative",
  [RiskTier.moderate]: "Moderate",
  [RiskTier.aggressive]: "Aggressive",
};

export default function EditBasket() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = BigInt(params.id ?? "0");
  const navigate = useNavigate();

  const { data: basket, isLoading: basketLoading } = useBasket(id);
  const { data: pairTrades, isLoading: tradesLoading } = usePairTrades();
  const updateMutation = useUpdateBasket();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState(5);
  const [selectedIds, setSelectedIds] = useState<bigint[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!basket || initialized) return;
    setName(basket.name);
    setDescription(basket.description);
    setThreshold(Number(basket.rebalanceThresholdBps) / 100);
    setSelectedIds(basket.slots.map((s) => s.pairTradeId));
    const w: Record<string, number> = {};
    const l: Record<string, string> = {};
    for (const s of basket.slots) {
      w[s.pairTradeId.toString()] = Number(s.targetWeightBps) / 100;
      l[s.pairTradeId.toString()] = s.slotLabel;
    }
    setWeights(w);
    setSlotLabels(l);
    setInitialized(true);
  }, [basket, initialized]);

  const selectedTrades: PairTrade[] = useMemo(
    () => (pairTrades ?? []).filter((t) => selectedIds.some((x) => x === t.id)),
    [pairTrades, selectedIds],
  );

  const totalWeight = selectedIds.reduce(
    (acc, sid) => acc + (weights[sid.toString()] ?? 0),
    0,
  );

  function toggleTrade(tradeId: bigint) {
    setSelectedIds((prev) => {
      const has = prev.some((x) => x === tradeId);
      return has ? prev.filter((x) => x !== tradeId) : [...prev, tradeId];
    });
  }

  function autoBalance() {
    const n = selectedIds.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const newW: Record<string, number> = {};
    for (const [i, sid] of selectedIds.entries()) {
      newW[sid.toString()] = i === n - 1 ? base + remainder : base;
    }
    setWeights(newW);
  }

  async function handleSave() {
    setSaveError("");
    if (!name.trim()) {
      setSaveError("Basket name is required.");
      return;
    }
    if (selectedIds.length < 3) {
      setSaveError("Select at least 3 pair trades.");
      return;
    }
    if (selectedIds.length > 10) {
      setSaveError("Maximum 10 pair trades allowed.");
      return;
    }
    if (totalWeight !== 100) {
      setSaveError(`Weights must sum to 100% (currently ${totalWeight}%).`);
      return;
    }

    const slots: BasketSlot[] = selectedIds.map((sid) => ({
      pairTradeId: sid,
      targetWeightBps: BigInt((weights[sid.toString()] ?? 0) * 100),
      slotLabel: slotLabels[sid.toString()] ?? "",
    }));

    try {
      await updateMutation.mutateAsync({
        id,
        name,
        description,
        slots,
        rebalanceThresholdBps: BigInt(threshold * 100),
      });
      navigate({ to: "/baskets/$id", params: { id: id.toString() } });
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to update basket. Please try again.");
    }
  }

  if (basketLoading || tradesLoading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

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
          onClick={() =>
            navigate({ to: "/baskets/$id", params: { id: id.toString() } })
          }
          data-ocid="edit-basket.back.button"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeft size={16} />
          Cancel
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Basket</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Update basket configuration
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
              Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label
                  htmlFor="edit-name"
                  className="text-xs text-muted-foreground"
                >
                  BASKET NAME <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {name.length}/40
                </span>
              </div>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                data-ocid="edit-basket.name.input"
                className="bg-background border-border"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label
                  htmlFor="edit-desc"
                  className="text-xs text-muted-foreground"
                >
                  DESCRIPTION
                </Label>
                <span className="text-xs text-muted-foreground">
                  {description.length}/200
                </span>
              </div>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                data-ocid="edit-basket.description.textarea"
                className="bg-background border-border resize-none min-h-[72px]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs text-muted-foreground">
                  REBALANCE THRESHOLD
                </Label>
                <span className="text-sm font-bold text-secondary font-mono">
                  {threshold}%
                </span>
              </div>
              <Slider
                min={1}
                max={20}
                step={1}
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
                data-ocid="edit-basket.threshold.input"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Rebalance when any slot drifts by {threshold}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Pair Trades
              </CardTitle>
              <span
                className={cn(
                  "text-sm font-bold font-mono",
                  selectedIds.length > 10
                    ? "text-destructive"
                    : "text-secondary",
                )}
              >
                {selectedIds.length} / 10
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pairTrades ?? []).map((trade) => {
              const isChecked = selectedIds.some((x) => x === trade.id);
              const riskCls =
                RISK_BADGE[trade.riskTier] ?? RISK_BADGE[RiskTier.conservative];
              const riskLabel = RISK_LABEL[trade.riskTier] ?? "Conservative";
              return (
                <label
                  key={trade.id.toString()}
                  htmlFor={`edit-trade-${trade.id}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isChecked
                      ? "border-secondary/50 bg-secondary/5"
                      : "border-border hover:border-secondary/30",
                  )}
                >
                  <Checkbox
                    id={`edit-trade-${trade.id}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleTrade(trade.id)}
                    className="border-secondary/50 data-[state=checked]:bg-secondary data-[state=checked]:border-secondary"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-bold text-sm text-primary">
                      {trade.tokenASymbol}
                    </span>
                    <ArrowRight size={12} className="text-muted-foreground" />
                    <span className="font-bold text-sm text-foreground">
                      {trade.tokenBSymbol}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] border ml-auto", riskCls)}
                    >
                      {riskLabel}
                    </Badge>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {selectedTrades.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Weights
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-bold font-mono",
                      totalWeight === 100 ? "text-success" : "text-destructive",
                    )}
                  >
                    {totalWeight}% / 100%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={autoBalance}
                    data-ocid="edit-basket.auto-balance.button"
                    className="text-xs border-secondary/30 text-secondary hover:bg-secondary/10 h-7 px-2"
                  >
                    Auto-balance
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTrades.map((trade) => {
                const riskCls =
                  RISK_BADGE[trade.riskTier] ??
                  RISK_BADGE[RiskTier.conservative];
                const riskLabel = RISK_LABEL[trade.riskTier] ?? "Conservative";
                const key = trade.id.toString();
                return (
                  <div
                    key={key}
                    className="p-3 rounded-lg border border-border bg-background/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-sm text-primary">
                        {trade.tokenASymbol}
                      </span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="font-bold text-sm text-foreground">
                        {trade.tokenBSymbol}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] border ml-auto", riskCls)}
                      >
                        {riskLabel}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Weight %
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={97}
                          value={weights[key] ?? ""}
                          onChange={(e) => {
                            const v = Math.min(
                              97,
                              Math.max(1, Number.parseInt(e.target.value) || 0),
                            );
                            setWeights((prev) => ({ ...prev, [key]: v }));
                          }}
                          className="bg-background border-border font-mono h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Slot Label
                        </Label>
                        <Input
                          type="text"
                          value={slotLabels[key] ?? ""}
                          onChange={(e) =>
                            setSlotLabels((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="Optional label"
                          className="bg-background border-border h-8"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {saveError && (
          <p
            className="text-sm text-destructive text-center"
            data-ocid="edit-basket.save.error_state"
          >
            {saveError}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          data-ocid="edit-basket.submit_button"
          className="w-full bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_16px_rgba(123,47,255,0.4)] h-12 text-base font-semibold"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
