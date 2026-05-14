import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

function createPNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcBuf = Buffer.concat([typeB, data]);
    let crc = 0xffffffff;
    for (const byte of crcBuf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    crc = (~crc) >>> 0;
    const crcOut = Buffer.allocUnsafe(4);
    crcOut.writeUInt32BE(crc);
    return Buffer.concat([len, typeB, data, crcOut]);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rawRows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rawRows));

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`icons/icon${size}.png`, createPNG(size, 99, 91, 255)); // #635bff
}
console.log('Icons generated.');
