import { describe, expect, it } from 'vitest';
import { HELLO } from './__hello.js';

describe('shared smoke', () => {
  it('exports HELLO', () => {
    expect(HELLO).toBe('cosmic');
  });
});
