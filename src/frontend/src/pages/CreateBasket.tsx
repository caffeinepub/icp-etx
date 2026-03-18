import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { type BasketSlot, useCreateBasket } from "../hooks/useBaskets";
import {
  type PairTrade,
  RiskTier,
  usePairTrades,
} from "../hooks/usePairTrades";

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

const TEMPLATES: Record<string, { tokens: string[]; weights: number[] }> = {
  BIG3: { tokens: ["CKBTC", "ICP", "CKETH"], weights: [40, 40, 20] },
  TOP5: {
    tokens: ["CKBTC", "ICP", "CKETH", "BOB", "WTN"],
    weights: [30, 30, 20, 10, 10],
  },
  TENACIOUS10: {
    tokens: [
      "CKBTC",
      "ICP",
      "CKETH",
      "BOB",
      "WTN",
      "CHAT",
      "KINIC",
      "GHOST",
      "HOT",
      "NTN",
    ],
    weights: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  },
};

function deriveRiskTier(selectedTrades: PairTrade[]): string {
  if (selectedTrades.some((t) => t.riskTier === RiskTier.aggressive))
    return "Aggressive";
  if (selectedTrades.some((t) => t.riskTier === RiskTier.moderate))
    return "Moderate";
  return "Conservative";
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Basic Info", "Select Trades", "Set Weights", "Review"];
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border transition-all",
              i + 1 === step
                ? "bg-secondary text-white border-secondary shadow-[0_0_8px_rgba(123,47,255,0.5)]"
                : i + 1 < step
                  ? "bg-success/20 text-success border-success/40"
                  : "bg-muted/20 text-muted-foreground border-border",
            )}
          >
            {i + 1 < step ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          <span
            className={cn(
              "text-xs ml-1 hidden sm:block",
              i + 1 === step ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "w-4 h-px mx-2",
                i + 1 < step ? "bg-success/40" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreateBasket() {
  const navigate = useNavigate();
  const createMutation = useCreateBasket();
  const { data: pairTrades } = usePairTrades();

  const templateKey = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("template") ?? "";
  }, []);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState(5);
  const [selectedIds, setSelectedIds] = useState<bigint[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!templateKey || !pairTrades || pairTrades.length === 0) return;
    const tpl = TEMPLATES[templateKey];
    if (!tpl) return;

    const matched: bigint[] = [];
    const newWeights: Record<string, number> = {};

    for (const [i, token] of tpl.tokens.entries()) {
      const match = pairTrades
        .filter(
          (t) =>
            t.tokenASymbol.toUpperCase() === token.toUpperCase() ||
            t.tokenBSymbol.toUpperCase() === token.toUpperCase(),
        )
        .sort((a, b) => Number(b.createdAt - a.createdAt))[0];
      if (match && !matched.some((mid) => mid === match.id)) {
        matched.push(match.id);
        newWeights[match.id.toString()] = tpl.weights[i];
      }
    }

    setSelectedIds(matched);
    setWeights(newWeights);
  }, [templateKey, pairTrades]);

  const selectedTrades = useMemo(
    () =>
      (pairTrades ?? []).filter((t) => selectedIds.some((sid) => sid === t.id)),
    [pairTrades, selectedIds],
  );

  const totalWeight = selectedIds.reduce(
    (acc, sid) => acc + (weights[sid.toString()] ?? 0),
    0,
  );

  function toggleTrade(tid: bigint) {
    setSelectedIds((prev) => {
      const has = prev.some((x) => x === tid);
      return has ? prev.filter((x) => x !== tid) : [...prev, tid];
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

  async function handleCreate() {
    setSaveError("");
    const slots: BasketSlot[] = selectedIds.map((sid) => ({
      pairTradeId: sid,
      targetWeightBps: BigInt((weights[sid.toString()] ?? 0) * 100),
      slotLabel: slotLabels[sid.toString()] ?? "",
    }));
    try {
      const newId = await createMutation.mutateAsync({
        name,
        description,
        slots,
        rebalanceThresholdBps: BigInt(threshold * 100),
      });
      navigate({ to: "/baskets/$id", params: { id: newId.toString() } });
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to create basket. Please try again.");
    }
  }

  const missingTokens = useMemo(() => {
    if (!templateKey) return [];
    const tpl = TEMPLATES[templateKey];
    if (!tpl || !pairTrades) return [];
    return tpl.tokens.filter(
      (token) =>
        !pairTrades.some(
          (t) =>
            t.tokenASymbol.toUpperCase() === token.toUpperCase() ||
            t.tokenBSymbol.toUpperCase() === token.toUpperCase(),
        ),
    );
  }, [templateKey, pairTrades]);

  const derivedRisk = deriveRiskTier(selectedTrades);

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
            step > 1 ? setStep((s) => s - 1) : navigate({ to: "/baskets" })
          }
          data-ocid="create-basket.back.button"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Basket</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Build a weighted portfolio of pair trades
          </p>
        </div>
      </motion.div>

      <StepIndicator step={step} />

      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
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
                    htmlFor="basket-name"
                    className="text-xs text-muted-foreground"
                  >
                    BASKET NAME <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {name.length}/40
                  </span>
                </div>
                <Input
                  id="basket-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  placeholder="e.g. Core ICP Portfolio"
                  data-ocid="create-basket.name.input"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label
                    htmlFor="basket-desc"
                    className="text-xs text-muted-foreground"
                  >
                    DESCRIPTION{" "}
                    <span className="text-muted-foreground/50">(optional)</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {description.length}/200
                  </span>
                </div>
                <Textarea
                  id="basket-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder="Describe your basket strategy..."
                  data-ocid="create-basket.description.textarea"
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
                  data-ocid="create-basket.threshold.input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Rebalance when any slot drifts by {threshold}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Button
            onClick={() => setStep(2)}
            disabled={!name.trim()}
            data-ocid="create-basket.step1-next.button"
            className="w-full bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_12px_rgba(123,47,255,0.3)] gap-2"
          >
            Next: Select Pair Trades <ArrowRight size={16} />
          </Button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {(!pairTrades || pairTrades.length < 3) && (
            <Card className="bg-warning/5 border-warning/30">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-warning flex-shrink-0"
                />
                <p className="text-sm text-warning">
                  You need at least 3 pair trades to create a basket.{" "}
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/pair-trades/new" })}
                    className="underline font-semibold"
                  >
                    Create more pair trades first →
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {missingTokens.length > 0 && (
            <Card className="bg-warning/5 border-warning/30">
              <CardContent className="p-4">
                <p className="text-xs text-warning font-semibold mb-2">
                  Missing pair trades for template:
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingTokens.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/pair-trades/new",
                          search: { tokenA: token } as any,
                        })
                      }
                      className="text-xs px-2 py-1 rounded border border-warning/40 text-warning hover:bg-warning/10 transition-colors"
                    >
                      No {token} pair trade — Create one →
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Select Pair Trades
                </CardTitle>
                <span
                  className={cn(
                    "text-sm font-bold font-mono",
                    selectedIds.length > 10
                      ? "text-destructive"
                      : "text-secondary",
                  )}
                >
                  {selectedIds.length} / 10 slots
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(pairTrades ?? []).map((trade) => {
                const isChecked = selectedIds.some((sid) => sid === trade.id);
                const riskCls =
                  RISK_BADGE[trade.riskTier] ??
                  RISK_BADGE[RiskTier.conservative];
                const riskLabel = RISK_LABEL[trade.riskTier] ?? "Conservative";
                return (
                  <label
                    key={trade.id.toString()}
                    htmlFor={`trade-${trade.id}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150",
                      isChecked
                        ? "border-secondary/50 bg-secondary/5"
                        : "border-border hover:border-secondary/30",
                    )}
                  >
                    <Checkbox
                      id={`trade-${trade.id}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleTrade(trade.id)}
                      className="border-secondary/50 data-[state=checked]:bg-secondary data-[state=checked]:border-secondary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primary">
                          {trade.tokenASymbol}
                        </span>
                        <ArrowRight
                          size={12}
                          className="text-muted-foreground"
                        />
                        <span className="font-bold text-sm text-foreground">
                          {trade.tokenBSymbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] border", riskCls)}
                        >
                          {riskLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          $
                          {trade.allocationUsd.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            trade.routeViaICP
                              ? "bg-secondary/10 text-secondary border-secondary/30"
                              : "bg-success/10 text-success border-success/30",
                          )}
                        >
                          {trade.routeViaICP ? "via ICP" : "Direct"}
                        </Badge>
                      </div>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Button
            onClick={() => setStep(3)}
            disabled={selectedIds.length < 3 || selectedIds.length > 10}
            data-ocid="create-basket.step2-next.button"
            className="w-full bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_12px_rgba(123,47,255,0.3)] gap-2"
          >
            Next: Set Weights <ArrowRight size={16} />
          </Button>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                  Target Weights
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-bold font-mono",
                      totalWeight === 100 ? "text-success" : "text-destructive",
                    )}
                  >
                    Total: {totalWeight}% / 100%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={autoBalance}
                    data-ocid="create-basket.auto-balance.button"
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
                          Slot Label (optional)
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
                          placeholder="e.g. BTC Anchor"
                          className="bg-background border-border h-8"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Button
            onClick={() => setStep(4)}
            disabled={totalWeight !== 100}
            data-ocid="create-basket.step3-next.button"
            className="w-full bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_12px_rgba(123,47,255,0.3)] gap-2"
          >
            Review & Confirm <ArrowRight size={16} />
          </Button>
        </motion.div>
      )}

      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xl font-bold text-foreground">{name}</p>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border",
                      RISK_BADGE[
                        derivedRisk === "Conservative"
                          ? RiskTier.conservative
                          : derivedRisk === "Moderate"
                            ? RiskTier.moderate
                            : RiskTier.aggressive
                      ],
                    )}
                  >
                    {derivedRisk}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Rebalance at ±{threshold}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length} slots
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Allocation
                </p>
                <div className="flex rounded-lg overflow-hidden h-6 w-full">
                  {selectedTrades.map((trade, i) => {
                    const w = weights[trade.id.toString()] ?? 0;
                    return (
                      <div
                        key={trade.id.toString()}
                        style={{
                          width: `${w}%`,
                          backgroundColor: NEON_COLORS[i % NEON_COLORS.length],
                        }}
                        title={`${trade.tokenASymbol}→${trade.tokenBSymbol}: ${w}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {selectedTrades.map((trade, i) => (
                    <div
                      key={trade.id.toString()}
                      className="flex items-center gap-1"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: NEON_COLORS[i % NEON_COLORS.length],
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {slotLabels[trade.id.toString()] ||
                          `${trade.tokenASymbol}→${trade.tokenBSymbol}`}
                        :{" "}
                        <span className="font-mono text-foreground">
                          {weights[trade.id.toString()] ?? 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {saveError && (
            <p
              className="text-sm text-destructive text-center"
              data-ocid="create-basket.save.error_state"
            >
              {saveError}
            </p>
          )}

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            data-ocid="create-basket.submit_button"
            className="w-full bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_16px_rgba(123,47,255,0.4)] h-12 text-base font-semibold"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Basket...
              </>
            ) : (
              "Create Basket"
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
