import { useEffect } from 'react';
import { type ConnectedAgent } from '../state/api-client';
import { EnterIcon, GitHubIcon } from './icons';
import { AgentIntegrations } from './Integrations';
import { SquaresBackground } from './SquaresBackground';

export const REPO_URL = 'https://github.com/Tiago-Davila/ChartsIA';

export interface LandingProps {
  origin: string;
  agents: ConnectedAgent[];
  /** Entra a la app y abre la ventana de un diagrama en blanco. */
  onStart(): void;
}

/** Pantalla inicial, solo cuando todavía no hay diagramas: título, Empezar, estrella en GitHub y los agentes para conectar. */
export function Landing({ origin, agents, onStart }: LandingProps) {
  // Enter empieza aunque el foco no esté en el botón, salvo que esté en otro control.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (document.activeElement === document.body || document.activeElement === null)) onStart();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onStart]);

  return (
    <div className="landing">
      <SquaresBackground />
      <main className="landing__content">
        <section className="landing__hero" aria-labelledby="landing-title">
          <h1 id="landing-title" className="landing__title">ChartsIA</h1>
          <p className="landing__tagline">Diagramas UML y C4 que dibujan tus agentes de IA, en vivo.</p>
          <div className="landing__actions">
            <button type="button" className="landing__start" onClick={onStart} autoFocus>
              Empezar
              <kbd className="landing__kbd" aria-hidden="true"><EnterIcon /></kbd>
            </button>
            {/* Adaptado de Star Border de React Bits: dos destellos recorren el borde. */}
            <a className="star-border" href={REPO_URL} target="_blank" rel="noreferrer">
              <span className="star-border__glow star-border__glow--bottom" aria-hidden="true" />
              <span className="star-border__glow star-border__glow--top" aria-hidden="true" />
              <span className="star-border__inner">
                <GitHubIcon />
                Star on GitHub
              </span>
            </a>
          </div>
        </section>
        <section className="landing__integrations" aria-labelledby="landing-integrations">
          <h2 id="landing-integrations">Integraciones</h2>
          <p>Conecta un agente y pídele un diagrama: aparece aquí al instante.</p>
          <AgentIntegrations origin={origin} agents={agents} />
        </section>
      </main>
    </div>
  );
}
