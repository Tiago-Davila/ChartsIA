import { type ReactNode } from 'react';

// Íconos de trazo de la barra lateral, dibujados a mano para no sumar una librería de íconos.

/** Base común: 16 px, trazo del color del texto. */
function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Signo más de "Nuevo". */
export function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>;
}

/** Carpeta de "Proyectos". */
export function FolderIcon() {
  return <Icon><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>;
}

/** Engranaje de "Configuración". */
export function GearIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  );
}

/** Flecha que se gira al plegar o desplegar. */
export function ChevronIcon() {
  return <Icon size={12}><path d="m9 6 6 6-6 6" /></Icon>;
}

/** Hoja de diagrama en blanco. */
export function FileIcon() {
  return <Icon><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Icon>;
}

/** Código, para importar Mermaid. */
export function CodeIcon() {
  return <Icon><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></Icon>;
}

/** Panel lateral, para el botón "Vista" que oculta o muestra la barra. */
export function SidebarIcon() {
  return <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Icon>;
}

/** Flecha para volver atrás. */
export function ArrowLeftIcon() {
  return <Icon><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
}

/** Controles deslizantes de la configuración general. */
export function SlidersIcon() {
  return <Icon><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icon>;
}

/** Enchufe de las conexiones MCP. */
export function PlugIcon() {
  return <Icon><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" /></Icon>;
}

/** Tilde de "Conectado". */
export function CheckIcon() {
  return <Icon><path d="m5 12 5 5 9-10" /></Icon>;
}

/** Dos hojas superpuestas: copiar al portapapeles. */
export function CopyIcon() {
  return <Icon><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Icon>;
}
