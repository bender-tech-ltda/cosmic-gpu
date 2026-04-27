// Aggregates all package-level Vitest configs so `pnpm test` runs every suite.
// See https://vitest.dev/guide/workspace
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['packages/*', 'apps/*']);
