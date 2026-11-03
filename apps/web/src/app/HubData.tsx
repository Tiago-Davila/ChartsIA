import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { ApiError, type BackupImportResult, type HubSettings, type HubSettingsChanges, type ValueSource } from '../state/api-client';
import { api } from '../state/clients';
import { downloadBlob } from '../state/download';
import { reportError } from './DiagramPreferences';
import { ConfirmDialog } from './ConfirmDialog';
import { CodeBlock } from './Integrations';
import { Modal } from './Modal';

const VARIABLES = { dataDir: 'CHARTSIA_DATA_DIR', maxElements: 'CHARTSIA_MAX_ELEMENTS', network: 'CHARTSIA_HOST', token: 'CHARTSIA_TOKEN' } as const;
const MAX_CONFLICTOS_VISIBLES = 8;

/** Dice de dónde viene el valor: de una variable de entorno (no se puede cambiar desde la app), del archivo o el de siempre. */
function Origen({ source, variable }: { source: ValueSource; variable: string }) {
  if (source === 'env') return <p className="config__nota">Definido por la variable {variable}: mientras exista, la app no puede cambiarlo.</p>;
  return <p className="config__nota">{source === 'file' ? 'Guardado en config.json.' : 'Valor por defecto.'}</p>;
}

/** Texto del resultado de una importación. */
function resumen({ imported, replaced, skipped, projectsCreated }: BackupImportResult): string {
  const partes = [`${imported} diagrama(s) nuevo(s)`, `${replaced} reemplazado(s)`, `${skipped} sin tocar`, `${projectsCreated} proyecto(s) nuevo(s)`];
  return `Importación lista: ${partes.join(', ')}.`;
}

/** Sección "Hub y datos": carpeta de datos, límite, acceso desde la red, token y respaldo de los diagramas. */
export function HubData() {
  const [settings, setSettings] = useState<HubSettings>();
  const [dataDir, setDataDir] = useState<string>();
  const [maxElements, setMaxElements] = useState<string>();
  const [confirmar, setConfirmar] = useState<'red' | 'token'>();
  const [conflictos, setConflictos] = useState<{ backup: unknown; mensajes: string[] }>();
  const [resultado, setResultado] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const selectorArchivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getHubSettings().then(setSettings).catch(reportError);
  }, []);

  /** Guarda en el hub y muestra lo que devuelve; los borradores vuelven a seguir lo guardado. */
  const guardar = (changes: HubSettingsChanges) =>
    api
      .setHubSettings(changes)
      .then((guardado) => {
        setSettings(guardado);
        setDataDir(undefined);
        setMaxElements(undefined);
      })
      .catch(reportError);

  const regenerar = () => api.regenerateToken().then(setSettings).catch(reportError);

  const exportar = () =>
    api
      .downloadBackup()
      .then(({ blob, filename }) => downloadBlob(blob, filename))
      .catch(reportError);

  /** Manda el respaldo al hub; si hay ids repetidos, pregunta antes de reemplazar o saltar. */
  const importar = async (backup: unknown, onConflict?: 'replace' | 'skip') => {
    setOcupado(true);
    setResultado('');
    try {
      setResultado(resumen(await api.importBackup(backup, onConflict)));
    } catch (error) {
      if (error instanceof ApiError && error.errors[0]?.code === 'IMPORT_CONFLICT') setConflictos({ backup, mensajes: error.errors.map((e) => e.message) });
      else reportError(error);
    } finally {
      setOcupado(false);
    }
  };

  const elegirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    setErrorArchivo('');
    if (!archivo) return;
    try {
      await importar(JSON.parse(await archivo.text()));
    } catch (error) {
      if (error instanceof SyntaxError) setErrorArchivo('El archivo no es un JSON válido.');
      else reportError(error);
    }
  };

  const resolverConflictos = (politica: 'replace' | 'skip') => {
    const pendiente = conflictos;
    setConflictos(undefined);
    if (pendiente) void importar(pendiente.backup, politica);
  };

  return (
    <>
      <header className="config__header">
        <h2 id="config-section">Hub y datos</h2>
        <p>Dónde guarda el hub los diagramas, cómo se accede a él y el respaldo de tus diagramas.</p>
      </header>
      {settings ? (
        <>
          {settings.restartRequired ? (
            <p className="config__aviso" role="status">
              Hay cambios guardados que el hub aplica al reiniciarse. Hasta entonces sigue con los valores anteriores.
            </p>
          ) : null}

          <div className="config__field">
            <label className="config__label" htmlFor="hub-datadir">Carpeta de datos</label>
            <form className="config__fila" onSubmit={(e) => { e.preventDefault(); void guardar({ dataDir: dataDir ?? settings.dataDir.value }); }}>
              <input id="hub-datadir" type="text" value={dataDir ?? settings.dataDir.value} disabled={settings.dataDir.source === 'env'} onChange={(e) => setDataDir(e.target.value)} />
              <button type="submit" className="button" disabled={settings.dataDir.source === 'env' || dataDir === undefined || dataDir === settings.dataDir.value}>Guardar</button>
            </form>
            <Origen source={settings.dataDir.source} variable={VARIABLES.dataDir} />
            {settings.dataDir.value !== settings.dataDir.running ? <p className="config__nota">El hub usa {settings.dataDir.running} hasta reiniciarse. Cambiar la carpeta no mueve los diagramas: exporta un respaldo e impórtalo después de reiniciar.</p> : null}
          </div>

          <div className="config__field">
            <label className="config__label" htmlFor="hub-max">Máximo de elementos por diagrama</label>
            <form className="config__fila" onSubmit={(e) => { e.preventDefault(); void guardar({ maxElements: Number(maxElements) }); }}>
              <input id="hub-max" type="number" min={1} max={100000} value={maxElements ?? String(settings.maxElements.value)} disabled={settings.maxElements.source === 'env'} onChange={(e) => setMaxElements(e.target.value)} />
              <button type="submit" className="button" disabled={settings.maxElements.source === 'env' || maxElements === undefined || maxElements === String(settings.maxElements.value)}>Guardar</button>
            </form>
            <Origen source={settings.maxElements.source} variable={VARIABLES.maxElements} />
            <p className="config__nota">Se aplica al instante.</p>
          </div>

          <fieldset className="config__field">
            <legend>Acceso desde la red</legend>
            <div className="segmented">
              <label>
                <input type="radio" name="red" checked={!settings.network.value} disabled={settings.network.source === 'env'} onChange={() => void guardar({ network: false })} />
                Solo este equipo
              </label>
              <label>
                <input type="radio" name="red" checked={settings.network.value} disabled={settings.network.source === 'env'} onChange={() => setConfirmar('red')} />
                Desde la red
              </label>
            </div>
            <Origen source={settings.network.source} variable={VARIABLES.network} />
            {settings.network.value !== settings.network.running ? <p className="config__nota">Se aplica al reiniciar el hub.</p> : null}
          </fieldset>

          {settings.network.value && settings.token.value ? (
            <div className="config__field">
              <h3>Token de acceso</h3>
              <CodeBlock text={settings.token.value} label="Copiar token" />
              <p className="config__nota">Quien tenga el token puede ver y cambiar tus diagramas. Guárdalo: lo pide la app y los agentes (Authorization: Bearer).</p>
              <Origen source={settings.token.source} variable={VARIABLES.token} />
              <button type="button" className="button" disabled={settings.token.source === 'env'} onClick={() => setConfirmar('token')}>Regenerar token</button>
            </div>
          ) : null}

          <h3>Respaldo</h3>
          <p className="config__nota">Un archivo JSON con todos tus diagramas y proyectos. Al importar, los diagramas con un id que ya existe no se pisan sin preguntarte.</p>
          <div className="config__fila">
            <button type="button" className="button" onClick={exportar}>Exportar respaldo</button>
            <button type="button" className="button" disabled={ocupado} onClick={() => selectorArchivo.current?.click()}>Importar respaldo…</button>
            <input ref={selectorArchivo} type="file" accept=".json,application/json" aria-label="Archivo de respaldo" hidden onChange={elegirArchivo} />
          </div>
          {errorArchivo ? <p className="config__nota" role="alert">{errorArchivo}</p> : null}
          {resultado ? <p className="config__nota" role="status">{resultado}</p> : null}
        </>
      ) : (
        <p className="config__nota">Cargando la configuración del hub…</p>
      )}

      {confirmar === 'red' ? (
        <ConfirmDialog
          titulo="Habilitar el acceso desde la red"
          mensaje="El hub escuchará fuera de este equipo y exigirá un token. Cualquiera en tu red que tenga el token podrá ver y cambiar tus diagramas. Se aplica al reiniciar el hub."
          textoConfirmar="Habilitar"
          onConfirmar={() => { setConfirmar(undefined); void guardar({ network: true }); }}
          onCerrar={() => setConfirmar(undefined)}
        />
      ) : null}
      {confirmar === 'token' ? (
        <ConfirmDialog
          titulo="Regenerar el token"
          mensaje="Se crea un token nuevo y el anterior deja de valer cuando reinicies el hub. Tendrás que usar el nuevo en la app y en los agentes."
          textoConfirmar="Regenerar"
          onConfirmar={() => { setConfirmar(undefined); void regenerar(); }}
          onCerrar={() => setConfirmar(undefined)}
        />
      ) : null}
      {conflictos ? (
        <Modal titulo="Diagramas que ya existen" onCerrar={() => setConflictos(undefined)}>
          <p className="modal__text">El respaldo trae diagramas con un id que ya existe en este hub. Todavía no se importó nada.</p>
          <ul className="config__conflictos">
            {conflictos.mensajes.slice(0, MAX_CONFLICTOS_VISIBLES).map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
            {conflictos.mensajes.length > MAX_CONFLICTOS_VISIBLES ? <li>…y {conflictos.mensajes.length - MAX_CONFLICTOS_VISIBLES} más.</li> : null}
          </ul>
          <div className="modal__actions">
            <button type="button" className="button" onClick={() => setConflictos(undefined)}>Cancelar</button>
            <button type="button" className="button" onClick={() => resolverConflictos('skip')}>Dejar los actuales</button>
            <button type="button" className="button button--danger" onClick={() => resolverConflictos('replace')}>Reemplazar</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
