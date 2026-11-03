import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PREFERENCES, mergePreferences, PreferenceChangesSchema, type Preferences } from '@chartsia/core/model';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DiagramLock } from './persistence/diagram-lock.js';

const LOCK_KEY = 'preferences';

/** Lee el `config.json` completo; sin archivo o con JSON roto vale un objeto vacío. */
async function readConfigFile(file: string): Promise<Record<string, unknown>> {
  try {
    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Preferencias de diagrama guardadas en `config.json`, bajo la clave `diagrams`. */
@Injectable()
export class PreferencesService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly lock: DiagramLock,
  ) {}

  /** Preferencias completas; lo que falte o no sea válido en el archivo vale lo de siempre. */
  async get(): Promise<Preferences> {
    const stored = PreferenceChangesSchema.safeParse((await readConfigFile(this.config.configFile)).diagrams ?? {});
    return stored.success ? mergePreferences(DEFAULT_PREFERENCES, stored.data) : DEFAULT_PREFERENCES;
  }

  /** Aplica cambios parciales, los guarda sin tocar el resto del archivo y devuelve las preferencias completas. */
  update(changes: unknown): Promise<Preferences> {
    return this.lock.run(LOCK_KEY, async () => {
      const parsed = PreferenceChangesSchema.safeParse(changes ?? {});
      if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
      const preferences = mergePreferences(await this.get(), parsed.data);
      const file = this.config.configFile;
      const content = { ...(await readConfigFile(file)), diagrams: preferences };
      const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
      await mkdir(dirname(file), { recursive: true });
      await writeFile(tmp, JSON.stringify(content, null, 2), { encoding: 'utf8', mode: 0o600 });
      try {
        await rename(tmp, file);
      } catch (error) {
        await rm(tmp, { force: true });
        throw error;
      }
      return preferences;
    });
  }
}
