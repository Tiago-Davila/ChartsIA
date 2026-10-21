import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

export function pngDataUrl(options: { width?: number; height?: number; ancillaryBytes?: number; animated?: boolean } = {}): string {
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)];
  if (options.animated) {
    const animation = Buffer.alloc(8);
    animation.writeUInt32BE(1, 0);
    parts.push(chunk('acTL', animation));
  }
  if (options.ancillaryBytes) {
    parts.push(chunk('tEXt', Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(options.ancillaryBytes, 0x61)])));
  }
  parts.push(chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))), chunk('IEND', Buffer.alloc(0)));
  return `data:image/png;base64,${Buffer.concat(parts).toString('base64')}`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
