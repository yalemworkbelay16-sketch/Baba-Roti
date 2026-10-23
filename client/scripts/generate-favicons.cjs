const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generate() {
  const publicDir = path.resolve(__dirname, '../public');
  const imgPath = path.join(publicDir, 'baba-roti-logo.png');
  const imgBuffer = fs.readFileSync(imgPath);

  // 1. Generate PNGs at multiple resolutions
  const png16 = await sharp(imgBuffer).resize(16, 16).png().toBuffer();
  const png32 = await sharp(imgBuffer).resize(32, 32).png().toBuffer();
  const png48 = await sharp(imgBuffer).resize(48, 48).png().toBuffer();
  const png64 = await sharp(imgBuffer).resize(64, 64).png().toBuffer();
  const png128 = await sharp(imgBuffer).resize(128, 128).png().toBuffer();
  const png192 = await sharp(imgBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(imgBuffer).resize(512, 512).png().toBuffer();

  // Save standard favicons
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), png32);
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png192);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), png512);

  // 2. Generate valid multi-resolution ICO file containing 16, 32, 48, 64 PNG frames
  const frames = [
    { width: 16, height: 16, buffer: png16 },
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 },
    { width: 64, height: 64, buffer: png64 },
  ];

  const headerSize = 6;
  const entrySize = 16;
  const entriesTotalSize = frames.length * entrySize;
  let offset = headerSize + entriesTotalSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(frames.length, 4); // count

  const entryBuffers = [];
  const imageBuffers = [];

  for (const frame of frames) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(frame.width >= 256 ? 0 : frame.width, 0);
    entry.writeUInt8(frame.height >= 256 ? 0 : frame.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(frame.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset

    entryBuffers.push(entry);
    imageBuffers.push(frame.buffer);
    offset += frame.buffer.length;
  }

  const icoBuffer = Buffer.concat([header, ...entryBuffers, ...imageBuffers]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  console.log('Successfully generated all Baba Roti Café favicons and icon files!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
