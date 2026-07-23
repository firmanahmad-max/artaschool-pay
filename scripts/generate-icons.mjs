/**
 * Generator ikon PWA — menulis PNG langsung (zlib bawaan Node), tanpa
 * dependensi grafis tambahan.
 *
 *   node scripts/generate-icons.mjs
 *
 * Menghasilkan lambang Arta: huruf "A" putih di atas indigo (--primary
 * tema terang, #4F46E5) agar konsisten dengan tanda merek di header.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x4f, 0x46, 0xe5]; // indigo-600
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = pixels(x, y);
      raw[o++] = p[0];
      raw[o++] = p[1];
      raw[o++] = p[2];
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Huruf "A": dua kaki miring + palang. `inset` memberi ruang aman untuk
 * ikon maskable (Android memotong sudut menjadi lingkaran/squircle).
 */
function letterA(size, inset) {
  const pad = size * inset;
  const h = size - pad * 2;
  const cx = size / 2;
  const tebal = Math.max(2, size * 0.11);
  const apexY = pad;
  const baseY = size - pad;
  const halfLebar = h * 0.42;

  return (x, y) => {
    if (y < apexY || y > baseY) return BG;
    const t = (y - apexY) / (baseY - apexY); // 0 di puncak, 1 di dasar
    const kiri = cx - halfLebar * t;
    const kanan = cx + halfLebar * t;
    // kaki miring
    if (Math.abs(x - kiri) < tebal / 2 || Math.abs(x - kanan) < tebal / 2) return FG;
    // palang di 68% tinggi
    const palangY = apexY + (baseY - apexY) * 0.68;
    if (Math.abs(y - palangY) < tebal / 2 && x > kiri && x < kanan) return FG;
    return BG;
  };
}

mkdirSync("public", { recursive: true });

const target = [
  { file: "public/icon-192.png", size: 192, inset: 0.16 },
  { file: "public/icon-512.png", size: 512, inset: 0.16 },
  // maskable: inset lebih besar agar "A" tetap utuh saat dipotong
  { file: "public/icon-maskable-512.png", size: 512, inset: 0.26 },
  { file: "public/apple-touch-icon.png", size: 180, inset: 0.16 },
];

for (const { file, size, inset } of target) {
  writeFileSync(file, png(size, letterA(size, inset)));
  console.log(`  ${file} (${size}x${size})`);
}
console.log("Ikon PWA dibuat.");
