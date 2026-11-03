import { mkdir } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DomainValidationError, fromZodError, validationError } from '@chartsia/core/validation';
import { ACCESS_TOKEN, newToken } from '../auth/token.js';
import { type AccessToken } from '../auth/bearer.guard.js';
import { DiagramLock } from '../diagrams/persistence/diagram-lock.js';
import { readConfigFile, writeConfigFile } from './config-file.js';
import { APP_CONFIG, type AppConfig, DEFAULT_DATA_DIR, DEFAULT_MAX_ELEMENTS, type HubFile, isLoopback, readHubFile, type ValueSource } from './config.js';

// Misma clave que las preferencias: ambos servicios reescriben el mismo `config.json`.
const LOCK_KEY = 'preferences';

export const HubSettingsChangesSchema = z.strictObject({
  dataDir: z.string().min(1).max(1024).nullable().optional(),
  maxElements: z.number().int().min(1).max(100_000).nullable().optional(),
  network: z.boolean().optional(),
});
export type HubSettingsChanges = z.infer<typeof HubSettingsChangesSchema>;

export interface HubSettings {
  /** Carpeta de datos configurada; `running` es la que usa el hub ahora. */
  dataDir: { value: string; source: ValueSource; running: string };
  /** El límite de elementos se aplica al guardar. */
  maxElements: { value: number; source: ValueSource };
  /** `true` hace que el hub escuche fuera de loopback; `running` es lo que hace ahora. */
  network: { value: boolean; source: ValueSource; running: boolean };
  token: { value: string | null; source: ValueSource };
  /** Hay valores guardados que el hub en marcha todavía no usa. */
  restartRequired: boolean;
}

/** Configuración del hub guardada en `config.json`, bajo la clave `hub`, y qué parte ya está aplicada. */
@Injectable()
export class HubSettingsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ACCESS_TOKEN) private readonly runningToken: AccessToken,
    private readonly lock: DiagramLock,
  ) {}

  /** Valores configurados con su origen, comparados con lo que el hub usa ahora. */
  get(): HubSettings {
    const { sources } = this.config;
    const file = readHubFile(this.config.configFile);
    const runningNetwork = !isLoopback(this.config.host);
    const dataDir = sources.dataDir === 'env' ? this.config.dataDir : (file.dataDir ?? DEFAULT_DATA_DIR);
    const network = sources.network === 'env' ? runningNetwork : (file.network ?? false);
    const token = sources.token === 'env' ? (this.config.token ?? null) : (file.token ?? null);
    return {
      dataDir: { value: dataDir, source: sources.dataDir === 'env' ? 'env' : file.dataDir ? 'file' : 'default', running: this.config.dataDir },
      maxElements: {
        value: this.config.maxElements,
        source: sources.maxElements === 'env' ? 'env' : file.maxElements ? 'file' : 'default',
      },
      network: { value: network, source: sources.network === 'env' ? 'env' : file.network !== undefined ? 'file' : 'default', running: runningNetwork },
      token: { value: token, source: sources.token === 'env' ? 'env' : file.token ? 'file' : 'default' },
      restartRequired: dataDir !== this.config.dataDir || network !== runningNetwork || (token !== null && this.runningToken !== undefined && token !== this.runningToken),
    };
  }

  /** Guarda los cambios sin tocar el resto del archivo; el límite de elementos se aplica al instante. */
  update(changes: unknown): Promise<HubSettings> {
    return this.lock.run(LOCK_KEY, async () => {
      const parsed = HubSettingsChangesSchema.safeParse(changes ?? {});
      if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
      const next = await this.mergeFile(readHubFile(this.config.configFile), parsed.data);
      await this.save(next);
      if (this.config.sources.maxElements !== 'env') this.config.maxElements = next.maxElements ?? DEFAULT_MAX_ELEMENTS;
      return this.get();
    });
  }

  /** Crea un token nuevo; el hub en marcha sigue con el anterior hasta reiniciar. */
  regenerateToken(): Promise<HubSettings> {
    return this.lock.run(LOCK_KEY, async () => {
      await this.save({ ...readHubFile(this.config.configFile), token: newToken() });
      return this.get();
    });
  }

  private async mergeFile(file: HubFile, changes: HubSettingsChanges): Promise<HubFile> {
    const next: HubFile = { ...file };
    if (changes.maxElements === null) delete next.maxElements;
    else if (changes.maxElements !== undefined) next.maxElements = changes.maxElements;
    if (changes.dataDir === null) delete next.dataDir;
    else if (changes.dataDir !== undefined) next.dataDir = await this.checkDataDir(changes.dataDir);
    if (changes.network !== undefined) next.network = changes.network;
    // Escuchar en la red exige token: si no hay ninguno se adopta el que ya usa el hub o se crea uno.
    if (next.network && !next.token && this.config.sources.token !== 'env') next.token = this.runningToken ?? newToken();
    return next;
  }

  /** La carpeta debe ser absoluta y poder crearse; así el hub no queda sin arrancar. */
  private async checkDataDir(dir: string): Promise<string> {
    if (!isAbsolute(dir)) {
      throw new DomainValidationError([validationError('SCHEMA_VIOLATION', '/dataDir', 'La carpeta de datos debe ser una ruta absoluta.', 'Escribe la ruta completa, por ejemplo /home/ana/chartsia.')]);
    }
    const path = resolve(dir);
    try {
      await mkdir(path, { recursive: true });
    } catch (error) {
      throw new DomainValidationError([validationError('SCHEMA_VIOLATION', '/dataDir', `No se puede usar "${path}": ${(error as Error).message}`, 'Elige una carpeta donde el hub pueda escribir.')]);
    }
    return path;
  }

  private async save(hub: HubFile): Promise<void> {
    const file = this.config.configFile;
    await writeConfigFile(file, { ...(await readConfigFile(file)), hub });
  }
}
