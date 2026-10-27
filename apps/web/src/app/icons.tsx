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

/** Flecha hacia arriba sobre una bandeja, para importar un archivo. */
export function UploadIcon() {
  return <Icon><path d="M12 15V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>;
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

/** Tecla Enter, para el botón "Empezar". */
export function EnterIcon() {
  return <Icon><path d="M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4" /></Icon>;
}

/** Marca de GitHub (Octicons de Primer, licencia MIT), solo para enlazar al repositorio. */
export function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
    </svg>
  );
}

/** Lápiz, para importar Excalidraw. */
export function PencilIcon() {
  return <Icon><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></Icon>;
}
