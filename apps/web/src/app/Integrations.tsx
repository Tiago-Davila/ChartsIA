import { useId, useState } from 'react';
import { type ConnectedAgent } from '../state/api-client';
import { AGENTS, mcpUrlParaAgentes, promptInstalacion, type Agent } from './agents';
import { CheckIcon, CopyIcon, PlusIcon } from './icons';
import { Modal } from './Modal';

/** Bloque de código con un botón de copiar dentro; avisa si el navegador no deja copiar. */
function CodeBlock({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = () => {
    // El portapapeles no existe sin contexto seguro (HTTP fuera de loopback).
    (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('sin portapapeles')))
      .then(() => setState('copied'))
      .catch(() => setState('failed'));
  };
  return (
    <div className="code-block">
      <pre><code>{text}</code></pre>
      <button type="button" className="code-block__copy" aria-label={label} title={state === 'copied' ? 'Copiado' : 'Copiar'} data-copied={state === 'copied' || undefined} onClick={copy}>
        {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span className={state === 'failed' ? 'code-block__error' : 'sr-only'} role="status">
        {state === 'copied' && 'Copiado'}
        {state === 'failed' && 'No se pudo copiar: selecciona el texto y cópialo a mano.'}
      </span>
    </div>
  );
}

/** Ventana con lo necesario para conectar un agente: instrucciones, comando y prompt, cada uno con su botón de copiar. */
function ConnectDialog({ agent, mcpUrl, onCerrar }: { agent: Agent; mcpUrl: string; onCerrar(): void }) {
  return (
    <Modal titulo={`Conectar ${agent.name}`} className="modal--wide" onCerrar={onCerrar}>
      <div className="config__connect">
        <p>{agent.help}</p>
        <CodeBlock text={agent.snippet(mcpUrl)} label={`Copiar configuración de ${agent.name}`} />
        <h3>Prompt de instalación</h3>
        <p>Pégalo en el propio agente y deja que se conecte solo.</p>
        <CodeBlock text={promptInstalacion(agent, mcpUrl)} label={`Copiar prompt de ${agent.name}`} />
      </div>
      <div className="modal__actions">
        <button type="button" className="button" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}

/** Tarjeta de una integración (Integrations de React Bits): nombre, tipo, una frase y el botón de conectar. */
function IntegrationCard({ agent, connected, mcpUrl }: { agent: Agent; connected: boolean; mcpUrl: string }) {
  const [abierta, setAbierta] = useState(false);
  const nombreId = useId();
  return (
    <article className="integration" aria-label={agent.name}>
      <div>
        <h4 id={nombreId} className="integration__name">{agent.name}</h4>
        <p className="integration__category">{agent.category}</p>
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

/** Grupo de tarjetas con su título; sin agentes no se muestra. */
function IntegrationGroup({ titulo, agents, connected, mcpUrl }: { titulo: string; agents: Agent[]; connected: boolean; mcpUrl: string }) {
  const id = useId();
  if (agents.length === 0) return null;
  return (
    <section className="integrations-group" aria-labelledby={id}>
      <h3 id={id}>{titulo}</h3>
      <div className="integrations">
        {agents.map((agent) => (
          <IntegrationCard key={agent.id} agent={agent} mcpUrl={mcpUrl} connected={connected} />
        ))}
      </div>
    </section>
  );
}

/** Tarjetas de los agentes: primero los que ya llamaron al hub y después los habilitados para conectar. */
export function AgentIntegrations({ origin, agents }: { origin: string; agents: ConnectedAgent[] }) {
  const mcpUrl = mcpUrlParaAgentes(origin);
  const nombres = new Set(agents.map((a) => a.name));
  const conectados = AGENTS.filter((agent) => agent.clients.some((c) => nombres.has(c)));
  const habilitados = AGENTS.filter((agent) => !conectados.includes(agent));
  return (
    <>
      <IntegrationGroup titulo="Conectados" agents={conectados} connected mcpUrl={mcpUrl} />
      <IntegrationGroup titulo="Habilitados" agents={habilitados} connected={false} mcpUrl={mcpUrl} />
    </>
  );
}
