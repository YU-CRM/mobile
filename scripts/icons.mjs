// Draws the app icon and splash screens for Android and iOS from the website's own mark: three people
// around a star (frontend/scripts/brand-mark.mjs, the front end checked out as a submodule), white with a pale teal star on the union
// blue, with the same soft glow as the app's background (frontend/src/styles/layout.css, body).
//
// Every image Capacitor generated is replaced at its own size, so the script follows whatever
// densities the native projects contain. Run it after `npx cap add`, and again if the mark changes:
//   node scripts/icons.mjs
//
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..');
const { PALETTES, markAt } = await import(pathToFileURL(join(mobile, 'frontend', 'scripts', 'brand-mark.mjs')).href);

const BLUE = '#3D66F5';
const BLUE_LIGHT = '#6C8CFF';
const BLUE_DEEP = '#2B4BD8';

const ground = (w, h) => `
  <defs>
    <radialGradient id="g1" cx="15%" cy="-10%" r="75%"><stop offset="0" stop-color="${BLUE_LIGHT}"/><stop offset="1" stop-color="${BLUE_LIGHT}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="100%" cy="100%" r="70%"><stop offset="0" stop-color="${BLUE_DEEP}"/><stop offset="1" stop-color="${BLUE_DEEP}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${BLUE}"/><rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/>`;
// The mark centred in a w×h canvas, `span` pixels across
const sparkle = (w, h, span) => markAt(w, h, span, PALETTES.blue);
// Android 13+ themed icons want a single-colour mask of the mark
const mono = (w, h, span) => markAt(w, h, span, { people: '#fff', star: '#fff' });
const svg = (w, h, body, clip = '') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${clip ? `<clipPath id="c">${clip}</clipPath><g clip-path="url(#c)">${body}</g>` : body}</svg>`);

const DRAW = {
  // Full icon for app stores and pre-Android-8 launchers: ground and mark (seven tenths of the width)
  icon: (w, h) => svg(w, h, ground(w, h) + sparkle(w, h, w * 0.7)),
  // Legacy launchers get the shape drawn in; adaptive ones (Android 8+) mask the layers themselves
  legacy: (w, h) => svg(w, h, ground(w, h) + sparkle(w, h, w * 0.7), `<rect width="${w}" height="${h}" rx="${w * 0.22}"/>`),
  round: (w, h) => svg(w, h, ground(w, h) + sparkle(w, h, w * 0.66), `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}"/>`),
  // Adaptive layers are 108dp with a 66dp safe zone: the mark stays well inside it
  foreground: (w, h) => svg(w, h, sparkle(w, h, w * 0.5)),
  monochrome: (w, h) => svg(w, h, mono(w, h, w * 0.5)),
  background: (w, h) => svg(w, h, ground(w, h)),
  splash: (w, h) => svg(w, h, ground(w, h) + sparkle(w, h, Math.min(w, h) * 0.24)),
  // iOS letterboxes the splash with aspect-fill, so the mark is sized against the long side
  splashIos: (w, h) => svg(w, h, ground(w, h) + sparkle(w, h, Math.max(w, h) * 0.17)),
};

async function redraw(file, kind, { opaque = false } = {}) {
  const { width, height } = await sharp(file).metadata();
  let image = sharp(DRAW[kind](width, height)).png();
  // The App Store rejects an icon with an alpha channel
  if (opaque) image = image.flatten({ background: BLUE }).removeAlpha();
  writeFileSync(file, await image.toBuffer());
  return `${kind} ${width}×${height}`;
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const androidRes = join(mobile, 'android', 'app', 'src', 'main', 'res');
const iosAssets = join(mobile, 'ios', 'App', 'App', 'Assets.xcassets');
const ANDROID_KIND = { 'ic_launcher.png': 'legacy', 'ic_launcher_round.png': 'round', 'ic_launcher_foreground.png': 'foreground', 'splash.png': 'splash' };

const done = [];
for (const file of walk(androidRes)) {
  const name = file.split(/[\\/]/).pop();
  if (ANDROID_KIND[name]) done.push(await redraw(file, ANDROID_KIND[name]));
}
// The adaptive icon's background and monochrome layers: one PNG per density, next to each foreground
for (const file of walk(androidRes).filter((f) => f.endsWith('ic_launcher_foreground.png'))) {
  const { width, height } = await sharp(file).metadata();
  writeFileSync(file.replace('ic_launcher_foreground.png', 'ic_launcher_background.png'), await sharp(DRAW.background(width, height)).png().toBuffer());
  writeFileSync(file.replace('ic_launcher_foreground.png', 'ic_launcher_monochrome.png'), await sharp(DRAW.monochrome(width, height)).png().toBuffer());
  done.push(`background+monochrome ${width}×${height}`);
}
const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <!-- Android 13+ themed icons tint this single-colour mask of the mark -->
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) writeFileSync(join(androidRes, 'mipmap-anydpi-v26', name), ADAPTIVE);
writeFileSync(join(androidRes, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLUE}</color>\n</resources>\n`);

for (const file of walk(iosAssets).filter((f) => f.endsWith('.png'))) {
  done.push(await redraw(file, file.includes('AppIcon') ? 'icon' : 'splashIos', { opaque: true }));
}
console.log(`icons: ${done.length} images\n  ${done.join('\n  ')}`);
