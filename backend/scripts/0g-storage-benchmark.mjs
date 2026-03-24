import 'dotenv/config';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Indexer } from '@0gfoundation/0g-ts-sdk';

const rootHash = process.argv[2] || process.env.ZERO_G_BENCH_ROOT_HASH;
if (!rootHash) {
  console.error('Usage: npm run 0g:storage:benchmark -- <rootHash> [outputDir]');
  console.error('Or set ZERO_G_BENCH_ROOT_HASH in your environment.');
  process.exit(1);
}

const indexerUrl = process.env.ZERO_G_STORAGE_INDEXER_URL || 'https://indexer-storage.0g.ai';
const proof = process.env.ZERO_G_BENCH_PROOF === 'true';
const targetMbps = Number.parseInt(process.env.ZERO_G_STORAGE_TARGET_MBPS || '200', 10);
const outputDir = process.argv[3] || path.join(tmpdir(), 'coal-0g-benchmark');
const outputPath = path.join(outputDir, `${rootHash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}.bin`);

await mkdir(outputDir, { recursive: true });

const indexer = new Indexer(indexerUrl);
const startedAt = performance.now();
const err = await indexer.download(rootHash, outputPath, proof);
if (err) {
  throw err;
}

const fileStats = await stat(outputPath);
const durationMs = Math.max(performance.now() - startedAt, 1);
const throughputMbps = Number((((fileStats.size / 1_000_000) / durationMs) * 1000).toFixed(2));

console.log(
  JSON.stringify(
    {
      rootHash,
      indexerUrl,
      outputPath,
      proofVerified: proof,
      byteSize: fileStats.size,
      durationMs: Number(durationMs.toFixed(2)),
      throughputMbps,
      targetMbps,
      hitTarget: throughputMbps >= targetMbps,
      notes: [
        'Use larger files when benchmarking; tiny payloads under-report real throughput.',
        'Write to local SSD or NVMe to avoid disk bottlenecks.',
        'Repeat the test after the first run to compare cold versus warm performance.',
        'Disable proof only when measuring transport speed; enable proof for integrity-sensitive reads.',
      ],
    },
    null,
    2,
  ),
);

if (process.env.ZERO_G_BENCH_CLEANUP === 'true') {
  await rm(outputPath, { force: true });
}
