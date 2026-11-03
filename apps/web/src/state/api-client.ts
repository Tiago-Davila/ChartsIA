import { type ExportFormat, type ExportPreferenceChanges, type ExportPreferences } from '@chartsia/core/export';
import { type Diagram, type DiagramType, type Operation, type PreferenceChanges, type Preferences } from '@chartsia/core/model';
import { type ValidationError } from '@chartsia/core/validation';

export interface DiagramSummary {
  diagramId: string;
  type: DiagramType;
  title: string;
  revision: number;
  updatedAt: string;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

/** Agente MCP visto por el hub; `lastCallAt` es una fecha ISO. */
export interface ConnectedAgent {
  id: number;
  name: string;
  version: string;
  lastCallAt: string;
}

/** Datos del hub para la sección General de la configuración. */
export interface HubInfo {
  version: string;
  port: number;
  dataDir: string;
}

/** De dónde sale un valor del hub: variable de entorno, `config.json` o el valor por defecto. */
export type ValueSource = 'env' | 'file' | 'default';

/** Configuración del hub; `running` es lo que usa el hub ahora y `value` lo que usará tras reiniciar. */
export interface HubSettings {
  dataDir: { value: string; source: ValueSource; running: string };
  maxElements: { value: number; source: ValueSource };
  network: { value: boolean; source: ValueSource; running: boolean };
  token: { value: string | null; source: ValueSource };
  restartRequired: boolean;
}

export interface HubSettingsChanges {
  dataDir?: string | null;
  maxElements?: number | null;
  network?: boolean;
}

export interface BackupImportResult {
  imported: number;
  replaced: number;
  skipped: number;
  projectsCreated: number;
}

export interface DiagramListResponse {
  activeDiagramId: string | null;
  diagrams: DiagramSummary[];
  projects: Project[];
}

export interface ApplyResponse {
  diagramId: string;
  revision: number;
  viewUrl: string;
  applied: number;
  warnings: string[];
}

/** Error HTTP del hub con el cuerpo `{ errors }` del contrato. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errors: ValidationError[],
  ) {
    super(errors[0]?.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
  get unauthorized(): boolean {
    return this.status === 401;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  getToken(): string | undefined;
  fetch?: typeof fetch;
}

/** Cliente tipado de la API interna ([app-api.md]). Envía el token como Bearer si existe. */
export function createApiClient({ baseUrl = '', getToken, fetch: fetchImpl = (...a) => fetch(...a) }: ApiClientOptions) {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const res = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    if (res.ok) return res;
    let errors: ValidationError[] = [];
    try {
      errors = ((await res.json()) as { errors?: ValidationError[] }).errors ?? [];
    } catch {
      // cuerpo no JSON
    }
    throw new ApiError(res.status, errors);
  }
  const json = async <T>(path: string, init?: RequestInit) => (await request(path, init)).json() as Promise<T>;
  const id = encodeURIComponent;

  return {
    listDiagrams: () => json<DiagramListResponse>('/api/diagrams'),
    createDiagram: (body: { type: DiagramType; title: string; projectId?: string }) =>
      json<{ diagramId: string; revision: number; viewUrl: string }>('/api/diagrams', { method: 'POST', body: JSON.stringify(body) }),
    importMermaid: (body: { source: string; title?: string; projectId?: string }) =>
      json<{ diagramId: string; revision: number; viewUrl: string; counts: { elements: number; relations: number }; warnings: string[] }>('/api/diagrams/import-mermaid', { method: 'POST', body: JSON.stringify(body) }),
    importExcalidraw: (body: { source: string; title?: string; projectId?: string }) =>
      json<{ diagramId: string; revision: number; viewUrl: string; counts: { elements: number; relations: number }; warnings: string[] }>('/api/diagrams/import-excalidraw', { method: 'POST', body: JSON.stringify(body) }),
    importDrawio: (body: { source: string; title?: string; projectId?: string }) =>
      json<{ diagramId: string; revision: number; viewUrl: string; counts: { elements: number; relations: number }; warnings: string[] }>('/api/diagrams/import-drawio', { method: 'POST', body: JSON.stringify(body) }),
    listAgents: async () => (await json<{ agents: ConnectedAgent[] }>('/api/agents')).agents,
    getHub: () => json<HubInfo>('/api/hub'),
    getHubSettings: () => json<HubSettings>('/api/hub/config'),
    setHubSettings: (changes: HubSettingsChanges) => json<HubSettings>('/api/hub/config', { method: 'PUT', body: JSON.stringify(changes) }),
    regenerateToken: () => json<HubSettings>('/api/hub/token', { method: 'POST' }),
    downloadBackup: async () => {
      const res = await request('/api/backup');
      const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'chartsia-respaldo.json';
      return { blob: await res.blob(), filename };
    },
    importBackup: (backup: unknown, onConflict?: 'replace' | 'skip') =>
      json<BackupImportResult>('/api/backup/import', { method: 'POST', body: JSON.stringify({ backup, ...(onConflict ? { onConflict } : {}) }) }),
    getPreferences: () => json<Preferences>('/api/preferences'),
    setPreferences: (changes: PreferenceChanges) => json<Preferences>('/api/preferences', { method: 'PUT', body: JSON.stringify(changes) }),
    getExportPreferences: () => json<ExportPreferences>('/api/preferences/export'),
    setExportPreferences: (changes: ExportPreferenceChanges) => json<ExportPreferences>('/api/preferences/export', { method: 'PUT', body: JSON.stringify(changes) }),
    getDiagram: (diagramId: string) => json<Diagram>(`/api/diagrams/${id(diagramId)}`),
    applyOperations: (diagramId: string, body: { baseRevision?: number; operations: Operation[] }) =>
      json<ApplyResponse>(`/api/diagrams/${id(diagramId)}/operations`, { method: 'POST', body: JSON.stringify(body) }),
    history: (diagramId: string, direction: 'undo' | 'redo') =>
      json<{ diagramId: string; revision: number }>(`/api/diagrams/${id(diagramId)}/${direction}`, { method: 'POST' }),
    activate: async (diagramId: string) => {
      await request(`/api/diagrams/${id(diagramId)}/activate`, { method: 'POST' });
    },
    createProject: (name: string) => json<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ name }) }),
    renameProject: (projectId: string, name: string) =>
      json<Project>(`/api/projects/${id(projectId)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteProject: async (projectId: string) => {
      await request(`/api/projects/${id(projectId)}`, { method: 'DELETE' });
    },
    deleteDiagram: async (diagramId: string) => {
      await request(`/api/diagrams/${id(diagramId)}`, { method: 'DELETE' });
    },
    setDiagramProject: async (diagramId: string, projectId: string | null) => {
      await request(`/api/diagrams/${id(diagramId)}/project`, { method: 'PUT', body: JSON.stringify({ projectId }) });
    },
    exportFile: async (diagramId: string, format: ExportFormat) => {
      const res = await request(`/api/diagrams/${id(diagramId)}/export?format=${format}`);
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `diagrama.${format}`;
      return { blob: await res.blob(), filename };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
