import { type CSSProperties, type ReactNode } from 'react';
import { type ConnectedAgent } from '../state/api-client';
import { AnimatedList } from './AnimatedList';
import { ArrowLeftIcon, PlugIcon, SlidersIcon } from './icons';
import { AgentIntegrations } from './Integrations';
import { type ConfigSection } from './routes';
import { ThemeToggle } from './ThemeToggle';

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
  section: ConfigSection;
  onSection(section: ConfigSection): void;
  onBack(): void;
}

/** Pantalla `/config`: barra propia con sus secciones (General y Conexiones MCP) y el contenido de la elegida. */
export function ConfigScreen({ origin, agents, section, onSection, onBack }: ConfigScreenProps) {
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
        <div className="sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>
      <section className="config" aria-labelledby="config-section">
        {section === 'general' ? (
          <header className="config__header">
            <h2 id="config-section">General</h2>
          </header>
        ) : (
          <McpConnections origin={origin} agents={agents} />
        )}
      </section>
    </div>
  );
}
