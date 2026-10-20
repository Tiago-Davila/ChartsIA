import { type ExportFormat } from '@chartsia/core/export';
import { type Diagram, type DiagramType, type Operation } from '@chartsia/core/model';
import { type ValidationError } from '@chartsia/core/validation';

export interface DiagramSummary {
  diagramId: string;
  type: DiagramType;
  title: string;
  revision: number;
  updatedAt: string;
}

export interface DiagramListResponse {
  activeDiagramId: string | null;
  diagrams: DiagramSummary[];
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
    getDiagram: (diagramId: string) => json<Diagram>(`/api/diagrams/${id(diagramId)}`),
    applyOperations: (diagramId: string, body: { baseRevision?: number; operations: Operation[] }) =>
      json<ApplyResponse>(`/api/diagrams/${id(diagramId)}/operations`, { method: 'POST', body: JSON.stringify(body) }),
    history: (diagramId: string, direction: 'undo' | 'redo') =>
      json<{ diagramId: string; revision: number }>(`/api/diagrams/${id(diagramId)}/${direction}`, { method: 'POST' }),
    activate: async (diagramId: string) => {
      await request(`/api/diagrams/${id(diagramId)}/activate`, { method: 'POST' });
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
