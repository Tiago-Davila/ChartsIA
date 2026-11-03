import { type ExportPreferenceChanges, type ExportPreferences } from '@chartsia/core/export';
import { useEffect, useState } from 'react';
import { api } from '../state/clients';
import { Choice, reportError } from './DiagramPreferences';

const FORMATOS = [
  { id: 'svg', label: 'SVG (imagen)' },
  { id: 'drawio', label: 'draw.io' },
  { id: 'excalidraw', label: 'Excalidraw' },
] as const;

const FONDOS = [
  { id: 'white', label: 'Blanco' },
  { id: 'transparent', label: 'Transparente' },
] as const;

const TITULO = [
  { id: 'false', label: 'No' },
  { id: 'true', label: 'Sí' },
] as const;

const MARGENES = [0, 24, 48, 96];
const ESCALAS = [0.5, 1, 2, 3];

/** Opciones numéricas como botones; si el valor guardado no es una de las comunes, se suma a la lista. */
function numericOptions(common: number[], current: number, label: (n: number) => string) {
  return [...new Set([...common, current])].sort((a, b) => a - b).map((n) => ({ id: String(n), label: label(n) }));
}

/** Sección "Exportación": formato por defecto y opciones que usan la app y el agente al exportar. */
export function ExportPreferencesSection() {
  const [prefs, setPrefs] = useState<ExportPreferences>();
  useEffect(() => {
    api.getExportPreferences().then(setPrefs).catch(reportError);
  }, []);
  const cambiar = (changes: ExportPreferenceChanges) => api.setExportPreferences(changes).then(setPrefs).catch(reportError);

  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Exportación</h2>
        <p>Valores por defecto del menú Exportar y de la herramienta export_diagram. El agente puede pedir otros en una llamada.</p>
      </header>
      {prefs ? (
        <>
          <Choice legend="Formato por defecto" name="exportar-formato" value={prefs.format} options={FORMATOS} onChange={(format) => cambiar({ format })} />
          <Choice legend="Fondo" name="exportar-fondo" value={prefs.background} options={FONDOS} onChange={(background) => cambiar({ background })} />
          <h3>Solo SVG</h3>
          <p className="config__nota">draw.io y Excalidraw tienen lienzo infinito y guardan el título en el archivo.</p>
          <Choice
            legend="Margen"
            name="exportar-margen"
            value={String(prefs.margin)}
            options={numericOptions(MARGENES, prefs.margin, (n) => (n === 0 ? 'Sin margen' : `${n} px`))}
            onChange={(margin) => cambiar({ margin: Number(margin) })}
          />
          <Choice
            legend="Escala"
            name="exportar-escala"
            value={String(prefs.scale)}
            options={numericOptions(ESCALAS, prefs.scale, (n) => `${n}×`)}
            onChange={(scale) => cambiar({ scale: Number(scale) })}
          />
          <Choice
            legend="Incluir el título en la imagen"
            name="exportar-titulo"
            value={String(prefs.includeTitle) as 'true' | 'false'}
            options={TITULO}
            onChange={(value) => cambiar({ includeTitle: value === 'true' })}
          />
        </>
      ) : (
        <p className="config__nota">Cargando las preferencias…</p>
      )}
    </>
  );
}
