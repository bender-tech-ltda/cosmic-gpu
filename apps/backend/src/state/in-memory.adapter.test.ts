import { describe, expect, it } from 'vitest';

import { InMemoryKvStore } from './in-memory.adapter.js';

describe('InMemoryKvStore', () => {
  it('round-trips put / get', async () => {
    const kv = new InMemoryKvStore();
    await kv.ready();
    await kv.put('foo', { hello: 'world' });
    const value = await kv.get<{ hello: string }>('foo');
    expect(value).toEqual({ hello: 'world' });
  });

  it('returns null for missing keys', async () => {
    const kv = new InMemoryKvStore();
    expect(await kv.get('absent')).toBeNull();
  });

  it('removes keys on del', async () => {
    const kv = new InMemoryKvStore();
    await kv.put('foo', 1);
    await kv.del('foo');
    expect(await kv.get('foo')).toBeNull();
  });

  it('lists only entries matching the prefix in lexicographic order', async () => {
    const kv = new InMemoryKvStore();
    await kv.put('a/2', 'two');
    await kv.put('a/1', 'one');
    await kv.put('b/1', 'other');

    const entries: Array<{ key: string; value: unknown }> = [];
    for await (const entry of kv.list('a/')) {
      entries.push(entry);
    }
    expect(entries.map((e) => e.key)).toEqual(['a/1', 'a/2']);
    expect(entries.map((e) => e.value)).toEqual(['one', 'two']);
  });

  it('isolates returned values from internal storage (deep clone)', async () => {
    const kv = new InMemoryKvStore();
    const original = { nested: { value: 1 } };
    await kv.put('foo', original);

    const a = await kv.get<typeof original>('foo');
    expect(a).toEqual(original);

    // Mutate the returned object — internal storage must not change.
    if (a) a.nested.value = 99;
    const b = await kv.get<typeof original>('foo');
    expect(b?.nested.value).toBe(1);
  });
});
