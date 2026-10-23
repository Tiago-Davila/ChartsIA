/** Id `dg_…` del diagrama de una dirección `/d/<slug>-<id>` (o la vieja `/d/dg_<id>`). */
export function idDesdeUrl(url: string): string | undefined {
  const match = /\/d\/(?:dg_|[a-z0-9-]*-)([a-z2-7]{12})(?:[/?#]|$)/.exec(url);
  return match ? `dg_${match[1]}` : undefined;
}

/** Expresión para la dirección nueva `/d/<slug>-<parte única>` de un diagrama `dg_…`. */
export function direccionDe(id: string): RegExp {
  return new RegExp(`/d/[a-z0-9-]*-${id.slice(3)}$`);
}
