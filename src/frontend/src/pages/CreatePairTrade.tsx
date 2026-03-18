import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UnifiedToken } from "@/types/tokenUniverse";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import TokenSelector from "../components/TokenSelector";
import { RiskTier, useCreatePairTrade } from "../hooks/usePairTrades";
import { useICPPrice, useTokenUniverse } from "../hooks/useQueries";

const RISK_OPTIONS: {
  tier: RiskTier;
  label: string;
  cap: string;
  borderClass: string;
  activeClass: string;
}[] = [
  {
    tier: RiskTier.conservative,
    label: "Conservative",
    cap: "30 trades/month",
    borderClass: "border-primary/30 hover:border-primary/70",
    activeClass:
      "border-primary bg-primary/10 shadow-[0_0_12px_rgba(0,245,255,0.25)]",
  },
  {
    tier: RiskTier.moderate,
    label: "Moderate",
    cap: "100 trades/month",
    borderClass: "border-warning/30 hover:border-warning/70",
    activeClass:
      "border-warning bg-warning/10 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
  },
  {
    tier: RiskTier.aggressive,
    label: "Aggressive",
    cap: "300 trades/month",
    borderClass: "border-destructive/30 hover:border-destructive/70",
    activeClass:
      "border-destructive bg-destructive/10 shadow-[0_0_12px_rgba(255,51,102,0.25)]",
  },
];

const RISK_LABEL_COLOR: Record<RiskTier, string> = {
  [RiskTier.conservative]: "text-primary",
  [RiskTier.moderate]: "text-warning",
  [RiskTier.aggressive]: "text-destructive",
};

function detectDirectRoute(
  tokenA: UnifiedToken | null,
  tokenB: UnifiedToken | null,
): boolean {
  if (!tokenA || !tokenB) return false;
  const aHasDex = tokenA.dexIds.some((d) =>
    d.toLowerCase().includes("dexscreener"),
  );
  const bHasDex = tokenB.dexIds.some((d) =>
    d.toLowerCase().includes("dexscreener"),
  );
  return aHasDex && bHasDex;
}

export default function CreatePairTrade() {
  const navigate = useNavigate();
  const { icpPriceUsd } = useICPPrice();
  const { isLoading: universeLoading } = useTokenUniverse();
  const createMutation = useCreatePairTrade();

  const [tokenA, setTokenA] = useState<UnifiedToken | null>(null);
  const [tokenB, setTokenB] = useState<UnifiedToken | null>(null);
  const [showSelectorA, setShowSelectorA] = useState(false);
  const [showSelectorB, setShowSelectorB] = useState(false);
  const [allocationStr, setAllocationStr] = useState("");
  const [riskTier, setRiskTier] = useState<RiskTier>(RiskTier.conservative);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allocationUsd = Number.parseFloat(allocationStr) || 0;
  const icpEquivalent = icpPriceUsd > 0 ? allocationUsd / icpPriceUsd : null;
  const isDirect = detectDirectRoute(tokenA, tokenB);
  const routeViaICP = tokenA && tokenB ? !isDirect : false;
  const bothSelected = !!tokenA && !!tokenB;

  function validate() {
    const errs: Record<string, string> = {};
    if (!tokenA) errs.tokenA = "Select Token A";
    if (!tokenB) errs.tokenB = "Select Token B";
    if (tokenA && tokenB && tokenA.address === tokenB.address)
      errs.tokenB = "Token B must differ from Token A";
    if (!allocationStr || allocationUsd <= 0)
      errs.allocation = "Enter an allocation greater than $0";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate() || !tokenA || !tokenB) return;
    try {
      const id = await createMutation.mutateAsync({
        tokenAAddress: tokenA.address,
        tokenASymbol: tokenA.symbol,
        tokenBAddress: tokenB.address,
        tokenBSymbol: tokenB.symbol,
        allocationUsd,
        riskTier,
        routeViaICP,
        notes,
      });
      navigate({ to: "/pair-trades/$id", params: { id: id.toString() } });
    } catch (_e) {
      setErrors({ save: "Failed to save. Please try again." });
    }
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
          onClick={() => navigate({ to: "/pair-trades" })}
          data-ocid="create-pair-trade.back.button"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Pair Trade</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure your pair trading position
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Token Selection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Token Pair
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Token A */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    TOKEN A
                  </Label>
                  {tokenA ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/30">
                      <div>
                        <span className="font-bold text-primary">
                          {tokenA.symbol}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {tokenA.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTokenA(null);
                          setShowSelectorA(false);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        data-ocid="create-pair-trade.token-a.close_button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowSelectorA(!showSelectorA);
                        setShowSelectorB(false);
                      }}
                      data-ocid="create-pair-trade.token-a.button"
                      className={cn(
                        "w-full p-3 rounded-lg border text-left text-sm transition-colors",
                        errors.tokenA
                          ? "border-destructive/50 bg-destructive/5 text-destructive"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {errors.tokenA || "Select Token A..."}
                    </button>
                  )}
                  {showSelectorA && !tokenA && (
                    <div className="mt-2">
                      <TokenSelector
                        onSelect={(t) => {
                          setTokenA(t);
                          setShowSelectorA(false);
                          if (errors.tokenA)
                            setErrors((e) => ({ ...e, tokenA: "" }));
                        }}
                        placeholder="Search Token A..."
                        excludeAddress={tokenB?.address}
                      />
                    </div>
                  )}
                </div>

                {/* Token B */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    TOKEN B
                  </Label>
                  {tokenB ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                      <div>
                        <span className="font-bold text-foreground">
                          {tokenB.symbol}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {tokenB.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTokenB(null);
                          setShowSelectorB(false);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        data-ocid="create-pair-trade.token-b.close_button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowSelectorB(!showSelectorB);
                        setShowSelectorA(false);
                      }}
                      data-ocid="create-pair-trade.token-b.button"
                      className={cn(
                        "w-full p-3 rounded-lg border text-left text-sm transition-colors",
                        errors.tokenB
                          ? "border-destructive/50 bg-destructive/5 text-destructive"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {errors.tokenB || "Select Token B..."}
                    </button>
                  )}
                  {showSelectorB && !tokenB && (
                    <div className="mt-2">
                      <TokenSelector
                        onSelect={(t) => {
                          setTokenB(t);
                          setShowSelectorB(false);
                          if (errors.tokenB)
                            setErrors((e) => ({ ...e, tokenB: "" }));
                        }}
                        placeholder="Search Token B..."
                        excludeAddress={tokenA?.address}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Route indicator */}
              {bothSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Route:
                    </span>
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                        isDirect
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-secondary/10 text-secondary border-secondary/30",
                      )}
                    >
                      {isDirect ? "Direct Pool" : "Routes via ICP"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isDirect
                      ? "Direct pair available on DexScreener"
                      : "No direct pair — trade will route through ICP"}
                  </span>
                </motion.div>
              )}

              {/* Pair preview */}
              {bothSelected && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <span className="font-bold text-xl text-primary">
                    {tokenA?.symbol}
                  </span>
                  <ArrowRight size={20} className="text-muted-foreground" />
                  <span className="font-bold text-xl text-foreground">
                    {tokenB?.symbol}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Allocation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label
                  htmlFor="allocation"
                  className="text-xs text-muted-foreground mb-1.5 block"
                >
                  USD Amount
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                    $
                  </span>
                  <Input
                    id="allocation"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={allocationStr}
                    onChange={(e) => {
                      setAllocationStr(e.target.value);
                      if (errors.allocation)
                        setErrors((er) => ({ ...er, allocation: "" }));
                    }}
                    placeholder="0.00"
                    data-ocid="create-pair-trade.allocation.input"
                    className={cn(
                      "pl-7 bg-background border-border font-mono",
                      errors.allocation && "border-destructive/50",
                    )}
                  />
                </div>
                {errors.allocation && (
                  <p
                    className="text-xs text-destructive mt-1"
                    data-ocid="create-pair-trade.allocation.error_state"
                  >
                    {errors.allocation}
                  </p>
                )}
                {icpEquivalent !== null && allocationUsd > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    ≈{" "}
                    <span className="text-primary font-mono">
                      {icpEquivalent.toFixed(4)} ICP
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Tier */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Risk Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {RISK_OPTIONS.map((opt) => {
                  const isActive = riskTier === opt.tier;
                  return (
                    <button
                      key={opt.tier}
                      type="button"
                      onClick={() => setRiskTier(opt.tier)}
                      data-ocid={`create-pair-trade.risk-${opt.tier}.button`}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                        isActive ? opt.activeClass : opt.borderClass,
                        "bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            isActive
                              ? RISK_LABEL_COLOR[opt.tier]
                              : "text-foreground",
                          )}
                        >
                          {opt.label}
                        </span>
                        {isActive && (
                          <CheckCircle2
                            size={16}
                            className={RISK_LABEL_COLOR[opt.tier]}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.cap}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
                Notes{" "}
                <span className="text-xs font-normal normal-case">
                  (optional)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this trade..."
                data-ocid="create-pair-trade.notes.textarea"
                className="bg-background border-border resize-none min-h-[80px]"
              />
            </CardContent>
          </Card>
        </motion.div>

        {errors.save && (
          <p
            className="text-sm text-destructive text-center"
            data-ocid="create-pair-trade.save.error_state"
          >
            {errors.save}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || universeLoading}
            data-ocid="create-pair-trade.submit_button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_16px_rgba(0,245,255,0.3)] h-12 text-base font-semibold"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Save Pair Trade"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
