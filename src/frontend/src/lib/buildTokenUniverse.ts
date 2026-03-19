/**
 * Token Universe Builder — v2 with hardcoded safety net
 *
 * Pipeline:
 * 1. Start with 5 hardcoded major tokens (always available, zero API dependency)
 * 2. Try getTokenUniverseCaches() from backend (raw JSON cache)
 * 3. Try direct browser fetch to KongSwap (enriches prices, no backend needed)
 * 4. Merge all sources, deduplicate by canisterId
 */

import type { TokenUniverse, UnifiedToken } from "../types/tokenUniverse";

// ─── Hardcoded Safety Net ─────────────────────────────────────────────────────
// These 5 tokens are ALWAYS present regardless of API status.
// Searching "ckbtc", "icp", "cketh" will ALWAYS find them.
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
    dexIds: ["kongswap", "icpswap"],
    lastUpdated: Date.now(),
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
    dexIds: ["kongswap", "icpswap"],
    lastUpdated: Date.now(),
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
    dexIds: ["kongswap", "icpswap"],
    lastUpdated: Date.now(),
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
    dexIds: ["kongswap", "icpswap"],
    lastUpdated: Date.now(),
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
    dexIds: ["kongswap"],
    lastUpdated: Date.now(),
  },
];

// ─── KongSwap Parser ──────────────────────────────────────────────────────────
function parseKongSwapRaw(raw: string): Map<string, Partial<UnifiedToken>> {
  const map = new Map<string, Partial<UnifiedToken>>();
  if (!raw || raw.length < 3) return map;
  try {
    const parsed = JSON.parse(raw);
    let items: unknown[] = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (Array.isArray(parsed?.tokens)) {
      items = parsed.tokens;
    } else if (Array.isArray(parsed?.data)) {
      items = parsed.data;
    } else if (typeof parsed === "object" && parsed !== null) {
      items = Object.values(parsed);
    }

    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const t = item as Record<string, unknown>;
      const rawAddr: string =
        (t.canister_id as string) ||
        (t.address as string) ||
        (t.canisterId as string) ||
        "";
      if (!rawAddr) continue;
      const addr = rawAddr.trim().toLowerCase();
      map.set(addr, {
        address: addr,
        symbol:
          (t.symbol as string) || (t.ticker as string) || addr.slice(0, 6),
        name: (t.name as string) || (t.symbol as string) || addr.slice(0, 8),
        decimals:
          typeof t.decimals === "number"
            ? (t.decimals as number)
            : Number.parseInt(String(t.decimals ?? "8"), 10) || 8,
        priceUsd:
          typeof t.price === "number"
            ? (t.price as number)
            : typeof t.price_usd === "number"
              ? (t.price_usd as number)
              : Number.parseFloat(String(t.price ?? t.price_usd ?? "0")) ||
                null,
        volume24h:
          typeof t.volume_24h === "number"
            ? (t.volume_24h as number)
            : Number.parseFloat(String(t.volume_24h ?? "0")) || null,
        kongswapAvailable: true,
        dexIds: ["kongswap"],
        lastUpdated: Date.now(),
      });
    }
  } catch (e) {
    console.warn("[TokenUniverse] KongSwap parse error:", e);
  }
  return map;
}

// ─── DexScreener Parser ───────────────────────────────────────────────────────
function parseDexScreenerRaw(raw: string): {
  map: Map<string, Partial<UnifiedToken>>;
  icpPriceUsd: number;
} {
  const map = new Map<string, Partial<UnifiedToken>>();
  let icpPriceUsd = 0;
  if (!raw || raw.length < 3) return { map, icpPriceUsd };
  try {
    const parsed = JSON.parse(raw);
    const pairs: unknown[] = Array.isArray(parsed?.pairs)
      ? parsed.pairs
      : Array.isArray(parsed)
        ? parsed
        : [];
    for (const p of pairs) {
      if (typeof p !== "object" || p === null) continue;
      const pair = p as Record<string, unknown>;
      const bt = pair.baseToken as Record<string, unknown> | undefined;
      if (!bt) continue;
      const baseAddr = ((bt.address as string) || "").trim().toLowerCase();
      if (!baseAddr) continue;
      const priceUsd = Number.parseFloat(String(pair.priceUsd ?? "0")) || null;
      const liq = (pair.liquidity as Record<string, unknown> | undefined)?.usd;
      const liquidityUsd =
        typeof liq === "number"
          ? liq
          : Number.parseFloat(String(liq ?? "0")) || null;
      const vol = (pair.volume as Record<string, unknown> | undefined)?.h24;
      const volume24h =
        typeof vol === "number"
          ? vol
          : Number.parseFloat(String(vol ?? "0")) || null;
      const change = (pair.priceChange as Record<string, unknown> | undefined)
        ?.h24;
      const priceChange24h =
        typeof change === "number"
          ? change
          : Number.parseFloat(String(change ?? "0")) || null;

      if (bt.symbol === "ICP" || baseAddr === "ryjl3-tyaaa-aaaaa-aaaba-cai") {
        if (priceUsd) icpPriceUsd = priceUsd;
      }

      const existing = map.get(baseAddr);
      map.set(baseAddr, {
        address: baseAddr,
        symbol: (bt.symbol as string) || baseAddr.slice(0, 6),
        name: (bt.name as string) || (bt.symbol as string) || "",
        decimals: 8,
        priceUsd: priceUsd ?? existing?.priceUsd ?? null,
        liquidityUsd: liquidityUsd ?? existing?.liquidityUsd ?? null,
        volume24h: volume24h ?? existing?.volume24h ?? null,
        priceChange24h: priceChange24h ?? existing?.priceChange24h ?? null,
        dexIds: [...new Set([...(existing?.dexIds ?? []), "dexscreener"])],
        lastUpdated: Date.now(),
      });
    }
  } catch (e) {
    console.warn("[TokenUniverse] DexScreener parse error:", e);
  }
  return { map, icpPriceUsd };
}

// ─── Direct KongSwap Browser Fetch ───────────────────────────────────────────
async function fetchKongSwapDirect(): Promise<
  Map<string, Partial<UnifiedToken>>
> {
  try {
    const res = await fetch("https://api.kongswap.io/api/tokens", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Map();
    const text = await res.text();
    return parseKongSwapRaw(text);
  } catch (e) {
    console.warn("[TokenUniverse] Direct KongSwap fetch failed:", e);
    return new Map();
  }
}

// ─── Backend Cache Fetch ──────────────────────────────────────────────────────
async function fetchFromBackendCaches(actor: unknown): Promise<{
  kongMap: Map<string, Partial<UnifiedToken>>;
  dexMap: Map<string, Partial<UnifiedToken>>;
  icpPriceUsd: number;
}> {
  try {
    if (!actor) throw new Error("No actor");
    const a = actor as {
      getTokenUniverseCaches: () => Promise<{
        dexScreener: string;
        icpSwap: string;
        kongSwap: string;
        updatedAt: bigint;
      }>;
    };
    const caches = await a.getTokenUniverseCaches();
    const kongMap = parseKongSwapRaw(caches.kongSwap || "");
    const { map: dexMap, icpPriceUsd } = parseDexScreenerRaw(
      caches.dexScreener || "",
    );
    return { kongMap, dexMap, icpPriceUsd };
  } catch (e) {
    console.warn("[TokenUniverse] Backend cache fetch failed:", e);
    return { kongMap: new Map(), dexMap: new Map(), icpPriceUsd: 0 };
  }
}

// ─── Merge Helper ─────────────────────────────────────────────────────────────
function mergeInto(
  base: Map<string, UnifiedToken>,
  source: Map<string, Partial<UnifiedToken>>,
) {
  for (const [addr, data] of source) {
    const existing = base.get(addr);
    if (existing) {
      if (data.priceUsd != null) existing.priceUsd = data.priceUsd;
      if (data.liquidityUsd != null) existing.liquidityUsd = data.liquidityUsd;
      if (data.volume24h != null) existing.volume24h = data.volume24h;
      if (data.priceChange24h != null)
        existing.priceChange24h = data.priceChange24h;
      if (data.kongswapAvailable) existing.kongswapAvailable = true;
      if (data.icpswapAvailable) existing.icpswapAvailable = true;
      if (data.dexIds) {
        existing.dexIds = [...new Set([...existing.dexIds, ...data.dexIds])];
      }
      existing.lastUpdated = Date.now();
    } else {
      base.set(addr, {
        address: addr,
        symbol: data.symbol || addr.slice(0, 6),
        name: data.name || data.symbol || addr.slice(0, 8),
        decimals: data.decimals ?? 8,
        priceUsd: data.priceUsd ?? null,
        priceNative: data.priceNative ?? null,
        liquidityUsd: data.liquidityUsd ?? null,
        volume24h: data.volume24h ?? null,
        priceChange24h: data.priceChange24h ?? null,
        icpswapAvailable: data.icpswapAvailable ?? false,
        kongswapAvailable: data.kongswapAvailable ?? false,
        dexIds: data.dexIds ?? [],
        lastUpdated: Date.now(),
      });
    }
  }
}

// ─── Main Builder ─────────────────────────────────────────────────────────────
export async function buildTokenUniverse(
  actor: unknown,
): Promise<TokenUniverse> {
  console.log("[TokenUniverse] Building...");

  // Step 1: Start with hardcoded tokens — always present
  const tokenMap = new Map<string, UnifiedToken>();
  for (const t of HARDCODED_TOKENS) {
    tokenMap.set(t.address, { ...t });
  }
  console.log(`[TokenUniverse] Hardcoded baseline: ${tokenMap.size} tokens`);

  // Step 2 & 3: Fetch from backend caches + direct KongSwap in parallel
  const [backendResult, kongDirectResult] = await Promise.allSettled([
    fetchFromBackendCaches(actor),
    fetchKongSwapDirect(),
  ]);

  let icpPriceUsd = 0;

  if (backendResult.status === "fulfilled") {
    mergeInto(tokenMap, backendResult.value.kongMap);
    mergeInto(tokenMap, backendResult.value.dexMap);
    if (backendResult.value.icpPriceUsd > 0) {
      icpPriceUsd = backendResult.value.icpPriceUsd;
    }
    console.log(
      `[TokenUniverse] After backend caches: ${tokenMap.size} tokens`,
    );
  }

  const kongDirectMap =
    kongDirectResult.status === "fulfilled"
      ? kongDirectResult.value
      : new Map();

  if (kongDirectMap.size > 0) {
    mergeInto(tokenMap, kongDirectMap);
    console.log(
      `[TokenUniverse] After direct KongSwap: ${tokenMap.size} tokens`,
    );
  }

  // Update ICP price on the ICP token
  if (icpPriceUsd > 0) {
    const icp = tokenMap.get("ryjl3-tyaaa-aaaaa-aaaba-cai");
    if (icp) icp.priceUsd = icpPriceUsd;
  }

  // Sort by volume desc, then alpha
  const tokens = Array.from(tokenMap.values()).sort((a, b) => {
    const va = a.volume24h ?? 0;
    const vb = b.volume24h ?? 0;
    if (vb !== va) return vb - va;
    return a.symbol.localeCompare(b.symbol);
  });

  console.log(
    `[TokenUniverse] Final: ${tokens.length} tokens, ICP=$${icpPriceUsd}`,
  );

  return {
    tokens,
    icpPriceUsd,
    fetchedAt: Date.now(),
    icpswapStatus: "ok",
    kongswapStatus: kongDirectMap.size > 0 ? "ok" : "unavailable",
    dexscreenerStatus:
      backendResult.status === "fulfilled" &&
      backendResult.value.dexMap.size > 0
        ? "ok"
        : "unavailable",
  };
}
