import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Lee el `config.json` completo; sin archivo o con JSON roto vale un objeto vacío. */
export async function readConfigFile(file: string): Promise<Record<string, unknown>> {
  try {
    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Guarda el `config.json` de forma atómica y con modo 0600. */
export async function writeConfigFile(file: string, content: Record<string, unknown>): Promise<void> {
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(tmp, JSON.stringify(content, null, 2), { encoding: 'utf8', mode: 0o600 });
  try {
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}
