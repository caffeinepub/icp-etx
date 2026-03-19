# ICP ETX

## Current State
Version 20 with real on-chain swaps, cost basis, PnL, Dashboard line chart, SwapHistory, BasketDetail drift bars all live. Wallet.tsx is a minimal table with a "New Swap" button and token universe debug card. Backend has no `syncBalances` or `withdraw` method. `qrcode.react` is not installed.

## Requested Changes (Diff)

### Add
- Backend: `ICRC1Ledger` actor type with `icrc1_balance_of` and `icrc1_transfer`
- Backend: `ICRC1TransferArgs` and `ICRC1TransferError` types
- Backend: `syncBalances()` — queries real on-chain balances for all held tokens and updates internal holdings
- Backend: `withdraw(tokenCanisterId, amount, destination)` — performs real `icrc1_transfer` from the canister to the destination (defaults to ownerPrincipal)
- Backend: `getCanisterId()` — returns the canister's own Principal (used as deposit address on frontend)
- Frontend: `qrcode.react` npm dependency
- Frontend: `useSyncBalances()`, `useWithdraw()`, `useCanisterId()` hooks in useQueries.ts
- Frontend: Full tabbed Wallet.tsx (Overview, Deposit, Withdraw, Activity tabs)

### Modify
- Wallet.tsx: Full rewrite with hero card, per-token holdings grid, and 4 tabs
- package.json: Add `qrcode.react`
- useQueries.ts: Add 3 new hooks

### Remove
- Wallet.tsx: Minimal table and debug card replaced by full wallet UI

## Implementation Plan
1. Add ICRC1 actor interface types to main.mo (after existing ICRC2Ledger type)
2. Add `syncBalances()`, `withdraw()`, `getCanisterId()` methods to main.mo
3. Add `qrcode.react` to package.json
4. Add `useSyncBalances`, `useWithdraw`, `useCanisterId` hooks to useQueries.ts
5. Rewrite Wallet.tsx with Overview/Deposit/Withdraw/Activity tabs, hero card, per-token grid, QR code, floating swap button
