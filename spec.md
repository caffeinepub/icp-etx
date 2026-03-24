# ICP ETX

## Current State
Version 67 live. `syncBalances()` exists and queries the ICP ledger, but state mutations and Debug.print happen inside the try/catch block — if `floatBalance.toText()` (instance method) causes any issue after the `await`, the holdings update gets rolled back within that continuation. User deposited 9.43 ICP to canister principal but it does not appear in Holdings.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- `syncBalances()` in main.mo: rewrite to move holdings mutation AFTER the try/catch (in an `if (icpSynced)` block), use `Float.toText(icpBalance)` static call, and store `rawBalance` outside the try block so it's safely accessible

### Remove
- Nothing

## Implementation Plan
1. Replace lines 1173–1241 in main.mo with a clean `syncBalances` that:
   - Queries ICP ledger inside try/catch (only the async call)
   - Sets `icpBalance` and `icpSynced` from the result
   - Updates/creates the ICP holding OUTSIDE the try/catch in an `if (icpSynced)` block
   - Logs `"Synced X.XXXX ICP from ledger – external deposit detected"` using `Float.toText()`
   - Returns status text
