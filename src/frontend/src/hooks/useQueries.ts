import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RiskTier } from "../backend";
import type { TokenUniverse, UnifiedToken } from "../types/tokenUniverse";
import { useActor } from "./useActor";

// Re-export types so other hooks can import from here
export type { UnifiedToken, TokenUniverse };
export { RiskTier };

// ─── Token Universe ───────────────────────────────────────────────────────────

/**
 * Returns true if the address looks like an ICP canister ID
 * (5 base32 groups separated by hyphens, e.g. "ryjl3-tyaaa-aaaaa-aaaba-cai").
 * Rejects ETH 0x… addresses, LTC addresses, hex strings, etc.
 */
function isIcpCanisterId(addr: string): boolean {
  return /^[a-z2-7]+-[a-z2-7]+-[a-z2-7]+-[a-z2-7]+-[a-z2-7]+$/.test(addr);
}

const HARDCODED_TOKENS: UnifiedToken[] = [
  {
    address: "ryjl3-tyaaa-aaaaa-aaaba-cai",
    symbol: "ICP",
    name: "Internet Computer",
    decimals: 8,
    priceUsd: null,
    priceNative: 1,
    liquidityUsd: null,
    volume24h: null,
    priceChange24h: null,
    icpswapAvailable: true,
    kongswapAvailable: true,
    dexIds: ["icpswap", "kongswap"],
    lastUpdated: 0,
  },
  {
    address: "mxzaz-hqaaa-aaaar-qaada-cai",
    symbol: "ckBTC",
    name: "Chain-Key Bitcoin",
    decimals: 8,
    priceUsd: null,
    priceNative: null,
    liquidityUsd: null,
    volume24h: null,
    priceChange24h: null,
    icpswapAvailable: true,
    kongswapAvailable: true,
    dexIds: ["icpswap", "kongswap"],
    lastUpdated: 0,
  },
  {
    address: "ss2fx-dyaaa-aaaar-qacoq-cai",
    symbol: "ckETH",
    name: "Chain-Key Ethereum",
    decimals: 18,
    priceUsd: null,
    priceNative: null,
    liquidityUsd: null,
    volume24h: null,
    priceChange24h: null,
    icpswapAvailable: true,
    kongswapAvailable: true,
    dexIds: ["icpswap", "kongswap"],
    lastUpdated: 0,
  },
  {
    address: "xevnm-gaaaa-aaaar-qafnq-cai",
    symbol: "ckUSDC",
    name: "Chain-Key USDC",
    decimals: 6,
    priceUsd: 1.0,
    priceNative: null,
    liquidityUsd: null,
    volume24h: null,
    priceChange24h: null,
    icpswapAvailable: true,
    kongswapAvailable: true,
    dexIds: ["icpswap", "kongswap"],
    lastUpdated: 0,
  },
  {
    address: "cngnf-vqaaa-aaaar-qag4q-cai",
    symbol: "ckUSDT",
    name: "Chain-Key USDT",
    decimals: 6,
    priceUsd: 1.0,
    priceNative: null,
    liquidityUsd: null,
    volume24h: null,
    priceChange24h: null,
    icpswapAvailable: true,
    kongswapAvailable: true,
    dexIds: ["icpswap", "kongswap"],
    lastUpdated: 0,
  },
];

function parseKongSwapTokens(raw: string): UnifiedToken[] {
  try {
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : (data?.tokens ?? []);
    return list
      .filter(
        (t: Record<string, unknown>) =>
          t.canister_id || t.canisterId || t.address,
      )
      .map((t: Record<string, unknown>) => ({
        address: String(t.canister_id ?? t.canisterId ?? t.address ?? ""),
        symbol: String(t.symbol ?? ""),
        name: String(t.name ?? t.symbol ?? ""),
        decimals: Number(t.decimals ?? 8),
        priceUsd: Number(t.price_usd ?? t.priceUsd ?? t.price ?? 0) || null,
        priceNative: null,
        liquidityUsd: t.tvl ? Number(t.tvl) : null,
        volume24h: t.volume_24h ? Number(t.volume_24h) : null,
        priceChange24h: null,
        icpswapAvailable: false,
        kongswapAvailable: true,
        dexIds: ["kongswap"],
        lastUpdated: Date.now(),
      }));
  } catch {
    return [];
  }
}

function parseDexScreenerPairs(raw: string): UnifiedToken[] {
  try {
    const data = JSON.parse(raw);
    const pairs = data?.pairs ?? [];
    const seen = new Set<string>();
    const result: UnifiedToken[] = [];
    for (const pair of pairs) {
      // Only keep pairs on the ICP chain
      if (pair.chainId && pair.chainId !== "icp") continue;
      const address =
        pair.baseToken?.address ?? pair.quoteToken?.address ?? pair.pairAddress;
      if (!address || seen.has(address)) continue;
      seen.add(address);
      result.push({
        address,
        symbol: String(pair.baseToken?.symbol ?? ""),
        name: String(pair.baseToken?.name ?? pair.baseToken?.symbol ?? ""),
        decimals: 8,
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
        priceNative: null,
        liquidityUsd: pair.liquidity?.usd ? Number(pair.liquidity.usd) : null,
        volume24h: pair.volume?.h24 ? Number(pair.volume.h24) : null,
        priceChange24h: pair.priceChange?.h24
          ? Number(pair.priceChange.h24)
          : null,
        icpswapAvailable: false,
        kongswapAvailable: false,
        dexIds: ["dexscreener"],
        lastUpdated: Date.now(),
      });
    }
    return result;
  } catch {
    return [];
  }
}

function mergeTokens(
  base: UnifiedToken[],
  extras: UnifiedToken[],
): UnifiedToken[] {
  const map = new Map<string, UnifiedToken>();
  for (const t of base) map.set(t.address, { ...t });
  for (const t of extras) {
    if (!t.address) continue;
    const existing = map.get(t.address);
    if (existing) {
      if (t.priceUsd != null) existing.priceUsd = t.priceUsd;
      if (t.liquidityUsd != null) existing.liquidityUsd = t.liquidityUsd;
      if (t.volume24h != null) existing.volume24h = t.volume24h;
      if (t.priceChange24h != null) existing.priceChange24h = t.priceChange24h;
      existing.icpswapAvailable =
        existing.icpswapAvailable || t.icpswapAvailable;
      existing.kongswapAvailable =
        existing.kongswapAvailable || t.kongswapAvailable;
    } else {
      map.set(t.address, { ...t });
    }
  }
  return Array.from(map.values());
}

export function buildPriceMap(tokens: UnifiedToken[]): Array<[string, number]> {
  return tokens
    .filter((t) => t.priceUsd != null && t.priceUsd > 0)
    .map((t) => [t.address, t.priceUsd as number]);
}

async function fetchKongSwapDirect(): Promise<UnifiedToken[]> {
  try {
    const resp = await fetch("https://api.kongswap.io/api/tokens", {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    return parseKongSwapTokens(await resp.text());
  } catch {
    return [];
  }
}

async function fetchDexScreenerDirect(): Promise<UnifiedToken[]> {
  try {
    const resp = await fetch(
      "https://api.dexscreener.com/latest/dex/search?q=icp",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];
    return parseDexScreenerPairs(await resp.text());
  } catch {
    return [];
  }
}

interface TokenUniverseResult extends TokenUniverse {
  isLoading: boolean;
  refetch: () => void;
  coreFallbackActive: boolean;
}

async function fetchCoinGeckoPrices(): Promise<Record<string, number>> {
  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer,bitcoin,ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return {};
    const data = await resp.json();
    return {
      "ryjl3-tyaaa-aaaaa-aaaba-cai": data?.["internet-computer"]?.usd ?? 0,
      "mxzaz-hqaaa-aaaar-qaada-cai": data?.bitcoin?.usd ?? 0,
      "ss2fx-dyaaa-aaaar-qacoq-cai": data?.ethereum?.usd ?? 0,
    };
  } catch {
    return {};
  }
}

let _cachedResult: TokenUniverseResult | null = null;

export function useTokenUniverse(): TokenUniverseResult {
  const { actor } = useActor();

  const queryResult = useQuery<TokenUniverse>({
    queryKey: ["tokenUniverse"],
    queryFn: async () => {
      let fast: UnifiedToken[] = [];
      let kongswapStatus: "ok" | "unavailable" = "unavailable";
      let dexscreenerStatus: "ok" | "unavailable" = "unavailable";

      if (actor) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const caches = await (actor as any).getTokenUniverseCaches();
          if (caches) {
            const kongRaw = caches.kongSwapCache ?? "";
            const dexRaw = caches.dexScreenerCache ?? "";
            if (kongRaw) fast = mergeTokens(fast, parseKongSwapTokens(kongRaw));
            if (dexRaw) fast = mergeTokens(fast, parseDexScreenerPairs(dexRaw));
          }
          // Warm cache
          void (actor as any).updateTokenUniverse?.().catch(() => {});
        } catch {
          /* ignore */
        }
      }

      const [kong, dex] = await Promise.all([
        fetchKongSwapDirect(),
        fetchDexScreenerDirect(),
      ]);

      if (kong.length > 0) kongswapStatus = "ok";
      if (dex.length > 0) dexscreenerStatus = "ok";

      const live = mergeTokens(kong, dex);
      const merged = mergeTokens(HARDCODED_TOKENS, mergeTokens(fast, live));
      // ── CoinGecko fallback for ICP, ckBTC, ckETH ────────────────────────────
      const COINGECKO_IDS = [
        "ryjl3-tyaaa-aaaaa-aaaba-cai",
        "mxzaz-hqaaa-aaaar-qaada-cai",
        "ss2fx-dyaaa-aaaar-qacoq-cai",
      ];
      const needsFallback = COINGECKO_IDS.some((addr) => {
        const t = merged.find((x) => x.address === addr);
        return !t?.priceUsd || t.priceUsd === 0;
      });
      if (needsFallback) {
        const cgPrices = await fetchCoinGeckoPrices();
        for (const t of merged) {
          const fallbackPrice = cgPrices[t.address];
          if (
            fallbackPrice &&
            fallbackPrice > 0 &&
            (!t.priceUsd || t.priceUsd === 0)
          ) {
            t.priceUsd = fallbackPrice;
          }
        }
      }

      // ── Dedup + ICP-only filter ─────────────────────────────────────────────
      const CORE_IDS = new Set(HARDCODED_TOKENS.map((t) => t.address));
      const seenAddresses = new Set<string>();
      const cleaned = merged.filter((token) => {
        const addr = token.address.toLowerCase();
        if (seenAddresses.has(addr)) return false; // deduplicate
        seenAddresses.add(addr);
        if (CORE_IDS.has(addr)) return true; // always keep core 5
        return isIcpCanisterId(addr); // drop non-ICP tokens
      });
      console.log(
        `Token list cleaned: ${cleaned.length} tokens after dedup/filter`,
      );

      const icpToken = cleaned.find(
        (t) => t.address === "ryjl3-tyaaa-aaaaa-aaaba-cai",
      );
      const icpPriceUsd = icpToken?.priceUsd ?? 0;

      console.log(`[TokenUniverse] ${cleaned.length} tokens loaded`);
      return {
        tokens: cleaned,
        icpPriceUsd,
        fetchedAt: Date.now(),
        icpswapStatus: "unavailable" as const,
        kongswapStatus,
        dexscreenerStatus,
      };
    },
    enabled: true,
    staleTime: 60_000,
    refetchInterval: 60_000,
    initialData: {
      tokens: HARDCODED_TOKENS,
      icpPriceUsd: 0,
      fetchedAt: 0,
      icpswapStatus: "unavailable" as const,
      kongswapStatus: "unavailable" as const,
      dexscreenerStatus: "unavailable" as const,
    },
    initialDataUpdatedAt: 0,
  });

  const result: TokenUniverseResult = {
    tokens: queryResult.data?.tokens ?? HARDCODED_TOKENS,
    icpPriceUsd: queryResult.data?.icpPriceUsd ?? 0,
    fetchedAt: queryResult.data?.fetchedAt ?? 0,
    icpswapStatus: queryResult.data?.icpswapStatus ?? "unavailable",
    kongswapStatus: queryResult.data?.kongswapStatus ?? "unavailable",
    dexscreenerStatus: queryResult.data?.dexscreenerStatus ?? "unavailable",
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
    coreFallbackActive: (queryResult.data?.fetchedAt ?? 0) === 0,
  };
  _cachedResult = result;
  return result;
}

export function useICPPrice() {
  const universe = useTokenUniverse();
  return { icpPriceUsd: universe.icpPriceUsd, isLoading: universe.isLoading };
}

export function useToken(address: string | undefined) {
  const universe = useTokenUniverse();
  if (!address) return undefined;
  return universe.tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase(),
  );
}

export function useTokenSearch(query: string): UnifiedToken[] {
  const universe = useTokenUniverse();
  const q = query.trim().toLowerCase();
  const allTokens =
    universe.tokens.length > 0 ? universe.tokens : HARDCODED_TOKENS;
  if (!q) return allTokens.slice(0, 50);
  return allTokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q),
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  const { actor, isFetching } = useActor();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getProfile();
    },
    enabled: !!actor && !isFetching,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = query.data as any;
  // Handle both { ok: {...} } and flat object shapes
  const ok =
    raw?.ok ?? (raw && typeof raw === "object" && !raw.err ? raw : null);
  return {
    displayName: ok?.displayName ?? ok?.name ?? "",
    riskPreference: ok?.riskPreference ?? ok?.risk ?? "Moderate",
    preferredCurrency: ok?.preferredCurrency ?? ok?.currency ?? "USD",
    ownerPrincipal: ok?.ownerPrincipal,
    isLoading: query.isLoading,
    data: query.data,
  };
}

export function useSetProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: {
      name: string;
      currency: string;
      risk: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).setProfile(
        profile.name,
        profile.currency,
        profile.risk,
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// ─── Funding ─────────────────────────────────────────────────────────────────

export function useFundingEntries() {
  const { actor, isFetching } = useActor();
  return useQuery({
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
  return useQuery({
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
    mutationFn: async (entry: {
      entryType: unknown;
      amountICP: number;
      note: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).addFundingEntry(
        entry.entryType,
        entry.amountICP,
        entry.note,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fundingEntries"] });
      queryClient.invalidateQueries({ queryKey: ["totalFundedICP"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
    },
  });
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export function useHoldings() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["holdings"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHoldings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useHolding(tokenCanisterId: string | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["holding", tokenCanisterId],
    queryFn: async () => {
      if (!actor || !tokenCanisterId) return null;
      // actor.getHolding expects a string canister ID
      return actor.getHolding(tokenCanisterId);
    },
    enabled: !!actor && !isFetching && !!tokenCanisterId,
  });
}

export function useAvailableICPBalance() {
  const { actor, isFetching } = useActor();
  return useQuery({
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
    mutationFn: async (params: {
      tokenCanisterId: string;
      amountChange: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // actor.updateHolding expects string canister ID
      return actor.updateHolding(params.tokenCanisterId, params.amountChange);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  });
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

export function useSwapReceipts() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["swapReceipts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSwapReceipts();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useSwapQuote(
  tokenIn: string | undefined,
  amountIn: number,
  tokenOut: string | undefined,
) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["swapQuote", tokenIn, amountIn, tokenOut],
    queryFn: async () => {
      if (!actor || !tokenIn || !tokenOut || amountIn <= 0) return 0;
      // actor.getSwapQuote expects string canister IDs
      return actor.getSwapQuote(tokenIn, amountIn, tokenOut);
    },
    enabled:
      !!actor &&
      !isFetching &&
      !!tokenIn &&
      !!tokenOut &&
      amountIn > 0 &&
      tokenIn !== tokenOut,
    staleTime: 15_000,
  });
}

export function useExecuteSwap() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tokenIn: string;
      amountIn: number;
      tokenOut: string;
      route: string;
      priceImpactPct: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const { Principal } = await import("@dfinity/principal");
      // actor.executeSwap expects Principal for tokenIn/tokenOut
      return actor.executeSwap(
        Principal.fromText(params.tokenIn),
        params.amountIn,
        Principal.fromText(params.tokenOut),
        params.route,
        params.priceImpactPct,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["swapReceipts"] });
      queryClient.invalidateQueries({ queryKey: ["availableICPBalance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
      queryClient.invalidateQueries({ queryKey: ["realizedPnL"] });
      queryClient.invalidateQueries({ queryKey: ["unrealizedPnL"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioHistory"] });
    },
  });
}

// ─── Trading Permission ───────────────────────────────────────────────────────

export function useTradingPermissionExpiry() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["tradingPermissionExpiry"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTradingPermissionExpiry();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
  });
}

export function useGrantTradingPermission() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.grantTradingPermission();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tradingPermissionExpiry"] }),
  });
}

export function useRevokeTradingPermission() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.revokeTradingPermission();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tradingPermissionExpiry"] }),
  });
}

// ─── Trade Frequency ──────────────────────────────────────────────────────────

export function useTradeFrequencyStatus() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["tradeFrequencyStatus"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTradeFrequencyStatus();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Pair Trades ──────────────────────────────────────────────────────────────

export function usePairTrades() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["pairTrades"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPairTrades();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePairTrade(id: bigint | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["pairTrade", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      const result = await actor.getPairTrade(id);
      return Array.isArray(result) ? (result[0] ?? null) : result;
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

export function useCreatePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (params: Record<string, any>) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createPairTrade(
        params.tokenAAddress,
        params.tokenASymbol,
        params.tokenBAddress,
        params.tokenBSymbol,
        params.allocationUsd,
        params.riskTier as RiskTier,
        params.routeViaICP ?? false,
        params.notes ?? "",
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] }),
  });
}

export function useUpdatePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      allocationUsd: number;
      riskTier: RiskTier;
      notes: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updatePairTrade(
        params.id,
        params.allocationUsd,
        params.riskTier,
        params.notes,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] }),
  });
}

export function useDeletePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deletePairTrade(id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] }),
  });
}

// ─── Baskets ──────────────────────────────────────────────────────────────────

export function useBaskets() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["baskets"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBaskets();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useBasket(id: bigint | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["basket", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      const result = await actor.getBasket(id);
      return Array.isArray(result) ? (result[0] ?? null) : result;
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

export function useCreateBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (params: Record<string, any>) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createBasket(
        params.name,
        params.description ?? "",
        params.slots,
        params.rebalanceThresholdBps ?? BigInt(500),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["baskets"] }),
  });
}

export function useUpdateBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (params: Record<string, any>) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateBasket(
        params.id,
        params.name,
        params.description ?? "",
        params.slots,
        params.rebalanceThresholdBps ?? BigInt(500),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["baskets"] }),
  });
}

export function useDeleteBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteBasket(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["baskets"] }),
  });
}

// ─── Portfolio Value & PnL ────────────────────────────────────────────────────

export function usePortfolioValue() {
  const { actor, isFetching } = useActor();
  const universe = useTokenUniverse();

  return useQuery<number>({
    queryKey: ["portfolioValue"],
    queryFn: async () => {
      if (!actor) return 0;
      const priceMap = buildPriceMap(universe.tokens);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = await (actor as any).getPortfolioValue(priceMap);
      return typeof val === "number" ? val : 0;
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useRealizedPnL() {
  const { actor, isFetching } = useActor();
  return useQuery<number>({
    queryKey: ["realizedPnL"],
    queryFn: async () => {
      if (!actor) return 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = await (actor as any).getTotalRealizedPnL();
      return typeof val === "number" ? val : 0;
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useUnrealizedPnL() {
  const { actor, isFetching } = useActor();
  const universe = useTokenUniverse();

  return useQuery<number>({
    queryKey: ["unrealizedPnL"],
    queryFn: async () => {
      if (!actor) return 0;
      const priceMap = buildPriceMap(universe.tokens);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = await (actor as any).getUnrealizedPnL(
        priceMap,
        universe.icpPriceUsd,
      );
      return typeof val === "number" ? val : 0;
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ─── Basket Drift ─────────────────────────────────────────────────────────────

export function useBasketDrift(basketId: bigint | undefined) {
  const { actor, isFetching } = useActor();
  const universe = useTokenUniverse();

  return useQuery<
    Array<{ direction: string; slotIndex: bigint; driftBps: bigint }>
  >({
    queryKey: ["basketDrift", basketId?.toString()],
    queryFn: async () => {
      if (!actor || basketId === undefined) return [];
      const priceMap = buildPriceMap(universe.tokens);
      return actor.getBasketDrift(basketId, priceMap);
    },
    enabled:
      !!actor && !isFetching && basketId !== undefined && !universe.isLoading,
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
    staleTime: Number.POSITIVE_INFINITY,
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

// ── Smart Wallet: Deposit Addresses ──────────────────────────────────────────

export function useUniqueDepositAddress() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["uniqueDepositAddress"],
    queryFn: async () => {
      if (!actor) return "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await (actor as any).getUniqueDepositAddress()) as string;
      } catch {
        return "";
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useBtcDepositAddress() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["btcDepositAddress"],
    queryFn: async () => {
      if (!actor) return "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await (actor as any).getBtcDepositAddress()) as string;
      } catch {
        return "";
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000 * 60,
  });
}

export function useEthDepositAddress() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["ethDepositAddress"],
    queryFn: async () => {
      if (!actor) return "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await (actor as any).getEthDepositAddress()) as string;
      } catch {
        return "";
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000 * 60,
  });
}

export function useDepositBtc() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).depositBtc() as Promise<string>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
    },
  });
}

export function useDepositEth() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).depositEth() as Promise<string>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
    },
  });
}

export function useWithdrawWithDenomination() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceToken,
      amount,
      outputToken,
      destination,
    }: {
      sourceToken: string;
      amount: number;
      outputToken: "ICP" | "ckBTC" | "ckETH" | "Individual";
      destination: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const { Principal } = await import("@dfinity/principal");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).withdrawWithDenomination(
        Principal.fromText(sourceToken),
        amount,
        outputToken,
        Principal.fromText(destination),
      ) as Promise<string>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValue"] });
    },
  });
}

export function useToggleAgent() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      id,
      isPairTrade,
      enabled,
    }: {
      id: bigint;
      isPairTrade: boolean;
      enabled: boolean;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).toggleAgent(
        id,
        isPairTrade,
        enabled,
      ) as Promise<boolean>;
    },
  });
}

export function useAnalyzeAndDecide() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      id,
      isPairTrade,
      focusAssetPrice,
      indicatorSummary,
    }: {
      id: bigint;
      isPairTrade: boolean;
      focusAssetPrice: number;
      indicatorSummary: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).analyzeAndDecide(
        id,
        isPairTrade,
        focusAssetPrice,
        indicatorSummary,
      ) as Promise<string>;
    },
  });
}
