import { computeRouteComparison } from "@/lib/routeComparison";
import { RISK_CONFIGS } from "@/types/dexRoutes";
import type { RouteComparisonResult } from "@/types/dexRoutes";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfile, useTokenUniverse } from "./useQueries";

export function useRouteComparison(
  tokenInAddress: string | null,
  tokenOutAddress: string | null,
  amountInUsd: number,
) {
  const [debouncedAmount, setDebouncedAmount] = useState(amountInUsd);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountInUsd), 500);
    return () => clearTimeout(t);
  }, [amountInUsd]);

  const { tokens } = useTokenUniverse();
  const { riskPreference } = useProfile();

  return useQuery<RouteComparisonResult | null>({
    queryKey: [
      "routeComparison",
      tokenInAddress,
      tokenOutAddress,
      debouncedAmount,
    ],
    queryFn: () => {
      if (!tokenInAddress || !tokenOutAddress || debouncedAmount <= 0)
        return null;
      const tokenIn = tokens.find((t) => t.address === tokenInAddress);
      const tokenOut = tokens.find((t) => t.address === tokenOutAddress);
      if (!tokenIn || !tokenOut) return null;
      const riskConfig = RISK_CONFIGS[riskPreference] ?? RISK_CONFIGS.Moderate;
      return computeRouteComparison(
        tokenIn,
        tokenOut,
        debouncedAmount,
        riskConfig,
      );
    },
    enabled:
      !!tokenInAddress &&
      !!tokenOutAddress &&
      debouncedAmount > 0 &&
      tokens.length > 0,
    staleTime: 15_000,
  });
}
