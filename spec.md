# ICP ETX

## Current State
Backend has fetchDexScreenerPairs/fetchICPSwapTokens/fetchKongSwapTokens as HTTP outcall proxy methods. Frontend has full buildTokenUniverse.ts, useTokenUniverse hook, TokenSelector.tsx, and all wiring — validated and building. Missing: backend-side caching (stable vars for raw JSON), getTokenUniverseCaches() query method, updateTokenUniverse() method, and frontend using the cache as primary path.

## Requested Changes (Diff)

### Add
- stable var dexScreenerCache: Text, icpSwapCache: Text, kongSwapCache: Text, tokenCacheUpdatedAt: Int in main.mo
- updateTokenUniverse() shared method: calls all 3 HTTP outcalls sequentially, stores results in stable caches
- getTokenUniverseCaches() query method: returns cached raw JSON for all 3 sources + updatedAt timestamp
- backend.d.ts: getTokenUniverseCaches() return type
- buildTokenUniverse.ts: try getTokenUniverseCaches() first (single canister call) before falling back to 3 individual calls

### Modify
- fetchDexScreenerPairs/fetchICPSwapTokens/fetchKongSwapTokens: also update their respective stable cache on success
- useTokenUniverse hook: call updateTokenUniverse() on mount to trigger first cache fill; the React Query 60s refetchInterval serves as the timer

### Remove
- Nothing

## Implementation Plan
1. Add 4 stable vars to main.mo after decimalsRegistry block
2. Update each fetch method to store result in its cache
3. Add updateTokenUniverse() and getTokenUniverseCaches() methods in HTTP Outcalls section
4. Update backend.d.ts with new method signature
5. Update buildTokenUniverse.ts to call getTokenUniverseCaches() as primary path
6. Update useTokenUniverse hook to call updateTokenUniverse() on mount
7. Validate
