import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import { usePairTrades } from "../hooks/usePairTrades";
import { RiskTier } from "../hooks/usePairTrades";

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

function formatDate(createdAt: bigint): string {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PairTrades() {
  const navigate = useNavigate();
  const { data: trades, isLoading } = usePairTrades();

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            ICP Pair Trades
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your precision pair trading positions
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: "/pair-trades/new" })}
          data-ocid="pair-trades.primary_button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_12px_rgba(0,245,255,0.3)] gap-2"
        >
          <Plus size={16} />
          New Pair Trade
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3" data-ocid="pair-trades.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !trades || trades.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          data-ocid="pair-trades.empty_state"
        >
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ArrowRight className="text-primary" size={28} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground mb-1">
                  No pair trades yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first trade to start trading.
                </p>
              </div>
              <Button
                onClick={() => navigate({ to: "/pair-trades/new" })}
                variant="outline"
                data-ocid="pair-trades.secondary_button"
                className="border-primary/30 text-primary hover:bg-primary/10 gap-2 mt-2"
              >
                <Plus size={16} />
                Create Pair Trade
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade, idx) => {
            const riskBadge = RISK_BADGE[trade.riskTier];
            return (
              <motion.div
                key={trade.id.toString()}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                data-ocid={`pair-trades.item.${idx + 1}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/pair-trades/$id",
                      params: { id: trade.id.toString() },
                    })
                  }
                  className="w-full text-left"
                >
                  <Card className="bg-card border-border hover:border-primary/40 transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,245,255,0.1)] cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-2 font-bold text-lg">
                            <span className="text-primary">
                              {trade.tokenASymbol}
                            </span>
                            <ArrowRight
                              size={18}
                              className="text-muted-foreground flex-shrink-0"
                            />
                            <span className="text-foreground">
                              {trade.tokenBSymbol}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            $
                            {trade.allocationUsd.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <Badge
                            variant="outline"
                            className={riskBadge.className}
                          >
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {formatDate(trade.createdAt)}
                      </p>
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
