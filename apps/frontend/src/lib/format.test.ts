import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatTime,
  truncate,
} from './format.js';

describe('formatInt', () => {
  it('formats finite numbers with thousand separators', () => {
    expect(formatInt(1234)).toBe('1,234');
    expect(formatInt(0)).toBe('0');
    expect(formatInt(1234567)).toBe('1,234,567');
  });

  it('returns em-dash for non-finite values', () => {
    expect(formatInt(Number.NaN)).toBe('—');
    expect(formatInt(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatLatencyMs', () => {
  it('uses ms below 1000', () => {
    expect(formatLatencyMs(0)).toBe('<1 ms');
    expect(formatLatencyMs(0.4)).toBe('<1 ms');
    expect(formatLatencyMs(7)).toBe('7 ms');
    expect(formatLatencyMs(999)).toBe('999 ms');
  });

  it('uses seconds at and above 1000', () => {
    expect(formatLatencyMs(1000)).toBe('1.00 s');
    expect(formatLatencyMs(1456)).toBe('1.46 s');
  });

  it('returns em-dash for invalid input', () => {
    expect(formatLatencyMs(-1)).toBe('—');
    expect(formatLatencyMs(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats a 0..1 ratio as a percentage', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.953, 1)).toBe('95.3%');
  });

  it('returns em-dash for non-finite', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatTime / formatDate', () => {
  it('returns the original string when ISO is invalid', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date');
    expect(formatDate('also-bad')).toBe('also-bad');
  });

  it('returns a non-empty formatted string for a real ISO', () => {
    const t = formatTime('2024-01-02T03:04:05.000Z');
    expect(t.length).toBeGreaterThan(0);
    const d = formatDate('2024-01-02T03:04:05.000Z');
    expect(d.length).toBeGreaterThan(0);
  });
});

describe('truncate', () => {
  it('returns the value unchanged when it fits', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('truncates with an ellipsis when it does not', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
});
