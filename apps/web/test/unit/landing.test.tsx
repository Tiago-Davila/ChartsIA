import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AGENTS } from '../../src/app/agents';
import { Landing, REPO_URL } from '../../src/app/Landing';
import { NewDiagram } from '../../src/app/NewDiagram';

const origin = 'http://127.0.0.1:3333';

describe('pantalla inicial', () => {
  it('muestra el título, Empezar y el enlace para dar una estrella en GitHub', async () => {
    const onStart = vi.fn();
    render(<Landing origin={origin} agents={[]} onStart={onStart} />);
    expect(screen.getByRole('heading', { level: 1, name: 'ChartsIA' })).toBeInTheDocument();
    const github = screen.getByRole('link', { name: 'Star on GitHub' });
    expect(github).toHaveAttribute('href', REPO_URL);
    expect(github).toHaveAttribute('target', '_blank');
    const empezar = screen.getByRole('button', { name: 'Empezar' });
    expect(empezar).toHaveFocus();
    await userEvent.click(empezar);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('Enter empieza aunque el foco no esté en el botón', () => {
    const onStart = vi.fn();
    render(<Landing origin={origin} agents={[]} onStart={onStart} />);
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('muestra las integraciones de los agentes, conectados primero, sin logos', () => {
    render(<Landing origin={origin} agents={[{ id: 1, name: 'claude-code', version: '2.1.0', lastCallAt: '2026-01-02T03:04:00.000Z' }]} onStart={vi.fn()} />);
    const integraciones = screen.getByRole('region', { name: 'Integraciones' });
    expect(within(integraciones).getAllByRole('article')).toHaveLength(AGENTS.length);
    expect(within(screen.getByRole('region', { name: 'Conectados' })).getByRole('article', { name: 'Claude Code (HTTP)' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Habilitados' })).getByRole('article', { name: 'Codex CLI' })).toBeInTheDocument();
    expect(integraciones.querySelector('img')).toBeNull();
  });

  it('el fondo animado es decorativo', () => {
    const { container } = render(<Landing origin={origin} agents={[]} onStart={vi.fn()} />);
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  it('"Empezar" deja abierta la ventana de diagrama en blanco', () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} openBlank />);
    expect(screen.getByRole('dialog', { name: 'Nuevo diagrama' })).toBeInTheDocument();
  });
});
