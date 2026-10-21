import { DIAGRAM_ID_PATTERN } from './diagram.js';
import { PROJECT_ID_PATTERN } from './project.js';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** Genera un id de diagrama "`dg_` + 12 caracteres base32" con aleatoriedad criptográfica. */
export function newDiagramId(random: (n: number) => Uint8Array = randomBytes): string {
  return newId('dg_', random);
}

/** Genera un id de proyecto "`pr_` + 12 caracteres base32" con aleatoriedad criptográfica. */
export function newProjectId(random: (n: number) => Uint8Array = randomBytes): string {
  return newId('pr_', random);
}

function newId(prefix: string, random: (n: number) => Uint8Array): string {
  const bytes = random(12);
  let out = prefix;
  for (let i = 0; i < 12; i++) out += BASE32[bytes[i]! & 31];
  return out;
}

export function isDiagramId(value: string): boolean {
  return DIAGRAM_ID_PATTERN.test(value);
}

export function isProjectId(value: string): boolean {
  return PROJECT_ID_PATTERN.test(value);
}

/** Web Crypto existe en Node y en navegadores; se tipa aquí para no depender de DOM ni de Node. */
interface WebCrypto {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

function randomBytes(n: number): Uint8Array {
  const { crypto } = globalThis as unknown as { crypto: WebCrypto };
  return crypto.getRandomValues(new Uint8Array(n));
}
