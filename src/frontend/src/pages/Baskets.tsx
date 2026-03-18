import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Layers, Package, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useBaskets } from "../hooks/useBaskets";

function formatDate(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RISK_BADGE: Record<string, { className: string }> = {
  Conservative: {
    className:
      "bg-primary/10 text-primary border-primary/30 shadow-[0_0_6px_rgba(0,245,255,0.2)]",
  },
  Moderate: {
    className:
      "bg-warning/10 text-warning border-warning/30 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
  },
  Aggressive: {
    className:
      "bg-destructive/10 text-destructive border-destructive/30 shadow-[0_0_6px_rgba(255,51,102,0.2)]",
  },
};

const TEMPLATES = [
  {
    key: "BIG3",
    name: "Big 3",
    risk: "Conservative",
    description: "Anchored in the three largest ICP ecosystem tokens.",
    slots: [
      { token: "CKBTC", weight: 40 },
      { token: "ICP", weight: 40 },
      { token: "CKETH", weight: 20 },
    ],
  },
  {
    key: "TOP5",
    name: "Top 5",
    risk: "Moderate",
    description: "Core position plus mid-cap growth exposure.",
    slots: [
      { token: "CKBTC", weight: 30 },
      { token: "ICP", weight: 30 },
      { token: "CKETH", weight: 20 },
      { token: "BOB", weight: 10 },
      { token: "WTN", weight: 10 },
    ],
  },
  {
    key: "TENACIOUS10",
    name: "Tenacious 10",
    risk: "Aggressive",
    description:
      "Maximum diversification across 10 ICP tokens at equal weight.",
    slots: [
      { token: "CKBTC", weight: 10 },
      { token: "ICP", weight: 10 },
      { token: "CKETH", weight: 10 },
      { token: "BOB", weight: 10 },
      { token: "WTN", weight: 10 },
      { token: "CHAT", weight: 10 },
      { token: "KINIC", weight: 10 },
      { token: "GHOST", weight: 10 },
      { token: "HOT", weight: 10 },
      { token: "NTN", weight: 10 },
    ],
  },
];

export default function Baskets() {
  const navigate = useNavigate();
  const { data: baskets, isLoading } = useBaskets();

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Baskets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Strategy-driven portfolios of weighted pair trades
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: "/baskets/new" })}
          data-ocid="baskets.primary_button"
          className="bg-secondary text-white hover:bg-secondary/90 shadow-[0_0_12px_rgba(123,47,255,0.35)] gap-2"
        >
          <Plus size={16} />
          New Basket
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3" data-ocid="baskets.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : !baskets || baskets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            className="bg-card border-border mb-6"
            data-ocid="baskets.empty_state"
          >
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                <Layers className="text-secondary" size={28} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground mb-1">
                  No baskets yet
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Create a basket of 3–10 weighted pair trades to start
                  portfolio trading.
                </p>
              </div>
              <Button
                onClick={() => navigate({ to: "/baskets/new" })}
                variant="outline"
                data-ocid="baskets.secondary_button"
                className="border-secondary/30 text-secondary hover:bg-secondary/10 gap-2 mt-2"
              >
                <Plus size={16} />
                Create Basket
              </Button>
            </CardContent>
          </Card>

          {/* Template cards */}
          <div className="mb-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Start from a template
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEMPLATES.map((tpl, idx) => {
                const riskBadge =
                  RISK_BADGE[tpl.risk] ?? RISK_BADGE.Conservative;
                return (
                  <motion.div
                    key={tpl.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.07 }}
                  >
                    <Card className="bg-card border-border hover:border-secondary/40 transition-all duration-200 hover:shadow-[0_0_16px_rgba(123,47,255,0.12)] h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-bold text-foreground">
                            {tpl.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs border ml-2 flex-shrink-0",
                              riskBadge.className,
                            )}
                          >
                            {tpl.risk}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {tpl.description}
                        </p>
                        <div className="space-y-1 mb-4 flex-1">
                          {tpl.slots.map((s) => (
                            <div
                              key={s.token}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-foreground font-medium">
                                {s.token}
                              </span>
                              <span className="text-muted-foreground font-mono">
                                {s.weight}%
                              </span>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate({
                              to: "/baskets/new",
                              search: { template: tpl.key } as any,
                            })
                          }
                          data-ocid={`baskets.template-${tpl.key.toLowerCase()}.button`}
                          className="w-full bg-secondary/10 text-secondary hover:bg-secondary/20 border border-secondary/30 shadow-none text-xs"
                          variant="outline"
                        >
                          <Package size={12} className="mr-1.5" />
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {baskets.map((basket, idx) => {
            const riskBadge =
              RISK_BADGE[basket.riskTier] ?? RISK_BADGE.Conservative;
            const thresholdPct = Number(basket.rebalanceThresholdBps) / 100;
            return (
              <motion.div
                key={basket.id.toString()}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                data-ocid={`baskets.item.${idx + 1}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/baskets/$id",
                      params: { id: basket.id.toString() },
                    })
                  }
                  className="w-full text-left"
                >
                  <Card className="bg-card border-border hover:border-secondary/40 transition-all duration-200 hover:shadow-[0_0_16px_rgba(123,47,255,0.1)] cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground text-base leading-snug">
                            {basket.name}
                          </p>
                          {basket.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {basket.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs border",
                              riskBadge.className,
                            )}
                          >
                            {basket.riskTier}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-success/10 text-success border-success/30 text-xs"
                          >
                            Balanced
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>{basket.slots.length} pair trades</span>
                        <span>Rebalance at ±{thresholdPct}%</span>
                        <span>Created {formatDate(basket.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
