# ICP ETX

## Current State
Version 67 live. syncBalances queries ICP ledger with `subaccount = null` and uses `icpBalance.toText()` (method syntax) for log output.

## Requested Changes (Diff)

### Add
- `import Blob "mo:core/Blob"` at top of main.mo

### Modify
- `syncBalances`: change `subaccount = null` to explicit `?Blob.fromArray(Array.tabulate<Nat8>(32, func _ = 0))` (dedicatedSubaccount = 0)
- Log line: use `Float.toText(icpBalance)` instead of `icpBalance.toText()` (safer with mo:core)

### Remove
Nothing removed.

## Implementation Plan
1. Add Blob import
2. Replace null subaccount with explicit 32-zero-byte blob in syncBalances ledger query
3. Fix Float.toText calls in syncBalances log/return lines
