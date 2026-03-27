import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Indexer } from '@0gfoundation/0g-ts-sdk';

const INDEXER_URL = 'https://indexer-storage-turbo.0g.ai';

let cachedIndexer: Indexer | null = null;
function getIndexer() {
  if (!cachedIndexer) cachedIndexer = new Indexer(INDEXER_URL);
  return cachedIndexer;
}

export async function downloadFromZeroG(rootHash: string): Promise<{
  rootHash: string;
  data: unknown;
  byteSize: number;
  durationMs: number;
  throughputMbps: number;
  isEncrypted: boolean;
  schema: string | null;
}> {
  const indexer = getIndexer();
  const outPath = path.join(tmpdir(), `coal-agent-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  try {
    const start = Date.now();
    const err = await indexer.download(rootHash, outPath, false);
    if (err) throw err;

    const raw = await readFile(outPath, 'utf8');
    const durationMs = Date.now() - start;
    const byteSize = Buffer.byteLength(raw, 'utf8');

    const data = JSON.parse(raw);
    const isEncrypted = Boolean(data.algorithm === 'aes-256-gcm' && data.ciphertext);
    const schema = data.version || null;

    return {
      rootHash,
      data,
      byteSize,
      durationMs,
      throughputMbps: byteSize > 0 && durationMs > 0
        ? Number(((byteSize * 8) / (durationMs / 1000) / 1_000_000).toFixed(2))
        : 0,
      isEncrypted,
      schema,
    };
  } finally {
    await rm(outPath, { force: true }).catch(() => {});
  }
}
