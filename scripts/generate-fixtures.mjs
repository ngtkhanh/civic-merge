// Original synthetic test images; not photographs or evidence of real incidents.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../mocks/images/', import.meta.url);
await mkdir(directory, { recursive: true });
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}
for (const [index, name] of ['pothole-1', 'pothole-2', 'trash', 'flood'].entries()) {
  const width = 320, height = 200;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = [91, 106, 115];
    if (x > 150 && x < 160 && y % 55 < 25) color = [238, 230, 175];
    if (index < 2 && ((x - 100 - index * 12) / 65) ** 2 + ((y - 116) / 38) ** 2 < 1) color = [29 + index * 8, 40, 46];
    if (index === 2 && y > 95 && y < 155 && x > 45 && x < 120) color = x % 22 < 10 ? [200, 210, 190] : [22, 110, 65];
    if (index === 3 && y > 90) color = [24, 105 + y % 12, 155];
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    raw.set(color, offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(new URL(`${name}.png`, directory), png);
}
console.log('Generated 4 original synthetic PNG fixtures.');
