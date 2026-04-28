import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AppShell from './AppShell.js';
import { setActiveApiKey } from '../lib/api-key-store.js';

function renderShell(): void {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<div data-testid="content">content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setActiveApiKey(null);
});

afterEach(() => {
  setActiveApiKey(null);
});

describe('<AppShell /> active-key pill', () => {
  it('is hidden when no active key is set', () => {
    renderShell();
    expect(screen.queryByTestId('active-key-pill')).not.toBeInTheDocument();
  });

  it('shows the truncated prefix when an active key is set', () => {
    setActiveApiKey('sk-AbCdEfGhIjKlMnOp');
    renderShell();
    const pill = screen.getByTestId('active-key-pill');
    expect(pill).toBeVisible();
    expect(pill).toHaveTextContent(/key:/i);
    // The truncate(value, 10) helper drops to 9 chars + ellipsis.
    expect(pill.textContent ?? '').toMatch(/sk-AbCdE…?/);
    // Click target navigates to /keys.
    expect(pill).toHaveAttribute('href', '/keys');
  });
});
