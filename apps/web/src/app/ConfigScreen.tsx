import { useState } from 'react';
import { type ConnectedAgent } from '../state/api-client';
import { getToken } from '../state/auth-token';
import { AGENTS, type Agent } from './agents';
import { ConnectionStatus, type ConnectionState } from './ConnectionStatus';
import { formatDate } from './labels';

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

/** Tarjeta de un agente: instrucciones y el comando a copiar. */
function AgentCard({ agent, mcpUrl }: { agent: Agent; mcpUrl: string }) {
  const snippet = agent.snippet(mcpUrl);
  return (
    <article className="config__card" aria-label={agent.name}>
      <h3>{agent.name}</h3>
      <p>{agent.help}</p>
      <code>{snippet}</code>
      <CopyButton text={snippet} label={`Copiar configuración de ${agent.name}`} />
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

/** Pantalla `/config`: URL del MCP, estado del hub, token, agentes conectados y una tarjeta por agente. */
export function ConfigScreen({ origin, agents, connection, onBack }: { origin: string; agents: ConnectedAgent[]; connection: ConnectionState; onBack(): void }) {
  const mcpUrl = `${origin}/mcp`;
  return (
    <section className="config" aria-labelledby="config-title">
      <button type="button" className="button" onClick={onBack}>← Volver al lienzo</button>
      <h2 id="config-title">Configuración</h2>
      <h3>URL del MCP</h3>
      <code>{mcpUrl}</code>
      <CopyButton text={mcpUrl} label="Copiar URL del MCP" />
      <h3>Estado del hub</h3>
      <ConnectionStatus state={connection} />
      <h3>Token</h3>
      <TokenRow />
      <h3>Agentes conectados</h3>
      <ConnectedAgents agents={agents} />
      <h3>Agentes</h3>
      {AGENTS.map((agent) => (
        <AgentCard key={agent.id} agent={agent} mcpUrl={mcpUrl} />
      ))}
    </section>
  );
}
