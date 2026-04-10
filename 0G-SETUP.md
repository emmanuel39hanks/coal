# Coal — 0G Integration Setup Guide

This guide walks you through configuring all five 0G components used by Coal: **Storage**, **Chain**, **Compute**, **KV**, and **Data Availability (DA)**. You can integrate them incrementally — Coal works without 0G, and each component degrades gracefully if unavailable.

Every component is keyed off a single master flag: `ZERO_G_ENABLED=true`. Set that, then add the per-component configuration below.

---

## Prerequisites

Before you begin, you need:

1. **A wallet with 0G mainnet tokens** (for writing to Storage and Chain). You can get 0G from supported exchanges or bridges. A few 0G tokens is enough for thousands of transactions.
2. **A Base wallet with USDC and ETH** (for Coal's Base settlement layer). Separate from the 0G wallet.
3. **A PostgreSQL database** (Neon is what we use in production).
4. **An Alchemy API key** for Base mainnet.
5. **Privy application credentials** for merchant and agent authentication.

---

## 0G Storage (Log Layer)

**Purpose:** Publishes immutable JSON artifacts — receipt payloads, merchant profiles, paywall manifests, encrypted merchant memory. Every payment in Coal generates a Storage artifact with a content-addressed root hash.

### Environment variables

```bash
ZERO_G_ENABLED=true
ZERO_G_CHAIN_RPC_URL=https://evmrpc.0g.ai
ZERO_G_CHAIN_PRIVATE_KEY=0x<your_0g_wallet_private_key>
ZERO_G_STORAGE_INDEXER_URL=https://indexer-storage-turbo.0g.ai
ZERO_G_STORAGESCAN_URL=https://storagescan.0g.ai
ZERO_G_STORAGE_ENCRYPTION_KEY=<32-byte hex, no 0x prefix>
ZERO_G_STORAGE_TARGET_MBPS=200
```

The `ZERO_G_STORAGE_ENCRYPTION_KEY` is a 64-character hex string (32 bytes) used for AES-256-GCM encryption of merchant memory snapshots. Generate one with:

```bash
openssl rand -hex 32
```

Store it securely — if you lose it, you lose the ability to decrypt any previously published memory snapshots.

### How to verify it works

```bash
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -m json.tool
# Look for: checks.storage.ok == true, trustedNodeCount > 0, flowAddress populated
```

Then trigger a profile publish from the merchant console (`/console/0g` → "Publish to 0G") and check the Vercel logs for `Published immutable JSON artifact to 0G Storage log layer`.

### What gets published automatically

| Trigger | Artifact |
|---|---|
| Merchant edits products/paywalls | Merchant profile bundle |
| Merchant edits settings | Merchant memory snapshot (encrypted) |
| Agent pays via x402 | Receipt payload |
| Human pays via checkout | Receipt payload |

---

## 0G Chain (Receipt Anchor Contract)

**Purpose:** Anchors a SHA-256 hash of every receipt on-chain via the `CoalReceiptAnchor V2` smart contract. Produces a tamper-proof, independently verifiable proof that a specific payment happened at a specific time. V2 calls the DASigners precompile (`epochNumber()`) and stamps the current DA epoch into every anchor event.

### Environment variables

```bash
ZERO_G_CHAIN_RPC_URL=https://evmrpc.0g.ai
ZERO_G_CHAIN_ID=16661
ZERO_G_CHAIN_PRIVATE_KEY=0x<your_0g_wallet_private_key>
ZERO_G_RECEIPT_ANCHOR_ADDRESS=0x24a80A3Bb16d26D4063Ecd4B2fD64C6856E25E8b
ZERO_G_CHAINSCAN_URL=https://chainscan.0g.ai
```

### Deploying your own CoalReceiptAnchor contract

The production contract is already deployed at `0x24a80A3Bb16d26D4063Ecd4B2fD64C6856E25E8b`. If you want to deploy your own copy (e.g. for a different network or a forked version):

```bash
cd contracts/0g-receipt-anchor
forge build
forge create src/CoalReceiptAnchor.sol:CoalReceiptAnchor \
  --rpc-url https://evmrpc.0g.ai \
  --private-key 0x<your_private_key> \
  --broadcast
```

Copy the deployed address into `ZERO_G_RECEIPT_ANCHOR_ADDRESS`.

The contract source is at `contracts/0g-receipt-anchor/src/CoalReceiptAnchor.sol`. It exposes three functions: `anchorReceipt`, `anchorEntitlement`, and `anchorProfile`. Each takes three `bytes32` hashes (payload hash, artifact root hash, subject/merchant hash) and emits an indexed event that includes the current 0G DA epoch.

### How to verify it works

```bash
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d['checks']['chain']['details']
print('chainId:', c['chainId'])
print('latestBlock:', c['latestBlock'])
print('contract:', c['receiptAnchorAddress'])
print('deployed:', c['receiptAnchorDeployed'])
print('writer balance:', c['writerBalance0G'])
"
```

You should see `deployed: True` and a writer balance > 0.

### Async anchoring

Chain anchoring runs **async** (fire-and-forget) in `publishVerifiedReceiptProof()` to avoid blocking payment confirmation. If the anchor write fails, it gets retried by the `anchor-receipts` cron job:

```bash
# Manually trigger the retry cron
curl -sS -X POST https://api.usecoal.xyz/api/cron/anchor-receipts \
  -H "Authorization: Bearer $CRON_SECRET"
# Response: { "processed": N, "anchored": M }
```

---

## 0G Compute (AI Commerce Inference)

**Purpose:** Powers Coal's agent-facing commerce queries — merchant memory Q&A, commerce routing, policy evaluation, support answering. Runs on 0G's decentralized GPU inference network via an OpenAI-compatible API. Sealed Inference routes queries through Intel TDX + NVIDIA H100/H200 TEE enclaves for privacy.

### Environment variables

```bash
ZERO_G_COMPUTE_ENABLED=true
ZERO_G_COMPUTE_PROVIDER=<provider_address_from_0g_broker>
ZERO_G_COMPUTE_BASE_URL=<provider_base_url>
ZERO_G_COMPUTE_API_KEY=<your_compute_api_key>
ZERO_G_COMPUTE_MODEL=<model_name>
ZERO_G_SEALED_INFERENCE_ENABLED=true
```

### Discovering available services

Coal uses the `@0glabs/0g-serving-broker` SDK to list available inference services:

```bash
cd backend
npx tsx -e "
import { listComputeServices } from './lib/0g/compute';
listComputeServices(5).then(services => {
  for (const s of services) {
    console.log(s.providerAddress, '→', s.model, s.endpoint || '');
  }
});
"
```

Pick a provider address and model, then plug them into `ZERO_G_COMPUTE_PROVIDER` and `ZERO_G_COMPUTE_MODEL`.

### Sealed Inference (TEE attestation)

When `ZERO_G_SEALED_INFERENCE_ENABLED=true` and a query requests sealed execution, Coal calls `broker.inference.verifyService()` after each response to verify the provider's TEE signature. The response includes:

```json
{
  "output": { ... },
  "verificationStatus": "sealed_tee",
  "teeAttestation": {
    "verified": true,
    "provider": "0x...",
    "timestamp": "2026-04-10T15:00:00.000Z"
  }
}
```

If the attestation fails, the response is still returned but `teeAttestation.verified` is `false`. It is a best-effort signal, not a hard block.

### How to verify it works

```bash
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d['checks']['compute']['details']
print('enabled:', c['enabled'])
print('configured:', c['configured'])
print('services:', c['serviceCount'])
"
```

Expect `services: 3` or higher.

---

## 0G KV (Mutable Mirror Layer)

**Purpose:** Mutable key-value store built on top of 0G Storage's log layer. Coal uses it to keep merchant profiles and memory pointers always-current so agent discovery can return fresh data without walking the full log history.

### Environment variables

```bash
ZERO_G_STORAGE_STREAM_ID=0x<64-hex-chars>
ZERO_G_STORAGE_KV_RPC_URL=http://<kv-rpc-node>:5678
```

If you do not set `ZERO_G_STORAGE_KV_RPC_URL`, Coal will discover a KV-capable node from the indexer at startup and cache it.

### Generating a stream ID

A stream ID is a 32-byte identifier that namespaces your KV writes. Generate one once and reuse it across deployments:

```bash
openssl rand -hex 32 | awk '{print "0x" $0}'
```

Store it in `ZERO_G_STORAGE_STREAM_ID`.

### What gets mirrored

| Key pattern | Content |
|---|---|
| `merchant:profile:latest` | Merchant profile bundle (name, products, paywalls, endpoints) |
| `merchant:memory:latest` | Memory pointer: storage URI + root hash + published timestamp |
| `paywall:{id}:manifest:latest` | x402 paywall manifest for a specific paywall |

Writes happen automatically in `publishMerchantProfileBundle()` and `publishMerchantMemorySnapshot()` in `backend/lib/0g/merchant.ts`. The KV write is fire-and-forget — a failure does not block the log-layer publish.

### How to verify it works

```bash
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d['checks']['kv']['details']
print('enabled:', c['enabled'])
print('configured:', c['configured'])
print('streamId:', c['streamId'])
"
```

Expect `streamId` to be populated (truncated in the public health response). To confirm writes are landing, edit any product in the merchant console and grep Vercel logs for `Upserted mutable JSON artifact to 0G KV layer`.

---

## 0G Data Availability (DA)

**Purpose:** Real-time payment event streaming. Every confirmed payment, subscription renewal, or webhook delivery is posted as a DA blob to the 0G DA layer. External systems monitoring the DA stream can see payment events as they happen, not when they later query Storage.

DA uses a separate **gRPC sidecar** that you run yourself (not a public HTTP endpoint). The sidecar handles blob dispersal, erasure coding, and confirmation polling.

### Environment variables

```bash
ZERO_G_DA_ENABLED=true
ZERO_G_DA_GRPC_URL=<sidecar_host>:51001
ZERO_G_DA_GRPC_TLS=false
```

Set `ZERO_G_DA_GRPC_TLS=true` **only** if your sidecar is fronted by a reverse proxy with TLS termination (e.g. nginx with Let's Encrypt). The default 0G DA sidecar image serves plain gRPC, so `false` is the correct default.

### Running the DA sidecar

The sidecar is an instance of the official 0G DA client:
https://github.com/0gfoundation/0g-da-client

**Minimum recommended specs:** 2 vCPU, 2-4 GB RAM, 20 GB disk, stable network. A cloud VM under $20/month is sufficient.

Deployment steps (example on a fresh Ubuntu EC2 or Hetzner box):

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone the 0G DA client
git clone https://github.com/0gfoundation/0g-da-client.git
cd 0g-da-client

# 3. Configure — refer to the upstream repo for the exact config format
#    Key fields: signing key, 0G RPC URL, entrance contract address
cp config.example.yaml config.yaml
# ... edit config.yaml ...

# 4. Run the sidecar
docker compose up -d

# 5. Verify port 51001 is listening
ss -tlnp | grep 51001
```

### Firewall / security group

Open port `51001/tcp` inbound to your Coal backend's outbound IPs. If Coal runs on Vercel, its outbound IPs are not fixed — you may need to open `51001/tcp` to `0.0.0.0/0` and rely on the signing key as the only auth. Consider fronting the sidecar with a reverse proxy + TLS + IP allow list if you run it exposed.

### How to verify it works

```bash
# 1. Check Coal's health endpoint
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('DA:', json.dumps(d['checks']['da'], indent=2))
"
# Expect: connected: true
```

```bash
# 2. Check the in-memory event log (populates after payments)
curl -sS https://api.usecoal.xyz/api/0g/da-events | python3 -m json.tool
# Expect: daEnabled: true, events array grows as payments confirm
```

```bash
# 3. Direct sidecar ping (from any machine with network access)
nc -zv <sidecar_host> 51001
# Expect: Connection to <host> port 51001 succeeded!
```

### Common DA failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `connected: false` in health | Sidecar down or unreachable | Restart the sidecar container, check security group |
| `connected: true` but no events | No confirmed payments yet | Trigger a test payment + run `verify-payments` cron |
| gRPC handshake timeout | `ZERO_G_DA_GRPC_TLS=true` against an insecure sidecar | Set `ZERO_G_DA_GRPC_TLS=false` |
| Proto file not found on Vercel | `outputFileTracingIncludes` missing from next.config.ts | Already fixed — see `backend/next.config.ts` |
| `PROCESSING` status forever | Sidecar accepted blob but upstream DA network is slow | Normal during peak load, not a bug |

### The 6 DA event types

Coal posts these event kinds, defined in `backend/lib/0g/da.ts`:

```typescript
type DAEventKind =
  | 'payment_confirmed'       // after on-chain verification
  | 'subscription_renewed'    // after a successful billing cycle
  | 'subscription_created'    // first billing cycle
  | 'webhook_delivered'       // after a merchant webhook succeeds
  | 'paywall_access_granted'  // after x402 payment verification
  | 'receipt_anchored';       // after 0G Chain anchor confirms
```

Every event has the same envelope:

```typescript
{
  version: 'coal.da_event.v1',
  kind: DAEventKind,
  merchantId: string,
  timestamp: string,        // ISO 8601
  payload: { /* kind-specific */ },
  payloadHash: string       // sha256 of payload
}
```

---

## Verifying the full 5-component stack

Once all components are configured, the health endpoint should return `status: ok` with all five checks green:

```bash
curl -sS https://api.usecoal.xyz/api/0g/health | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('Overall:', d['status'])
for k in ['storage','chain','compute','kv','da']:
    print(f'  {k:8s}', 'OK' if d['checks'][k]['ok'] else 'FAIL')
"
```

Expected output:

```
Overall: ok
  storage  OK
  chain    OK
  compute  OK
  kv       OK
  da       OK
```

If any component is `FAIL`, check the Vercel backend logs for the specific error. Each 0G module logs structured errors via `zeroGLogger` with enough context to debug.

---

## End-to-end proof trail test

Once all five components are configured, test the full proof trail by making a real payment:

```bash
# 1. Create a checkout session via the API
curl -sS -X POST https://api.usecoal.xyz/api/pay/session \
  -H "x-api-key: $COAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount":"0.10","productId":"<your_product_id>"}'

# 2. Pay it from a wallet with USDC on Base (via the returned checkout URL)

# 3. Wait for the verify-payments cron (or trigger manually)
curl -sS -X POST https://api.usecoal.xyz/api/cron/verify-payments \
  -H "Authorization: Bearer $CRON_SECRET"

# 4. Trigger the anchor cron
curl -sS -X POST https://api.usecoal.xyz/api/cron/anchor-receipts \
  -H "Authorization: Bearer $CRON_SECRET"

# 5. Check the receipt
curl -sS https://api.usecoal.xyz/api/receipts/<session_id> | python3 -m json.tool
```

A fully-verified receipt returns:

```json
{
  "verified": true,
  "status": "confirmed",
  "proofTrail": {
    "storage": { "storageRoot": "0x...", "storageUri": "0g://log/0x...", "explorerUrl": "https://storagescan.0g.ai/tx/0x..." },
    "chain":   { "anchorTxHash": "0x...", "anchorContract": "0x24a80A3B...", "explorerUrl": "https://chainscan.0g.ai/tx/0x..." }
  }
}
```

If `proofTrail.storage` is `null` → 0G Storage config issue.
If `proofTrail.chain` is `null` → 0G Chain config issue or the async anchor cron has not run yet.

---

## Reference: files that implement each component

| Component | Implementation |
|---|---|
| Storage | `backend/lib/0g/storage.ts` |
| Chain | `backend/lib/0g/chain.ts` + `contracts/0g-receipt-anchor/src/CoalReceiptAnchor.sol` |
| Compute | `backend/lib/0g/compute.ts` |
| KV | `backend/lib/0g/storage.ts` (`upsertMutableJson`, `getMutableJson`) |
| DA | `backend/lib/0g/da.ts` + `backend/lib/0g/proto/disperser.proto` |
| Health | `backend/app/api/0g/health/route.ts` |
| Receipt pipeline | `backend/lib/receipts/proof.ts` |
| Merchant publishing | `backend/lib/0g/merchant.ts` |

---

## Support

- Coal backend logs: Vercel project `coal-backend`
- 0G official docs: https://docs.0g.ai
- 0G DA client repo: https://github.com/0gfoundation/0g-da-client
- 0G Serving Broker: https://github.com/0glabs/0g-serving-broker
- Contract on ChainScan: https://chainscan.0g.ai/address/0x24a80A3Bb16d26D4063Ecd4B2fD64C6856E25E8b

Open an issue on this repo if you hit a reproducible bug.
