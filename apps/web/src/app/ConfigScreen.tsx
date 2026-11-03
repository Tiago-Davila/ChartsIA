import { type CSSProperties, type ReactNode, useState } from 'react';
import { type ConnectedAgent, type HubInfo } from '../state/api-client';
import { mcpUrlParaAgentes } from './agents';
import { AnimatedList } from './AnimatedList';
import { type CanvasPreferences, setCanvasPreferences, useCanvasPreferences } from './canvas-preferences';
import { DiagramPreferences } from './DiagramPreferences';
import { ExportPreferencesSection } from './ExportPreferences';
import { ArrowLeftIcon, DownloadIcon, FileIcon, GridIcon, PlugIcon, SlidersIcon } from './icons';
import { AgentIntegrations, CodeBlock } from './Integrations';
import { type ConfigSection } from './routes';
import { applyTheme, initialTheme, type ThemePreference } from './theme';

const TEMAS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'Según el sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
];

/** Sección "General": el tema de la app y los datos del hub. */
function General({ origin, hub }: { origin: string; hub: HubInfo | null }) {
  const [tema, setTema] = useState<ThemePreference>(initialTheme);
  const elegir = (preferencia: ThemePreference) => {
    applyTheme(preferencia);
    setTema(preferencia);
  };
  return (
    <>
      <header className="config__header">
        <h2 id="config-section">General</h2>
        <p>Apariencia de la app y datos del hub.</p>
      </header>
      <fieldset className="config__field">
        <legend>Tema</legend>
        <div className="segmented">
          {TEMAS.map((t) => (
            <label key={t.id}>
              <input type="radio" name="tema" value={t.id} checked={tema === t.id} onChange={() => elegir(t.id)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <h3>Hub</h3>
      {hub ? (
        <dl className="config__datos">
          <dt>Versión</dt>
          <dd>{hub.version}</dd>
          <dt>Puerto</dt>
          <dd>{hub.port}</dd>
          <dt>URL del MCP</dt>
          <dd>
            <CodeBlock text={mcpUrlParaAgentes(origin)} label="Copiar URL del MCP" />
          </dd>
          <dt>Carpeta de datos</dt>
          <dd>
            <CodeBlock text={hub.dataDir} label="Copiar carpeta de datos" />
          </dd>
        </dl>
      ) : (
        <p className="config__nota">Cargando los datos del hub…</p>
      )}
    </>
  );
}

/** Preferencia del lienzo con su leyenda arriba y sus opciones como botones segmentados. */
function Preferencia<K extends keyof CanvasPreferences>({ leyenda, campo, opciones }: { leyenda: string; campo: K; opciones: [CanvasPreferences[K], string][] }) {
  const valor = useCanvasPreferences()[campo];
  return (
    <fieldset className="config__field">
      <legend>{leyenda}</legend>
      <div className="segmented">
        {opciones.map(([opcion, etiqueta]) => (
          <label key={etiqueta}>
            <input type="radio" name={campo} checked={valor === opcion} onChange={() => setCanvasPreferences({ [campo]: opcion })} />
            {etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const MOSTRAR_U_OCULTAR: [boolean, string][] = [
  [true, 'Mostrar'],
  [false, 'Ocultar'],
];

/** Sección "Lienzo": cuadrícula, minimapa, controles de zoom y comportamiento al abrir o cambiar un diagrama. */
function Lienzo() {
  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Lienzo</h2>
        <p>Cada cambio se aplica al instante y se recuerda en este navegador.</p>
      </header>
      <Preferencia leyenda="Cuadrícula" campo="grid" opciones={MOSTRAR_U_OCULTAR} />
      <Preferencia
        leyenda="Tamaño de la cuadrícula"
        campo="gridSize"
        opciones={[
          [10, '10 px'],
          [20, '20 px'],
          [40, '40 px'],
        ]}
      />
      <Preferencia
        leyenda="Ajustar a la cuadrícula al mover"
        campo="snapToGrid"
        opciones={[
          [false, 'No'],
          [true, 'Sí'],
        ]}
      />
      <Preferencia leyenda="Minimapa" campo="minimap" opciones={MOSTRAR_U_OCULTAR} />
      <Preferencia leyenda="Controles de zoom" campo="zoomControls" opciones={MOSTRAR_U_OCULTAR} />
      <Preferencia
        leyenda="Al abrir un diagrama"
        campo="onOpen"
        opciones={[
          ['fit', 'Ajustar a la pantalla'],
          ['actual', 'Mostrar al 100 %'],
        ]}
      />
      <Preferencia
        leyenda="Animaciones"
        campo="animations"
        opciones={[
          ['system', 'Según el sistema'],
          ['normal', 'Normales'],
          ['reduced', 'Reducidas'],
        ]}
      />
      <Preferencia
        leyenda="Cuando el agente cambia el diagrama"
        campo="onAgentChange"
        opciones={[
          ['open', 'Abrirlo automáticamente'],
          ['notice', 'Solo mostrar un aviso'],
        ]}
      />
    </>
  );
}

/** Sección "Conexiones MCP": las tarjetas de los agentes, conectados primero. */
function McpConnections({ origin, agents }: { origin: string; agents: ConnectedAgent[] }) {
  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Conexiones MCP</h2>
        <p>Conecta un agente y pídele diagramas: aparecen en el lienzo al instante.</p>
      </header>
      <AgentIntegrations origin={origin} agents={agents} />
    </>
  );
}

const SECCIONES: { id: ConfigSection; label: string; icon: ReactNode }[] = [
  { id: 'general', label: 'General', icon: <SlidersIcon /> },
  { id: 'lienzo', label: 'Lienzo', icon: <GridIcon /> },
  { id: 'diagramas', label: 'Diagramas', icon: <FileIcon /> },
  { id: 'exportacion', label: 'Exportación', icon: <DownloadIcon /> },
  { id: 'mcp', label: 'Conexiones MCP', icon: <PlugIcon /> },
];

export interface ConfigScreenProps {
  origin: string;
  agents: ConnectedAgent[];
  hub: HubInfo | null;
  section: ConfigSection;
  onSection(section: ConfigSection): void;
  onBack(): void;
}

/** Pantalla `/config`: barra propia con sus secciones (General, Lienzo y Conexiones MCP) y el contenido de la elegida. */
export function ConfigScreen({ origin, agents, hub, section, onSection, onBack }: ConfigScreenProps) {
  return (
    <div className="config-shell">
      <aside className="config-nav">
        <div className="brand">
          <button type="button" className="sidebar-nav__row" onClick={onBack}>
            <ArrowLeftIcon />
            Volver al lienzo
          </button>
        </div>
        <nav className="config-nav__body" aria-labelledby="config-title">
          <h1 id="config-title" className="config-nav__title">Configuración</h1>
          <AnimatedList ariaLabel="Secciones" className="config-nav__list">
            {SECCIONES.map((s, i) => (
              <li key={s.id} data-row data-current={s.id === section || undefined} style={{ '--i': i } as CSSProperties}>
                <button type="button" className="sidebar-nav__row config-nav__item" aria-current={s.id === section ? 'page' : undefined} onClick={() => onSection(s.id)}>
                  {s.icon}
                  {s.label}
                </button>
              </li>
            ))}
          </AnimatedList>
        </nav>
      </aside>
      <section className="config" aria-labelledby="config-section">
        {section === 'general' ? (
          <General origin={origin} hub={hub} />
        ) : section === 'lienzo' ? (
          <Lienzo />
        ) : section === 'diagramas' ? (
          <DiagramPreferences />
        ) : section === 'exportacion' ? (
          <ExportPreferencesSection />
        ) : (
          <McpConnections origin={origin} agents={agents} />
        )}
      </section>
    </div>
  );
}
