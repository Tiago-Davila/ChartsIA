import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

describe('contract: get_hub_config', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('es de solo lectura y devuelve la configuración que el hub usa ahora', async () => {
    const tool = (await h.client.listTools()).tools.find((t) => t.name === 'get_hub_config')!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const res = await h.call('get_hub_config', {});
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ dataDir: h.config.dataDir, maxElements: 500, network: false, restartRequired: false });
  });

  it('avisa de los cambios guardados que esperan un reinicio y nunca incluye el token', async () => {
    await writeFile(h.config.configFile, JSON.stringify({ hub: { network: true, token: 'secreto-que-no-debe-salir-por-mcp-123456', maxElements: 12 } }));
    const res = await h.call('get_hub_config', {});
    expect(res.structuredContent).toMatchObject({ network: false, restartRequired: true });
    expect(JSON.stringify(res)).not.toContain('secreto');
  });

  it('rechaza campos de más', async () => {
    expect(h.errorCodes(await h.call('get_hub_config', { token: 'x' }))).toEqual(['SCHEMA_VIOLATION']);
  });
});
