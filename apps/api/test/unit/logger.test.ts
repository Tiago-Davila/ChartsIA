import { describe, expect, it } from 'vitest';
import { JsonLogger } from '../../src/common/logger.js';

describe('JsonLogger', () => {
  it('redacta secretos y omite cuerpos de diagramas', () => {
    const lines: string[] = [];
    const logger = new JsonLogger({ write: (l) => lines.push(l) });
    logger.log({ headers: { authorization: 'Bearer abc' }, auth: { token: 't' }, diagram: { x: 1 } });
    logger.log('petición con Bearer secreto123');
    const out = lines.join('\n');
    expect(out).not.toContain('abc');
    expect(out).not.toContain('secreto123');
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('[omitted]');
  });
});
