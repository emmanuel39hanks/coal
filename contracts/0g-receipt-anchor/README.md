# Coal 0G Receipt Anchor

Minimal 0G Chain contract for anchoring Coal receipt, entitlement, and merchant-profile hashes without putting large payloads on-chain.

## What This Contract Does

- emits `ReceiptAnchored`
- emits `EntitlementAnchored`
- emits `ProfileAnchored`
- exposes the fixed 0G precompile addresses we care about right now:
  - `DASigners`: `0x0000000000000000000000000000000000001000`
  - `Wrapped0GBase`: `0x0000000000000000000000000000000000001002`

This keeps the on-chain layer small, verifiable, and easy to ship for the hackathon.

## Why This Shape

- Coal’s canonical payment settlement remains on Base.
- Large receipts and manifests live in 0G Storage.
- 0G Chain stores only compact hashes and event logs.
- The precompile addresses are surfaced now so future DA and wrapped-token flows have a stable home in the contract package.

## Deploy With Foundry

0G’s docs recommend Cancun EVM settings and the mainnet RPC at `https://evmrpc.0g.ai`.

```bash
cd contracts/0g-receipt-anchor
forge create \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $ZERO_G_CHAIN_PRIVATE_KEY \
  --evm-version cancun \
  src/CoalReceiptAnchor.sol:CoalReceiptAnchor
```

## Verify On ChainScan

```bash
forge verify-contract \
  --chain-id 16661 \
  --num-of-optimizations 200 \
  --compiler-version v0.8.19+commit.7dd6d404 \
  --verifier custom \
  --verifier-api-key PLACEHOLDER \
  --verifier-url https://chainscan.0g.ai/open/api \
  <DEPLOYED_CONTRACT_ADDRESS> \
  src/CoalReceiptAnchor.sol:CoalReceiptAnchor
```

After verification, the contract code should be viewable at:

`https://chainscan.0g.ai/address/<DEPLOYED_CONTRACT_ADDRESS>#code`
