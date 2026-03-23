# ICP ETX

## Current State
Version 46 with scalping toggle live. The `analyzeAndDecide` scalping branch logs a stub decision and returns early — no real swaps are executed. `_agentSwap` exists with 2% slippage hardcoded.

## Requested Changes (Diff)

### Add
- Real triangular arbitrage execution inside the scalping branch: resolves 3 token addresses from basket slots via pairTrades lookup, executes A→B, B→C, C→A using `_agentSwap` with 0.5% slippage, creates EXEC-XXXX receipts for each leg

### Modify
- `_agentSwap`: add `maxSlippage: Float` parameter; replace hardcoded `?2.0` with `?maxSlippage`
- Existing BUY/SELL call sites in `analyzeAndDecide`: pass `2.0` explicitly
- Scalping branch in `analyzeAndDecide`: replace stub early-return with real 3-leg swap execution

### Remove
- Stub log-only scalping branch

## Implementation Plan
1. Patch `_agentSwap` signature and internals (5 targeted edits to main.mo)
2. Update BUY/SELL call sites to pass slippage=2.0
3. Replace scalping stub with real triangular execution at 0.5% slippage
