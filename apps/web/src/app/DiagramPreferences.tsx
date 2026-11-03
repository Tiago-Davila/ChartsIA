import { PALETTE_KINDS, type PaletteKind, type PreferenceChanges, type Preferences } from '@chartsia/core/model';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../state/api-client';
import { api } from '../state/clients';
import { diagramStore } from '../state/diagram-store';

const DIRECCIONES = [
  { id: 'down', label: 'De arriba a abajo' },
  { id: 'right', label: 'De izquierda a derecha' },
] as const;

const ESPACIOS = [
  { id: 'compact', label: 'Compacto' },
  { id: 'normal', label: 'Normal' },
  { id: 'wide', label: 'Amplio' },
] as const;

const FUENTES = [
  { id: 'default', label: 'Predeterminada' },
  { id: 'sans-serif', label: 'Sans-serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Monoespaciada' },
  { id: 'handwritten', label: 'Manuscrita' },
] as const;

const MOSTRAR = [
  { id: 'true', label: 'Mostrar' },
  { id: 'false', label: 'Ocultar' },
] as const;

const DETALLES_UML = [
  { campo: 'types', label: 'Tipos' },
  { campo: 'visibility', label: 'Visibilidad' },
  { campo: 'multiplicities', label: 'Multiplicidades' },
  { campo: 'methods', label: 'Métodos' },
] as const;

const TIPOS: Record<PaletteKind, string> = {
  class: 'Clase',
  interface: 'Interfaz',
  enum: 'Enumeración',
  package: 'Paquete',
  person: 'Persona',
  'software-system': 'Sistema de software',
  container: 'Contenedor',
  component: 'Componente',
  boundary: 'Límite',
  entity: 'Entidad',
  table: 'Tabla',
  collection: 'Colección',
};

const COLORES = [
  { campo: 'fillColor', label: 'Relleno', inicial: '#ffffff' },
  { campo: 'borderColor', label: 'Borde', inicial: '#1f2933' },
  { campo: 'fontColor', label: 'Texto', inicial: '#1f2933' },
] as const;

/** Muestra el error del hub en el aviso; sin respuesta del hub, un mensaje genérico. */
function reportError(error: unknown) {
  const errors =
    error instanceof ApiError && error.errors.length > 0
      ? error.errors
      : [{ code: 'SCHEMA_VIOLATION' as const, path: '', message: 'No se pudo contactar con el hub.', hint: 'Comprueba que el hub está en marcha y vuelve a intentarlo.' }];
  diagramStore.getState().showErrors(errors);
}

interface ChoiceProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange(value: T): void;
}

/** Una preferencia con su leyenda y las opciones como botones segmentados. */
function Choice<T extends string>({ legend, name, value, options, onChange }: ChoiceProps<T>) {
  return (
    <fieldset className="config__field">
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.id}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Selector de color que guarda un instante después del último cambio, no en cada arrastre. */
function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), 400);
  };
  return <input type="color" aria-label={label} value={draft} onChange={(e) => change(e.target.value)} />;
}

/** Sección "Diagramas": las preferencias que se aplican a los diagramas nuevos. */
export function DiagramPreferences() {
  const [prefs, setPrefs] = useState<Preferences>();
  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(reportError);
  }, []);
  const cambiar = (changes: PreferenceChanges) => api.setPreferences(changes).then(setPrefs).catch(reportError);

  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Diagramas</h2>
        <p>Cómo se dibujan los diagramas nuevos. Los que ya existen no cambian.</p>
      </header>
      {prefs ? (
        <>
          <Choice legend="Dirección" name="direccion" value={prefs.direction} options={DIRECCIONES} onChange={(direction) => cambiar({ direction })} />
          <Choice legend="Espacio entre elementos" name="espacio-elementos" value={prefs.elementSpacing} options={ESPACIOS} onChange={(elementSpacing) => cambiar({ elementSpacing })} />
          <Choice legend="Espacio entre capas" name="espacio-capas" value={prefs.layerSpacing} options={ESPACIOS} onChange={(layerSpacing) => cambiar({ layerSpacing })} />
          <Choice legend="Fuente" name="fuente" value={prefs.fontFamily} options={FUENTES} onChange={(fontFamily) => cambiar({ fontFamily })} />
          <h3>Detalle UML</h3>
          {DETALLES_UML.map((d) => (
            <Choice
              key={d.campo}
              legend={d.label}
              name={`uml-${d.campo}`}
              value={String(prefs.uml[d.campo]) as 'true' | 'false'}
              options={MOSTRAR}
              onChange={(value) => cambiar({ uml: { [d.campo]: value === 'true' } })}
            />
          ))}
          <h3>C4</h3>
          <Choice legend="Leyenda" name="leyenda-c4" value={String(prefs.c4Legend) as 'true' | 'false'} options={MOSTRAR} onChange={(value) => cambiar({ c4Legend: value === 'true' })} />
          <h3>Colores por tipo de elemento</h3>
          <p className="config__nota">Un tipo sin colores elegidos usa los de siempre.</p>
          <ul className="config__paleta">
            {PALETTE_KINDS.map((kind) => {
              const colors = prefs.palette[kind];
              return (
                <li key={kind}>
                  <span>{TIPOS[kind]}</span>
                  {COLORES.map((c) => (
                    <ColorField
                      key={c.campo}
                      label={`${c.label} de ${TIPOS[kind]}`}
                      value={colors?.[c.campo] ?? c.inicial}
                      onCommit={(value) => cambiar({ palette: { [kind]: { ...colors, [c.campo]: value } } })}
                    />
                  ))}
                  <button type="button" className="button" disabled={!colors} onClick={() => cambiar({ palette: { [kind]: null } })}>
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="config__nota">Cargando las preferencias…</p>
      )}
    </>
  );
}
