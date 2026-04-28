// HyperDB awareness demo.
//
// The take-home brief explicitly names HyperDB. Our production state layer
// uses Hyperbee on Hypercore behind a `KvStore` interface (see
// `apps/backend/src/state/`); the rationale lives in
// `docs/architecture.md` §2.4 and §4. This script proves we can use the
// modern HyperDB (`hyperdb@6.x`) API end-to-end. It is intentionally
// **not** wired into the backend runtime — it is documentation in
// runnable form.
//
// What it does:
//   1. Opens a fresh Hypercore in a temp directory.
//   2. Wraps it in `HyperDB.bee(core, definition)` — the P2P-aware engine.
//   3. Inserts a few records into the `@cosmic/kv` collection.
//   4. Reads them back via `db.get(...)`.
//   5. Streams a range scan via `db.find(...)` (the HyperDB equivalent of
//      our `KvStore.list(prefix)`).
//   6. Deletes a record and re-reads to confirm.
//   7. Cleans up the temp directory.
//
// Run it with:
//   pnpm --filter @cosmic/backend demo:hyperdb

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import HyperDB from 'hyperdb';
import Hypercore from 'hypercore';

import definition from './spec/hyperdb/index.js';

const log = (...args) => {
  console.log(...args);
};

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'cosmic-hyperdb-demo-'));
  log('using temp dir', dir);

  const core = new Hypercore(dir);
  await core.ready();
  log('hypercore ready (key=' + core.key.toString('hex').slice(0, 8) + '…)');

  const db = HyperDB.bee(core, definition, { autoUpdate: true });
  await db.ready();
  log('hyperdb ready');

  // Insert a few rows. NOTE: HyperDB requires `db.flush()` to persist the
  // batch to the underlying Hyperbee — none of the API points are
  // auto-flushing.
  await db.insert('@cosmic/kv', { key: 'workers/wkr_a', value: '{"capacity":4}' });
  await db.insert('@cosmic/kv', { key: 'workers/wkr_b', value: '{"capacity":2}' });
  await db.insert('@cosmic/kv', { key: 'jobs/job_1', value: '{"status":"pending"}' });
  await db.flush();
  log('inserted 3 records + flushed');

  // Single-record lookup. Note the query shape: `key` is the field name,
  // not the literal string key. HyperDB encodes it via the index.
  const wkrA = await db.get('@cosmic/kv', { key: 'workers/wkr_a' });
  log('get workers/wkr_a:', wkrA);

  // Range scan — this is the HyperDB equivalent of our `KvStore.list(prefix)`.
  // We use the `gte` / `lt` query bounds with the key field shape.
  const stream = db.find('@cosmic/kv', {
    gte: { key: 'workers/' },
    lt: { key: 'workers/\uffff' },
  });
  const workers = await stream.toArray();
  log(
    'find workers/:',
    workers.map((row) => ({ key: row.key, value: row.value })),
  );

  // Delete + re-read to confirm.
  await db.delete('@cosmic/kv', { key: 'workers/wkr_a' });
  await db.flush();
  const wkrAAfter = await db.get('@cosmic/kv', { key: 'workers/wkr_a' });
  log('get workers/wkr_a after delete:', wkrAAfter);

  // Clean shutdown.
  await db.close();
  await core.close();
  await rm(dir, { recursive: true, force: true });
  log('cleanup complete');
}

main().catch((err) => {
  console.error('demo failed:', err);
  process.exit(1);
});
