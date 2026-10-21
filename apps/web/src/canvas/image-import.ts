import { MAX_IMAGE_BYTES, sanitizeImageDataUrl } from '@chartsia/core/model';

const MIME_BY_EXTENSION: Record<string, 'image/png' | 'image/jpeg' | 'image/svg+xml'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

/** Convierte y valida una imagen local antes de enviarla al hub. */
export async function readImageFile(file: File): Promise<{ name: string; src: string }> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Cada imagen debe ocupar como máximo ${MAX_IMAGE_BYTES / 1024 / 1024} MiB.`);
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const expected = file.type === 'image/jpg' ? 'image/jpeg' : file.type || MIME_BY_EXTENSION[extension];
  if (!expected || !['image/png', 'image/jpeg', 'image/svg+xml'].includes(expected)) {
    throw new Error('Elige un archivo PNG, JPG o SVG.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer el archivo.'));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const src = sanitizeImageDataUrl(`data:${expected};base64,${base64}`);
  const name = file.name.replaceAll('\\', '/').split('/').at(-1)?.trim().slice(0, 200) || 'Imagen';
  return { name, src };
}
