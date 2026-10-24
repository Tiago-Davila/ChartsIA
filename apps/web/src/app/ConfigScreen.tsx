import { type CSSProperties, type ReactNode, useId, useState } from 'react';
import { type ConnectedAgent } from '../state/api-client';
import { getToken } from '../state/auth-token';
import { AGENTS, mcpUrlParaAgentes, promptInstalacion, type Agent } from './agents';
import { AnimatedList } from './AnimatedList';
import { ConnectionStatus, type ConnectionState } from './ConnectionStatus';
import { ArrowLeftIcon, CheckIcon, PlugIcon, PlusIcon, SlidersIcon } from './icons';
import { formatDate } from './labels';
import { Modal } from './Modal';
import { type ConfigSection } from './routes';
import { ThemeToggle } from './ThemeToggle';

/** Copia el texto y avisa si el navegador lo impide. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = () => {
    // El portapapeles no existe sin contexto seguro (HTTP fuera de loopback).
    (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('sin portapapeles')))
      .then(() => setState('copied'))
      .catch(() => setState('failed'));
  };
  return (
    <>
      <button type="button" className="button" aria-label={label} onClick={copy}>Copiar</button>
      <span role="status">
        {state === 'copied' && 'Copiado'}
        {state === 'failed' && 'No se pudo copiar: selecciona el texto y cópialo a mano.'}
      </span>
    </>
  );
}

/** Ventana con lo necesario para conectar un agente: instrucciones, comando y prompt, cada uno con su botón de copiar. */
function ConnectDialog({ agent, mcpUrl, onCerrar }: { agent: Agent; mcpUrl: string; onCerrar(): void }) {
  const snippet = agent.snippet(mcpUrl);
  const prompt = promptInstalacion(agent, mcpUrl);
  return (
    <Modal titulo={`Conectar ${agent.name}`} className="modal--wide" onCerrar={onCerrar}>
      <div className="config__connect">
        <p>{agent.help}</p>
        <code>{snippet}</code>
        <CopyButton text={snippet} label={`Copiar configuración de ${agent.name}`} />
        <h3>Prompt de instalación</h3>
        <p>Pégalo en el propio agente y deja que se conecte solo.</p>
        <pre className="config__prompt"><code>{prompt}</code></pre>
        <CopyButton text={prompt} label={`Copiar prompt de ${agent.name}`} />
      </div>
      <div className="modal__actions">
        <button type="button" className="button" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}

/** Tarjeta de una integración (Integrations de React Bits): logo, nombre, una frase y el botón de conectar. */
function IntegrationCard({ agent, connected, mcpUrl }: { agent: Agent; connected: boolean; mcpUrl: string }) {
  const [abierta, setAbierta] = useState(false);
  const nombreId = useId();
  return (
    <article className="integration" aria-label={agent.name}>
      <div className="integration__head">
        <span className="integration__logo" aria-hidden>
          {agent.logo ? <img src={agent.logo} alt="" /> : agent.monogram}
        </span>
        <div>
          <h3 id={nombreId} className="integration__name">{agent.name}</h3>
          <p className="integration__category">{agent.category}</p>
        </div>
      </div>
      <p className="integration__summary">{agent.summary}</p>
      <button type="button" className="integration__action" data-connected={connected || undefined} aria-describedby={nombreId} onClick={() => setAbierta(true)}>
        {connected ? <CheckIcon /> : <PlusIcon />}
        {connected ? 'Conectado' : 'Conectar'}
      </button>
      {abierta ? <ConnectDialog agent={agent} mcpUrl={mcpUrl} onCerrar={() => setAbierta(false)} /> : null}
    </article>
  );
}

/** El token se guarda solo en esta pestaña; aquí se muestra enmascarado y nunca va en la URL. */
function TokenRow() {
  const token = getToken();
  const [visible, setVisible] = useState(false);
  if (!token) return <p>No hay token guardado: en loopback el hub no lo exige.</p>;
  return (
    <div>
      <code>{visible ? token : '•'.repeat(12)}</code>
      <button type="button" className="button" aria-pressed={visible} onClick={() => setVisible(!visible)}>
        {visible ? 'Ocultar token' : 'Ver token'}
      </button>
      <CopyButton text={token} label="Copiar token" />
    </div>
  );
}

/** Agentes MCP que se han conectado al hub, con la hora de su última llamada. */
function ConnectedAgents({ agents }: { agents: ConnectedAgent[] }) {
  if (agents.length === 0) return <p>Ningún agente se ha conectado todavía.</p>;
  return (
    <ul aria-label="Agentes conectados">
      {agents.map((agent) => (
        <li key={agent.id}>
          <strong>{agent.name}</strong> {agent.version && `v${agent.version}`} · última llamada {formatDate(agent.lastCallAt)}
        </li>
      ))}
    </ul>
  );
}

/** Sección "Conexiones MCP": datos del hub, una tarjeta por integración y los agentes que ya se conectaron. */
function McpConnections({ origin, agents, connection }: { origin: string; agents: ConnectedAgent[]; connection: ConnectionState }) {
  const mcpUrl = mcpUrlParaAgentes(origin);
  const nombres = new Set(agents.map((a) => a.name));
  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Conexiones MCP</h2>
        <p>Conecta un agente al hub y pídele diagramas: aparecen en el lienzo al instante.</p>
      </header>
      <div className="config__hub">
        <h3>URL del MCP</h3>
        <code>{mcpUrl}</code>
        <CopyButton text={mcpUrl} label="Copiar URL del MCP" />
        <h3>Estado del hub</h3>
        <ConnectionStatus state={connection} />
        <h3>Token</h3>
        <TokenRow />
      </div>
      <div className="integrations">
        {AGENTS.map((agent) => (
          <IntegrationCard key={agent.id} agent={agent} mcpUrl={mcpUrl} connected={agent.clients.some((c) => nombres.has(c))} />
        ))}
      </div>
      <h3>Agentes conectados</h3>
      <ConnectedAgents agents={agents} />
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
  connection: ConnectionState;
  section: ConfigSection;
  onSection(section: ConfigSection): void;
  onBack(): void;
}

/** Pantalla `/config`: barra propia con sus secciones (General y Conexiones MCP) y el contenido de la elegida. */
export function ConfigScreen({ origin, agents, connection, section, onSection, onBack }: ConfigScreenProps) {
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
          <McpConnections origin={origin} agents={agents} connection={connection} />
        )}
      </section>
    </div>
  );
}
