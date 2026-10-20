const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Claves de orden fraccionario consecutivas compatibles con Excalidraw (`fractional-indexing`):
 * "a0".."az", "b00".."bzz", "c000"…, siempre crecientes en orden lexicográfico.
 */
export function orderKeys(count: number): string[] {
  const keys: string[] = [];
  for (let n = 0; keys.length < count; n++) {
    let rest = n;
    let head = 0;
    let span = 62;
    while (rest >= span) {
      rest -= span;
      head++;
      span *= 62;
    }
    let digits = '';
    for (let i = 0; i <= head; i++) {
      digits = DIGITS[rest % 62]! + digits;
      rest = Math.floor(rest / 62);
    }
    keys.push(String.fromCharCode(97 + head) + digits);
  }
  return keys;
}
