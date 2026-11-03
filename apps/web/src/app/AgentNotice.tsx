import { useEffect } from 'react';
import { diagramStore, useDiagramStore } from '../state/diagram-store';
import { navigate } from './routes';
import { pathDeDiagrama } from '../state/use-hub-sync';

/** Aviso de que el agente abrió otro diagrama, con el botón para verlo; desaparece al abrirlo. */
export function AgentNotice() {
  const diagramId = useDiagramStore((s) => s.agentNoticeId);
  const abierto = useDiagramStore((s) => s.openDiagramId);
  const titulo = useDiagramStore((s) => s.diagrams.find((d) => d.diagramId === diagramId)?.title);
  const visto = diagramId !== null && diagramId === abierto;
  useEffect(() => {
    if (visto) diagramStore.getState().showAgentNotice(null);
  }, [visto]);
  if (!diagramId || visto) return null;
  return (
    <div className="toast-region">
      <div className="toast toast--info" role="status">
        <p className="toast__title">
          {titulo ? `El agente abrió «${titulo}»` : 'El agente abrió otro diagrama'}
          <button type="button" aria-label="Cerrar" onClick={() => diagramStore.getState().showAgentNotice(null)}>
            ×
          </button>
        </p>
        <button type="button" onClick={() => navigate(pathDeDiagrama(diagramId))}>
          Abrir
        </button>
      </div>
    </div>
  );
}
