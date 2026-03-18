export interface UnifiedToken {
  address: string; // canister ID, lowercase normalized
  symbol: string;
  name: string;
  decimals: number; // default 8 if unknown
  priceUsd: number | null;
  priceNative: number | null; // price in ICP
  liquidityUsd: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  icpswapAvailable: boolean;
  kongswapAvailable: boolean;
  dexIds: string[]; // which DEXes list this token
  lastUpdated: number; // unix timestamp ms
}

export interface TokenUniverse {
  tokens: UnifiedToken[];
  icpPriceUsd: number;
  fetchedAt: number;
  icpswapStatus: "ok" | "unavailable";
  kongswapStatus: "ok" | "unavailable";
  dexscreenerStatus: "ok" | "unavailable";
}
