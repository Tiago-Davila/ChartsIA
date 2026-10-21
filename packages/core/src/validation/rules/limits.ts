import { DEFAULT_MAX_ELEMENTS } from '../../model/enums.js';
import { MAX_DIAGRAM_IMAGE_BYTES, MAX_DIAGRAM_IMAGE_PIXELS, totalImageDataUrlBytes, totalImageRasterPixels } from '../../model/image-data.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

export function checkLimits({ diagram, options }: RuleContext): ValidationError[] {
  const max = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const errors: ValidationError[] = [];
  if (diagram.elements.length > max) {
    errors.push(validationError(
      'LIMIT_EXCEEDED',
      '/elements',
      `El diagrama tendría ${diagram.elements.length} elementos y el máximo es ${max} (incluye grupos).`,
      `Divide el contenido en varios diagramas de como máximo ${max} elementos.`,
    ));
  }
  const imageBytes = totalImageDataUrlBytes(diagram.elements);
  if (imageBytes > MAX_DIAGRAM_IMAGE_BYTES) {
    errors.push(validationError(
      'LIMIT_EXCEEDED',
      '/elements',
      `Las imágenes del diagrama ocupan ${imageBytes} bytes y superan el máximo de ${MAX_DIAGRAM_IMAGE_BYTES / 1024 / 1024} MiB.`,
      'Reduce o elimina imágenes hasta que el total de sus archivos sea como máximo 25 MiB.',
    ));
  }
  const imagePixels = totalImageRasterPixels(diagram.elements);
  if (imagePixels > MAX_DIAGRAM_IMAGE_PIXELS) {
    errors.push(validationError(
      'LIMIT_EXCEEDED',
      '/elements',
      `Las imágenes raster del diagrama declaran ${imagePixels} píxeles y superan el máximo de ${MAX_DIAGRAM_IMAGE_PIXELS / 1_000_000} millones.`,
      'Reduce el tamaño de las imágenes JPG/PNG para que el total no supere 40 millones de píxeles.',
    ));
  }
  return errors;
}
