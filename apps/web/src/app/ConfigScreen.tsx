import { type CSSProperties, type ReactNode, useState } from 'react';
import { type ConnectedAgent, type HubInfo } from '../state/api-client';
import { mcpUrlParaAgentes } from './agents';
import { AnimatedList } from './AnimatedList';
import { ArrowLeftIcon, PlugIcon, SlidersIcon } from './icons';
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

/** Pantalla `/config`: barra propia con sus secciones (General y Conexiones MCP) y el contenido de la elegida. */
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
        ) : (
          <McpConnections origin={origin} agents={agents} />
        )}
      </section>
    </div>
  );
}
