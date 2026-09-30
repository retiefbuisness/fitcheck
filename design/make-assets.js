// Renders Fit Check's app icon, adaptive icon layers, splash image and Play Store
// graphics from vector art. Run with sharp available:
//   node design/make-assets.js   (NODE_PATH pointing at a folder with sharp installed)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = path.join(ROOT, 'mobile', 'assets', 'images');
const STORE = path.join(ROOT, 'design', 'store');
fs.mkdirSync(STORE, { recursive: true });

const ORANGE_TOP = '#ea580c';
const ORANGE_BOTTOM = '#c2410c';

// Hanger with a check mark, drawn on a 1024 canvas, centred on (512, 512).
function glyph(color, scale) {
  return `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -430)" fill="none" stroke="${color}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M512 380 L512 336 C512 304 562 296 562 252 C562 222 540 200 512 200 C484 200 462 222 462 250" stroke-width="40"/>
    <path d="M512 380 L200 640 L824 640 Z" stroke-width="40"/>
    <path d="M446 540 L494 588 L584 492" stroke-width="42"/>
  </g>`;
}

const background = (w, h) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ORANGE_TOP}"/>
      <stop offset="1" stop-color="${ORANGE_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>`;

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

async function png(file, content, size) {
  await sharp(Buffer.from(content)).resize(size, size).png().toFile(file);
  console.log('wrote', path.relative(ROOT, file));
}

async function main() {
  // Full app icon (square, full bleed).
  await png(path.join(IMAGES, 'icon.png'), svg(1024, 1024, background(1024, 1024) + glyph('#ffffff', 0.9)), 1024);

  // Android adaptive icon layers. Foreground art stays inside the 66% safe zone.
  await png(path.join(IMAGES, 'android-icon-background.png'), svg(1024, 1024, background(1024, 1024)), 1024);
  await png(path.join(IMAGES, 'android-icon-foreground.png'), svg(1024, 1024, glyph('#ffffff', 0.6)), 1024);
  await png(path.join(IMAGES, 'android-icon-monochrome.png'), svg(1024, 1024, glyph('#ffffff', 0.6)), 1024);

  // Splash screen image (shown on the cream/dark splash background).
  await png(path.join(IMAGES, 'splash-icon.png'), svg(1024, 1024, glyph(ORANGE_BOTTOM, 1)), 1024);
  await png(path.join(IMAGES, 'favicon.png'), svg(1024, 1024, background(1024, 1024) + glyph('#ffffff', 0.9)), 48);

  // Play Store listing icon: 512x512, full bleed (Google applies the rounded mask).
  await png(path.join(STORE, 'play-store-icon-512.png'), svg(1024, 1024, background(1024, 1024) + glyph('#ffffff', 0.9)), 512);

  // Play Store feature graphic: 1024x500.
  const feature = svg(
    1024,
    500,
    background(1024, 500) +
      `<g transform="translate(-302 -262)">${glyph('#ffffff', 0.45)}</g>
       <text x="400" y="232" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="92" font-weight="800" letter-spacing="-2">Fit Check</text>
       <text x="404" y="298" fill="#ffffff" fill-opacity="0.92" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="600">Your closet. Your fits. Your people.</text>
       <text x="404" y="350" fill="#ffffff" fill-opacity="0.8" font-family="Segoe UI, Arial, sans-serif" font-size="26">Outfit ideas &amp; ratings with private on-device AI</text>`,
  );
  await sharp(Buffer.from(feature)).png().toFile(path.join(STORE, 'feature-graphic-1024x500.png'));
  console.log('wrote design/store/feature-graphic-1024x500.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
