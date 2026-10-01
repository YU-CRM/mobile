/* Native glue for the iOS and Android app.

   scripts/build-web.mjs bundles this file (with Capacitor) into www/assets/native.<hash>.js and
   loads it before the app bundle, so window.YUNative exists before the first request. The web
   code meets the app only through window.YUNative (frontend/src/js/api.js, ui.js, state.js, news.js);
   everything else here works on the page from the outside: the Android back button, links that
   leave the app, report photos that need the session, and the splash screen.

   __YU_API_ORIGIN__ is replaced at build time with the server the app talks to. */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

const API_ORIGIN = __YU_API_ORIGIN__;
const TOKEN_KEY = 'session';
// localStorage is wiped with the app, the iOS keychain is not: this mark tells a fresh install
const INSTALL_MARK = 'yu.installed';
// Screens where Back leaves the app instead of going back a step
const ROOT_SCREENS = new Set(['dashboard', 'login']);

const report = (what, err) => console.error(`[YU native] ${what}:`, err);

// ---- The session token, in the Keychain (iOS) or the Keystore-encrypted store (Android).
// It lives only in this closure: page script can ask for a request to be made with it
// (YUNative.fetch) but never read it, so even a script injected into the page could not
// carry a 30-day session off the device.
const SESSION_HEADER = 'X-YU-Session';
// Captured before any app script runs, so the token is never handed to a fetch the page replaced
const baseFetch = window.fetch.bind(window);
let token = null;
async function loadToken() {
  await SecureStorage.setKeyPrefix('yu_');
  // A reinstall must not inherit the previous install's session from the keychain
  if (!localStorage.getItem(INSTALL_MARK)) {
    await SecureStorage.remove(TOKEN_KEY);
    localStorage.setItem(INSTALL_MARK, '1');
  }
  const stored = await SecureStorage.get(TOKEN_KEY, false);
  token = typeof stored === 'string' && stored ? stored : null;
}
const ready = loadToken().catch((err) => { report('could not read the saved session', err); token = null; });

// Writes go through one queue, so a sign-out's remove can never land after the next sign-in's set
let writes = ready;
function setToken(next) {
  const previous = token;
  token = typeof next === 'string' && next ? next : null;
  // Photos loaded for one session are never shown to the next
  if (token !== previous) forgetPhotos();
  const value = token;
  writes = writes.then(() => (value
    ? SecureStorage.set(TOKEN_KEY, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly)
    : SecureStorage.remove(TOKEN_KEY))).catch((err) => report('could not save the session', err));
  return writes;
}

// Requests to the server, with the token. A new session (sign-in, sign-up, password reset)
// comes back in the X-YU-Session header and goes straight to the keychain.
const sentWith = new WeakMap();
async function apiFetch(path, init = {}) {
  if (!isApiPath(path)) throw new Error(`not an API path: ${path}`);
  await ready;
  const sent = token;
  const headers = { ...(init.headers || {}), ...(sent ? { Authorization: `Bearer ${sent}` } : {}) };
  const res = await baseFetch(`${API_ORIGIN}${path}`, { ...init, headers, credentials: 'omit' });
  const issued = res.headers.get(SESSION_HEADER);
  if (issued) await setToken(issued);
  sentWith.set(res, sent);
  return res;
}
// Whether a 401 means this session is over: only if it answered the token still in use
const endedSession = (res) => res.status === 401 && sentWith.get(res) === token;
const forgetSession = () => setToken(null);
async function hasSession() {
  await ready;
  return !!token;
}

window.YUNative = Object.freeze({ apiOrigin: API_ORIGIN, fetch: apiFetch, endedSession, forgetSession, hasSession });

// ---- Report photos: an <img> cannot send the token, so they are fetched and shown as blobs.
// Only same-server /api/ paths are ever fetched, so the token never leaves for another origin.
const photos = new Map();
// Bumped on sign-out: a photo still loading then belongs to the previous account and is dropped
let photoGeneration = 0;
function isApiPath(path) {
  return typeof path === 'string' && path.startsWith('/api/') && !path.startsWith('//');
}
function photoBlobUrl(path) {
  if (!photos.has(path)) {
    const generation = photoGeneration;
    const load = (async () => {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      if (generation !== photoGeneration) { URL.revokeObjectURL(url); throw new Error('signed out while loading'); }
      return url;
    })();
    // A failed photo is retried the next time it is drawn, not cached as broken
    const pending = load.catch((err) => { if (photos.get(path) === pending) photos.delete(path); throw err; });
    photos.set(path, pending);
  }
  return photos.get(path);
}
function forgetPhotos() {
  photoGeneration += 1;
  photos.forEach((pending) => pending.then((url) => URL.revokeObjectURL(url), () => {}));
  photos.clear();
}
function fillPhotos() {
  document.querySelectorAll('img[data-auth-src]:not([data-auth-state])').forEach((img) => {
    const path = img.getAttribute('data-auth-src');
    if (!isApiPath(path)) return;
    img.setAttribute('data-auth-state', 'loading');
    photoBlobUrl(path).then(
      (url) => { img.src = url; img.setAttribute('data-auth-state', 'ok'); },
      (err) => { img.setAttribute('data-auth-state', 'failed'); report(`photo ${path} did not load`, err); },
    );
  });
}
let fillQueued = false;
new MutationObserver(() => {
  if (fillQueued) return;
  fillQueued = true;
  requestAnimationFrame(() => { fillQueued = false; fillPhotos(); });
}).observe(document.documentElement, { childList: true, subtree: true });

async function openPhoto(path, alt) {
  const { esc } = window.YU.ui;
  try {
    const url = await photoBlobUrl(path);
    // modal.open takes its title as HTML
    window.YU.ui.modal.open({
      title: esc(alt),
      body: `<img src="${esc(url)}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;border-radius:16px">`,
      wide: true,
    });
  } catch (err) {
    report(`photo ${path} did not open`, err);
    // fetch() throws a TypeError when the server cannot be reached; anything else is the server's answer
    window.YU.ui.toast(window.YU.tText(err instanceof TypeError ? 'error.offline' : 'error.generic'), 'bad');
  }
}

// ---- Links that leave the app open in the in-app browser; full-size photos open in a modal
document.addEventListener('click', (e) => {
  const link = e.target.closest && e.target.closest('a[target="_blank"]');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (isApiPath(href)) {
    e.preventDefault();
    const img = link.querySelector('img');
    openPhoto(href, (img && img.alt) || '');
  } else if (/^https?:\/\//i.test(href)) {
    e.preventDefault();
    Browser.open({ url: href }).catch((err) => report(`could not open ${href}`, err));
  }
}, true);

// ---- Android Back: close the top layer first, then step back, and leave from a root screen
function closeTopLayer(ui) {
  if (ui.picker && ui.picker.isOpen()) ui.picker.close();
  else if (document.getElementById('ctx-menu')) ui.closeMenu();
  else if (ui.modal.isOpen()) ui.modal.close();
  else if (ui.drawer.isOpen()) ui.drawer.close();
  else return false;
  return true;
}
App.addListener('backButton', ({ canGoBack }) => {
  const YU = window.YU;
  if (!YU || !YU.ui || closeTopLayer(YU.ui)) return;
  if (!canGoBack || ROOT_SCREENS.has(YU.router.parse().name)) {
    App.minimizeApp().catch((err) => report('could not leave the app', err));
    return;
  }
  history.back();
}).catch((err) => report('Back button not available', err));

// ---- native.css fills the strip under the status bar once the page has scrolled
window.addEventListener('scroll', () => {
  document.documentElement.classList.toggle('has-scrolled', window.scrollY > 0);
}, { passive: true });

// ---- While the keyboard is up, the floating tab bar would ride on top of it (the app resizes for the
// keyboard, a phone browser does not): native.css hides it while a text field has focus.
// (A select opens the picker sheet, not the keyboard: frontend/src/js/picker.js.)
const TYPING_FIELD = 'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="button"]):not([type="submit"])';
document.addEventListener('focusin', (e) => {
  if (e.target.matches && e.target.matches(TYPING_FIELD)) document.documentElement.classList.add('is-typing');
});
document.addEventListener('focusout', () => {
  // Focus moving straight to the next field must not flash the tab bar in between
  setTimeout(() => {
    const el = document.activeElement;
    if (!(el && el.matches && el.matches(TYPING_FIELD))) document.documentElement.classList.remove('is-typing');
  }, 0);
});

// ---- The native splash hands over to the page once it has drawn its first frame. The page's own
// boot splash is the same blue, so the handover does not flash.
document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    SplashScreen.hide().catch((err) => report('splash screen did not hide', err));
  }));
});
