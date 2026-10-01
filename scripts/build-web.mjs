// Builds the front end for the iOS and Android app into mobile/www.
//
// The app ships the website's own build (frontend/build.mjs → frontend/dist), unchanged, plus:
//   assets/native.<hash>.js   — Capacitor and src/native.js, bundled by esbuild, with the server address baked in
//   assets/native.<hash>.css  — src/native.css
//   a Content-Security-Policy meta tag that allows exactly that server (the website gets its CSP as a header)
//   viewport-fit=cover, so the page draws under the status bar and home indicator (the CSS pads for them)
//
// Usage:
//   YU_API_ORIGIN=https://yu.example.uz node scripts/build-web.mjs    release: the production server, https only
//   node scripts/build-web.mjs --dev                                   http://localhost:3000, for an emulator with `adb reverse tcp:3000 tcp:3000`
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..');
// The front end is the YU-CRM/frontend repository, checked out here as a submodule
const frontend = join(mobile, 'frontend');
const dist = join(frontend, 'dist');
const www = join(mobile, 'www');
const DEV_ORIGIN = 'http://localhost:3000';
// Plain http is only ever acceptable for a server on the developer's own machine
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

const fail = (msg) => { console.error(`build-web: ${msg}`); process.exit(1); };
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);

function apiOrigin() {
  const dev = process.argv.includes('--dev');
  const raw = dev ? DEV_ORIGIN : process.env.YU_API_ORIGIN;
  if (!raw) fail('set YU_API_ORIGIN to the server the app should use, e.g. YU_API_ORIGIN=https://yu.example.uz (or pass --dev for http://localhost:3000)');
  let url;
  try { url = new URL(raw); } catch { fail(`YU_API_ORIGIN is not a URL: ${raw}`); }
  if (url.pathname !== '/' || url.search || url.hash) fail(`YU_API_ORIGIN must be an origin only, without a path: ${raw}`);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    fail(`YU_API_ORIGIN must use https (http is allowed only for localhost): ${raw}`);
  }
  return url.origin;
}

function buildWebsite() {
  if (!existsSync(join(frontend, 'build.mjs'))) fail('frontend/ is empty; run `git submodule update --init`');
  if (!existsSync(join(frontend, 'node_modules'))) fail('the front end has no dependencies yet; run `npm run frontend:install`');
  const run = spawnSync(process.execPath, ['build.mjs'], { cwd: frontend, stdio: 'inherit' });
  if (run.status !== 0) fail('the website build (frontend/build.mjs) failed');
  if (!existsSync(join(dist, 'index.html'))) fail('frontend/dist/index.html is missing after the website build');
}

async function bundleNative(origin) {
  const out = await build({
    entryPoints: [join(mobile, 'src', 'native.js')],
    bundle: true, format: 'iife', target: 'es2020', minify: true, write: false, legalComments: 'none',
    define: { __YU_API_ORIGIN__: JSON.stringify(origin) },
  });
  return out.outputFiles[0].text;
}

const contentSecurityPolicy = (origin) => [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self'", `connect-src 'self' ${origin}`,
  "object-src 'none'", "base-uri 'none'", "form-action 'self'",
].join('; ');

function replaceOnce(html, find, replace, what) {
  if (!html.includes(find)) fail(`could not find ${what} in index.html; has build.mjs changed its output?`);
  return html.replace(find, replace);
}

const origin = apiOrigin();
buildWebsite();
rmSync(www, { recursive: true, force: true });
cpSync(dist, www, { recursive: true });

const js = await bundleNative(origin);
const css = readFileSync(join(mobile, 'src', 'native.css'), 'utf8');
const names = { js: `native.${hash(js)}.js`, css: `native.${hash(css)}.css` };
writeFileSync(join(www, 'assets', names.js), js);
writeFileSync(join(www, 'assets', names.css), css);

let html = readFileSync(join(www, 'index.html'), 'utf8');
html = replaceOnce(html, '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">', 'the viewport meta tag');
html = replaceOnce(html, '<meta charset="utf-8">',
  `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(origin)}">`, 'the charset meta tag');
// Deferred scripts run in document order: the glue goes first so window.YUNative is there before the app boots
html = replaceOnce(html, '<link rel="stylesheet" href="assets/app.',
  `<script src="assets/${names.js}" defer></script>\n<link rel="stylesheet" href="assets/app.`, 'the app stylesheet link');
html = replaceOnce(html, '</head>', `<link rel="stylesheet" href="assets/${names.css}">\n</head>`, '</head>');
writeFileSync(join(www, 'index.html'), html);

console.log(`www/ built for ${origin}: assets/${names.js} ${(js.length / 1024).toFixed(0)} KB, assets/${names.css}`);
