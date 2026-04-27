import { describe, expect, it, vi } from 'vitest';

import { AUDIT_EVENT, logEvent, type AuditLogger } from './audit.js';

function fakeLogger(): { log: AuditLogger; info: ReturnType<typeof vi.fn> } {
  const info = vi.fn();
  return { log: { info } as unknown as AuditLogger, info };
}

describe('logEvent', () => {
  it('emits a single info line with the event name as both field and msg', () => {
    const { log, info } = fakeLogger();
    logEvent(log, AUDIT_EVENT.apiKeyCreated, { apiKeyId: 'ak_1', prefix: 'sk-AbCd' });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      { event: AUDIT_EVENT.apiKeyCreated, apiKeyId: 'ak_1', prefix: 'sk-AbCd' },
      AUDIT_EVENT.apiKeyCreated,
    );
  });

  it('works with no extra fields', () => {
    const { log, info } = fakeLogger();
    logEvent(log, AUDIT_EVENT.apiKeyRevoked);

    expect(info).toHaveBeenCalledWith(
      { event: AUDIT_EVENT.apiKeyRevoked },
      AUDIT_EVENT.apiKeyRevoked,
    );
  });
});
