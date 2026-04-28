// Spec generator for the HyperDB awareness demo.
//
// HyperDB 6.x is a schema-first document database: every runtime call goes
// through a `definition` object that the builder generates from a
// Hyperschema. This script does that one-time codegen step. The output
// (`./spec/hyperschema/`, `./spec/hyperdb/`) is committed to the repo so
// `node run.mjs` works on a fresh checkout without having to re-run this
// script.
//
// Re-run this script when changing the kv schema:
//   node apps/backend/scripts/hyperdb-demo/build-spec.cjs

const path = require('node:path');
const Hyperschema = require('hyperschema');
const HyperDB = require('hyperdb/builder');

const SCHEMA_DIR = path.join(__dirname, 'spec', 'hyperschema');
const DB_DIR = path.join(__dirname, 'spec', 'hyperdb');

// 1. Hyperschema: defines the wire format of the documents we store.
const schema = Hyperschema.from(SCHEMA_DIR);
const cosmic = schema.namespace('cosmic');

cosmic.register({
  name: 'kv',
  compact: true,
  fields: [
    { name: 'key', type: 'string', required: true },
    { name: 'value', type: 'string', required: true },
  ],
});

Hyperschema.toDisk(schema);

// 2. HyperDB collections: the runtime API on top of the schema.
const db = HyperDB.from(SCHEMA_DIR, DB_DIR);
const cosmicDb = db.namespace('cosmic');

cosmicDb.collections.register({
  name: 'kv',
  schema: '@cosmic/kv',
  key: ['key'],
});

HyperDB.toDisk(db, undefined, { esm: true });

console.log('hyperdb spec generated under', DB_DIR);
