import { buildTokenUniverse } from "@/lib/buildTokenUniverse";
import type { TokenUniverse, UnifiedToken } from "@/types/tokenUniverse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  FundingEntry,
  FundingEntryType,
  Holding,
  SwapReceipt,
} from "../backend";
import { useActor } from "./useActor";

export interface ProfileData {
  displayName: string;
  preferredCurrency: string;
  riskPreference: string;
}

export function useProfile() {
  const { actor, isFetching } = useActor();

  const query = useQuery<ProfileData | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getProfile();
      if (result.__kind__ === "ok") {
        return {
          displayName: result.ok.displayName,
          preferredCurrency: result.ok.preferredCurrency,
          riskPreference: result.ok.riskPreference,
        };
      }
      return null;
    },
    enabled: !!actor && !isFetching,
  });

  return {
    displayName: query.data?.displayName ?? "",
    preferredCurrency: query.data?.preferredCurrency ?? "USD",
    riskPreference: query.data?.riskPreference ?? "",
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useSetProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      currency,
      risk,
    }: { name: string; currency: string; risk: string }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.setProfile(name, currency, risk);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useTokenUniverse() {
  const { actor } = useActor();

  useEffect(() => {
    if (!actor) return;
    (actor as { updateTokenUniverse?: () => Promise<void> })
      .updateTokenUniverse?.()
      .catch(() => {});
  }, [actor]);

  const query = useQuery<TokenUniverse>({
    queryKey: ["tokenUniverse"],
    queryFn: () => buildTokenUniverse(actor),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return {
    tokens: query.data?.tokens ?? [],
    icpPriceUsd: query.data?.icpPriceUsd ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    icpswapStatus: query.data?.icpswapStatus ?? ("unavailable" as const),
    kongswapStatus: query.data?.kongswapStatus ?? ("unavailable" as const),
    dexscreenerStatus:
      query.data?.dexscreenerStatus ?? ("unavailable" as const),
    fetchedAt: query.data?.fetchedAt ?? null,
    refetch: query.refetch,
  };
}

export function useToken(address: string): UnifiedToken | undefined {
  const { tokens } = useTokenUniverse();
  return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

export function useTokenSearch(query: string): UnifiedToken[] {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { tokens } = useTokenUniverse();
  if (!debounced.trim()) return tokens.slice(0, 20);
  const lower = debounced.toLowerCase();
  return tokens
    .filter(
      (t) =>
        t.symbol.toLowerCase().includes(lower) ||
        t.name.toLowerCase().includes(lower),
    )
    .sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1))
    .slice(0, 20);
}

export function useICPPrice() {
  const { icpPriceUsd, isLoading, error } = useTokenUniverse();
  return { icpPriceUsd, isLoading, error };
}

export interface TradeFrequencyStatus {
  usedThisMonth: number;
  limitThisMonth: number;
  resetsAt: number;
  pctUsed: number;
}

export function useTradeFrequencyStatus() {
  const { actor, isFetching } = useActor();
  return useQuery<TradeFrequencyStatus | null>({
    queryKey: ["tradeFrequency"],
    queryFn: async () => {
      if (!actor) return null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = await (actor as any).getTradeFrequencyStatus();
        if (!r) return null;
        return {
          usedThisMonth: Number(r.usedThisMonth),
          limitThisMonth: Number(r.limitThisMonth),
          resetsAt: Number(r.resetsAt),
          pctUsed: Number(r.pctUsed),
        };
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ── Funding Ledger Hooks ──────────────────────────────────────────────────────

export function useFundingEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<FundingEntry[]>({
    queryKey: ["fundingEntries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFundingEntries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTotalFundedICP() {
  const { actor, isFetching } = useActor();
  return useQuery<number>({
    queryKey: ["totalFundedICP"],
    queryFn: async () => {
      if (!actor) return 0;
      return actor.getTotalFundedICP();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddFundingEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryType,
      amountICP,
      note,
    }: {
      entryType: FundingEntryType;
      amountICP: number;
      note: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addFundingEntry(entryType, amountICP, note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fundingEntries"] });
      queryClient.invalidateQueries({ queryKey: ["totalFundedICP"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
    },
  });
}

// ── Holdings Hooks ────────────────────────────────────────────────────────────

export function useHoldings() {
  const { actor, isFetching } = useActor();
  return useQuery<Holding[]>({
    queryKey: ["holdings"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHoldings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useHolding(tokenCanisterId: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Holding | null>({
    queryKey: ["holding", tokenCanisterId],
    queryFn: async () => {
      if (!actor || !tokenCanisterId) return null;
      const result = await actor.getHolding(tokenCanisterId);
      return result;
    },
    enabled: !!actor && !isFetching && !!tokenCanisterId,
  });
}

export function useAvailableICPBalance() {
  const { actor, isFetching } = useActor();
  return useQuery<number>({
    queryKey: ["availableICPBalance"],
    queryFn: async () => {
      if (!actor) return 0;
      return actor.getAvailableICPBalance();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateHolding() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tokenCanisterId,
      amountChange,
    }: {
      tokenCanisterId: string;
      amountChange: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateHolding(tokenCanisterId, amountChange);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["holding"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
    },
  });
}

// ── Swap Execution Hooks ──────────────────────────────────────────────────────

export function useSwapReceipts() {
  const { actor, isFetching } = useActor();
  return useQuery<SwapReceipt[]>({
    queryKey: ["swapReceipts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSwapReceipts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSwapQuote(
  tokenIn: string,
  amountIn: number,
  tokenOut: string,
) {
  const { actor, isFetching } = useActor();
  const enabled =
    !!actor && !isFetching && !!tokenIn && !!tokenOut && amountIn > 0;

  return useQuery<number>({
    queryKey: ["swapQuote", tokenIn, amountIn, tokenOut],
    queryFn: async () => {
      if (!actor) return 0;
      return actor.getSwapQuote(tokenIn, amountIn, tokenOut);
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useExecuteSwap() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tokenIn,
      amountIn,
      tokenOut,
      route,
      priceImpactPct,
    }: {
      tokenIn: string;
      amountIn: number;
      tokenOut: string;
      route: string;
      priceImpactPct: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).executeSwap(
        tokenIn,
        amountIn,
        tokenOut,
        route,
        priceImpactPct,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swapReceipts"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
      queryClient.invalidateQueries({ queryKey: ["realizedPnL"] });
      queryClient.invalidateQueries({ queryKey: ["unrealizedPnL"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioHistory"] });
    },
  });
}

// ── PnL & Portfolio Hooks ─────────────────────────────────────────────────────

/** Build a priceMap array from the token universe for backend PnL/portfolio calls */
export function buildPriceMap(
  tokens: Array<{ address: string; priceUsd: number | null }>,
): Array<[string, number]> {
  return tokens
    .filter((t) => t.priceUsd != null)
    .map((t) => [t.address, t.priceUsd as number] as [string, number]);
}

export function usePortfolioValue() {
  const { actor, isFetching } = useActor();
  const { tokens, isLoading: universeLoading } = useTokenUniverse();

  return useQuery<number>({
    queryKey: ["portfolioValue"],
    queryFn: async () => {
      if (!actor) return 0;
      const priceMap = buildPriceMap(tokens);
      return actor.getPortfolioValue(priceMap);
    },
    enabled: !!actor && !isFetching && !universeLoading,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useRealizedPnL() {
  const { actor, isFetching } = useActor();

  return useQuery<number>({
    queryKey: ["realizedPnL"],
    queryFn: async () => {
      if (!actor) return 0;
      return actor.getTotalRealizedPnL();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useUnrealizedPnL() {
  const { actor, isFetching } = useActor();
  const {
    tokens,
    icpPriceUsd,
    isLoading: universeLoading,
  } = useTokenUniverse();

  return useQuery<number>({
    queryKey: ["unrealizedPnL"],
    queryFn: async () => {
      if (!actor) return 0;
      const priceMap = buildPriceMap(tokens);
      return actor.getUnrealizedPnL(priceMap, icpPriceUsd);
    },
    enabled: !!actor && !isFetching && !universeLoading,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useBasketDrift(basketId: bigint | undefined) {
  const { actor, isFetching } = useActor();
  const { tokens, isLoading: universeLoading } = useTokenUniverse();

  return useQuery<
    Array<{ direction: string; slotIndex: bigint; driftBps: bigint }>
  >({
    queryKey: ["basketDrift", basketId?.toString()],
    queryFn: async () => {
      if (!actor || basketId === undefined) return [];
      const priceMap = buildPriceMap(tokens);
      return actor.getBasketDrift(basketId, priceMap);
    },
    enabled:
      !!actor && !isFetching && basketId !== undefined && !universeLoading,
    staleTime: 30_000,
  });
}

// ── Portfolio History Hook ────────────────────────────────────────────────────

export interface PortfolioSnapshot {
  timestamp: number; // ms
  totalValueUsd: number;
}

export function usePortfolioHistory(days: number) {
  const { actor, isFetching } = useActor();
  return useQuery<PortfolioSnapshot[]>({
    queryKey: ["portfolioHistory", days],
    queryFn: async () => {
      if (!actor) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await (actor as any).getPortfolioHistory(BigInt(days));
      if (!Array.isArray(raw)) return [];
      return (raw as Array<{ timestamp: bigint; totalValueUsd: number }>)
        .map((s) => ({
          timestamp: Number(s.timestamp) / 1_000_000, // ns -> ms
          totalValueUsd: s.totalValueUsd,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ── Wallet: Canister ID, SyncBalances, Withdraw ───────────────────────────────

export function useCanisterId() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["canisterId"],
    queryFn: async () => {
      if (!actor) return "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = await (actor as any).getCanisterId();
        return p?.toText ? p.toText() : String(p);
      } catch {
        return "";
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: Number.POSITIVE_INFINITY, // canister ID never changes
  });
}

export function useSyncBalances() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).syncBalances() as Promise<string>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
    },
  });
}

export function useWithdraw() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tokenCanisterId,
      amount,
      destination,
    }: {
      tokenCanisterId: string;
      amount: number;
      destination?: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const { Principal } = await import("@dfinity/principal");
      const destPrincipal = destination
        ? [Principal.fromText(destination)]
        : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).withdraw(
        Principal.fromText(tokenCanisterId),
        amount,
        destPrincipal,
      ) as Promise<string>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
    },
  });
}
