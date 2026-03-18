import type { backendInterface } from "@/backend";
import type { TokenUniverse, UnifiedToken } from "@/types/tokenUniverse";

function parsePrice(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  const n = typeof val === "number" ? val : Number.parseFloat(val);
  if (Number.isNaN(n) || n === 0) return null;
  return n;
}

interface DexScreenerToken {
  symbol: string;
  name: string;
  address: string;
}

interface DexScreenerPair {
  baseToken: DexScreenerToken;
  quoteToken: DexScreenerToken;
  priceUsd: string;
  priceNative: string;
  liquidity?: { usd: number };
  volume?: { h24: number };
  priceChange?: { h24: number };
  dexId: string;
  pairAddress: string;
}

interface DexEntry {
  symbol: string;
  name: string;
  priceUsd: number | null;
  priceNative: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  dexId: string;
  pairAddress: string;
}

interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
}

// ─── Parse helpers (pure, no IO) ─────────────────────────────────────────────

function parseDexScreenerRaw(raw: string): {
  map: Map<string, DexEntry>;
  icpPriceUsd: number;
  status: "ok" | "unavailable";
} {
  try {
    const parsed = JSON.parse(raw);
    const pairs: DexScreenerPair[] = parsed.pairs ?? [];
    const map = new Map<string, DexEntry>();
    let icpPriceUsd = 0;
    let icpLiquidity = -1;

    for (const pair of pairs) {
      const liq = pair.liquidity?.usd ?? 0;
      if (pair.quoteToken.symbol === "ICP" && liq > icpLiquidity) {
        const p = parsePrice(pair.priceUsd);
        if (p) {
          icpPriceUsd = p;
          icpLiquidity = liq;
        }
      }
      const baseAddr = pair.baseToken.address.toLowerCase();
      const existing = map.get(baseAddr);
      if (!existing || (existing.liquidityUsd ?? 0) < liq) {
        map.set(baseAddr, {
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          priceUsd: parsePrice(pair.priceUsd),
          priceNative: parsePrice(pair.priceNative),
          liquidityUsd: liq || null,
          volume24h: pair.volume?.h24 ?? null,
          priceChange24h: pair.priceChange?.h24 ?? null,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
        });
      }
      const quoteAddr = pair.quoteToken.address.toLowerCase();
      if (!map.has(quoteAddr)) {
        map.set(quoteAddr, {
          symbol: pair.quoteToken.symbol,
          name: pair.quoteToken.name,
          priceUsd: null,
          priceNative: null,
          liquidityUsd: liq || null,
          volume24h: pair.volume?.h24 ?? null,
          priceChange24h: null,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
        });
      }
    }
    return { map, icpPriceUsd, status: "ok" };
  } catch (e) {
    console.error("[TokenUniverse] DexScreener parse failed:", e);
    return { map: new Map(), icpPriceUsd: 0, status: "unavailable" };
  }
}

function parseICPSwapRaw(raw: string): {
  map: Map<string, TokenMeta>;
  status: "ok" | "unavailable";
} {
  try {
    const parsed = JSON.parse(raw);
    let items: Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    }> = [];
    if (Array.isArray(parsed)) items = parsed;
    else if (parsed?.data?.content) items = parsed.data.content;
    else if (parsed?.data && Array.isArray(parsed.data)) items = parsed.data;

    const map = new Map<string, TokenMeta>();
    for (const item of items) {
      if (item.address)
        map.set(item.address.toLowerCase(), {
          symbol: item.symbol,
          name: item.name,
          decimals: item.decimals ?? 8,
        });
    }
    return { map, status: "ok" };
  } catch (e) {
    console.warn("[TokenUniverse] ICPSwap parse failed:", e);
    return { map: new Map(), status: "unavailable" };
  }
}

function parseKongSwapRaw(raw: string): {
  map: Map<string, TokenMeta>;
  status: "ok" | "unavailable";
} {
  try {
    const parsed = JSON.parse(raw);
    let items: Array<{
      canister_id: string;
      symbol: string;
      name: string;
      decimals: number;
    }> = [];
    if (Array.isArray(parsed)) items = parsed;
    else if (parsed?.tokens && Array.isArray(parsed.tokens))
      items = parsed.tokens;
    else if (parsed?.data && Array.isArray(parsed.data)) items = parsed.data;

    const map = new Map<string, TokenMeta>();
    for (const item of items) {
      const id = item.canister_id;
      if (id)
        map.set(id.toLowerCase(), {
          symbol: item.symbol,
          name: item.name,
          decimals: item.decimals ?? 8,
        });
    }
    return { map, status: "ok" };
  } catch (e) {
    console.warn("[TokenUniverse] KongSwap parse failed:", e);
    return { map: new Map(), status: "unavailable" };
  }
}

// ─── Fetch helpers (IO + parse) ───────────────────────────────────────────────

async function fetchDexScreener(actor: backendInterface | null): Promise<{
  map: Map<string, DexEntry>;
  icpPriceUsd: number;
  status: "ok" | "unavailable";
}> {
  let raw: string | null = null;
  if (actor) {
    try {
      const result = await actor.fetchDexScreenerPairs();
      if (result && result !== "[]" && result.length > 2) {
        raw = result;
        console.log("[TokenUniverse] DexScreener: proxy");
      }
    } catch (e) {
      console.warn("[TokenUniverse] DexScreener proxy failed:", e);
    }
  }
  if (!raw) {
    try {
      const res = await fetch(
        "https://api.dexscreener.com/latest/dex/pairs/icp",
        { signal: AbortSignal.timeout(10000) },
      );
      raw = await res.text();
      console.log("[TokenUniverse] DexScreener: direct");
    } catch (e) {
      console.error("[TokenUniverse] DexScreener direct failed:", e);
      return { map: new Map(), icpPriceUsd: 0, status: "unavailable" };
    }
  }
  return parseDexScreenerRaw(raw);
}

async function fetchICPSwap(
  actor: backendInterface | null,
): Promise<{ map: Map<string, TokenMeta>; status: "ok" | "unavailable" }> {
  let raw: string | null = null;
  if (actor) {
    try {
      const result = await actor.fetchICPSwapTokens();
      if (result && result !== "{}" && result !== "[]" && result.length > 2) {
        raw = result;
        console.log("[TokenUniverse] ICPSwap: proxy");
      }
    } catch (e) {
      console.warn("[TokenUniverse] ICPSwap proxy failed:", e);
    }
  }
  if (!raw) {
    try {
      const res = await fetch("https://api.icpswap.com/v3/token/list", {
        signal: AbortSignal.timeout(8000),
      });
      raw = await res.text();
      console.log("[TokenUniverse] ICPSwap: direct");
    } catch (e) {
      console.warn("[TokenUniverse] ICPSwap direct failed:", e);
      return { map: new Map(), status: "unavailable" };
    }
  }
  return parseICPSwapRaw(raw);
}

async function fetchKongSwap(
  actor: backendInterface | null,
): Promise<{ map: Map<string, TokenMeta>; status: "ok" | "unavailable" }> {
  let raw: string | null = null;
  if (actor) {
    try {
      const result = await actor.fetchKongSwapTokens();
      if (result && result !== "{}" && result !== "[]" && result.length > 2) {
        raw = result;
        console.log("[TokenUniverse] KongSwap: proxy");
      }
    } catch (e) {
      console.warn("[TokenUniverse] KongSwap proxy failed:", e);
    }
  }
  if (!raw) {
    try {
      const res = await fetch("https://api.kongswap.io/api/tokens", {
        signal: AbortSignal.timeout(8000),
      });
      raw = await res.text();
      console.log("[TokenUniverse] KongSwap: direct");
    } catch (e) {
      console.warn("[TokenUniverse] KongSwap direct failed:", e);
      return { map: new Map(), status: "unavailable" };
    }
  }
  return parseKongSwapRaw(raw);
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function buildTokenUniverse(
  actor: backendInterface | null,
): Promise<TokenUniverse> {
  const now = Date.now();

  // Fast path: try getting all 3 caches in a single canister call
  // Avoids 3 separate HTTP outcalls when caches are warm
  let cachedDex: string | null = null;
  let cachedIcpSwap: string | null = null;
  let cachedKongSwap: string | null = null;

  if (actor) {
    try {
      const caches = await actor.getTokenUniverseCaches();
      if (caches.dexScreener && caches.dexScreener.length > 2) {
        cachedDex = caches.dexScreener;
        console.log(
          "[TokenUniverse] Fast path: DexScreener from backend cache",
        );
      }
      if (caches.icpSwap && caches.icpSwap.length > 2) {
        cachedIcpSwap = caches.icpSwap;
        console.log("[TokenUniverse] Fast path: ICPSwap from backend cache");
      }
      if (caches.kongSwap && caches.kongSwap.length > 2) {
        cachedKongSwap = caches.kongSwap;
        console.log("[TokenUniverse] Fast path: KongSwap from backend cache");
      }
    } catch (e) {
      console.warn(
        "[TokenUniverse] Backend cache unavailable, falling back:",
        e,
      );
    }
  }

  // For any missing caches, fall back to individual fetch (proxy then direct)
  const [dexResult, icpswapResult, kongswapResult] = await Promise.all([
    cachedDex
      ? Promise.resolve(parseDexScreenerRaw(cachedDex))
      : fetchDexScreener(actor),
    cachedIcpSwap
      ? Promise.resolve(parseICPSwapRaw(cachedIcpSwap))
      : fetchICPSwap(actor),
    cachedKongSwap
      ? Promise.resolve(parseKongSwapRaw(cachedKongSwap))
      : fetchKongSwap(actor),
  ]);

  const { map: dexMap, icpPriceUsd, status: dexscreenerStatus } = dexResult;
  const { map: icpswapMap, status: icpswapStatus } = icpswapResult;
  const { map: kongswapMap, status: kongswapStatus } = kongswapResult;

  const allAddresses = new Set<string>([
    ...dexMap.keys(),
    ...icpswapMap.keys(),
    ...kongswapMap.keys(),
  ]);

  const tokens: UnifiedToken[] = [];

  for (const addr of allAddresses) {
    const dex = dexMap.get(addr);
    const icpswap = icpswapMap.get(addr);
    const kong = kongswapMap.get(addr);

    const base = dex ?? icpswap ?? kong;
    if (!base) continue;

    const actualDecimals = icpswap?.decimals ?? kong?.decimals ?? 8;

    tokens.push({
      address: addr,
      symbol: base.symbol,
      name: base.name,
      decimals: actualDecimals,
      priceUsd: dex?.priceUsd ?? null,
      priceNative: dex?.priceNative ?? null,
      liquidityUsd: dex?.liquidityUsd ?? null,
      volume24h: dex?.volume24h ?? null,
      priceChange24h: dex?.priceChange24h ?? null,
      icpswapAvailable: !!icpswap,
      kongswapAvailable: !!kong,
      dexIds: dex ? [dex.dexId] : [],
      lastUpdated: now,
    });
  }

  tokens.sort((a, b) => {
    if (a.liquidityUsd === null && b.liquidityUsd === null) return 0;
    if (a.liquidityUsd === null) return 1;
    if (b.liquidityUsd === null) return -1;
    return b.liquidityUsd - a.liquidityUsd;
  });

  return {
    tokens,
    icpPriceUsd,
    fetchedAt: now,
    icpswapStatus,
    kongswapStatus,
    dexscreenerStatus,
  };
}
