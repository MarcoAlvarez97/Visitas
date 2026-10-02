// Genera íconos PWA (192, 512, apple-touch 180) con la identidad de RutaVisitas.
// Uso: node scripts/gen-icons.mjs  (o bun scripts/gen-icons.mjs)

import sharp from "sharp"

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#059669"/>
  <g fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M132 372 C 220 372, 220 150, 308 150" stroke-dasharray="2 52" opacity="0.95"/>
    <circle cx="132" cy="372" r="46" fill="#ffffff" stroke="none"/>
    <circle cx="132" cy="372" r="18" fill="#059669" stroke="none"/>
    <path d="M308 96 c -47 0 -84 37 -84 83 c 0 62 84 143 84 143 s 84 -81 84 -143 c 0 -46 -37 -83 -84 -83 z" fill="#ffffff" stroke="#047857" stroke-width="10"/>
    <circle cx="308" cy="180" r="30" fill="#047857" stroke="none"/>
  </g>
</svg>`

const out = "/home/z/my-project/public/icons"
for (const [name, size, pad] of [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
  ["maskable-512.png", 512, 44], // más padding para zona segura maskable
]) {
  const content = pad
    ? svg.replace('<rect width="512" height="512" rx="112"', `<rect x="${pad}" y="${pad}" width="${512 - pad * 2}" height="${512 - pad * 2}" rx="120"`)
    : svg
  await sharp(Buffer.from(content))
    .resize(size, size)
    .png()
    .toFile(`${out}/${name}`)
  console.log("ok", name)
}
