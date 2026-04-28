import { expect, test } from '@playwright/test';

import { mockBackend } from './fixtures.js';

test.describe('API keys page', () => {
  test('happy path — empty → create → plaintext banner → list populated', async ({ page }) => {
    await mockBackend(page, { keys: [] });

    await page.goto('/keys');

    // Empty state.
    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();
    await expect(page.getByText('No API keys yet')).toBeVisible();

    // Active-key pill is hidden when no key is set.
    await expect(page.getByTestId('active-key-pill')).toBeHidden();

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

    // Active-key pill in the header now reflects the auto-selected key.
    const pill = page.getByTestId('active-key-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/key:\s+sk-/);

    // The active-key clear control surfaces.
    await expect(page.getByRole('button', { name: /Clear active key/i })).toBeVisible();
  });

  test('paste an existing key — sets active key + reflects in the header pill', async ({
    page,
  }) => {
    await mockBackend(page, { keys: [] });
    await page.goto('/keys');

    // Pill is initially hidden.
    await expect(page.getByTestId('active-key-pill')).toBeHidden();

    const input = page.getByTestId('existing-key-input');
    const useBtn = page.getByRole('button', { name: /Use this key/i });

    // Empty submission is rejected (button stays disabled).
    await expect(useBtn).toBeDisabled();
    await input.fill('sk-PASTED-FROM-CURL-1234');
    await expect(useBtn).toBeEnabled();
    await useBtn.click();

    // Pill appears in the header showing the prefix.
    const pill = page.getByTestId('active-key-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/key:\s+sk-PASTED/);

    // Field clears after submit.
    await expect(input).toHaveValue('');

    // Clearing the active key hides the pill again.
    await page.getByRole('button', { name: /Clear active key/i }).click();
    await expect(page.getByTestId('active-key-pill')).toBeHidden();
  });
});
