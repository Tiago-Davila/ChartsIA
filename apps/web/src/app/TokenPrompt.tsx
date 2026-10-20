import { type FormEvent, useState } from 'react';

/** Se muestra cuando el hub responde 401: el hub escucha fuera de loopback y exige token. */
export function TokenPrompt({ onSubmit }: { onSubmit(token: string): void }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <section className="token-prompt" aria-labelledby="token-title">
      <h1 id="token-title">Token de acceso</h1>
      <p>Este hub de ChartsIA exige un token. Abre la URL con <code>#token=…</code> que muestra el hub al arrancar o pégalo aquí.</p>
      <form onSubmit={submit}>
        <label htmlFor="token-input" className="sr-only">Token</label>
        <input id="token-input" type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="button button--primary">Entrar</button>
      </form>
    </section>
  );
}
