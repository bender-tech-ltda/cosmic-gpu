import { expect, test } from '@playwright/test';

import { mockBackend } from './fixtures.js';

test.describe('API keys page', () => {
  test('happy path — empty → create → plaintext banner → list populated', async ({ page }) => {
    await mockBackend(page, { keys: [] });

    await page.goto('/keys');

    // Empty state.
    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();
    await expect(page.getByText('No API keys yet')).toBeVisible();

    // Create form is the only thing the user can interact with.
    const nameInput = page.getByPlaceholder(/cli-laptop/i);
    const createBtn = page.getByRole('button', { name: /^Create key$/i });
    await expect(createBtn).toBeDisabled();

    await nameInput.fill('demo-key');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // One-time plaintext banner.
    const plaintextBox = page.getByTestId('created-key-plaintext');
    await expect(plaintextBox).toBeVisible();
    await expect(plaintextBox).toContainText(/^sk-/);

    // The new row appears in the list (and the empty state disappears).
    await expect(page.getByText('No API keys yet')).toBeHidden();
    const list = page.getByTestId('keys-list');
    await expect(list).toBeVisible();
    await expect(list.getByText('demo-key')).toBeVisible();

    // The active-key clear control surfaces (the create flow auto-selected it).
    await expect(page.getByRole('button', { name: /Clear active key/i })).toBeVisible();
  });
});
