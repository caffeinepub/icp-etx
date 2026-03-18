import type {
  DEXRoute,
  DEXRouteId,
  RiskConfig,
  RouteComparisonResult,
} from "@/types/dexRoutes";
import type { UnifiedToken } from "@/types/tokenUniverse";

const FEE_MAP: Record<DEXRouteId, number> = {
  ICPSwap: 0.3,
  KongSwap: 0.25,
  ViaICP_ICPSwap: 0.7,
  ViaICP_KongSwap: 0.6,
};

function normalize(values: number[], invert = false): number[] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return values.map(() => 0.5);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return values.map(() => 1);
  return values.map((v) => {
    if (!Number.isFinite(v)) return 0;
    const norm = (v - min) / (max - min);
    return invert ? 1 - norm : norm;
  });
}

export function computeRouteComparison(
  tokenIn: UnifiedToken,
  tokenOut: UnifiedToken,
  amountInUsd: number,
  riskConfig: RiskConfig,
): RouteComparisonResult {
  const routeIds: DEXRouteId[] = [
    "ICPSwap",
    "KongSwap",
    "ViaICP_ICPSwap",
    "ViaICP_KongSwap",
  ];

  const isAvailable = (id: DEXRouteId): boolean => {
    switch (id) {
      case "ICPSwap":
        return !!(tokenIn.icpswapAvailable && tokenOut.icpswapAvailable);
      case "KongSwap":
        return !!(tokenIn.kongswapAvailable && tokenOut.kongswapAvailable);
      case "ViaICP_ICPSwap":
        return !!(tokenIn.icpswapAvailable && tokenOut.icpswapAvailable);
      case "ViaICP_KongSwap":
        return !!(tokenIn.kongswapAvailable && tokenOut.kongswapAvailable);
    }
  };

  const poolLiquidity =
    ((tokenIn.liquidityUsd ?? 0) + (tokenOut.liquidityUsd ?? 0)) / 2;

  const routes: DEXRoute[] = routeIds.map((id) => {
    const available = isAvailable(id);
    const feesPct = FEE_MAP[id];
    const fees = (amountInUsd * feesPct) / 100;
    const estimatedOutput =
      amountInUsd > 0
        ? (amountInUsd * (1 - feesPct / 100)) /
          Math.max(tokenOut.priceUsd ?? 1, 0.000001)
        : 0;
    const liquidityDepthMultiple =
      amountInUsd > 0 ? poolLiquidity / amountInUsd : 0;
    const estimatedSlippage =
      (amountInUsd / Math.max(poolLiquidity, 1)) * 100 * 0.5;
    const priceImpactPct = estimatedSlippage * 1.2;

    let blockedByRisk = false;
    let blockReason: string | undefined;

    if (available) {
      if (estimatedSlippage > riskConfig.maxSlippagePct) {
        blockedByRisk = true;
        blockReason = `Slippage ${estimatedSlippage.toFixed(2)}% exceeds max ${riskConfig.maxSlippagePct}%`;
      } else if (priceImpactPct > riskConfig.maxPriceImpactPct) {
        blockedByRisk = true;
        blockReason = `Price impact ${priceImpactPct.toFixed(2)}% exceeds max ${riskConfig.maxPriceImpactPct}%`;
      } else if (
        liquidityDepthMultiple < riskConfig.minLiquidityDepthMultiple
      ) {
        blockedByRisk = true;
        blockReason = `Liquidity ${liquidityDepthMultiple.toFixed(1)}x below min ${riskConfig.minLiquidityDepthMultiple}x`;
      }
    }

    return {
      dex: id,
      available,
      effectivePrice: tokenOut.priceUsd ?? 0,
      estimatedOutput,
      fees,
      feesPct,
      liquidityDepth: poolLiquidity,
      liquidityDepthMultiple,
      estimatedSlippage,
      priceImpactPct,
      score: 0,
      recommended: false,
      blockedByRisk,
      blockReason,
    };
  });

  const available = routes.filter((r) => r.available);
  if (available.length > 0) {
    const outputs = available.map((r) => r.estimatedOutput);
    const slippages = available.map((r) => r.estimatedSlippage);
    const multiples = available.map((r) => r.liquidityDepthMultiple);
    const fees = available.map((r) => r.fees);

    const normOutputs = normalize(outputs, false);
    const normSlippages = normalize(slippages, true);
    const normMultiples = normalize(multiples, false);
    const normFees = normalize(fees, true);

    available.forEach((r, i) => {
      r.score = Math.round(
        (normOutputs[i] * 0.4 +
          normSlippages[i] * 0.3 +
          normMultiples[i] * 0.2 +
          normFees[i] * 0.1) *
          100,
      );
    });
  }

  const eligibleRoutes = available.filter((r) => !r.blockedByRisk);
  let bestRoute: DEXRoute | null = null;
  if (eligibleRoutes.length > 0) {
    bestRoute = eligibleRoutes.reduce(
      (best, r) => (r.score > best.score ? r : best),
      eligibleRoutes[0],
    );
    bestRoute.recommended = true;
  }

  const availableOutputs = available
    .map((r) => r.estimatedOutput)
    .filter((v) => v > 0);
  const outputSpreadPct =
    availableOutputs.length >= 2
      ? ((Math.max(...availableOutputs) - Math.min(...availableOutputs)) /
          Math.max(...availableOutputs)) *
        100
      : 0;

  return { routes, bestRoute, outputSpreadPct };
}
