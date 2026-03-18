export type DEXRouteId =
  | "ICPSwap"
  | "KongSwap"
  | "ViaICP_ICPSwap"
  | "ViaICP_KongSwap";

export interface DEXRoute {
  dex: DEXRouteId;
  available: boolean;
  effectivePrice: number;
  estimatedOutput: number;
  fees: number;
  feesPct: number;
  liquidityDepth: number;
  liquidityDepthMultiple: number;
  estimatedSlippage: number;
  priceImpactPct: number;
  score: number;
  recommended: boolean;
  blockedByRisk: boolean;
  blockReason?: string;
}

export interface RouteComparisonResult {
  routes: DEXRoute[];
  bestRoute: DEXRoute | null;
  outputSpreadPct: number;
}

export interface RiskConfig {
  maxSlippagePct: number;
  maxPriceImpactPct: number;
  minLiquidityDepthMultiple: number;
  maxTradesPerMonth: number;
}

export const RISK_CONFIGS: Record<string, RiskConfig> = {
  Conservative: {
    maxSlippagePct: 0.5,
    maxPriceImpactPct: 5,
    minLiquidityDepthMultiple: 10,
    maxTradesPerMonth: 30,
  },
  Moderate: {
    maxSlippagePct: 1,
    maxPriceImpactPct: 10,
    minLiquidityDepthMultiple: 5,
    maxTradesPerMonth: 100,
  },
  Aggressive: {
    maxSlippagePct: 3,
    maxPriceImpactPct: 15,
    minLiquidityDepthMultiple: 2,
    maxTradesPerMonth: 300,
  },
};

export const PRICE_IMPACT_THRESHOLDS: Record<
  string,
  { green: number; yellow: number; orange: number; red: number }
> = {
  Conservative: { green: 0.5, yellow: 1, orange: 2, red: 5 },
  Moderate: { green: 1, yellow: 3, orange: 5, red: 10 },
  Aggressive: { green: 3, yellow: 5, orange: 10, red: 15 },
};
