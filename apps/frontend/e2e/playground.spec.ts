import { expect, test } from '@playwright/test';

import { mockBackend, mockChatCompletionStream, setActiveKey } from './fixtures.js';

test.describe('Playground page', () => {
  test('happy path — send a prompt and watch tokens stream in', async ({ page }) => {
    await setActiveKey(page, 'sk-DEMO');
    await mockBackend(page, { keys: [] });
    await mockChatCompletionStream(page, ['hello ', 'world']);

    await page.goto('/playground');

    await expect(page.getByRole('heading', { name: /^Playground$/i })).toBeVisible();

    // Empty state cleared because we have an active key.
    await expect(page.getByText(/No active API key/i)).toBeHidden();

    // Prompt textarea + Send button.
    const promptArea = page.getByPlaceholder(/Ask the model/i);
    const sendBtn = page.getByRole('button', { name: /^Send$/i });
    await expect(sendBtn).toBeDisabled();

    await promptArea.fill('say hi');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Response region accumulates the streamed text.
    const region = page.getByTestId('playground-response');
    await expect(region).toContainText('hello world', { timeout: 5_000 });

    // Stream finished — Send is re-enabled.
    await expect(sendBtn).toBeEnabled();
    await expect(page.getByText(/2 chunks received/i)).toBeVisible();
  });
});
