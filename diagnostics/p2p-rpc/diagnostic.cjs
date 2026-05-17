#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mode = process.argv[2];
const stateDir = process.env.P2P_DIAG_STATE_DIR || '/state';
const dhtReadyFile = path.join(stateDir, 'dht.ready');
const serverReadyFile = path.join(stateDir, 'server.ready');
const serverPublicKeyFile = path.join(stateDir, 'server-public-key.hex');

function requirePackage(name) {
  const roots = [
    process.env.P2P_DIAG_MODULE_ROOT,
    '/app/apps/backend',
    '/app/apps/worker',
    '/app',
    process.cwd(),
  ].filter(Boolean);

  for (const root of roots) {
    try {
      return require(path.join(root, 'node_modules', name));
    } catch {
      /* try the next known workspace location */
    }
  }

  return require(name);
}

const HyperDHT = requirePackage('hyperdht');
const HyperswarmRPC = requirePackage('@hyperswarm/rpc');

function log(event, fields = {}) {
  process.stdout.write(
    JSON.stringify({
      time: new Date().toISOString(),
      role: mode,
      event,
      ...fields,
    }) + '\n',
  );
}

function fail(event, err) {
  log(event, {
    error: err instanceof Error ? { message: err.message, stack: err.stack, code: err.code } : String(err),
  });
}

function parseBootstrap(value) {
  const trimmed = (value || '').trim();
  if (trimmed.length === 0) return undefined;

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portRaw] = entry.split(':');
      const port = Number.parseInt(portRaw || '', 10);
      if (!host || !Number.isFinite(port) || port <= 0) {
        throw new Error(`P2P_DIAG_BOOTSTRAP entry is not host:port — got "${entry}"`);
      }
      return { host, port };
    });
}

function ownHost() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  throw new Error('no non-loopback IPv4 interface available');
}

function deterministicKeyPair(label) {
  return HyperDHT.keyPair(crypto.createHash('sha256').update(label).digest());
}

function serialize(value) {
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
  }
  return value;
}

function ensureStateDir() {
  fs.mkdirSync(stateDir, { recursive: true });
}

function removeIfExists(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function waitForSignal(close) {
  let closing = false;
  await new Promise((resolve) => {
    const stop = (signal) => {
      if (closing) return;
      closing = true;
      log('shutdown.start', { signal });
      Promise.resolve()
        .then(close)
        .catch((err) => fail('shutdown.error', err))
        .finally(resolve);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForFile(filePath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`timed out waiting for ${filePath}`);
}

async function waitForDhtReady(dht, timeoutMs) {
  const ready = typeof dht.ready === 'function' ? dht.ready() : dht.fullyBootstrapped();
  await withTimeout(ready, timeoutMs, `DHT bootstrap timed out after ${timeoutMs}ms`);
}

async function runDht() {
  ensureStateDir();
  removeIfExists(dhtReadyFile);

  const port = Number.parseInt(process.env.P2P_DIAG_DHT_PORT || '49737', 10);
  const host = process.env.P2P_DIAG_DHT_HOST || ownHost();
  const node = HyperDHT.bootstrapper(port, host);

  node.on('error', (err) => fail('dht.error', err));
  await waitForDhtReady(node, Number.parseInt(process.env.P2P_DIAG_READY_TIMEOUT_MS || '15000', 10));

  const address = node.address();
  fs.writeFileSync(dhtReadyFile, JSON.stringify(serialize({ host, address }), null, 2));
  log('dht.ready', { host, address: serialize(address) });

  await waitForSignal(async () => {
    removeIfExists(dhtReadyFile);
    await node.destroy();
  });
}

function serverOptionsFromEnv() {
  const options = {};
  if (process.env.P2P_DIAG_HOLEPUNCH === 'false') options.holepunch = false;
  if (process.env.P2P_DIAG_SHARE_LOCAL_ADDRESS === 'false') options.shareLocalAddress = false;
  return options;
}

async function runServer() {
  ensureStateDir();
  removeIfExists(serverReadyFile);
  removeIfExists(serverPublicKeyFile);

  const bootstrap = parseBootstrap(process.env.P2P_DIAG_BOOTSTRAP || 'dht:49737');
  const keyPair = deterministicKeyPair(process.env.P2P_DIAG_SERVER_SEED_LABEL || 'cosmic-p2p-rpc-diagnostic-server-v1');
  const rpc = new HyperswarmRPC({ keyPair, ...(bootstrap !== undefined ? { bootstrap } : {}) });
  const serverOptions = serverOptionsFromEnv();
  const server = rpc.createServer(serverOptions);

  rpc.dht.on('error', (err) => fail('server.dht_error', err));
  server.on('connection', (connection) => {
    log('server.connection', {
      remotePublicKey: connection.stream && connection.stream.remotePublicKey
        ? connection.stream.remotePublicKey.toString('hex')
        : null,
    });
  });
  server.respond('echo', async (request) => {
    const payload = Buffer.isBuffer(request) ? request.toString('utf8') : String(request);
    log('server.request', { method: 'echo', payload });
    return Buffer.from(
      JSON.stringify({
        ok: true,
        received: payload,
        serverPublicKey: keyPair.publicKey.toString('hex'),
        at: new Date().toISOString(),
      }),
    );
  });

  await server.listen(keyPair);
  await waitForDhtReady(rpc.dht, Number.parseInt(process.env.P2P_DIAG_READY_TIMEOUT_MS || '15000', 10));

  const publicKeyHex = keyPair.publicKey.toString('hex');
  const details = {
    publicKey: publicKeyHex,
    bootstrap,
    serverOptions,
    serverAddress: serialize(server.address()),
    dhtAddress: serialize(rpc.dht.address && rpc.dht.address()),
    dhtLocalAddress: serialize(rpc.dht.localAddress && rpc.dht.localAddress()),
    dhtRemoteAddress: serialize(rpc.dht.remoteAddress && rpc.dht.remoteAddress()),
    dhtNodes: serialize(rpc.dht.toArray ? rpc.dht.toArray({ limit: 8 }) : []),
  };

  fs.writeFileSync(serverPublicKeyFile, publicKeyHex);
  fs.writeFileSync(serverReadyFile, JSON.stringify(details, null, 2));
  log('server.ready', details);

  await waitForSignal(async () => {
    removeIfExists(serverReadyFile);
    removeIfExists(serverPublicKeyFile);
    await server.close().catch(() => {});
    await rpc.destroy({ force: true });
  });
}

async function runClient() {
  ensureStateDir();

  const bootstrap = parseBootstrap(process.env.P2P_DIAG_BOOTSTRAP || 'dht:49737');
  const attempts = Number.parseInt(process.env.P2P_DIAG_ATTEMPTS || '3', 10);
  const timeoutMs = Number.parseInt(process.env.P2P_DIAG_REQUEST_TIMEOUT_MS || '20000', 10);
  const readyTimeoutMs = Number.parseInt(process.env.P2P_DIAG_READY_TIMEOUT_MS || '15000', 10);
  const serverPublicKeyHex = await waitForFile(serverPublicKeyFile, readyTimeoutMs);
  const serverPublicKey = Buffer.from(serverPublicKeyHex, 'hex');
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const keyPair = deterministicKeyPair(`cosmic-p2p-rpc-diagnostic-client-v1-${attempt}`);
    const rpc = new HyperswarmRPC({ keyPair, ...(bootstrap !== undefined ? { bootstrap } : {}) });
    rpc.dht.on('error', (err) => fail('client.dht_error', err));

    try {
      await waitForDhtReady(rpc.dht, readyTimeoutMs);
      log('client.dht_ready', {
        attempt,
        bootstrap,
        dhtAddress: serialize(rpc.dht.address && rpc.dht.address()),
        dhtLocalAddress: serialize(rpc.dht.localAddress && rpc.dht.localAddress()),
        dhtRemoteAddress: serialize(rpc.dht.remoteAddress && rpc.dht.remoteAddress()),
        dhtNodes: serialize(rpc.dht.toArray ? rpc.dht.toArray({ limit: 8 }) : []),
      });

      const startedAt = Date.now();
      const response = await withTimeout(
        rpc.request(serverPublicKey, 'echo', Buffer.from(`ping-${attempt}`)),
        timeoutMs,
        `RPC echo timed out after ${timeoutMs}ms`,
      );
      log('client.success', {
        attempt,
        latencyMs: Date.now() - startedAt,
        response: Buffer.isBuffer(response) ? response.toString('utf8') : String(response),
      });
      await rpc.destroy({ force: true });
      return;
    } catch (err) {
      lastError = err;
      fail('client.attempt_failed', err);
    } finally {
      await rpc.destroy({ force: true }).catch(() => {});
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  fail('client.failed', lastError || new Error('all attempts failed'));
  process.exitCode = 2;
}

async function main() {
  if (mode === 'dht') return runDht();
  if (mode === 'server') return runServer();
  if (mode === 'client') return runClient();
  throw new Error(`unknown diagnostic mode: ${mode || '<missing>'}`);
}

main().catch((err) => {
  fail('fatal', err);
  process.exit(1);
});
