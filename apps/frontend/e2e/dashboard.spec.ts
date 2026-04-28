import { expect, test } from '@playwright/test';

import { makeKey, mockBackend, setActiveKey } from './fixtures.js';

test.describe('Dashboard page', () => {
  test('happy path — healthy banner + stat cards + usage table', async ({ page }) => {
    await setActiveKey(page, 'sk-DEMO');
    await mockBackend(page, {
      keys: [makeKey({ id: 'ak_demo', name: 'demo-key' })],
    });

    await page.goto('/dashboard');

    // Health banner.
    await expect(page.getByText(/Healthy/i)).toBeVisible();
    await expect(page.getByText(/3 peers connected/i)).toBeVisible();

    // Stat cards driven by /metrics.
    await expect(page.getByText(/Workers connected/i)).toBeVisible();
    await expect(page.getByText(/Latency p95/i)).toBeVisible();
    await expect(page.getByText('240 ms')).toBeVisible();
    await expect(page.getByText(/Rate-limit rejections/i)).toBeVisible();

    // Per-key usage table appears once /v1/usage/me resolves.
    await expect(page.getByText(/Your usage/i)).toBeVisible();
    await expect(page.getByText(/Requests \(this key\)/i)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Window' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '3' }).first()).toBeVisible();
  });
});
