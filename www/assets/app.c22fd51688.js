/* js/constants.js */
/* Static labels and allow-lists shared by all screens. The server keeps the same lists in server/src/core/enums.ts. */
window.YU = window.YU || {};
// Role labels live in the locale catalogues; YU.roleName() reads them (see state.js).
YU.ROLE_IDS = ['volunteer', 'coordinator', 'leader', 'admin'];
// Colour tones that have a .tone-* class in the stylesheet; anything else renders as slate
YU.TONES = ['violet', 'coral', 'green', 'teal', 'blue', 'pink', 'gold', 'navy', 'slate'];
// Asia/Tashkent is UTC+5 all year (no daylight saving), so a fixed offset is exact
YU.TZ_OFFSET_MIN = 300;
// The domain in email placeholders while sign-up is not limited to one domain
YU.EXAMPLE_EMAIL_DOMAIN = 'example.com';
// News and reward categories are stored as these values — the wording the server seeds — and
// shown through the catalogue (YU.newsCategoryLabel / YU.rewardCategoryLabel in state.js).
// Forms offer them as option values, so a post written in any language files under the same category.
YU.NEWS_CATEGORIES = { 'Объявления': 'announcements', 'События': 'events', 'Итоги': 'results', 'Студсоюз': 'union' };
YU.REWARD_CATEGORIES = { 'Мерч': 'merch', 'Опыт': 'experience', 'Привилегии': 'privileges', 'Сертификаты': 'certificates' };

;
/* js/i18n.js */
/* Locale: catalogs, t(), plurals and every Intl formatter the interface needs.

   Catalogs are plain JSON fetched at boot from assets/i18n/<locale>.json. A value is
   either a string or, for anything counted, an object keyed by CLDR plural category
   ({ one, few, many, other }) — which categories exist differs by language, so the
   lookup asks Intl.PluralRules rather than assuming Russian's three forms.

   t() escapes the values it interpolates, so callers pass raw text, not esc()'d text. */
(function () {
  const LOCALES = [
    { id: 'uz-Latn', label: 'Oʻzbekcha', short: 'UZ' },
    { id: 'uz-Cyrl', label: 'Ўзбекча', short: 'ЎЗ' },
    { id: 'ru', label: 'Русский', short: 'RU' },
    { id: 'en', label: 'English', short: 'EN' },
  ];
  const IDS = LOCALES.map((l) => l.id);
  const DEFAULT = 'uz-Latn';
  // A key missing from one catalog is looked up in these, in order, before the key itself shows.
  const FALLBACK = { 'uz-Cyrl': ['uz-Latn', 'ru'], 'uz-Latn': ['ru'], ru: ['uz-Latn'], en: ['uz-Latn', 'ru'] };
  const STORE_KEY = 'yu.locale';
  const TZ = 'Asia/Tashkent';

  const catalogs = Object.create(null);
  let current = DEFAULT;

  // build.mjs fingerprints each catalogue and lists them here, so /assets can stay immutable.
  const MANIFEST = (() => {
    const el = document.querySelector('meta[name="yu-i18n"]');
    try { return el ? JSON.parse(el.content) : {}; } catch (_) { return {}; }
  })();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Formatters are expensive to build, so one set per locale is kept alive.
  const cache = Object.create(null);
  function formatters(id) {
    if (cache[id]) return cache[id];
    const d = (opts) => new Intl.DateTimeFormat(id, { timeZone: TZ, ...opts });
    cache[id] = {
      plural: new Intl.PluralRules(id),
      number: new Intl.NumberFormat(id),
      rel: new Intl.RelativeTimeFormat(id, { numeric: 'auto' }),
      dayMonth: d({ day: 'numeric', month: 'short' }),
      dayMonthFull: d({ day: 'numeric', month: 'long' }),
      dayMonthYear: d({ day: 'numeric', month: 'short', year: 'numeric' }),
      time: d({ hour: '2-digit', minute: '2-digit', hour12: false }),
    };
    if (id === 'uz-Latn' && lacksMonthNames(id)) Object.assign(cache[id], uzLatnFormatters());
    return cache[id];
  }

  // Google Chrome reports Uzbek (Latin) as supported but ships none of its data, so it prints
  // dates as "M10 7", relative times as "-2 d" or "tomorrow" and numbers English-style. Edge and
  // Node have the data. Where it is missing, these rebuild CLDR's own uz output — "7-okt",
  // "7-oktabr", "7-okt, 2026", "2 kun oldin", "1 234,5" — so every browser reads the same.
  const lacksMonthNames = (id) => /\d/.test(new Intl.DateTimeFormat(id, { month: 'short' }).format(new Date(Date.UTC(2026, 9, 15))));
  const UZ_LATN = {
    months: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
    monthsLong: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    // Per unit: [value -1, 0, +1] said in words (numeric: 'auto'), then the past and future patterns
    rel: {
      minute: [null, 'shu daqiqada', null, '{n} daqiqa oldin', '{n} daqiqadan keyin'],
      hour: [null, 'shu soatda', null, '{n} soat oldin', '{n} soatdan keyin'],
      day: ['kecha', 'bugun', 'ertaga', '{n} kun oldin', '{n} kundan keyin'],
    },
  };
  function uzLatnFormatters() {
    // Day, month and year numbers in Tashkent time, read from a locale every runtime has
    const numeric = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' });
    const dmy = (date) => Object.fromEntries(numeric.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
    const date = (pattern) => ({ format: (value) => pattern(dmy(value)) });
    const grouped = new Intl.NumberFormat('en-US');
    const number = { format: (n) => grouped.format(n).replace(/[,.]/g, (c) => (c === ',' ? ' ' : ',')) };
    const english = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const rel = {
      format(value, unit) {
        const words = UZ_LATN.rel[unit];
        if (!words) return english.format(value, unit);
        if (Math.abs(value) <= 1 && words[value + 1]) return words[value + 1];
        return words[value < 0 ? 3 : 4].replace('{n}', number.format(Math.abs(value)));
      },
    };
    return {
      number,
      rel,
      dayMonth: date(({ day, month }) => `${day}-${UZ_LATN.months[month - 1]}`),
      dayMonthFull: date(({ day, month }) => `${day}-${UZ_LATN.monthsLong[month - 1]}`),
      dayMonthYear: date(({ day, month, year }) => `${day}-${UZ_LATN.months[month - 1]}, ${year}`),
    };
  }

  function lookup(key) {
    const chain = [current, ...(FALLBACK[current] || []), DEFAULT];
    for (const id of chain) {
      const c = catalogs[id];
      if (c && c[key] !== undefined && c[key] !== '') return c[key];
    }
    return undefined;
  }

  // {name} is replaced by the param; numbers are grouped for the locale. Strings are
  // escaped for the HTML sinks that nearly every screen uses — see text() for the rest.
  function interpolate(text, params, escapeStrings) {
    if (!params) return text;
    return String(text).replace(/\{(\w+)\}/g, (whole, name) => {
      if (!(name in params)) return whole;
      const v = params[name];
      if (typeof v === 'number') return formatters(current).number.format(v);
      return escapeStrings ? esc(v) : String(v ?? '');
    });
  }

  function entry(key, params) {
    let value = lookup(key);
    // A missing key shows as the key: visible in the interface and greppable in the catalogs.
    if (value === undefined) return undefined;
    if (value && typeof value === 'object') {
      const n = params && (params.count !== undefined ? params.count : params.n);
      const category = formatters(current).plural.select(Math.abs(Number(n) || 0));
      value = value[category] !== undefined ? value[category] : value.other;
    }
    return value;
  }

  function t(key, params) {
    const value = entry(key, params);
    return value === undefined ? key : interpolate(value, params, true);
  }

  // For sinks that are not HTML — toast() and anything else writing textContent. Escaping
  // there would show a name like "Ra'no" as "Ra&#39;no", so params go in as they are.
  function text(key, params) {
    const value = entry(key, params);
    return value === undefined ? key : interpolate(value, params, false);
  }

  // Reference data — departments, levels, badges, categories, seasons — ships with Russian
  // wording (server/src/db/migrations/005_reference_refresh.sql), and the ru catalogue holds
  // that same wording under ref.* keys. While a stored value is still the shipped one, it reads
  // in the current language; once an admin has written their own, it shows exactly as typed.
  // ru is always loaded: it is the current locale or in every fallback chain.
  function ref(key, stored) {
    const shipped = catalogs.ru && catalogs.ru[key];
    if (typeof shipped !== 'string' || shipped !== stored) return stored;
    const value = lookup(key);
    return typeof value === 'string' ? value : stored;
  }
  // The same for vocabularies stored by value rather than by id: finds the ref key under
  // prefix whose shipped wording is the stored value.
  function refByValue(prefix, stored) {
    const ru = catalogs.ru;
    if (!ru || typeof stored !== 'string') return stored;
    const key = Object.keys(ru).find((k) => k.startsWith(prefix) && ru[k] === stored);
    return key ? ref(key, stored) : stored;
  }

  // People's names are stored as typed, mostly in Cyrillic. Readers of the Latin-script interfaces
  // see them in Latin letters: Uzbek Latin spelling for uz-Latn (Axmedov), the familiar English
  // one for en (Akhmedov). The stored name never changes; Cyrillic interfaces show it as typed.
  const LATIN = {
    'uz-Latn': { х: 'x', ў: 'oʻ', ғ: 'gʻ', ъ: 'ʼ', ы: 'i' },
    en: { х: 'kh', ў: 'o', ғ: 'g', ъ: '', ы: 'y' },
  };
  const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ҳ: 'h' };
  const VOWEL = /[аеёиоуыэюяў]/i;
  function toLatin(name, scheme) {
    const chars = [...name];
    let out = '';
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i], lower = ch.toLowerCase(), prev = chars[i - 1] || '';
      let lat, width = 1;
      // дж is one sound: Джавохир → Javoxir
      if (lower === 'д' && (chars[i + 1] || '').toLowerCase() === 'ж') { lat = 'j'; width = 2; }
      // е says "ye" at the start of a word and after a vowel or a sign: Абдуллаева → Abdullayeva
      else if (lower === 'е') lat = !/\p{L}/u.test(prev) || VOWEL.test(prev) || /[ьъ]/i.test(prev) ? 'ye' : 'e';
      else lat = scheme[lower] ?? CYR[lower];
      if (lat === undefined) { out += ch; continue; }
      const next = chars[i + width] || '';
      // A capital stays a capital; inside a word written in capitals (a capital before or after it)
      // every letter of the Latin spelling is a capital: ЮЛИЯ → YULIYA, not YULIYa
      if (ch !== lower && lat) lat = /\p{Lu}/u.test(next) || /\p{Lu}/u.test(prev) ? lat.toUpperCase() : lat[0].toUpperCase() + lat.slice(1);
      out += lat;
      i += width - 1;
    }
    return out;
  }
  const personName = (name) => {
    const scheme = LATIN[current];
    return scheme && typeof name === 'string' && /[Ѐ-ӿ]/.test(name) ? toLatin(name, scheme) : name;
  };

  // Activity recorded before message keys existed is a finished Russian sentence. The ru catalogue holds
  // the same sentences as templates, so a stored sentence is matched back to its key and params and read
  // in the current language. Russian past tense agrees with the actor ("Опубликовала" from a woman), so a
  // verb ending in -л also matches its -ла form. A sentence that matches nothing shows as it was stored.
  const patterns = Object.create(null);
  const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function patternsFor(prefix) {
    if (patterns[prefix]) return patterns[prefix];
    const list = [];
    for (const [key, value] of Object.entries(catalogs.ru || {})) {
      if (!key.startsWith(prefix) || key.endsWith('.target')) continue;
      for (const form of typeof value === 'string' ? [value] : Object.values(value)) {
        const names = [];
        const body = form.split(/(\{\w+\})/).map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (m) { names.push(m[1]); return '(.+?)'; }
          return reEscape(part).replace(/([а-яё]+л)(?=[\s,.:;!?»]|$)/giu, '$1(?:а)?');
        }).join('');
        list.push({ key, names, re: new RegExp(`^${body}$`, 'su') });
      }
    }
    return (patterns[prefix] = list);
  }
  const legacyCache = new Map();
  function legacy(prefix, text) {
    if (typeof text !== 'string' || !text || !catalogs.ru) return null;
    const cacheKey = `${prefix}\u0000${text}`;
    if (legacyCache.has(cacheKey)) return legacyCache.get(cacheKey);
    let found = null;
    for (const p of patternsFor(prefix)) {
      const hit = p.re.exec(text);
      if (!hit) continue;
      const params = Object.fromEntries(p.names.map((n, i) => {
        const v = hit[i + 1];
        return [n, n === 'count' && /^\d[\d\s]*$/.test(v) ? Number(v.replace(/\s/g, '')) : v];
      }));
      found = { key: p.key, params };
      break;
    }
    legacyCache.set(cacheKey, found);
    return found;
  }

  async function load(id) {
    if (catalogs[id]) return true;
    try {
      const res = await fetch(`assets/i18n/${MANIFEST[id] || `${id}.json`}`, { headers: { accept: 'application/json' } });
      if (!res.ok) return false;
      catalogs[id] = await res.json();
      return true;
    } catch (_) {
      return false;
    }
  }

  const stored = () => {
    try { return localStorage.getItem(STORE_KEY); } catch (_) { return null; }
  };
  const remember = (id) => {
    try { localStorage.setItem(STORE_KEY, id); } catch (_) { /* private windows and blocked storage */ }
  };

  // Account preference, then this browser's choice, then what the browser asks for, then the installation default.
  function resolve(accountLocale, installDefault) {
    const wanted = [accountLocale, stored(), ...(navigator.languages || [navigator.language || ''])];
    for (const raw of wanted) {
      if (!raw) continue;
      const exact = IDS.find((id) => id.toLowerCase() === String(raw).toLowerCase());
      if (exact) return exact;
      // "uz", "uz-UZ" and "ru-RU" all resolve to the locale they are written in
      const base = String(raw).toLowerCase().split('-')[0];
      if (base === 'uz') return 'uz-Latn';
      const near = IDS.find((id) => id.toLowerCase().split('-')[0] === base);
      if (near) return near;
    }
    return IDS.includes(installDefault) ? installDefault : DEFAULT;
  }

  // Resolves to the language actually in use: the one asked for, or the default when its catalogue
  // could not be fetched (a stale asset after a deploy, a flaky connection)
  async function apply(id) {
    if (!IDS.includes(id)) id = DEFAULT;
    if (!(await load(id)) && id !== DEFAULT) {
      console.warn(`[i18n] could not load ${id}, staying with ${DEFAULT}`);
      id = DEFAULT;
      await load(id);
    }
    // Whatever the fallback chain may need, so a partial catalog never shows raw keys
    for (const next of FALLBACK[id] || []) await load(next);
    current = id;
    document.documentElement.setAttribute('lang', id);
    return id;
  }

  YU.i18n = {
    locales: LOCALES,
    ids: IDS,
    current: () => current,
    t,
    text,
    load,
    resolve,
    apply,
    remember,
    ref,
    refByValue,
    personName,
    legacy,
    fmt: () => formatters(current),
    // Switching re-renders every screen; the account keeps the choice when signed in.
    set: async (id) => {
      if (id === current) return current;
      const got = await apply(id);
      if (got !== id) {
        // The choice is neither kept nor saved to the account: it would only come back broken
        if (YU.ui && YU.ui.toast) YU.ui.toast(YU.tText('error.localeLoad'), 'bad');
        YU.emit('change');
        return current;
      }
      remember(id);
      if (YU.state && YU.state.session && YU.state.session.loggedIn && YU.actions && YU.actions.setLocale) {
        YU.actions.setLocale(id).then((r) => { if (r && !r.ok && YU.ui && YU.ui.toast) YU.ui.toast(r.error, 'bad'); });
      }
      YU.emit('change');
      return current;
    },
  };
  YU.t = t;
  // Same lookup, but for textContent sinks such as toast(), where an escaped
  // apostrophe would show up as "Ra&#39;no" instead of "Ra'no".
  YU.tText = text;
})();

;
/* js/theme.js */
/* Light, dark, or follow the system.

   Three states, not two. "System" is the default and a real choice people come back to,
   so the control cycles light → dark → system rather than flipping a switch.

   Only an explicit choice writes data-theme onto <html>; "system" removes it and lets the
   prefers-color-scheme block in theme.css decide. That is why the dark rules are guarded
   with :not([data-theme="light"]) — so choosing Light on a dark machine actually sticks.

   The choice is per-device, in localStorage, and deliberately not synced to the account:
   a phone read at night and a desktop in a bright office want different answers. */
(function () {
  const MODES = ['light', 'dark', 'system'];
  const ICON = { light: 'sun', dark: 'moon', system: 'monitor' };
  const STORE_KEY = 'yu.theme';

  const stored = () => {
    try { return localStorage.getItem(STORE_KEY); } catch (_) { return null; }
  };
  const remember = (mode) => {
    try {
      if (mode === 'system') localStorage.removeItem(STORE_KEY);
      else localStorage.setItem(STORE_KEY, mode);
    } catch (_) { /* private windows and blocked storage */ }
  };

  let mode = MODES.includes(stored()) ? stored() : 'system';

  const systemPrefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // What is actually on screen, which is what the icon and the label should describe
  const resolved = () => (mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode);

  function paint() {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
  }

  // Following the system means following it as it changes, not only at boot.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (mode === 'system' && YU.emit) YU.emit('change'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  YU.theme = {
    modes: MODES,
    current: () => mode,
    resolved,
    icon: () => ICON[mode],
    set(next) {
      if (!MODES.includes(next) || next === mode) return mode;
      mode = next;
      paint();
      remember(next);
      YU.emit('change');
      return mode;
    },
    cycle() {
      return YU.theme.set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    },
  };

  // Stamp before first paint rather than waiting for a screen to render
  paint();
})();

;
/* js/prefs.js */
/* Per-device preferences beyond the theme: the screen the app opens on.

   Kept in localStorage like the theme, for the same reason: the phone someone checks for
   missions between classes and the desktop a coordinator reviews on want different answers,
   so the choice is deliberately not synced to the account. */
(function () {
  const START = [
    { id: 'dashboard', path: '#/', key: 'nav.dashboard', icon: 'layout-dashboard' },
    { id: 'missions', path: '#/missions', key: 'nav.missions', icon: 'clipboard-list' },
    { id: 'news', path: '#/news', key: 'nav.news', icon: 'newspaper' },
    { id: 'rating', path: '#/rating', key: 'nav.rating', icon: 'trophy' },
  ];
  const DEFAULT = 'dashboard';
  const STORE_KEY = 'yu.start';

  const stored = () => {
    try { return localStorage.getItem(STORE_KEY); } catch (_) { return null; }
  };
  const remember = (id) => {
    try {
      if (id === DEFAULT) localStorage.removeItem(STORE_KEY);
      else localStorage.setItem(STORE_KEY, id);
    } catch (_) { /* private windows and blocked storage */ }
  };
  const known = (id) => START.some((s) => s.id === id);

  YU.prefs = {
    startScreens: START,
    start: () => (known(stored()) ? stored() : DEFAULT),
    startPath: () => START.find((s) => s.id === YU.prefs.start()).path,
    setStart(id) {
      if (!known(id)) return YU.prefs.start();
      remember(id);
      if (YU.emit) YU.emit('change');
      return id;
    },
  };
})();

;
/* js/api.js */
/* Server API client. JSON with the X-YU header the server requires on every write.
   Never throws: every call resolves to { ok: true, ...data } or { ok: false, error, code?, status? }.
   The website calls its own origin and is signed in by its HttpOnly cookie. The iOS and Android app
   (mobile/) runs this same code from a local origin; its requests go through window.YUNative, which
   knows the server's address and keeps the session token in the device keychain. */
window.YU = window.YU || {};
(function () {
  const REQUEST_TIMEOUT_MS = 20000;
  // A 10 MB photo over a phone connection needs far longer than a JSON call
  const UPLOAD_TIMEOUT_MS = 120000;

  async function request(method, path, body) {
    const native = window.YUNative || null;
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') headers['X-YU'] = '1';
    // The server answers (errors, emails) in the language this screen is in
    const locale = YU.i18n && YU.i18n.current && YU.i18n.current();
    if (locale) headers['X-YU-Locale'] = locale;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isForm ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    const init = { method, headers, signal: controller.signal, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) };
    let res;
    try {
      // The app's requests go through its native layer, which adds the token without handing it to this code
      res = native ? await native.fetch(`/api${path}`, init) : await fetch(`/api${path}`, { ...init, credentials: 'same-origin' });
    } catch (e) {
      return { ok: false, error: YU.tText('error.offline'), code: 'network' };
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    // A 401 on anything but the login form means the session ended (expired, logged out elsewhere, blocked).
    // In the app, only if it answered the token still in use: one sent before signing out and in again is the old session's.
    if (res.status === 401 && path !== '/auth/login' && (!native || native.endedSession(res)) && YU.api.onSessionLost) YU.api.onSessionLost();
    if (!data || typeof data !== 'object') {
      return { ok: false, error: res.ok ? YU.t('error.badResponse') : YU.t('error.serverStatus', { status: res.status }), status: res.status };
    }
    if (!res.ok || data.ok === false) return { ok: false, error: data.error || YU.t('error.generic'), code: data.code, status: res.status, field: data.field };
    return data;
  }

  YU.api = {
    get: (path) => request('GET', path),
    post: (path, body = {}) => request('POST', path, body),
    patch: (path, body = {}) => request('PATCH', path, body),
    put: (path, body = {}) => request('PUT', path, body),
    del: (path, body) => request('DELETE', path, body),
    upload: (path, formData) => request('POST', path, formData),
    onSessionLost: null,
  };
})();

;
/* js/state.js */
/* App state, permissions and selectors. The data comes from the server (GET /api/snapshot, already filtered for the
   logged-in user's role); YU.emit('change') re-renders the current screen. YU.actions live in actions.js. */
(function () {
  // Server-corrected clock: skew is (server time - browser time), set when data arrives from the server
  YU.clock = { skew: 0 };
  YU.now = () => new Date(Date.now() + YU.clock.skew);

  // Everything that comes from the snapshot; replaced as a whole on every reload
  const DATA_KEYS = ['users', 'missions', 'submissions', 'news', 'liked', 'rewards', 'redemptions', 'transactions', 'notifications',
    'audit', 'departments', 'badges', 'levels', 'settings', 'analytics', 'org'];
  const emptyData = () => ({
    users: [], missions: [], submissions: [], news: [], liked: [], rewards: [], redemptions: [], transactions: [], notifications: [],
    audit: [], departments: [], badges: [], levels: [], analytics: null,
    settings: { registrationOpen: true, allowedDomain: '', maxActiveMissions: 3, latePenaltyPct: 20, maxMissionCoins: 100, defaultLanguage: 'uz-Latn' },
  });

  YU.state = {
    session: { userId: null, loggedIn: false },
    org: { university: 'Inha University in Tashkent', semester: '', semesterStart: new Date().toISOString() },
    registration: { open: true, domain: '' },
    version: 0,
    ...emptyData(),
    ui: {},             // per-screen UI state (filters, tabs) — screens read/write YU.state.ui.<screen>
  };

  const listeners = new Set();
  YU.subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  // One listener that throws must not stop the others from hearing about the change
  YU.emit = (what = 'change') => listeners.forEach((fn) => { try { fn(what); } catch (err) { console.error('[listener]', err); } });

  // ---- Reference data in the reader's language
  // Departments, levels, badges and reward categories ship with Russian wording. Each display
  // field becomes a getter that asks the catalogue on every read (so a language switch needs no
  // reload) and falls back to the stored text once an admin has renamed the row. The stored text
  // stays on row.raw for the edit forms: saving a form must never write a translation back.
  const localise = (row, fields) => {
    const raw = {};
    Object.entries(fields).forEach(([field, show]) => {
      raw[field] = row[field];
      Object.defineProperty(row, field, { enumerable: true, configurable: true, get: () => show(raw[field]) });
    });
    Object.defineProperty(row, 'raw', { value: raw, enumerable: false });
  };
  const ref = (key) => (stored) => YU.i18n.ref(key, stored);
  // The row as it is stored — what an edit form must show and send back, never a translation
  YU.sourceOf = (row) => (row ? { ...row, ...(row.raw || {}) } : row);
  // Params of a logged event or notification read like the rest of the page: a person's name in the
  // viewer's script, and a mission, news post, reward or badge named by its original title under its
  // title in the viewer's language
  let titleIndex = null, titleSource = [];
  const localTitle = (title) => {
    const lists = [YU.state.missions, YU.state.news, YU.state.rewards, YU.state.badges];
    if (!titleIndex || lists.some((list, i) => list !== titleSource[i])) {
      titleSource = lists; titleIndex = new Map();
      lists.forEach((list) => (list || []).forEach((row) => { const raw = row.raw && row.raw.title; if (raw && !titleIndex.has(raw)) titleIndex.set(raw, row); }));
    }
    const row = titleIndex.get(title);
    return row ? row.title : title;
  };
  YU.activityParams = (p) => {
    const out = { ...(p || {}) };
    if (typeof out.name === 'string') out.name = YU.i18n.personName(out.name);
    if (typeof out.title === 'string') out.title = localTitle(out.title);
    return out;
  };
  // Plain text: callers escape it like any other stored value
  YU.newsCategoryLabel = (c) => (YU.NEWS_CATEGORIES[c] ? YU.tText(`news.category.${YU.NEWS_CATEGORIES[c]}`) : c);
  YU.rewardCategoryLabel = (c) => (YU.REWARD_CATEGORIES[c] ? YU.tText(`adminContent.rewards.cat.${YU.REWARD_CATEGORIES[c]}`) : c);
  // "Осень 2026": the season is reference vocabulary, the year is not
  const semesterName = (stored) => {
    const m = /^(\S+)\s+(\d{4})$/.exec(stored || '');
    const season = m ? YU.i18n.refByValue('ref.season.', m[1]) : null;
    return m && season !== m[1] ? YU.tText('ref.semester', { season, year: m[2] }) : stored;
  };
  // The server sends each chart week as its Monday (YYYY-MM-DD); the label is drawn per language
  const weekLabel = (day) => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? YU.i18n.fmt().dayMonth.format(new Date(`${day}T00:00:00+05:00`)) : day);
  // What people wrote — missions, news, rewards — comes with a translation per language from the
  // server (row.translations); a language without one shows the original
  const translated = (row, field = null) => (stored) => {
    const t = row.translations && row.translations[YU.i18n.current()];
    const v = t ? t[field] : undefined;
    return v === undefined || v === null || (field === 'title' && !v) ? stored : v;
  };
  const translatedFields = (row, fields) => Object.fromEntries(Object.entries(fields).map(([field, from]) => [field, translated(row, from)]));
  function localiseSnapshot(data) {
    (data.departments || []).forEach((d) => localise(d, { name: ref(`ref.dept.${d.id}.name`), desc: ref(`ref.dept.${d.id}.desc`) }));
    (data.levels || []).forEach((l) => localise(l, { name: ref(`ref.level.${l.id}`) }));
    (data.badges || []).forEach((b) => localise(b, { title: ref(`ref.badge.${b.id}.title`), desc: ref(`ref.badge.${b.id}.desc`) }));
    (data.missions || []).forEach((m) => localise(m, translatedFields(m, { title: 'title', description: 'description', location: 'location', requirements: 'requirements' })));
    (data.news || []).forEach((n) => localise(n, translatedFields(n, { title: 'title', excerpt: 'excerpt', body: 'body' })));
    // A reward's description travels as desc but is stored, and translated, as description
    (data.rewards || []).forEach((r) => localise(r, { category: YU.rewardCategoryLabel, ...translatedFields(r, { title: 'title', desc: 'description' }) }));
    (data.users || []).forEach((u) => localise(u, { name: (stored) => YU.i18n.personName(stored) }));
    if (data.org) localise(data.org, { semester: semesterName });
    if (data.analytics && Array.isArray(data.analytics.weeks)) {
      const days = data.analytics.weeks;
      Object.defineProperty(data.analytics, 'weeks', { enumerable: true, configurable: true, get: () => days.map(weekLabel) });
    }
  }

  // ---- Loading from the server
  YU.applySnapshot = (snap) => {
    YU.clock.skew = new Date(snap.serverNow).getTime() - Date.now();
    const data = {};
    DATA_KEYS.forEach((k) => { if (snap[k] !== undefined) data[k] = snap[k]; });
    localiseSnapshot(data);
    Object.assign(YU.state, data, { session: { userId: snap.me, loggedIn: true }, version: snap.version });
  };
  YU.clearSession = () => {
    Object.assign(YU.state, emptyData(), { session: { userId: null, loggedIn: false }, version: 0, ui: {} });
    // The app keeps its token in the keychain, so signing out there has to forget it too
    if (window.YUNative) window.YUNative.forgetSession();
  };
  // Responses are numbered so a slow, older snapshot never overwrites a newer one
  let requested = 0, applied = 0;
  YU.reload = async () => {
    const seq = ++requested;
    const r = await YU.api.get('/snapshot');
    if (!r.ok) return r;
    if (seq < applied || !YU.state.session.loggedIn) return { ok: true };
    applied = seq;
    YU.applySnapshot(r);
    YU.emit('change');
    return { ok: true };
  };
  // After the server has started a session (login, sign-up, password reset): load that user's data
  YU.reloadAfterAuth = async () => {
    const snap = await YU.api.get('/snapshot');
    if (!snap.ok) return snap;
    YU.applySnapshot(snap);
    YU.emit('change');
    return { ok: true };
  };
  // First load: who am I (plus public org info for the login page), then my data
  YU.start = async () => {
    const me = await YU.api.get('/auth/me');
    // The app opens on the sign-in screen even when the server cannot be reached and nobody is
    // signed in yet; the sign-in attempt is what says so. A signed-in user gets the retry splash.
    if (!me.ok && window.YUNative && !(await window.YUNative.hasSession())) {
      await YU.i18n.apply(YU.i18n.resolve(null, null));
      return { ok: true };
    }
    if (!me.ok) return me;
    YU.state.org = me.org;
    YU.state.registration = me.registration;
    // The catalogue has to be in hand before the first render, or the screen paints in
    // one language and immediately repaints in another.
    await YU.i18n.apply(YU.i18n.resolve(me.user && me.user.locale, me.defaultLanguage));
    if (!me.user) return { ok: true };
    const snap = await YU.api.get('/snapshot');
    if (snap.ok) YU.applySnapshot(snap);
    return snap;
  };

  // ---- Keeping fresh: a cheap /api/pulse every 30 s; the full snapshot only when something changed
  // and the user is not in the middle of something (open drawer/modal, focused field, edited form).
  const PULSE_MS = 30000;
  let staleSince = null;
  const userBusy = () => {
    if (YU.ui.drawer.isOpen() || YU.ui.modal.isOpen() || document.getElementById('ctx-menu')) return true;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
    return !!document.querySelector('form[data-dirty]');
  };
  const refreshIfStale = () => { if (staleSince && !userBusy()) { staleSince = null; YU.reload(); } };
  async function pulse() {
    if (document.hidden || !YU.state.session.loggedIn) return;
    const r = await YU.api.get('/pulse');
    if (r.ok && r.version !== YU.state.version) staleSince = staleSince || Date.now();
    refreshIfStale();
  }
  setInterval(pulse, PULSE_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pulse(); });
  window.addEventListener('hashchange', () => setTimeout(refreshIfStale, 0));
  document.addEventListener('focusout', () => setTimeout(refreshIfStale, 0));
  // A form counts as "being edited" from the first keystroke until the screen re-renders it
  document.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('form'); if (f) f.dataset.dirty = '1'; });

  // ---- Lookups
  YU.me = () => YU.state.users.find((u) => u.id === YU.state.session.userId) || null;
  YU.role = () => (YU.state.session.loggedIn && YU.me() ? YU.me().role : 'guest');
  YU.roleName = (r) => (YU.ROLE_IDS.includes(r) ? YU.t(`role.${r}`) : r);
  YU.user = (id) => YU.state.users.find((u) => u.id === id) || null;
  YU.mission = (id) => YU.state.missions.find((m) => m.id === id) || null;
  YU.dept = (id) => YU.state.departments.find((d) => d.id === id) || null;
  YU.newsItem = (id) => YU.state.news.find((n) => n.id === id) || null;
  YU.reward = (id) => YU.state.rewards.find((r) => r.id === id) || null;
  YU.badge = (id) => YU.state.badges.find((b) => b.id === id) || null;
  YU.submission = (id) => YU.state.submissions.find((s) => s.id === id) || null;

  // ---- Permissions
  // Mirrors server/src/core/permissions.ts, which is the one that is enforced. 'guest' exists only here.
  // What a participant does: earning and spending. The leader and admins run the union rather than take part in it
  const PARTICIPANT_ONLY = ['missions.subscribe', 'rewards.redeem'];
  const VOLUNTEER = ['news.view', 'missions.view', 'rating.view', 'profile.own', 'rewards.view', ...PARTICIPANT_ONLY];
  const COORDINATOR = [...VOLUNTEER, 'review.panel', 'missions.create', 'people.assign.dept'];
  const LEADER = [...COORDINATOR.filter((p) => !PARTICIPANT_ONLY.includes(p)), 'org.view.all', 'people.manage', 'coins.grant', 'news.manage', 'rewards.manage'];
  const PERMS = {
    guest: [],
    volunteer: VOLUNTEER,
    coordinator: COORDINATOR,
    leader: LEADER,
    admin: ['*'],
  };
  // '*' stops short of the participant permissions
  const roleCan = (role, perm) => { const list = PERMS[role] || []; return list.includes('*') ? !PARTICIPANT_ONLY.includes(perm) : list.includes(perm); };
  YU.can = (perm) => roleCan(YU.role(), perm);
  YU.isParticipant = () => YU.can('missions.subscribe');
  // Whether a given person earns coins and badges: volunteers and coordinators do, the leader and admins do not
  YU.participates = (user) => !!user && roleCan(user.role, 'missions.subscribe');
  // News is written by whoever holds news.manage, and by the coordinators of the department that runs it
  YU.canManageNews = () => {
    const me = YU.me(); if (!me) return false;
    if (YU.can('news.manage')) return true;
    const dept = YU.state.settings.newsDeptId;
    return !!dept && me.role === 'coordinator' && me.deptId === dept;
  };
  // Leaders and admins act across every department; a coordinator only in their own.
  YU.isUnionWide = () => { const me = YU.me(); return !!me && (me.role === 'admin' || me.role === 'leader'); };
  YU.isCoordinatorOf = (deptId) => { const me = YU.me(); return !!me && (YU.isUnionWide() || (me.role === 'coordinator' && me.deptId === deptId)); };
  YU.canSubscribe = (mission) => !!mission && mission.status === 'open' && YU.can('missions.subscribe');

  // ---- Selectors (read-only derived data)
  const S = {
    seatsTaken: (missionId) => YU.state.submissions.filter((s) => s.missionId === missionId && s.status !== 'rejected').length,
    seatsLeft: (mission) => Math.max(0, mission.seats - S.seatsTaken(mission.id)),
    mySubmission: (missionId) => { const me = YU.me(); return me ? YU.state.submissions.find((s) => s.missionId === missionId && s.userId === me.id) || null : null; },
    mySubmissions: () => { const me = YU.me(); return me ? YU.state.submissions.filter((s) => s.userId === me.id) : []; },
    myActiveCount: () => S.mySubmissions().filter((s) => s.status === 'in_progress' || s.status === 'pending').length,
    // Every open mission is visible to every volunteer; drafts and archives only to the people who run them
    visibleMissions: () => YU.state.missions.filter((m) => {
      if (m.status === 'draft' || m.status === 'archived') return YU.isCoordinatorOf(m.deptId);
      return true;
    }),
    missionSubmissions: (missionId) => YU.state.submissions.filter((s) => s.missionId === missionId),
    pendingReviews: (deptId = null) => YU.state.submissions.filter((s) => {
      if (s.status !== 'pending') return false;
      const m = YU.mission(s.missionId);
      return m && (!deptId || m.deptId === deptId);
    }),
    // Rating — active, non-blocked people who have earned something
    leaderboard: (period = 'semester', deptId = null) => {
      const key = period === 'semester' ? 'coinsSemester' : 'coinsTotal';
      return YU.state.users
        .filter((u) => u.status === 'active' && YU.participates(u) && u[key] > 0 && (!deptId || u.deptId === deptId))
        .slice()
        .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name, YU.i18n.current() || 'ru'));
    },
    // Equal coins share a place (1, 1, 3): nobody is ranked below someone with the same score
    rankOf: (userId, period = 'semester') => {
      const key = period === 'semester' ? 'coinsSemester' : 'coinsTotal';
      const board = S.leaderboard(period);
      const me = board.find((u) => u.id === userId);
      return me ? 1 + board.filter((u) => u[key] > me[key]).length : null;
    },
    userTransactions: (userId) => YU.state.transactions.filter((t) => t.userId === userId),
    userRedemptions: (userId) => YU.state.redemptions.filter((r) => r.userId === userId),
    myNotifications: () => { const me = YU.me(); return me ? YU.state.notifications.filter((n) => n.userId === me.id) : []; },
    unreadCount: () => S.myNotifications().filter((n) => !n.read).length,
    publishedNews: () => YU.state.news.filter((n) => n.status === 'published').slice().sort((a, b) => (b.pinned - a.pinned) || (new Date(b.publishedAt) - new Date(a.publishedAt))),
    deptStats: (deptId) => {
      const missions = YU.state.missions.filter((m) => m.deptId === deptId);
      const subs = YU.state.submissions.filter((s) => missions.some((m) => m.id === s.missionId));
      return {
        open: missions.filter((m) => m.status === 'open').length,
        drafts: missions.filter((m) => m.status === 'draft').length,
        pending: subs.filter((s) => s.status === 'pending').length,
        inProgress: subs.filter((s) => s.status === 'in_progress').length,
        approved: subs.filter((s) => s.status === 'approved').length,
        volunteers: YU.state.users.filter((u) => u.deptId === deptId && u.status === 'active').length,
        coinsAwarded: subs.filter((s) => s.status === 'approved').reduce((a, s) => a + (s.coinsAwarded || 0), 0),
      };
    },
  };
  YU.select = S;

})();

;
/* js/actions.js */
/* YU.actions — every change goes to the server; on success the snapshot is reloaded, so screens re-render with the
   server's truth before the promise resolves. Each action resolves to { ok, error?, ...data } and never throws.
   Methods are added to the existing object because some screens keep a reference to YU.actions. */
(function () {
  const api = YU.api;
  const enc = encodeURIComponent;
  YU.actions = YU.actions || {};
  const A = YU.actions;

  // Runs a request and reloads the data before resolving: after a success, and also after a refusal that
  // means the screen was stale (the seat went, the report was reviewed by someone else, the mission closed),
  // or a network error, since the change may well have landed before the connection dropped
  const call = async (request, { reload = true } = {}) => {
    const r = await request;
    const stale = !r.ok && (r.status === 409 || r.status === 404 || r.code === 'network');
    if (reload && (r.ok || stale)) {
      const again = await YU.reload();
      // The change is saved; only the screen is behind. Say so rather than pretend the save failed.
      if (r.ok && !again.ok) { YU.ui.toast(YU.tText('error.savedNotRefreshed'), 'info'); return { ...r, stale: true }; }
    }
    return r;
  };
  // For admin actions the server may ask to re-enter the password (code confirm_password): ask once and retry
  const withPassword = async (send) => {
    const first = await send(undefined);
    if (first.ok || first.code !== 'confirm_password') return first;
    const password = await YU.ui.askPassword(first.error);
    if (!password) return { ok: false, error: '' };
    return send(password);
  };

  // ---- Session
  YU.actions.login = async (email, password) => {
    const r = await YU.api.post('/auth/login', { email, password });
    if (!r.ok) return r;
    const snap = await YU.reloadAfterAuth();
    if (!snap.ok) return snap;
    return { ok: true, user: YU.me() };
  };
  YU.actions.changePassword = (currentPassword, newPassword) => YU.api.post('/auth/password/change', { currentPassword, newPassword });
  YU.actions.listSessions = () => YU.api.get('/auth/sessions');
  YU.actions.revokeOtherSessions = () => YU.api.post('/auth/sessions/revoke-others');
  // The Telegram bot: whether this account has a chat linked, a one-time code to link one, and unlinking
  YU.actions.telegramStatus = () => YU.api.get('/telegram');
  YU.actions.telegramLinkCode = () => YU.api.post('/telegram/link-code');
  YU.actions.telegramUnlink = () => YU.api.del('/telegram');
  YU.actions.deleteAccount = async (password) => {
    const r = await YU.api.del('/auth/account', { password });
    if (r.ok) { YU.clearSession(); YU.emit('change'); }
    return r;
  };
  YU.actions.logout = async () => {
    const r = await YU.api.post('/auth/logout');
    // Offline, the website cannot end the server session: staying signed in is more honest than a login
    // screen over a live cookie. The app forgets its token locally, which is what signing out means there.
    if (!r.ok && !(r.code === 'network' && window.YUNative)) return r;
    YU.clearSession();
    YU.emit('change');
    return { ok: true };
  };
  // Session expired, was revoked, or the account was blocked: back to the login screen
  YU.api.onSessionLost = () => {
    if (!YU.state.session.loggedIn) return;
    YU.clearSession();
    YU.ui.drawer.close(); YU.ui.modal.close();
    YU.ui.toast(YU.tText('error.sessionExpired'), 'info');
    YU.emit('change');
  };

  // ---- Missions: taking part
  A.takeTask = (id) => call(api.post(`/missions/${enc(id)}/subscribe`));
  A.dropTask = (id) => call(api.post(`/missions/${enc(id)}/unsubscribe`));
  // proof: { proofLabel } for links and text, or { file } (a File) for photo missions
  A.submitReport = (id, { comment = '', proofLabel = '', file = null } = {}) => {
    if (file) {
      const form = new FormData();
      form.append('comment', comment);
      form.append('photo', file, file.name || 'photo.jpg');
      return call(api.upload(`/missions/${enc(id)}/report-photo`, form));
    }
    return call(api.post(`/missions/${enc(id)}/report`, { comment, proofText: proofLabel }));
  };

  // ---- Reviews
  A.approveSubmission = (id, { coins, comment = '' } = {}) => call(api.post(`/submissions/${enc(id)}/approve`, { coins: Number(coins), comment }));
  A.rejectSubmission = (id, { comment = '' } = {}) => call(api.post(`/submissions/${enc(id)}/reject`, { comment }));

  // ---- Rewards
  A.redeemReward = (id) => call(api.post(`/rewards/${enc(id)}/redeem`));
  A.issueRedemption = (id) => call(api.post(`/redemptions/${enc(id)}/issue`));
  A.createReward = (data) => call(api.post('/rewards', data));
  A.updateReward = (id, patch) => call(api.patch(`/rewards/${enc(id)}`, patch));
  A.deleteReward = (id) => call(api.del(`/rewards/${enc(id)}`));

  // ---- Missions: management
  A.createTask = (data) => call(api.post('/missions', data));
  A.updateTask = (id, patch) => call(api.patch(`/missions/${enc(id)}`, patch));
  // A person's correction of how a mission, news post or reward reads in one language, and its undo
  const CONTENT_PATH = { mission: 'missions', news: 'news', reward: 'rewards' };
  A.saveTranslation = (kind, id, locale, fields) => call(api.put(`/${CONTENT_PATH[kind]}/${enc(id)}/translations/${enc(locale)}`, fields));
  A.resetTranslation = (kind, id, locale) => call(api.del(`/${CONTENT_PATH[kind]}/${enc(id)}/translations/${enc(locale)}`));
  A.publishTask = (id) => call(api.post(`/missions/${enc(id)}/publish`));
  A.closeTask = (id) => call(api.post(`/missions/${enc(id)}/close`));
  A.deleteTask = (id) => call(api.del(`/missions/${enc(id)}`));

  // ---- News
  A.createNews = (data) => call(api.post('/news', data));
  A.updateNews = (id, patch) => call(api.patch(`/news/${enc(id)}`, patch));
  A.publishNews = (id) => call(api.post(`/news/${enc(id)}/publish`));
  A.deleteNews = (id) => call(api.del(`/news/${enc(id)}`));
  // Pictures travel on their own, one at a time, after the post exists; the first in the order is the cover
  A.uploadNewsPicture = (id, file) => {
    const form = new FormData();
    form.append('picture', file, file.name || 'picture.jpg');
    return call(api.upload(`/news/${enc(id)}/pictures`, form));
  };
  A.removeNewsPicture = (id, uploadId) => call(api.del(`/news/${enc(id)}/pictures/${enc(uploadId)}`));
  A.orderNewsPictures = (id, order) => call(api.put(`/news/${enc(id)}/pictures`, { order }));
  // One's own profile picture, cropped square on the server
  A.setAvatar = (file) => {
    const form = new FormData();
    form.append('avatar', file, file.name || 'avatar.jpg');
    return call(api.upload('/me/avatar', form));
  };
  A.removeAvatar = () => call(api.del('/me/avatar'));
  A.toggleLike = (id) => call(api.post(`/news/${enc(id)}/like`));
  // Counting a view never reloads: the article updates its own counter
  A.viewNews = (id) => call(api.post(`/news/${enc(id)}/view`), { reload: false });

  // ---- People
  A.updateUser = (id, patch) => {
    const me = YU.me();
    if (me && me.id === id) {
      const own = {};
      ['name', 'phone', 'bio', 'tone'].forEach((k) => { if (patch[k] !== undefined) own[k] = patch[k]; });
      return call(api.patch('/me', own));
    }
    // A typed department name travels alongside: the server makes the department, or matches an existing one
    return withPassword((confirmPassword) => call(api.patch(`/users/${enc(id)}`, { role: patch.role, deptId: patch.deptId || null, ...(patch.deptName ? { deptName: patch.deptName } : {}), confirmPassword })));
  };
  // An admin corrects someone's name, email, group, school, phone or bio
  A.updateUserDetails = (id, patch) => call(api.patch(`/users/${enc(id)}/details`, patch));
  // An admin sets someone a new password, confirmed with the admin's own; the person's sessions end
  A.setUserPassword = (id, password) => withPassword((confirmPassword) => call(api.post(`/users/${enc(id)}/password`, { password, confirmPassword })));
  // An admin takes a mission away from a person: the seat, the waiting report, or an accepted one with its coins
  A.removeSubmission = (id) => call(api.del(`/submissions/${enc(id)}`));
  A.blockUser = (id, reason = '') => call(api.post(`/users/${enc(id)}/block`, { reason }));
  // Removing someone is confirmed with the admin's password, which the server asks for
  A.deleteUser = (id) => withPassword((confirmPassword) => call(api.del(`/users/${enc(id)}`, { confirmPassword })));
  A.unblockUser = (id) => call(api.post(`/users/${enc(id)}/unblock`));
  A.adjustCoins = (userId, delta, reason) => call(api.post(`/users/${enc(userId)}/coins`, { delta: Math.round(Number(delta)), reason }));
  A.markAllRead = () => call(api.post('/notifications/read-all'));
  A.setLocale = (locale) => call(api.patch('/me', { locale }));

  // ---- Staffing a department: coordinators move volunteers in and out of their own
  A.assignDepartment = (userId, deptId) => call(api.post(`/users/${enc(userId)}/department`, { deptId: deptId || null }));

  // ---- The Android app (admin): a build is published from its APK; releases are not part of the snapshot
  A.publishAppRelease = (file, notes = '') => {
    const form = new FormData();
    form.append('apk', file);
    form.append('notes', notes);
    return call(api.upload('/app/android', form), { reload: false });
  };
  // A build hosted elsewhere (a public Google Drive file): its link and the version the admin states
  A.publishAppLink = ({ url, versionName, versionCode, notes = '' }) => call(api.post('/app/android/link', { url, versionName, versionCode: Math.round(Number(versionCode)), notes }), { reload: false });
  A.deleteAppRelease = (id) => call(api.del(`/app/android/${enc(id)}`), { reload: false });

  // ---- Organisation (admin)
  A.createDepartment = (data) => call(api.post('/departments', data));
  A.updateDepartment = (id, patch) => call(api.patch(`/departments/${enc(id)}`, patch));
  A.deleteDepartment = (id) => call(api.del(`/departments/${enc(id)}`));
  A.updateLevel = (id, patch) => call(api.patch(`/levels/${enc(id)}`, { name: patch.name, min: Math.round(Number(patch.min)) }));
  A.createBadge = (data) => call(api.post('/badges', data));
  A.updateBadge = (id, patch) => call(api.patch(`/badges/${enc(id)}`, patch));
  A.deleteBadge = (id) => call(api.del(`/badges/${enc(id)}`));
  A.awardBadge = (userId, badgeId) => call(api.post(`/badges/${enc(badgeId)}/award`, { userId }));
  A.revokeBadge = (userId, badgeId) => call(api.post(`/badges/${enc(badgeId)}/revoke`, { userId }));
  A.updateSettings = (patch) => withPassword((confirmPassword) => call(api.patch('/settings', { ...patch, confirmPassword })));
  A.startSemester = (name, startsAt) => call(api.post('/semesters', startsAt ? { name, startsAt } : { name }));
})();

;
/* js/ui.js */
/* Shared UI helpers. Every screen builds HTML strings with these and mounts handlers via YU.ui.on(). */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<i data-lucide="${esc(name)}"${cls ? ` class="${esc(cls)}"` : ''}></i>`;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- Numbers, counts and dates, all following the active locale.
  // plural() still takes Russian's three forms; it goes away as screens move onto t(),
  // whose catalogs carry whichever plural categories each language actually has.
  const plural = (n, forms) => {
    n = Math.abs(Math.round(n));
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  };
  const F = () => YU.i18n.fmt();
  const fmtNum = (n) => F().number.format(Math.round(n));
  const fmtCoins = (n, opts = {}) => `${opts.sign && n > 0 ? '+' : ''}${YU.t('coins.amount', { count: n })}`;
  const countOf = (n, forms) => `${fmtNum(n)} ${plural(n, forms)}`;

  // ---- Dates. Always read in Tashkent time, whatever zone the browser is in; "now" is
  // YU.now() (the server-corrected clock). Intl does the wording, so no month tables here.
  const pad = (n) => String(n).padStart(2, '0');
  const DAY_MS = 86400000;
  // Shift an instant by the Tashkent offset and read it with getUTC* to get Tashkent wall-clock parts
  const wall = (d) => new Date(new Date(d).getTime() + YU.TZ_OFFSET_MIN * 60000);
  const startOfDay = (d) => { const w = wall(d); return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()); };
  const fmtTime = (iso) => F().time.format(new Date(iso));
  const fmtDate = (iso, opts = {}) => {
    if (!iso) return '\u2014';
    const d = new Date(iso), f = F();
    const base = (opts.year ? f.dayMonthYear : opts.full ? f.dayMonthFull : f.dayMonth).format(d);
    return opts.time ? `${base}, ${fmtTime(iso)}` : base;
  };
  const daysDiff = (iso) => Math.round((startOfDay(iso) - startOfDay(YU.now())) / DAY_MS);
  // <input type="datetime-local"> round trip in Tashkent time
  const toInputValue = (iso) => { const t = wall(iso); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`; };
  const fromInputValue = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value || ''))) return null;
    const hours = YU.TZ_OFFSET_MIN / 60;
    const d = new Date(`${value}:00+${pad(hours)}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  // numeric:'auto' gives "today"/"tomorrow"/"yesterday" in the locale's own words
  const relDay = (iso) => (Math.abs(daysDiff(iso)) < 7 ? F().rel.format(daysDiff(iso), 'day') : fmtDate(iso));
  const timeAgo = (iso) => {
    const mins = Math.round((YU.now() - new Date(iso)) / 60000);
    if (mins < 1) return YU.t('time.justNow');
    if (mins < 60) return F().rel.format(-mins, 'minute');
    const h = Math.round(mins / 60);
    if (h < 24 && daysDiff(iso) === 0) return F().rel.format(-h, 'hour');
    return relDay(iso);
  };
  // Deadline descriptor: { label, tone: ok|warn|bad|neutral, soon, past }
  const deadline = (iso) => {
    const dd = daysDiff(iso);
    // Past is a matter of the clock, not the calendar: "today by 08:00" is over at 08:01
    if (new Date(iso).getTime() <= new Date(YU.now()).getTime()) return { label: YU.t('deadline.past', { date: fmtDate(iso) }), tone: 'bad', soon: false, past: true, days: dd };
    if (dd === 0) return { label: YU.t('deadline.today', { time: fmtTime(iso) }), tone: 'warn', soon: true, past: false, days: dd };
    if (dd === 1) return { label: YU.t('deadline.tomorrow', { time: fmtTime(iso) }), tone: 'warn', soon: true, past: false, days: dd };
    if (dd <= 3) return { label: YU.t('deadline.inDays', { count: dd }), tone: 'warn', soon: true, past: false, days: dd };
    return { label: YU.t('deadline.until', { date: fmtDate(iso) }), tone: 'neutral', soon: false, past: false, days: dd };
  };
  // ---- Atoms
  // Tone names end up inside class="" attributes, so only known tones pass through
  const safeTone = (t) => (YU.TONES.includes(t) ? t : 'slate');
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // The initials stay underneath the picture: they show until it loads (the app fetches it with the session) or if it fails
  const avatar = (user, size = '', extra = '') =>
    `<span class="avatar ${size} tone-${safeTone(user && user.tone)} ${extra} ${user && user.avatarUrl ? 'has-photo' : ''}" title="${esc(user ? user.name : '')}">${esc(initials(user ? user.name : '?'))}${user && user.avatarUrl ? `<img class="avatar-photo" ${photoSrc(user.avatarUrl)} alt="" loading="lazy">` : ''}</span>`;
  const chip = (text, t = '', opts = {}) =>
    `<span class="chip ${t ? `tone-${safeTone(t)}` : ''} ${opts.dot ? 'chip-dot' : ''} ${opts.cls || ''}">${opts.icon ? icon(opts.icon) : ''}${esc(text)}</span>`;
  const deptChip = (deptId, opts = {}) => {
    const dpt = YU.dept(deptId);
    if (!dpt) return chip(YU.t('dept.all'), 'slate', opts);
    return chip(dpt.name, dpt.tone, { dot: true, ...opts });
  };
  const pill = (text, kind = 'neutral', ic = '') => `<span class="pill pill-${kind}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const MISSION_STATUS = { open: 'ok', closed: 'neutral', draft: 'warn', archived: 'neutral' };
  const SUB_STATUS = {
    in_progress: ['info', 'loader-circle'],
    pending: ['warn', 'clock'],
    approved: ['ok', 'check'],
    rejected: ['bad', 'x'],
  };
  const missionStatusPill = (s) => pill(YU.t(`mission.status.${s}`), MISSION_STATUS[s] || 'neutral');
  const subStatusLabel = (s) => YU.t(`sub.status.${s}`);
  const subStatusPill = (s) => { const [k, i] = SUB_STATUS[s] || ['neutral', '']; return pill(subStatusLabel(s), k, i); };
  const coins = (n, opts = {}) =>
    `<span class="points ${opts.lg ? 'points-lg' : ''} ${opts.plain ? 'points-plain' : ''} ${n < 0 ? 'points-neg' : ''} ${opts.cls || ''}">${icon('coins')}${opts.sign && n > 0 ? '+' : ''}${fmtNum(n)}</span>`;
  // Language switcher. A native select so it is keyboard- and screen-reader-friendly
  // everywhere, and usable as a wheel on phones.
  // A menu button showing the current language's code; the menu lists every language by its own name.
  // app.js opens it, so the same switcher works in the topbar and on the sign-in screens.
  const langSwitcher = (cls = '') => {
    const now = YU.i18n.locales.find((l) => l.id === YU.i18n.current()) || YU.i18n.locales[0];
    const label = YU.tText('lang.switch');
    return `<button type="button" class="lang-switch ${cls}" data-lang-menu aria-haspopup="menu" aria-expanded="false" aria-label="${esc(`${label}: ${now.label}`)}" title="${esc(label)}">`
      + `${icon('languages', 'lang-globe')}<span class="lang-code">${esc(now.short)}</span>${icon('chevron-down', 'lang-caret')}</button>`;
  };

  // Light / dark / system. One button that cycles, labelled with the state it is in now.
  const themeToggle = (cls = '') => {
    const mode = YU.theme.current();
    const label = YU.t('theme.switch', { mode: YU.t(`theme.${mode}`) });
    return `<button type="button" class="icon-btn theme-toggle ${cls}" data-theme-toggle aria-label="${esc(label)}" title="${esc(label)}">${icon(YU.theme.icon())}</button>`;
  };

  const progress = (value, max, cls = '') => {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
    return `<div class="progress ${cls}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
  };
  const ring = (pct, { color = 'var(--cobalt)', label = '' } = {}) =>
    `<div class="ring" style="--p:${Math.max(0, Math.min(100, pct))};--c:${color}"><span>${label || pct + '%'}</span></div>`;
  const empty = ({ icon: ic = 'inbox', title, text = '', action = '' }) =>
    `<div class="empty">${icon(ic)}<div class="h3">${esc(title)}</div>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
  const kpi = ({ label, value, delta = '', deltaTone = 'ok', icon: ic = '', tone = 'blue', sub = '' }) =>
    `<div class="panel kpi">
      <div class="row-between"><span class="kpi-label">${esc(label)}</span>${ic ? `<span class="kpi-icon tone-${safeTone(tone)}">${icon(ic)}</span>` : ''}</div>
      <div class="kpi-value">${value}</div>
      ${delta ? `<span class="kpi-delta text-${deltaTone}">${icon(deltaTone === 'ok' ? 'trending-up' : deltaTone === 'bad' ? 'trending-down' : 'minus')}${esc(delta)}</span>` : sub ? `<span class="small muted">${esc(sub)}</span>` : ''}
    </div>`;
  // Page title with the italic serif accent word: title(t('missions.title'), t('missions.titleAccent'))
  const title = (main, accent = '', tag = 'h1') => `<${tag} class="h1">${esc(main)}${accent ? ` <em>${esc(accent)}</em>` : ''}</${tag}>`;
  const eyebrow = (text) => `<div class="eyebrow">${esc(text)}</div>`;
  const userLine = (user, sub = '') =>
    `<span class="row gap-10">${avatar(user, 'avatar-sm')}<span class="col gap-0" style="min-width:0"><span class="list-title truncate">${esc(user ? user.name : '—')}</span>${sub ? `<span class="micro muted truncate">${esc(sub)}</span>` : ''}</span></span>`;
  const levelFor = (pts) => {
    const lv = YU.state.levels.length ? YU.state.levels : [{ id: 'l0', name: YU.t('level.fallback'), min: 0 }];
    let cur = lv[0];
    for (const l of lv) if (pts >= l.min) cur = l;
    const idx = lv.indexOf(cur);
    const next = lv[idx + 1] || null;
    const span = next ? next.min - cur.min : 1;
    const pct = next ? Math.round(((pts - cur.min) / span) * 100) : 100;
    return { level: cur, next, pct, toNext: next ? next.min - pts : 0, index: idx + 1 };
  };

  // ---- Tiny charts (inline SVG, theme tokens). One scale per chart; endpoint emphasised.
  const sparkline = (values, { w = 200, h = 44, color = 'var(--cobalt)', fill = true, cls = 'spark' } = {}) => {
    if (!values.length) return '';
    const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
    const px = (i) => (i / (values.length - 1)) * (w - 6) + 3;
    const py = (v) => h - 4 - ((v - min) / span) * (h - 8);
    const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const area = `M${px(0)},${h} L${pts.replace(/ /g, ' L')} L${px(values.length - 1)},${h} Z`;
    const last = values.length - 1;
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${fill ? `<path d="${area}" fill="${color}" opacity=".10"/>` : ''}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${px(last).toFixed(1)}" cy="${py(values[last]).toFixed(1)}" r="3.2" fill="${color}"/>
    </svg>`;
  };
  const bars = (values, labels = [], { h = 140, color = 'var(--cobalt)', highlight = -1, highlightColor = 'var(--gold)', gap = 6 } = {}) => {
    const n = values.length; if (!n) return '';
    const w = 400, top = 18, bottom = labels.length ? 20 : 4;
    const max = Math.max(...values) || 1;
    const bw = (w - gap * (n - 1)) / n;
    const rects = values.map((v, i) => {
      const bh = Math.max(2, ((v) / max) * (h - top - bottom));
      const x = i * (bw + gap), y = h - bottom - bh;
      const c = i === highlight ? highlightColor : color;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${c}" opacity="${i === highlight ? 1 : 0.85}"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink-3)">${fmtNum(v)}</text>`;
    }).join('');
    const lbls = labels.map((l, i) => `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${h - 5}" text-anchor="middle" font-size="10" fill="var(--ink-3)">${esc(l)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true" style="font-family:var(--font-body)">${rects}${lbls}</svg>`;
  };

  // ---- Event delegation
  const on = (root, evt, selector, handler) => {
    root.addEventListener(evt, (e) => {
      const el = e.target.closest(selector);
      if (el && root.contains(el)) handler(e, el);
    });
  };
  const formData = (form) => Object.fromEntries(new FormData(form).entries());
  // Flags a form field as invalid, shows its .error sibling and moves focus to it
  const markField = (form, sel, bad) => {
    const input = form.querySelector(sel); if (!input) return;
    input.classList.toggle('is-invalid', bad);
    const err = input.parentElement.querySelector('.error'); if (err) err.hidden = !bad;
    if (bad) input.focus();
  };
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  // Runs an async action with its button disabled, so a double click cannot send it twice.
  // Resolves to the action's result, or { ok: false, error: '' } when the button was already busy.
  const busy = async (btn, run) => {
    if (btn && btn.getAttribute('aria-busy') === 'true') return { ok: false, error: '' };
    if (btn) { btn.setAttribute('aria-busy', 'true'); btn.disabled = true; }
    try {
      return await run();
    } finally {
      if (btn) { btn.removeAttribute('aria-busy'); btn.disabled = false; }
    }
  };
  const refreshIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } }); };

  // ---- Layers: scrim, drawer, modal, toast, menu
  const layers = { drawer: false, modal: false };
  // Replace a persistent layer element with an empty clone so listeners from a previous open do not accumulate
  const freshLayer = (sel) => { const old = $(sel); if (!old) return null; const el = old.cloneNode(false); old.replaceWith(el); return el; };
  const syncScrim = () => {
    const s = $('#scrim'); if (!s) return;
    const open = layers.drawer || layers.modal;
    if (open) { s.hidden = false; requestAnimationFrame(() => s.classList.add('is-open')); }
    else { s.classList.remove('is-open'); setTimeout(() => { if (!layers.drawer && !layers.modal) s.hidden = true; }, 320); }
    document.body.style.overflow = open ? 'hidden' : '';
  };
  const drawer = {
    // title/body/foot are HTML strings (escape your own data)
    open({ title, sub = '', body, foot = '' }) {
      const el = freshLayer('#drawer'); if (!el) return null;
      el.classList.remove('is-open');
      el.innerHTML = `
        <div class="drawer-head"><div style="min-width:0"><div class="h2">${title}</div>${sub ? `<div class="small muted" style="margin-top:4px">${sub}</div>` : ''}</div>
          <button class="icon-btn" data-close-layer aria-label="${esc(YU.t('action.close'))}">${icon('x')}</button></div>
        <div class="drawer-body">${body}</div>
        ${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
      el.hidden = false; layers.drawer = true; syncScrim();
      requestAnimationFrame(() => el.classList.add('is-open'));
      refreshIcons();
      return el;
    },
    update({ title, sub, body, foot }) {
      const el = $('#drawer'); if (!el || el.hidden) return null;
      if (title !== undefined) $('.drawer-head .h2', el).innerHTML = title;
      if (sub !== undefined) { const s = $('.drawer-head .muted', el); if (s) s.innerHTML = sub; }
      if (body !== undefined) $('.drawer-body', el).innerHTML = body;
      if (foot !== undefined) {
        let f = $('.drawer-foot', el);
        if (!f && foot) { f = document.createElement('div'); f.className = 'drawer-foot'; el.appendChild(f); }
        if (f) { if (foot) f.innerHTML = foot; else f.remove(); }
      }
      refreshIcons();
      return el;
    },
    el() { return $('#drawer'); },
    isOpen() { return layers.drawer; },
    close() {
      const el = $('#drawer'); if (!el) return;
      el.classList.remove('is-open'); layers.drawer = false; syncScrim();
      setTimeout(() => { if (!layers.drawer) { el.hidden = true; el.innerHTML = ''; } }, 320);
    },
  };
  // Called once when the current modal closes by any means (button, Escape, scrim, or being replaced by another modal)
  let modalCloseHook = null;
  const runModalCloseHook = () => { const h = modalCloseHook; modalCloseHook = null; if (h) h(); };
  const modal = {
    open({ title, sub = '', body, foot = '', wide = false, onClose = null }) {
      runModalCloseHook();
      modalCloseHook = onClose;
      const wrap = $('#modal-wrap'), el = freshLayer('#modal'); if (!el) return null;
      el.className = `modal ${wide ? 'is-wide' : ''}`;
      el.innerHTML = `
        <div class="modal-head"><div style="min-width:0"><div class="h2">${title}</div>${sub ? `<div class="small muted" style="margin-top:4px">${sub}</div>` : ''}</div>
          <button class="icon-btn" data-close-layer aria-label="${esc(YU.t('action.close'))}">${icon('x')}</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}`;
      wrap.hidden = false; layers.modal = true; syncScrim();
      requestAnimationFrame(() => el.classList.add('is-open'));
      refreshIcons();
      const first = $('input, select, textarea, button.btn-primary', $('.modal-body', el));
      if (first) setTimeout(() => first.focus(), 60);
      return el;
    },
    el() { return $('#modal'); },
    isOpen() { return layers.modal; },
    close() {
      const wrap = $('#modal-wrap'), el = $('#modal'); if (!el) return;
      runModalCloseHook();
      el.classList.remove('is-open'); layers.modal = false; syncScrim();
      setTimeout(() => { if (!layers.modal) { wrap.hidden = true; el.innerHTML = ''; } }, 320);
    },
  };
  // Resolves true/false; closing the dialog any other way (Escape, scrim, another modal) counts as "no"
  const confirm = ({ title, text = '', ok = YU.t('action.confirm'), cancel = YU.t('action.cancel'), danger = false, extra = '' }) =>
    new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; resolve(v); };
      const el = modal.open({
        title: esc(title),
        body: `${text ? `<p class="muted-2">${esc(text)}</p>` : ''}${extra}`,
        foot: `<button class="btn btn-secondary" data-confirm="0">${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="1">${esc(ok)}</button>`,
        onClose: () => done(false),
      });
      if (!el) return done(false);
      el.onclick = (e) => {
        const b = e.target.closest('[data-confirm]'); if (b) { done(b.dataset.confirm === '1'); modal.close(); return; }
        if (e.target.closest('[data-close-layer]')) done(false);
      };
    });
  // Asks the user to re-enter their password for a sensitive action; resolves the password, or null if cancelled
  const askPassword = (reason = '') =>
    new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; resolve(v); };
      const el = modal.open({
        title: YU.t('password.title'),
        sub: esc(reason || YU.t('password.reason')),
        body: `<form id="pw-confirm" class="col gap-10" novalidate><div class="field"><label for="pw-confirm-input">${esc(YU.t('password.label'))}</label><input class="input" id="pw-confirm-input" type="password" autocomplete="current-password" maxlength="128"></div></form>`,
        foot: `<button class="btn btn-secondary" data-pw="0">${esc(YU.t('action.cancel'))}</button><button class="btn btn-primary" data-pw="1">${esc(YU.t('action.confirm'))}</button>`,
        onClose: () => done(null),
      });
      if (!el) return done(null);
      const input = el.querySelector('#pw-confirm-input');
      const submit = () => { done(input.value || null); modal.close(); };
      el.querySelector('#pw-confirm').onsubmit = (e) => { e.preventDefault(); submit(); };
      el.onclick = (e) => {
        const b = e.target.closest('[data-pw]');
        if (b) { if (b.dataset.pw === '1') submit(); else modal.close(); }
      };
    });
  // msg is plain text (never HTML); an empty msg shows nothing, so `toast(r.error)` is safe for silent failures
  const toast = (msg, kind = 'ok', ic) => {
    const host = $('#toasts'); if (!host || !msg) return;
    const icons = { ok: 'check-circle-2', bad: 'alert-circle', gold: 'coins', info: 'info' };
    const t = document.createElement('div');
    t.className = `toast is-${kind}`;
    t.innerHTML = `${icon(ic || icons[kind] || icons.info)}<span></span>`;
    t.querySelector('span').textContent = String(msg);
    host.appendChild(t); refreshIcons();
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, 3400);
  };
  // Context menu anchored to an element. items: [{label, icon, danger, onClick}] or 'sep'
  // A popup list under its button. Items may carry a hint on the right (a code, a shortcut) and a
  // checked state, which makes them a choice among several. Arrow keys, Home and End move between
  // items; Escape and Tab close the menu, Escape handing focus back to the button.
  let menuAnchor = null;
  const menuItem = (it, i) => {
    const choice = it.checked !== undefined;
    return `<button type="button" class="menu-item ${it.danger ? 'is-danger' : ''} ${it.checked ? 'is-checked' : ''}" data-i="${i}" tabindex="-1"`
      + ` role="${choice ? 'menuitemradio' : 'menuitem'}"${choice ? ` aria-checked="${!!it.checked}"` : ''}${it.disabled ? ' disabled' : ''}>`
      + `${it.icon ? icon(it.icon) : ''}<span class="menu-label">${esc(it.label)}</span>`
      + `${it.hint ? `<span class="menu-hint">${esc(it.hint)}</span>` : ''}${choice ? `<span class="menu-check">${it.checked ? icon('check') : ''}</span>` : ''}</button>`;
  };
  const menu = (anchor, items, { label = '' } = {}) => {
    closeMenu();
    const m = document.createElement('div');
    m.className = 'menu'; m.id = 'ctx-menu';
    m.setAttribute('role', 'menu');
    if (label) m.setAttribute('aria-label', label);
    m.innerHTML = items.map((it, i) => it === 'sep' ? '<div class="menu-sep" role="separator"></div>' : menuItem(it, i)).join('');
    document.body.appendChild(m);
    menuAnchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = r.right - mw + window.scrollX, top = r.bottom + 6 + window.scrollY;
    if (left < 8) left = 8;
    if (r.bottom + mh + 12 > window.innerHeight) top = r.top - mh - 6 + window.scrollY;
    m.style.left = `${left}px`; m.style.top = `${top}px`;
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const it = items[+b.dataset.i]; closeMenu(true); if (it && it.onClick) it.onClick();
    });
    m.addEventListener('keydown', (e) => {
      const list = $$('.menu-item:not(:disabled)', m), at = list.indexOf(document.activeElement);
      const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); list[(to + list.length) % list.length].focus(); }
      else if (e.key === 'Tab') closeMenu();
    });
    refreshIcons();
    // The chosen item, or else the first, takes focus so the keyboard starts inside the menu
    const start = $('.menu-item.is-checked', m) || $('.menu-item:not(:disabled)', m);
    if (start) start.focus({ preventScroll: true });
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  };
  const closeMenu = (refocus = false) => {
    const m = $('#ctx-menu'); if (m) m.remove();
    document.removeEventListener('click', onDocClick);
    if (menuAnchor) { menuAnchor.setAttribute('aria-expanded', 'false'); if (refocus && menuAnchor.isConnected) menuAnchor.focus({ preventScroll: true }); }
    menuAnchor = null;
  };
  const onDocClick = (e) => { if (!e.target.closest('#ctx-menu')) closeMenu(); };

  // Global layer wiring: close buttons, scrim click, Escape
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-layer]')) {
      if (e.target.closest('#modal')) modal.close(); else if (e.target.closest('#drawer')) drawer.close();
    }
    if (e.target.id === 'scrim') { if (layers.modal) modal.close(); else if (layers.drawer) drawer.close(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // An open menu takes the first Escape; the drawer or modal under it stays open
    if ($('#ctx-menu')) { closeMenu(true); return; }
    if (layers.modal) modal.close(); else if (layers.drawer) drawer.close();
  });

  // The source of a photo that only loads with the session (report proofs). A browser sends the cookie
  // with a plain src; the app signs in with a token, which an <img> cannot send, so it gets
  // data-auth-src for mobile/src/native.js to fetch and fill in.
  const photoSrc = (url) => `${window.YUNative ? 'data-auth-src' : 'src'}="${esc(url)}"`;

  // The union's mark (three people around a star), the same geometry as scripts/brand-mark.mjs, drawn inline so
  // it takes the logo's colour: the people in currentColor, the star in --mark-star (see .logo-mark in layout.css)
  const MARK_SEATS = [-90, 30, 150];
  const markPt = (deg, r) => { const a = (deg * Math.PI) / 180; return [160 + r * Math.cos(a), 160 + r * Math.sin(a)]; };
  const markArc = (from, to, r) => { const [x1, y1] = markPt(from, r), [x2, y2] = markPt(to, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const MARK_STAR = `M${Array.from({ length: 10 }, (_, i) => markPt(-90 + i * 36, i % 2 ? 20 : 50).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  const MARK_SVG = `<svg class="logo-mark" viewBox="0 0 320 320" aria-hidden="true" focusable="false">${MARK_SEATS.map((a) => {
    const [hx, hy] = markPt(a, 136), [tx, ty] = markPt(a, 102);
    return `<path d="${markArc(a - 42, a + 42, 96)}" fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round"/>`
      + `<ellipse cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" rx="42" ry="24" transform="rotate(${a + 90} ${tx.toFixed(1)} ${ty.toFixed(1)})" fill="currentColor"/>`
      + `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="22" fill="currentColor"/>`;
  }).join('')}<path d="${MARK_STAR}" class="logo-mark-star"/></svg>`;
  const mark = () => MARK_SVG;

  YU.ui = {
    esc, icon, $, $$, plural, fmtNum, fmtCoins, countOf, photoSrc, mark,
    fmtDate, fmtTime, relDay, timeAgo, deadline, daysDiff, toInputValue, fromInputValue,
    safeTone, initials, avatar, chip, deptChip, pill, missionStatusPill, subStatusPill, subStatusLabel, coins, progress, ring, langSwitcher, themeToggle, empty, kpi, userLine, levelFor, title, eyebrow,
    sparkline, bars,
    on, formData, markField, debounce, busy, refreshIcons,
    drawer, modal, confirm, askPassword, toast, menu, closeMenu,
  };
})();

;
/* js/motion.js */
/* Motion: the stagger index for a screen's blocks, the marker that slides between active navigation
   items, and the ripple a press leaves on a control. motion.css draws all three. Under
   prefers-reduced-motion this only places the marker where it belongs; nothing moves. */
(function () {
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.16, 1, .3, 1)';

  // ---- A screen arriving. Its top-level blocks rise in one after another; a grid's tiles count one by one.
  const GROUPS = '.bento, .cards-2, .cards-3, .cards-4, .two-col, .settings, .profile-settings, .list, .col';
  const MAX_STAGGER = 10;
  const STEP_MS = 45;
  const units = (view) => [...view.children].flatMap((el) => (el.matches(GROUPS) && el.children.length > 1 ? [...el.children] : [el]));
  const total = (count) => 380 + Math.min(count, MAX_STAGGER) * STEP_MS + 80;
  // `resume` is the previous #view element when a re-render replaced it mid-entrance: the new one
  // carries on from the same moment (a negative delay) instead of starting over or popping in
  function enter(view, { dx = 0, dy = 14, resume = null } = {}) {
    view.classList.remove('is-entering');
    if (reduced()) return;
    const list = units(view);
    let offset = 0;
    if (resume) {
      const at = Number(resume.dataset.enterAt || 0); if (!at) return;
      offset = performance.now() - at;
      if (offset >= total(list.length)) return;
      dx = parseFloat(resume.style.getPropertyValue('--view-dx')) || 0;
      dy = parseFloat(resume.style.getPropertyValue('--view-dy')) || 0;
    }
    list.forEach((el, i) => { el.setAttribute('data-anim', ''); el.style.setProperty('--i', String(Math.min(i, MAX_STAGGER))); });
    view.style.setProperty('--view-dx', `${dx}px`);
    view.style.setProperty('--view-dy', `${dy}px`);
    view.style.setProperty('--enter-offset', `${-Math.round(offset)}ms`);
    view.dataset.enterAt = String(performance.now() - offset);
    view.classList.add('is-entering');
    // Once the last block has landed the class goes, so nothing inside is left under a transform
    setTimeout(() => view.classList.remove('is-entering'), total(list.length) - offset);
  }

  // ---- The marker. Navigation is re-rendered on every route change, so the marker is drawn fresh each time
  // and animated from where its predecessor stood (a FLIP): the eye sees one pill travelling.
  const last = {};
  const placed = {};
  const place = (m, active) => { m.style.left = `${active.offsetLeft}px`; m.style.width = `${active.offsetWidth}px`; };
  function marker(container, active, key) {
    if (!container) return;
    // The previous marker: still in the container, or detached when a render replaced the container's
    // children (a detached element keeps its running animation, so it can be put back mid-slide)
    const old = container.querySelector(`.${key}-marker`) || (placed[key] && placed[key].m) || null;
    // Set before anything reads layout, so the active item's first computed style already has no
    // background of its own and nothing fades while the marker travels. A hidden bar (the other layout's
    // navigation) gets no marker and keeps the item's own background for when a resize reveals it.
    const shown = !!active && container.offsetWidth > 0;
    container.classList.toggle('has-marker', shown);
    if (!shown) { if (old) old.remove(); last[key] = null; placed[key] = null; return; }
    // A re-render that changed nothing about the active item keeps the marker, so a slide in progress runs on
    if (old && last[key] && last[key].left === active.offsetLeft && last[key].width === active.offsetWidth) {
      if (!old.isConnected) container.appendChild(old);
      placed[key] = { m: old, active };
      return;
    }
    if (old) old.remove();
    const m = document.createElement('span');
    m.className = `${key}-marker`; m.setAttribute('aria-hidden', 'true');
    container.appendChild(m);
    place(m, active);
    watch(container);
    const to = { left: active.offsetLeft, width: active.offsetWidth };
    const from = last[key];
    last[key] = to; placed[key] = { m, active };
    if (reduced() || !m.animate) return;
    if (from && (from.left !== to.left || from.width !== to.width)) {
      m.animate([{ transform: `translateX(${from.left - to.left}px) scaleX(${from.width / to.width})` }, { transform: 'none' }], { duration: 360, easing: EASE });
    } else if (!from) {
      m.animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: EASE });
    }
  }
  // A turned phone, a resized window or a webfont arriving late moves the items; the marker follows
  // without a show, and remembers the new place so the next journey starts from the right spot
  const settle = () => {
    Object.entries(placed).forEach(([key, p]) => {
      if (!p || !p.m.isConnected || !p.active.isConnected) return;
      place(p.m, p.active);
      last[key] = { left: p.active.offsetLeft, width: p.active.offsetWidth };
    });
  };
  window.addEventListener('resize', settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  const watched = new WeakSet();
  const watch = (container) => {
    if (!window.ResizeObserver || watched.has(container)) return;
    watched.add(container);
    new ResizeObserver(settle).observe(container);
  };

  // ---- The ripple, from the point of the press outward
  // Not the tab bar or the nav pill: both are rebuilt on navigation, which would cut a ripple short
  const HOSTS = '.btn, .icon-btn, .filter-chip, .set-option, .list-item.is-link, .tab, .menu-item, .seg button';
  document.addEventListener('pointerdown', (e) => {
    if (reduced() || e.button !== 0) return;
    const host = e.target.closest && e.target.closest(HOSTS);
    if (!host || host.disabled || host.getAttribute('aria-disabled') === 'true') return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
    setTimeout(() => { if (s.isConnected) s.remove(); }, 900);
  }, { passive: true });

  YU.motion = { enter, marker, reduced };
})();

;
/* js/translations.js */
/* "Other languages" — the panel under a mission, news or reward form where a translation can be read
   and corrected. Readers see content in their own language; the server translates it automatically
   (when configured), and whoever may edit the item may fix any language here. A correction is kept
   until the original text changes. The panel lives outside the item's own <form>, so the form's
   saving logic never sees it. */
(function () {
  const U = YU.ui;
  const { esc } = U;

  // How each kind's translated fields are edited: one line, a text, one item per line, or paragraphs
  const FIELDS = {
    mission: [
      { name: 'title', type: 'line', label: 'adminContent.label.name', max: 120 },
      { name: 'location', type: 'line', label: 'adminContent.missions.locationLabel', max: 120 },
      { name: 'description', type: 'text', label: 'adminContent.label.description', max: 3000 },
      { name: 'requirements', type: 'lines', label: 'adminContent.missions.requirementsLabel', max: 200 },
    ],
    news: [
      { name: 'title', type: 'line', label: 'adminContent.label.heading', max: 160 },
      { name: 'excerpt', type: 'text', label: 'adminContent.news.excerptLabel', max: 300 },
      { name: 'body', type: 'paragraphs', label: 'adminContent.news.bodyLabel', max: 5000 },
    ],
    // A reward's description travels as desc but is stored and translated as description
    reward: [
      { name: 'title', type: 'line', label: 'adminContent.label.name', max: 80 },
      { name: 'description', from: 'desc', type: 'text', label: 'adminContent.label.description', max: 300 },
    ],
  };

  const toText = (f, v) => (Array.isArray(v) ? v.join(f.type === 'paragraphs' ? '\n\n' : '\n') : v || '');
  const fromText = (f, text) => (f.type === 'lines' ? text.split('\n').map((s) => s.trim()).filter(Boolean)
    : f.type === 'paragraphs' ? text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) : text.trim());
  const stateOf = (t) => (!t ? 'none' : t.machine === false ? 'manual' : 'auto');
  const localeLabel = (id) => (YU.i18n.locales.find((l) => l.id === id) || {}).label || id;

  function bodyHtml(kind, source, locale, t, draft) {
    const state = stateOf(t);
    const fields = FIELDS[kind].map((f, i) => {
      const id = `tr-${kind}-${f.name}`;
      const value = draft ? draft[f.name] : toText(f, t ? t[f.name] : '');
      const original = toText(f, source[f.from || f.name]);
      const control = f.type === 'line'
        ? `<input class="input" id="${id}" data-tr-field="${i}" value="${esc(value)}" placeholder="${esc(original)}" maxlength="${f.max}">`
        : `<textarea class="textarea ${f.type === 'line' ? '' : 'adminc-short'}" id="${id}" data-tr-field="${i}" rows="${f.type === 'text' ? 3 : 4}" placeholder="${esc(original)}">${esc(value)}</textarea>`;
      return `<div class="field"><label for="${id}">${YU.t(f.label)}</label>${control}</div>`;
    }).join('');
    return `<div class="tr-state small"><span class="tr-dot is-${state}" aria-hidden="true"></span>${YU.t(`translate.state.${state}`)}</div>
      <div class="adminc-form tr-fields">${fields}</div>
      <div class="row gap-8 wrap tr-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-tr-save>${U.icon('check')}${YU.t('translate.save')}</button>
        ${state === 'manual' ? `<button type="button" class="btn btn-ghost btn-sm" data-tr-reset>${U.icon('rotate-ccw')}${YU.t('translate.reset')}</button>` : ''}
      </div>`;
  }

  // The panel for a published row: a new row has nothing to translate yet, and a draft is translated
  // only once it is published, so its text does not leave the server before then
  function panel(kind, row) {
    if (!row || !row.id || !FIELDS[kind] || row.status === 'draft') return '';
    const targets = YU.i18n.locales.filter((l) => l.id !== row.sourceLocale);
    const first = targets.find((l) => l.id === YU.i18n.current()) || targets[0];
    const enabled = !!(YU.state.settings && YU.state.settings.translationEnabled);
    const tabs = targets.map((l) => {
      const state = stateOf(row.translations && row.translations[l.id]);
      return `<button type="button" class="tab ${l.id === first.id ? 'is-active' : ''}" role="tab" aria-selected="${l.id === first.id}" data-tr-locale="${esc(l.id)}">${esc(l.label)}<span class="tr-dot is-${state}" aria-hidden="true"></span></button>`;
    }).join('');
    return `<section class="tr-panel" data-tr-panel aria-label="${YU.t('translate.title')}">
      <div class="tr-head">
        <div class="h3">${YU.t('translate.title')}</div>
        ${row.sourceLocale ? `<span class="chip">${YU.t('translate.original', { language: localeLabel(row.sourceLocale) })}</span>` : ''}
      </div>
      <p class="small muted">${YU.t(enabled ? 'translate.hint' : 'translate.off')}</p>
      <div class="tabs tr-tabs" role="tablist">${tabs}</div>
      <div class="tr-body" data-tr-body>${bodyHtml(kind, YU.sourceOf(row), first.id, row.translations && row.translations[first.id], null)}</div>
    </section>`;
  }

  // Wires the panel drawn by panel() inside root; unsaved edits survive switching tabs
  function mount(root, kind, row) {
    const box = root.querySelector('[data-tr-panel]');
    if (!box) return;
    const source = YU.sourceOf(row);
    const saved = { ...(row.translations || {}) };
    const drafts = {};
    let locale = box.querySelector('.tab.is-active').dataset.trLocale;
    const read = () => Object.fromEntries(FIELDS[kind].map((f, i) => [f.name, box.querySelector(`[data-tr-field="${i}"]`).value]));
    // On a phone the tab row scrolls sideways; the chosen language is brought into view
    const showActive = () => {
      const row = box.querySelector('.tr-tabs'), a = row.querySelector('.tab.is-active');
      if (!a || row.scrollWidth <= row.clientWidth) return;
      row.scrollLeft += (a.getBoundingClientRect().left + a.offsetWidth / 2) - (row.getBoundingClientRect().left + row.clientWidth / 2);
    };
    const draw = () => {
      box.querySelector('[data-tr-body]').innerHTML = bodyHtml(kind, source, locale, saved[locale], drafts[locale]);
      box.querySelectorAll('.tab').forEach((t) => {
        const on = t.dataset.trLocale === locale;
        t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on));
        const dot = t.querySelector('.tr-dot'); if (dot) dot.className = `tr-dot is-${stateOf(saved[t.dataset.trLocale])}`;
      });
      U.refreshIcons();
      showActive();
    };
    showActive();
    U.on(box, 'click', '[data-tr-locale]', (e, el) => { drafts[locale] = read(); locale = el.dataset.trLocale; draw(); });
    U.on(box, 'click', '[data-tr-save]', async (e, btn) => {
      const text = read();
      const fields = Object.fromEntries(FIELDS[kind].map((f) => [f.name, fromText(f, text[f.name])]));
      if (!fields.title) { U.toast(YU.tText('translate.needTitle'), 'bad'); return; }
      const r = await U.busy(btn, () => YU.actions.saveTranslation(kind, row.id, locale, fields));
      if (!r.ok) { U.toast(r.error, 'bad'); return; }
      saved[locale] = { ...fields, machine: false }; delete drafts[locale];
      U.toast(YU.tText('translate.saved', { language: localeLabel(locale) }), 'ok');
      if (box.isConnected) draw();
    });
    U.on(box, 'click', '[data-tr-reset]', async (e, btn) => {
      const r = await U.busy(btn, () => YU.actions.resetTranslation(kind, row.id, locale));
      if (!r.ok) { U.toast(r.error, 'bad'); return; }
      delete saved[locale]; delete drafts[locale];
      U.toast(YU.tText('translate.resetDone'), 'ok');
      if (box.isConnected) draw();
    });
  }

  YU.contentTranslations = { panel, mount };
})();

;
/* js/picker.js */
/* Phone picker for <select>. On the phone layout a select opens a bottom sheet drawn in the app's own
   look, instead of the system's list (Android's radio dialog, iOS's wheel), in the website on a phone
   and in the iOS/Android app alike. The <select> stays the source of truth: choosing sets its value and
   fires input and change, so every screen's existing handlers work unchanged. Wider layouts keep the
   native dropdown, which suits a mouse and keyboard better. */
(function () {
  const { esc, icon, $, $$ } = YU.ui;
  // The layout.css breakpoint where the phone layout begins
  const PHONE = window.matchMedia('(max-width: 900px)');
  // A finger that travels further than this is scrolling the page, not tapping the field
  const TAP_SLOP_PX = 10;
  // Matches --dur-slow, the sheet's slide-out
  const CLOSE_MS = 320;
  let open = null;

  const pickable = (el) => !!el && el.tagName === 'SELECT' && !el.multiple && el.size <= 1 && !el.matches(':disabled') && PHONE.matches;
  const selectIn = (e) => (e.target && e.target.closest ? e.target.closest('select') : null);

  // What a screen reader would call the field: its aria-label, else its <label>
  function labelOf(select) {
    const aria = select.getAttribute('aria-label');
    if (aria) return aria;
    const label = (select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`)) || select.closest('label');
    if (!label) return '';
    // A label wrapped round its select would otherwise read out every option too
    const copy = label.cloneNode(true);
    copy.querySelectorAll('select').forEach((s) => s.remove());
    return copy.textContent.trim();
  }

  function optionRow(option, index) {
    const on = option.selected;
    return `<button type="button" class="sheet-option ${on ? 'is-selected' : ''}" role="option" aria-selected="${on}" data-index="${index}"${option.disabled ? ' disabled' : ''}>`
      + `<span class="sheet-option-label">${esc(option.textContent.trim())}</span>`
      + `<span class="sheet-check" aria-hidden="true">${on ? icon('check') : ''}</span></button>`;
  }
  function rows(select) {
    const all = [...select.options];
    return [...select.children].map((child) => (child.tagName === 'OPTGROUP'
      ? `<div class="sheet-group" role="presentation">${esc(child.label)}</div>${[...child.children].map((o) => optionRow(o, all.indexOf(o))).join('')}`
      : optionRow(child, all.indexOf(child)))).join('');
  }

  function choose(select, index) {
    if (select.selectedIndex === index) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Focus goes back to the field unless a finger opened the sheet: on iOS, focusing a select during a
  // tap opens the wheel. A keyboard, a mouse or a screen reader's double-tap gets its place back.
  function close() {
    if (!open) return;
    const { wrap, select, byTouch } = open;
    open = null;
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), CLOSE_MS);
    if (!byTouch && select.isConnected) select.focus({ preventScroll: true });
  }

  function openPicker(select, byTouch) {
    close();
    const title = labelOf(select);
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
      <div class="sheet on-light" role="dialog" aria-modal="true"${title ? ` aria-label="${esc(title)}"` : ''}>
        <div class="sheet-grip" aria-hidden="true"></div>
        ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
        <div class="sheet-list" role="listbox">${rows(select)}</div>
      </div>`;
    document.body.appendChild(wrap);
    open = { wrap, select, byTouch };
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-sheet-close]')) { close(); return; }
      const row = e.target.closest('[data-index]');
      if (!row || row.disabled) return;
      close();
      choose(select, Number(row.dataset.index));
    });
    wrap.addEventListener('keydown', (e) => {
      const list = $$('.sheet-option:not(:disabled)', wrap), at = list.indexOf(document.activeElement);
      const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); list[(to + list.length) % list.length].focus(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    YU.ui.refreshIcons();
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    const start = $('.sheet-option.is-selected', wrap) || $('.sheet-option:not(:disabled)', wrap);
    if (start) { start.focus({ preventScroll: true }); start.scrollIntoView({ block: 'nearest' }); }
  }

  // The system list opens on the press itself, so the press is cancelled and the sheet opens instead:
  // on touchend for fingers (which also cancels the click and mousedown that follow), on click for
  // a mouse or a screen reader's double-tap.
  let touchStart = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = pickable(selectIn(e)) && t ? { x: t.clientX, y: t.clientY } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', (e) => {
    const select = selectIn(e), t = e.changedTouches[0];
    if (!touchStart || !pickable(select) || !t) return;
    const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > TAP_SLOP_PX;
    touchStart = null;
    if (moved) return;
    e.preventDefault();
    openPicker(select, true);
  }, { capture: true, passive: false });
  document.addEventListener('mousedown', (e) => { if (pickable(selectIn(e))) e.preventDefault(); }, true);
  document.addEventListener('click', (e) => {
    const select = selectIn(e);
    if (!pickable(select)) return;
    e.preventDefault();
    if (!open) openPicker(select, false);
  }, true);
  document.addEventListener('keydown', (e) => {
    const select = selectIn(e);
    if (!pickable(select) || !['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    openPicker(select, false);
  }, true);
  // Leaving the screen, or widening past the phone layout, takes the sheet away with it
  window.addEventListener('hashchange', () => close());
  PHONE.addEventListener('change', () => close());

  YU.ui.picker = { isOpen: () => !!open, close };
})();

;
/* js/router.js */
/* Hash router. #/<screen>/<id>/<sub>?query → YU.screens[screen].render(params) + mount(root, params). */
(function () {
  YU.screens = YU.screens || {};
  YU.adminSections = YU.adminSections || [];

  const parse = () => {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, query = ''] = raw.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    return {
      name: segs[0] || 'dashboard',
      params: { id: segs[1] || null, sub: segs[2] || null, query: Object.fromEntries(new URLSearchParams(query)) },
      path: pathPart,
    };
  };

  // Screens that need a permission beyond being logged in: a permission name, or a check of its own
  const GUARDS = { rewards: 'rewards.view', review: 'review.panel', admin: () => YU.can('*') || YU.canManageNews() };
  const allowed = (guard) => (typeof guard === 'function' ? guard() : YU.can(guard));
  // Screens for logged-out visitors only; a logged-in user is sent home from them
  const GUEST_ONLY = new Set(['login', 'register', 'forgot']);
  // Screens anyone may open, logged in or not
  const OPEN = new Set(['privacy', 'app']);
  // The tab bar's order, so a move between tabs can slide the way the finger went
  const TAB_ORDER = ['dashboard', 'missions', 'news', 'rating', 'profile'];
  let current = null;
  // Bumped on every navigation. Code that continues after an await compares tokens to know the user has moved on.
  let navToken = 0;

  const render = (opts = {}) => {
    const route = parse();
    const shell = YU.ui.$('#shell'), view = YU.ui.$('#view');
    if (!shell || !view) return;

    const guestOnly = GUEST_ONLY.has(route.name), open = OPEN.has(route.name);
    if (!YU.state.session.loggedIn && !guestOnly && !open) { location.hash = '#/login'; return; }
    if (YU.state.session.loggedIn && guestOnly) { location.hash = '#/'; return; }
    const guard = GUARDS[route.name];
    if (guard && !allowed(guard)) { YU.ui.toast(YU.tText('error.forbiddenSection'), 'bad'); location.hash = '#/'; return; }

    const screen = YU.screens[route.name] || YU.screens.notfound;
    // The full-bleed blue layout is used for the guest screens, and for open ones while logged out
    const isAuth = guestOnly || (open && !YU.state.session.loggedIn);
    shell.classList.toggle('is-auth', isAuth);
    view.classList.toggle('is-auth', isAuth);
    ['#sidebar', '#topbar', '#tabbar'].forEach((s) => { const el = YU.ui.$(s); if (el) el.hidden = isAuth; });

    const changed = !current || current.name !== route.name || current.params.id !== route.params.id || current.params.sub !== route.params.sub;
    // Leaving a screen closes any layer it opened
    if (current && current.name !== route.name) { YU.ui.drawer.close(); YU.ui.modal.close(); YU.ui.closeMenu(); }
    // Fresh element each render so delegated listeners from previous mounts do not pile up
    const fresh = view.cloneNode(false);
    const entering = view.classList.contains('is-entering') ? view : null;
    view.replaceWith(fresh);
    try {
      fresh.innerHTML = screen.render(route.params);
      if (screen.mount) screen.mount(fresh, route.params);
    } catch (err) {
      // A screen that throws must not leave a blank page: say so, log it, and offer a fresh load
      console.error(`[screen ${route.name}]`, err);
      fresh.innerHTML = YU.ui.empty({
        icon: 'alert-triangle', title: YU.t('error.screenTitle'), text: YU.t('error.screenText'),
        action: `<button class="btn btn-primary" type="button" id="screen-retry">${YU.ui.esc(YU.t('action.tryAgain'))}</button>`,
      });
      const retry = fresh.querySelector('#screen-retry');
      if (retry) retry.onclick = () => { YU.reload().then(() => render({ keepScroll: true })); };
    }

    const title = typeof screen.title === 'function' ? screen.title(route.params) : screen.title || 'YU';
    document.title = `${title} — YU CRM`;
    if (!isAuth && YU.app && YU.app.renderChrome) YU.app.renderChrome(route, title);
    if (isAuth && YU.app && YU.app.hideChrome) YU.app.hideChrome();
    YU.ui.refreshIcons();
    if (changed && !opts.keepScroll) {
      window.scrollTo(0, 0);
      // A move between neighbouring tabs slides sideways in the direction of travel; any other arrival rises
      const a = current ? TAB_ORDER.indexOf(current.name) : -1, b = TAB_ORDER.indexOf(route.name);
      // 16px stays inside the column's own gutter, so the clipped edge never shows
      const dx = a >= 0 && b >= 0 && a !== b ? Math.sign(b - a) * 16 : 0;
      if (YU.motion) YU.motion.enter(fresh, { dx, dy: dx ? 0 : 14 });
    } else if (entering && YU.motion) {
      YU.motion.enter(fresh, { resume: entering });
    }
    current = route;
  };

  YU.router = {
    go(path) { location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\/+/, '')}`; },
    refresh() { render({ keepScroll: true }); },
    current: () => current,
    parse,
    token: () => navToken,
  };

  window.addEventListener('hashchange', () => { navToken += 1; render(); });
  YU.subscribe(() => render({ keepScroll: true }));
  // A promise nobody awaited must not fail in silence
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled]', e.reason);
    if (YU.ui && YU.ui.toast && YU.i18n.current()) YU.ui.toast(YU.tText('error.generic'), 'bad');
  });

  YU.screens.notfound = {
    title: () => YU.t('notfound.title'),
    render: () => YU.ui.empty({ icon: 'compass', title: YU.t('notfound.heading'), text: YU.t('notfound.text'), action: `<a class="btn btn-primary" href="#/">${YU.ui.esc(YU.t('action.home'))}</a>` }),
  };

  // Shown in #view until the session and data have loaded, or when the server cannot be reached
  const splash = (html) => { const view = YU.ui.$('#view'); if (view) { view.classList.add('is-auth'); view.innerHTML = html; } };
  YU.boot = async () => {
    splash(`<div class="splash" role="status" aria-live="polite"><span class="logo">${YU.ui.mark()}youth union</span><span class="splash-dot" aria-hidden="true"></span><span class="sr-only">${YU.ui.esc(YU.t('app.loading'))}</span></div>`);
    const r = await YU.start();
    if (!r.ok) {
      // The server never answered, so no catalogue was chosen yet: load one, or the splash shows raw keys
      if (!YU.i18n.current()) await YU.i18n.apply(YU.i18n.resolve(null, null));
      const text = r.code === 'network' ? YU.t('error.offline') : YU.ui.esc(r.error);
      splash(`<div class="splash"><span class="logo">${YU.ui.mark()}youth union</span><p class="splash-text">${text}</p><button class="btn btn-secondary" type="button" id="splash-retry">${YU.ui.esc(YU.t('action.tryAgain'))}</button></div>`);
      YU.ui.$('#splash-retry').onclick = () => YU.boot();
      return;
    }
    if (!location.hash) { location.hash = YU.prefs.startPath(); return; }
    render();
  };
})();

;
/* js/screens/login.js */
/* Login — blue full-bleed, logo row, big headline left, white sign-in card right with links to sign-up and password reset. */
(function () {
  const U = YU.ui;
  const { esc } = U;

  const initialEmail = (params) => (params && params.query && params.query.email !== undefined) ? String(params.query.email) : ((YU.state.ui.login && YU.state.ui.login.email) || '');

  function render(params) {
    const email = initialEmail(params);
    return `<div class="login-page">
      <div class="login-top">
        <span class="logo">${U.mark()}youth union</span>
        <span class="login-top-end"><span class="eyebrow login-top-right">${YU.t('login.orgLine', { university: YU.state.org.university })}</span>${U.themeToggle()}${U.langSwitcher()}</span>
      </div>
      <div class="login-grid">
        <div class="login-copy">
          <span class="eyebrow-pill">${YU.t('login.eyebrow')}</span>
          <h1 class="h1 login-title">${YU.t('login.headline')}</h1>
          <p class="login-lead">${YU.t('login.lead')}</p>
        </div>
        <div class="login-side">
          <form class="login-card" id="login-form" novalidate>
            <div class="login-card-title">${YU.t('login.cardTitle')}</div>
            <div class="login-card-sub">${YU.t('login.cardSub')}</div>
            <div class="col gap-10">
              <div class="field" data-field="email">
                <input class="input" id="login-email" name="email" type="email" autocomplete="username" placeholder="${YU.t('login.emailPlaceholder', { domain: YU.state.registration.domain || YU.EXAMPLE_EMAIL_DOMAIN })}" value="${esc(email)}" aria-label="${YU.t('login.emailLabel')}" required>
              </div>
              <div class="field" data-field="password">
                <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="${YU.t('login.passwordPlaceholder')}" aria-label="${YU.t('login.passwordLabel')}" required maxlength="128">
              </div>
              <span class="form-error" id="login-error" role="alert" hidden></span>
              <button class="btn btn-blue btn-lg btn-block login-submit" type="submit">${YU.t('login.submit')}</button>
            </div>
            <div class="login-card-note"><a class="login-link" href="#/forgot">${YU.t('login.forgotLink')}</a></div>
          </form>
          <div class="login-alt">${YU.t('login.noAccount')} <a class="login-link-light" href="#/register">${YU.t('login.registerLink')}</a></div>
          ${window.YUNative ? '' : `<div class="login-alt mt-12">${YU.t('app.login.text')} <a class="login-link-light" href="#/app">${YU.t('app.login.link')}</a></div>`}
        </div>
      </div>
    </div>`;
  }

  function mount(root) {
    const form = root.querySelector('#login-form');
    const email = root.querySelector('#login-email');
    const password = root.querySelector('#login-password');
    const err = root.querySelector('#login-error');
    const showError = (msg, field) => {
      err.textContent = msg; err.hidden = false;
      [email, password].forEach((el) => el.classList.toggle('is-invalid', el === field));
      if (field) field.focus();
    };
    const clearError = () => { err.hidden = true; email.classList.remove('is-invalid'); password.classList.remove('is-invalid'); };
    email.addEventListener('input', () => { YU.state.ui.login = { ...(YU.state.ui.login || {}), email: email.value }; clearError(); });
    password.addEventListener('input', clearError);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const address = email.value.trim();
      if (!address) return showError(YU.t('login.error.emailRequired'), email);
      if (!password.value) return showError(YU.t('login.error.passwordRequired'), password);
      const r = await U.busy(form.querySelector('.login-submit'), () => YU.actions.login(address, password.value));
      if (!r.ok) { if (r.error) showError(r.error, password); password.value = ''; return; }
      YU.state.ui.login = {};
      U.toast(YU.tText('login.welcomeBack', { name: r.user.name.split(' ')[0] }), 'ok');
      location.hash = YU.prefs.startPath();
    });
    if (matchMedia('(min-width: 901px)').matches) setTimeout(() => (email.value ? password : email).focus(), 50);
  }

  YU.screens.login = { title: () => YU.t('login.pageTitle'), render, mount };
})();

;
/* js/screens/auth.js */
/* Public account screens: sign-up (#/register), password reset (#/forgot) and the privacy notice (#/privacy).
   Sign-up and reset both work in two steps: ask for the email, then the code from the letter. */
(function () {
  const U = YU.ui;
  const { esc, icon } = U;
  const PASSWORD_MIN = 8;

  const ui = () => (YU.state.ui.auth = YU.state.ui.auth || { step: 'email', email: '', flow: '', draft: {} });
  const setUi = (patch) => { YU.state.ui.auth = { ...ui(), ...patch }; };
  // Starting a flow from scratch when the screen is opened fresh
  const flowState = (flow) => { const st = ui(); if (st.flow !== flow) setUi({ flow, step: 'email', email: '', draft: {} }); return ui(); };
  // What has been typed so far: switching the language or theme re-renders the form, and must not empty it
  const draft = () => ui().draft || {};
  const typed = (name) => `value="${esc(draft()[name] || '')}"`;

  const page = ({ title, lead, card }) => `<div class="login-page">
      <div class="login-top">
        <a class="logo" href="#/login">${U.mark()}youth union</a>
        <span class="login-top-end"><span class="eyebrow login-top-right">${YU.t('login.orgLine', { university: YU.state.org.university })}</span>${U.themeToggle()}${U.langSwitcher()}</span>
      </div>
      <div class="login-grid">
        <div class="login-copy">
          <span class="eyebrow-pill">${YU.t('auth.eyebrow')}</span>
          <h1 class="h1 login-title">${title}</h1>
          <p class="login-lead">${lead}</p>
        </div>
        <div class="login-side">${card}</div>
      </div>
    </div>`;

  const card = ({ title, sub, body, submit, note }) => `<form class="login-card" id="auth-form" novalidate>
      <div class="login-card-title">${title}</div>
      <div class="login-card-sub">${sub}</div>
      <div class="col gap-10">${body}
        <span class="form-error" id="auth-error" role="alert" hidden></span>
        <button class="btn btn-blue btn-lg btn-block login-submit" type="submit">${submit}</button>
      </div>
      ${note ? `<div class="login-card-note">${note}</div>` : ''}
    </form>`;

  const field = (name, label, attrs = '') => `<div class="field" data-field="${name}">
      <label for="auth-${name}">${label}</label><input class="input" id="auth-${name}" name="${name}" ${attrs}>
    </div>`;

  // ---------- Sign-up
  function registerRender() {
    const st = flowState('register');
    const domain = YU.state.registration.domain;
    if (!YU.state.registration.open) {
      return page({
        title: YU.t('auth.register.closedTitle'), lead: YU.t('auth.register.closedLead'),
        card: `<div class="login-card"><div class="login-card-title">${YU.t('auth.register.closedCardTitle')}</div><div class="login-card-sub">${YU.t('auth.register.closedCardSub')}</div>
          <a class="btn btn-secondary btn-block mt-16" href="#/login">${YU.t('auth.register.backToLogin')}</a></div>`,
      });
    }
    const body = st.step === 'email'
      ? field('email', YU.t('auth.emailLabel'), `type="email" autocomplete="username" placeholder="${YU.t('auth.emailPlaceholder', { domain: domain || YU.EXAMPLE_EMAIL_DOMAIN })}" value="${esc(draft().email || st.email)}" required`)
      : `<div class="notice notice-info">${icon('mail')}<span>${YU.t('auth.register.codeSent', { email: st.email })}</span></div>
        ${field('code', YU.t('auth.codeLabel'), `inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" ${typed('code')} required`)}
        ${field('name', YU.t('auth.register.nameLabel'), `maxlength="60" autocomplete="name" placeholder="${YU.t('auth.register.namePlaceholder')}" ${typed('name')} required`)}
        ${field('group', YU.t('auth.register.groupLabel'), `maxlength="20" placeholder="CSE-25-1" ${typed('group')} required`)}
        ${field('school', YU.t('auth.register.schoolLabel'), `maxlength="20" placeholder="SOCIE" ${typed('school')}`)}
        ${field('password', YU.t('auth.passwordLabel'), `type="password" autocomplete="new-password" minlength="${PASSWORD_MIN}" maxlength="128" ${typed('password')} required`)}
        <span class="hint">${YU.t('auth.register.passwordHint', { min: PASSWORD_MIN })}</span>
        <label class="check"><input type="checkbox" name="consent" value="1" ${draft().consent ? 'checked' : ''}>${YU.t('auth.register.consent')} <a href="#/privacy">${YU.t('auth.register.consentLink')}</a></label>`;
    return page({
      title: YU.t('auth.register.title'),
      lead: domain ? YU.t('auth.register.lead', { domain }) : YU.t('auth.register.leadAny'),
      card: card({
        title: st.step === 'email' ? YU.t('auth.register.stepEmailTitle') : YU.t('auth.register.stepCodeTitle'),
        sub: st.step === 'email' ? YU.t('auth.register.stepEmailSub') : YU.t('auth.register.stepCodeSub'),
        body, submit: st.step === 'email' ? YU.t('auth.getCode') : YU.t('auth.register.submitComplete'),
        note: st.step === 'email' ? `${YU.t('auth.register.haveAccount')} <a class="login-link" href="#/login">${YU.t('auth.signInLink')}</a>` : `<button type="button" class="login-link" data-auth="back">${YU.t('auth.otherEmail')}</button>`,
      }),
    });
  }

  // ---------- Password reset
  function forgotRender() {
    const st = flowState('forgot');
    const body = st.step === 'email'
      ? field('email', YU.t('auth.emailLabel'), `type="email" autocomplete="username" placeholder="${YU.t('auth.emailPlaceholder', { domain: YU.state.registration.domain || YU.EXAMPLE_EMAIL_DOMAIN })}" ${typed('email')} required`)
      : `<div class="notice notice-info">${icon('mail')}<span>${YU.t('auth.forgot.codeSent', { email: st.email })}</span></div>
        ${field('code', YU.t('auth.codeLabel'), `inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" ${typed('code')} required`)}
        ${field('password', YU.t('auth.forgot.newPasswordLabel'), `type="password" autocomplete="new-password" minlength="${PASSWORD_MIN}" maxlength="128" ${typed('password')} required`)}
        <span class="hint">${YU.t('auth.forgot.passwordHint', { min: PASSWORD_MIN })}</span>`;
    return page({
      title: YU.t('auth.forgot.title'),
      lead: YU.t('auth.forgot.lead'),
      card: card({
        title: st.step === 'email' ? YU.t('auth.forgot.stepEmailTitle') : YU.t('auth.forgot.stepCodeTitle'),
        sub: st.step === 'email' ? YU.t('auth.forgot.stepEmailSub') : YU.t('auth.forgot.stepCodeSub'),
        body, submit: st.step === 'email' ? YU.t('auth.getCode') : YU.t('auth.forgot.submitSave'),
        note: st.step === 'email' ? `${YU.t('auth.forgot.rememberedPassword')} <a class="login-link" href="#/login">${YU.t('auth.signInLink')}</a>` : `<button type="button" class="login-link" data-auth="back">${YU.t('auth.otherEmail')}</button>`,
      }),
    });
  }

  function mountFlow(root, flow) {
    const form = root.querySelector('#auth-form');
    const err = root.querySelector('#auth-error');
    const fail = (msg, name) => {
      err.textContent = msg; err.hidden = false;
      const el = name && form.querySelector(`[name="${name}"]`);
      form.querySelectorAll('.input').forEach((i) => i.classList.toggle('is-invalid', i === el));
      if (el) el.focus();
    };
    U.on(form, 'input', '.input', (e, el) => { err.hidden = true; if (el.name) setUi({ draft: { ...draft(), [el.name]: el.value } }); });
    U.on(form, 'change', 'input[type="checkbox"]', (e, el) => { setUi({ draft: { ...draft(), [el.name]: el.checked } }); });
    U.on(root, 'click', '[data-auth="back"]', () => { setUi({ step: 'email', draft: { email: ui().email } }); YU.emit('change'); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = U.formData(form);
      const btn = form.querySelector('.login-submit');
      const st = ui();
      if (st.step === 'email') {
        const email = String(f.email || '').trim();
        if (!email) return fail(YU.t('auth.error.emailRequired'), 'email');
        const r = await U.busy(btn, () => YU.api.post(flow === 'register' ? '/auth/register/start' : '/auth/password/forgot', { email }));
        if (!r.ok) return fail(r.error, 'email');
        setUi({ step: 'code', email: email.toLowerCase(), draft: {} });
        YU.emit('change');
        return;
      }
      const code = String(f.code || '').trim(), password = String(f.password || '');
      if (!/^\d{6}$/.test(code)) return fail(YU.t('auth.error.codeFormat'), 'code');
      if (password.length < PASSWORD_MIN) return fail(YU.t('auth.error.passwordShort', { min: PASSWORD_MIN }), 'password');
      let r;
      if (flow === 'register') {
        if (!String(f.name || '').trim()) return fail(YU.t('auth.error.nameRequired'), 'name');
        if (!String(f.group || '').trim()) return fail(YU.t('auth.error.groupRequired'), 'group');
        if (!f.consent) return fail(YU.t('auth.error.consentRequired'), 'consent');
        r = await U.busy(btn, () => YU.api.post('/auth/register/complete', {
          email: st.email, code, name: String(f.name).trim(), group: String(f.group).trim(), school: String(f.school || '').trim(), password, consent: true,
        }));
      } else {
        r = await U.busy(btn, () => YU.api.post('/auth/password/reset', { email: st.email, code, password }));
      }
      // The server names the field its message is about; anything it does not name is about the password
      if (!r.ok) return fail(r.error, r.field && form.querySelector(`[name="${r.field}"]`) ? r.field : 'password');
      // The account and session exist now: the form is cleared only once its data has loaded, so a
      // failed load can be retried without "this address already has an account"
      const snap = await YU.reloadAfterAuth();
      if (!snap.ok) return fail(snap.error);
      setUi({ step: 'email', email: '', flow: '', draft: {} });
      U.toast(flow === 'register' ? YU.t('auth.register.toast') : YU.t('auth.forgot.toast'), 'ok');
      location.hash = YU.prefs.startPath();
    });
    const first = form.querySelector('.input');
    if (first && matchMedia('(min-width: 901px)').matches) setTimeout(() => first.focus(), 50);
  }

  // ---------- Privacy notice
  function privacyRender() {
    const sections = ['collected', 'purpose', 'audience', 'retention', 'rights'];
    const body = `<article class="prose auth-legal">
        <h1 class="h1">${YU.t('auth.privacy.heading')}</h1>
        <p class="lead">${YU.t('auth.privacy.lead')}</p>
        ${sections.map((s) => `<h2 class="h2 mt-24">${YU.t('auth.privacy.' + s + '.title')}</h2><p>${YU.t('auth.privacy.' + s + '.text')}</p>`).join('')}
        <p class="mt-24"><a class="btn btn-secondary" href="${YU.state.session.loggedIn ? '#/settings' : '#/register'}">${YU.t('auth.privacy.back')}</a></p>
      </article>`;
    // Logged out the notice stands alone on the blue ground; logged in it renders inside the usual shell
    return YU.state.session.loggedIn ? body : `<div class="login-page"><div class="login-top"><a class="logo" href="#/login">${U.mark()}youth union</a>${U.themeToggle()}${U.langSwitcher()}</div><div class="auth-legal-wrap">${body}</div></div>`;
  }

  YU.screens.register = { title: () => YU.t('auth.register.pageTitle'), render: registerRender, mount: (root) => mountFlow(root, 'register') };
  YU.screens.forgot = { title: () => YU.t('auth.forgot.pageTitle'), render: forgotRender, mount: (root) => mountFlow(root, 'forgot') };
  YU.screens.privacy = { title: () => YU.t('auth.privacy.pageTitle'), render: privacyRender };
})();

;
/* js/screens/app-download.js */
/* The Android app page — #/app. Open to anyone, signed in or not: where to get the app, which version is
   current and how a build that does not come from a store is installed. Inside the app itself the same page
   says which version is installed and whether a newer one is out.
   All classes prefixed .app- */
(function () {
  const U = YU.ui;
  const { esc, icon, fmtDate } = U;
  const MB = 1024 * 1024;
  const fmtSize = (bytes) => `${(bytes / MB).toFixed(1).replace(/\.0$/, '')} MB`;
  const isAndroid = () => /android/i.test(navigator.userAgent);
  const native = () => window.YUNative || null;
  // In the app the API lives on another origin; a link that leaves the app is opened by the native layer.
  // A build hosted elsewhere (Google Drive) is reached through the same path: the server redirects to it.
  const downloadHref = (release) => (native() ? `${native().apiOrigin}${release.url}` : release.url);
  // What the last fetch said, kept across re-renders (a language switch, a login) so the page does not flash
  let latest = { status: 'loading', release: null };
  let installed = null;

  function versionBlock() {
    if (latest.status === 'loading') return `<p class="small muted">${YU.t('app.page.loading')}</p>`;
    if (latest.status === 'error') return `<p class="small muted">${YU.t('app.page.offline')}</p><button type="button" class="btn btn-secondary btn-sm" data-app-action="retry">${icon('refresh-cw')}${YU.t('app.page.retry')}</button>`;
    const r = latest.release;
    if (!r) return `<p class="small muted">${YU.t('app.page.none')}</p>`;
    const current = installed && Number(installed.build) >= r.versionCode;
    return `
      <div class="app-version">
        <span class="pill pill-info">${icon('package')}${YU.t('app.page.version', { version: r.versionName })}</span>
        <span class="small muted">${r.hosted ? YU.t('app.page.meta', { size: fmtSize(r.bytes), date: fmtDate(r.publishedAt, { year: true }) }) : YU.t('app.page.metaLink', { date: fmtDate(r.publishedAt, { year: true }) })}</span>
      </div>
      ${installed ? `<p class="small muted mt-8">${YU.t('app.page.installed', { version: installed.version })}${current ? ` ${YU.t('app.page.upToDate')}` : ''}</p>` : ''}
      ${r.notes ? `<p class="small mt-8">${esc(r.notes)}</p>` : ''}
      ${current ? '' : `<a class="btn btn-primary btn-lg app-download" href="${esc(downloadHref(r))}" ${native() ? 'target="_blank"' : 'download'}>${icon('download')}${YU.t('app.page.download')}</a>`}
      ${isAndroid() || native() ? '' : `<p class="small muted mt-8">${YU.t('app.page.notAndroid')}</p>`}`;
  }

  function body() {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    return `<article class="app-page">
      <div class="app-hero">
        <span class="app-icon">${U.mark()}</span>
        <div>
          <h1 class="h1">${YU.t('app.page.heading')}</h1>
          <p class="lead">${YU.t('app.page.lead')}</p>
        </div>
      </div>
      <section class="panel"><div class="panel-body" id="app-version-box">${versionBlock()}</div></section>
      <section class="panel"><div class="panel-head"><span class="h2">${YU.t('app.page.stepsTitle')}</span></div>
        <div class="panel-body"><ol class="app-steps">${steps.map((s) => `<li>${YU.t('app.page.' + s)}</li>`).join('')}</ol>
        <p class="small muted mt-12 app-note">${icon('refresh-cw')}<span>${YU.t('app.page.updates')}</span></p>
        <p class="small muted mt-8 app-note">${icon('apple')}<span>${YU.t('app.page.ios')}</span></p></div>
      </section>
      <p class="mt-16"><a class="btn btn-secondary" href="${YU.state.session.loggedIn ? '#/settings' : '#/login'}">${YU.t('app.page.back')}</a></p>
    </article>`;
  }

  // Logged out the page stands alone on the blue ground, like the privacy notice; logged in it sits in the shell
  function render() {
    const content = body();
    return YU.state.session.loggedIn ? content : `<div class="login-page"><div class="login-top"><a class="logo" href="#/login">${U.mark()}youth union</a>${U.themeToggle()}${U.langSwitcher()}</div><div class="auth-legal-wrap">${content}</div></div>`;
  }

  async function load(root) {
    latest = { status: 'loading', release: null };
    const box = root.querySelector('#app-version-box');
    if (box) { box.innerHTML = versionBlock(); U.refreshIcons(); }
    const [r, info] = await Promise.all([
      YU.api.get('/app/android'),
      native() && native().appInfo ? native().appInfo().catch(() => null) : Promise.resolve(null),
    ]);
    installed = info;
    latest = r.ok ? { status: 'ready', release: r.release || null } : { status: 'error', release: null };
    const again = root.querySelector('#app-version-box');
    if (again) { again.innerHTML = versionBlock(); U.refreshIcons(); }
  }

  function mount(root) {
    U.on(root, 'click', '[data-app-action="retry"]', () => load(root));
    load(root);
  }

  YU.screens.app = { title: () => YU.t('app.page.title'), render, mount };
})();

;
/* js/screens/dashboard.js */
/* Dashboard — the reference screen. Hero with headline and featured mission; four stat tiles; my missions + latest news. */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, deptChip, subStatusPill, fmtNum, deadline, fmtDate, timeAgo, progress } = U;
  const DAY = 86400000;

  // Catalogue keys, not text: the headline has to follow the language switch like everything else.
  const HEADLINE = {
    member: 'dashboard.hero.headline.member',
    student: 'dashboard.hero.headline.student',
    coordinator: 'dashboard.hero.headline.coordinator',
    admin: 'dashboard.hero.headline.admin',
  };
  const myOpenSubs = () => YU.select.mySubmissions()
    .filter((s) => ['in_progress', 'pending', 'rejected'].includes(s.status))
    .map((s) => ({ s, t: YU.mission(s.missionId) })).filter((x) => x.t)
    .sort((a, b) => new Date(a.t.deadline) - new Date(b.t.deadline));
  const featuredTask = (me) => {
    const mine = new Set(YU.select.mySubmissions().map((s) => s.missionId));
    return YU.select.visibleMissions()
      .filter((t) => t.status === 'open' && !mine.has(t.id) && YU.select.seatsLeft(t) > 0)
      .sort((a, b) => YU.select.seatsLeft(b) - YU.select.seatsLeft(a) || b.coins - a.coins)[0] || null;
  };

  // ---------- Hero
  function hero(me) {
    const role = me.role;
    const earning = YU.state.users.filter((u) => u.status === 'active' && u.coinsSemester > 0);
    const top = earning.slice(0, 3);
    const ft = featuredTask(me);
    const primary = role === 'admin'
      ? `<a class="btn btn-secondary" href="#/admin">${YU.t('dashboard.hero.cta.admin')}</a>`
      : YU.can('review.panel') ? `<a class="btn btn-secondary" href="#/review">${YU.t('dashboard.hero.cta.review')}</a>`
      : `<a class="btn btn-secondary" href="#/missions">${YU.t('dashboard.hero.cta.missions')}</a>`;
    return `<section class="dash-hero">
      <span class="deco-ring" style="left:34%;top:6%;width:130px;height:130px" aria-hidden="true"></span>
      <span class="deco-ring" style="left:8%;bottom:30%;width:72px;height:72px" aria-hidden="true"></span>
      <span class="deco-ring" style="right:30%;bottom:8%;width:96px;height:96px" aria-hidden="true"></span>
      <span class="deco-star" style="left:26%;top:2%" aria-hidden="true">✦</span>
      <div class="dash-hero-left">
        <div>
          <div class="dash-earning">
            <span class="avatar-stack">${top.map((u) => avatar(u)).join('')}<span class="avatar more">+</span></span>
            <span>${YU.t('dashboard.hero.earning', { count: earning.length })}</span>
          </div>
        </div>
        <div>
          <span class="eyebrow-pill" style="margin-bottom:16px">${YU.t('dashboard.hero.eyebrow')}</span>
          <h1 class="h1 dash-title">${YU.t(HEADLINE[role] || HEADLINE.member)}</h1>
          <div class="dash-hero-actions">
            ${primary}
            <a class="icon-btn" href="#/rating" title="${YU.t('nav.rating')}" aria-label="${YU.t('nav.rating')}">${icon('trophy')}</a>
            <a class="icon-btn" href="#/news" title="${YU.t('nav.news')}" aria-label="${YU.t('nav.news')}">${icon('newspaper')}</a>
          </div>
        </div>
      </div>
      <div class="dash-hero-right">
        <div class="dash-hero-note">${YU.t('dashboard.hero.note')}</div>
        ${ft ? `<div class="dash-feature">
          <div class="news-cover tone-${U.safeTone(YU.dept(ft.deptId) && YU.dept(ft.deptId).tone)}"><div style="position:absolute;left:12px;top:12px">${deptChip(ft.deptId)}</div></div>
          <div style="padding:12px 6px 6px">
            <div class="dash-feature-title">${esc(ft.title)}</div>
            <div class="dash-feature-sub">${YU.t('dashboard.hero.feature.seats', { count: YU.select.seatsLeft(ft) })}. ${esc(ft.location)}. ${YU.t('dashboard.hero.feature.reward', { count: ft.coins })}.</div>
            ${YU.isParticipant()
              ? `<a class="btn btn-secondary btn-block" style="margin-top:12px" href="#/missions/${ft.id}">${YU.t('dashboard.hero.feature.cta')}</a>`
              : `<a class="btn btn-secondary btn-block" style="margin-top:12px" href="#/admin/missions/${ft.id}">${YU.t('dashboard.hero.feature.manage')}</a>`}
          </div>
        </div>` : `<div class="dash-feature"><div style="padding:8px 6px"><div class="dash-feature-title">${YU.t('dashboard.hero.soon.title')}</div><div class="dash-feature-sub">${YU.t('dashboard.hero.soon.text')}</div><a class="btn btn-secondary btn-block" style="margin-top:12px" href="#/news">${YU.t('dashboard.hero.soon.cta')}</a></div></div>`}
      </div>
      ${YU.isParticipant() ? progressPanel(me) : ''}
    </section>`;
  }

  // ---------- Stat tiles
  const tile = (kind, label, value, sub = '') => `<div class="dash-tile ${kind}"><div class="kpi-label">${label}</div>${value}${sub}</div>`;
  const big = (v) => `<div class="kpi-value dash-big">${v}</div>`;
  const titleText = (v) => `<div class="dash-tile-title">${v}</div>`;
  const sub = (v) => `<div class="dash-tile-sub">${v}</div>`;
  const chipSub = (v) => `<div class="dash-tile-chip">${v}</div>`;

  function tilesMember(me) {
    const monthGain = YU.select.userTransactions(me.id).filter((t) => t.delta > 0 && (YU.now() - new Date(t.at)) < 30 * DAY).reduce((a, t) => a + t.delta, 0);
    const lv = U.levelFor(me.coinsTotal);
    const board = YU.select.leaderboard('semester');
    const rank = YU.select.rankOf(me.id);
    const toTop5 = rank && rank > 5 ? board[4].coinsSemester - me.coinsSemester + 1 : 0;
    const open = myOpenSubs();
    const active = open.filter((x) => x.s.status !== 'rejected');
    const next = open.find((x) => x.s.status !== 'pending');
    const dl = next ? deadline(next.t.deadline) : null;
    return [
      tile('panel', YU.t('dashboard.tiles.myCoins.label'), big(fmtNum(me.coinsSemester)), chipSub(monthGain ? YU.t('dashboard.tiles.monthGain', { amount: monthGain }) : YU.t('dashboard.tiles.myCoins.level', { level: lv.level.name }))),
      tile('panel', YU.t('dashboard.tiles.rank.label'), big(rank ? `#${rank}` : '—'), sub(rank ? (toTop5 ? `${YU.t('dashboard.tiles.rank.toTop5', { count: toTop5 })} · <a href="#/rating">${YU.t('dashboard.tiles.rank.allRating')}</a>` : `${YU.t('dashboard.tiles.rank.inTop5')} · <a href="#/rating">${YU.t('dashboard.tiles.rank.allRating')}</a>`) : `<a href="#/missions">${YU.t('dashboard.tiles.rank.takeFirst')}</a>`)),
      me.role === 'coordinator'
        ? tile('card-navy', YU.t('dashboard.pending.title'), big(YU.select.deptStats(me.deptId).pending), sub(`${YU.t('dashboard.pending.inDept', { dept: YU.dept(me.deptId).name })} · <a href="#/review">${YU.t('dashboard.link.review')}</a>`))
        : tile('card-navy', YU.t('dashboard.tiles.activeMissions.label'), big(active.length), sub(dl ? `${dl.label.charAt(0).toLowerCase() + dl.label.slice(1)}: ${esc(next.t.title)}` : YU.t('dashboard.tiles.activeMissions.noDeadlines'))),
      next
        ? tile('card-peach', YU.t('dashboard.tiles.nextDeadline.label'), titleText(esc(next.t.title)), sub(`<b>${esc(fmtDate(next.t.deadline, { time: true }))}</b> · ${esc(next.t.location)}`))
        : tile('card-peach', YU.t('dashboard.tiles.nextStep.label'), titleText(YU.t('dashboard.tiles.nextStep.value')), sub(`${YU.t('dashboard.tiles.nextStep.text')} · <a href="#/missions">${YU.t('dashboard.tiles.nextStep.link')}</a>`)),
    ].join('');
  }
  // ---- Personal progress (phones, participants): the level and the way to the next one, then the
  // numbers that grow with the member. The desktop has the profile page's level strip for this.
  function progressPanel(me) {
    const lv = U.levelFor(me.coinsTotal), rank = YU.select.rankOf(me.id);
    const badges = me.badges.filter((b) => YU.badge(b)).length;
    const stat = (value, label) => `<div class="dash-progress-stat"><b>${value}</b><span>${label}</span></div>`;
    return `<section class="panel dash-progress only-mobile">
      <div class="dash-progress-head">
        <div><div class="kpi-label">${YU.t('dashboard.progress.title')}</div><span class="pill pill-gold">${icon('sparkles')}${esc(lv.level.name)}</span></div>
        <a class="btn btn-secondary btn-sm" href="#/profile">${YU.t('nav.profile')}</a>
      </div>
      ${progress(me.coinsTotal - lv.level.min, lv.next ? lv.next.min - lv.level.min : 1, 'is-gold')}
      <div class="micro muted">${lv.next ? YU.t('profile.level.toNext', { name: lv.next.name, count: lv.toNext }) : YU.t('profile.level.max')}</div>
      <div class="dash-progress-grid">
        ${stat(fmtNum(me.missionsDone), YU.t('profile.stat.missionsDone'))}
        ${stat(rank ? `#${rank}` : '—', YU.t('profile.stat.rank'))}
        ${stat(`${me.streakWeeks} <small>${YU.t('profile.stat.weeksShort')}</small>`, YU.t('profile.stat.streak'))}
        ${stat(badges, YU.t('profile.tab.badges'))}
        ${stat(fmtNum(me.coinsTotal), YU.t('profile.stat.total'))}
        ${stat(fmtNum(me.balance), YU.t('profile.stat.balance'))}
      </div>
    </section>`;
  }

  function tilesAdmin() {
    const an = YU.state.analytics, last = an.coinsAwarded.length - 1;
    const people = YU.state.users.filter((u) => u.status === 'active').length;
    const fresh = YU.state.users.filter((u) => u.status === 'active' && (YU.now() - new Date(u.joinedAt)) < 30 * DAY).length;
    return [
      tile('panel', YU.t('dashboard.tiles.members.label'), big(people), chipSub(YU.t('dashboard.tiles.monthGain', { amount: fresh }))),
      tile('panel', YU.t('dashboard.tiles.pendingReports.label'), big(YU.select.pendingReviews().length), sub(`${YU.t('dashboard.tiles.pendingReports.allDepts')} · <a href="#/review">${YU.t('dashboard.link.review')}</a>`)),
      tile('card-peach', YU.t('dashboard.tiles.awardedWeek.label'), titleText(YU.t('coins.amount', { count: an.coinsAwarded[last] })), sub(`${YU.t('dashboard.tiles.awardedWeek.missions', { count: an.missionsCompleted[last] })} · ${YU.t('dashboard.tiles.awardedWeek.since', { week: an.weeks[last] })}`)),
    ].join('');
  }

  // ---------- Lower row
  function myMissionsPanel(me) {
    const rows = myOpenSubs();
    return `<section class="panel panel-pad">
      <div class="row-between mb-16"><span class="h2">${YU.t('dashboard.myMissions.title')}</span><a class="btn btn-secondary btn-sm" href="#/missions?tab=mine">${YU.t('dashboard.myMissions.all')}</a></div>
      ${rows.length ? `<div class="col gap-10">${rows.map(({ s, t }) => { const dl = deadline(t.deadline); return `
        <a class="list-item is-link dash-row" href="#/missions/${t.id}">
          <span class="grow" style="min-width:0"><div class="list-title">${esc(t.title)}</div>
            <div class="list-sub ${dl.soon && s.status !== 'pending' ? 'deadline-soon' : ''}">${esc(YU.dept(t.deptId).name)} · ${s.status === 'pending' ? YU.t('dashboard.submitted', { time: timeAgo(s.submittedAt) }) : s.status === 'rejected' ? YU.t('dashboard.myMissions.rejected', { comment: s.reviewComment }) : esc(dl.label.toLowerCase())}</div></span>
          <span class="row gap-10 dash-row-side">${subStatusPill(s.status)}${coins(t.coins, { sign: true })}</span>
        </a>`; }).join('')}</div>`
        : U.empty({ icon: 'clipboard-list', title: YU.t('dashboard.myMissions.empty.title'), text: YU.t('dashboard.myMissions.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/missions">${YU.t('dashboard.myMissions.empty.action')}</a>` })}
    </section>`;
  }
  function attentionPanel(me) {
    const isAdmin = me.role === 'admin';
    const pending = YU.select.pendingReviews(isAdmin ? null : me.deptId).slice(0, 4);
    const rows = pending.map((s) => { const t = YU.mission(s.missionId), u = YU.user(s.userId); return `
      <a class="list-item is-link dash-row" href="#/review/${s.id}">
        ${avatar(u, 'avatar-sm')}
        <span class="grow" style="min-width:0"><div class="list-title">${esc(t.title)}</div><div class="list-sub">${esc(u.name)} · ${YU.t('dashboard.submitted', { time: timeAgo(s.submittedAt) })}${isAdmin ? ` · ${esc(YU.dept(t.deptId).name)}` : ''}</div></span>
        <span class="row gap-10 dash-row-side">${coins(t.coins, { sign: true })}<span class="btn btn-primary btn-sm">${YU.t('dashboard.attention.review')}</span></span>
      </a>`; });
    return `<section class="panel panel-pad">
      <div class="row-between mb-16"><span class="h2">${isAdmin ? YU.t('dashboard.attention.title') : YU.t('dashboard.pending.title')}</span><a class="btn btn-secondary btn-sm" href="#/review">${YU.t('dashboard.attention.all')}</a></div>
      ${rows.length ? `<div class="col gap-10">${rows.join('')}</div>` : U.empty({ icon: 'check-check', title: YU.t('dashboard.attention.empty.title'), text: YU.t('dashboard.attention.empty.text') })}
    </section>`;
  }
  function newsPanel() {
    const items = YU.select.publishedNews().slice(0, 3);
    return `<section class="panel is-glass panel-pad">
      <div class="row-between mb-16"><span class="h2">${YU.t('dashboard.news.title')}</span><a class="btn btn-secondary btn-sm" href="#/news">${YU.t('dashboard.news.all')}</a></div>
      <div class="col gap-14">${items.map((n) => `
        <a href="#/news/${n.id}" class="dash-news-row">
          <div class="eyebrow">${esc(fmtDate(n.publishedAt))} · ${esc(YU.newsCategoryLabel(n.category))}</div>
          <div class="dash-news-title">${esc(n.title)}</div>
        </a>`).join('')}</div>
    </section>`;
  }

  // ---------- Compose
  function render() {
    const me = YU.me(); if (!me) return '';
    const role = me.role;
    const tiles = YU.isUnionWide() ? tilesAdmin() : tilesMember(me);
    const left = YU.can('review.panel') ? attentionPanel(me) : myMissionsPanel(me);
    return `${hero(me)}
      <div class="dash-tiles">${tiles}</div>
      <div class="dash-lower">${left}${newsPanel()}</div>
      ${YU.can('review.panel') && !YU.isUnionWide() ? `<div class="dash-lower" style="grid-template-columns:1fr">${myMissionsPanel(me)}</div>` : ''}`;
  }

  function mount() {}

  // A function, so the tab title follows a language switch like the rest of the screen.
  YU.screens.dashboard = { title: () => YU.t('nav.dashboard'), render, mount };
})();

;
/* js/screens/missions.js */
/* Missions — the board of open missions, my participations, closed missions, and the mission detail drawer (#/missions/:id). */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, progress, chip, deptChip, missionStatusPill, subStatusPill, deadline, fmtDate, timeAgo } = U;
  const PROOF_ICONS = { photo: 'camera', link: 'link', text: 'file-text' };
  const TABS = ['board', 'mine', 'done'];
  const SORTS = ['deadline', 'coins', 'new'];
  const GROUPS = ['in_progress', 'pending', 'rejected', 'approved'];
  const DEFAULT_UI = { tab: 'board', q: '', dept: '', sort: 'deadline', freeOnly: false };
  const SEARCH_DELAY = 150;
  const MAX_PHOTO_MB = 10;

  // Drawer bookkeeping: which mission it shows and whether it shows details or the report form
  let drawerTask = null, drawerMode = 'detail';
  // Photo chosen in the report form (photo missions only) and its preview URL
  let pickedPhoto = null, photoPreview = null;
  const wiredRoots = new WeakSet();

  const ui = () => YU.state.ui.missions || DEFAULT_UI;
  const setUi = (patch) => { YU.state.ui.missions = { ...ui(), ...patch }; };
  // «Mine» lists missions you took; someone who never takes missions has no such tab
  const tabsFor = () => (YU.isParticipant() ? TABS : TABS.filter((id) => id !== 'mine'));
  const tabOf = (params) => { const tabs = tabsFor(), want = params && params.query && params.query.tab; return tabs.includes(want) ? want : tabs.includes(ui().tab) ? ui().tab : 'board'; };
  const baseHash = () => `#/missions${ui().tab !== 'board' ? `?tab=${ui().tab}` : ''}`;
  const onTasksRoute = () => /^#\/missions(\/|\?|$)/.test(location.hash);
  const newTaskHref = () => (YU.role() === 'admin' ? '#/admin/missions/new' : '#/review/new');
  const proofType = (type) => (PROOF_ICONS[type] ? type : 'text');
  const proofLabel = (type) => YU.t(`missions.proof.${proofType(type)}`);
  const proofIcon = (type) => PROOF_ICONS[proofType(type)];
  const deptTone = (t) => { const d = YU.dept(t.deptId); return d ? d.tone : 'slate'; };
  // The coordinator as the admin named them on the department, read in the viewer's script like any person's name
  const curatorOf = (t) => { const d = YU.dept(t.deptId); return d && d.headName ? YU.i18n.personName(d.headName) : ''; };
  const participants = (t) => YU.select.missionSubmissions(t.id).filter((s) => s.status !== 'rejected');
  const dlClass = (dl) => (dl.past ? 'text-bad' : dl.soon ? 'deadline-soon' : '');

  // ---------- Data slices
  const boardTasks = () => YU.select.visibleMissions().filter((t) => t.status === 'open' || t.status === 'draft');
  const doneTasks = () => YU.select.visibleMissions().filter((t) => t.status === 'closed').sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
  const SORT_FN = {
    deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    coins: (a, b) => (b.coins - a.coins) || (new Date(a.deadline) - new Date(b.deadline)),
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  const filteredBoard = () => {
    const st = ui(), q = st.q.trim().toLowerCase();
    return boardTasks()
      // In the reader's language and in the one it was written in
      .filter((t) => (!q || [t.title, t.description, t.raw && t.raw.title, t.raw && t.raw.description].some((s) => (s || '').toLowerCase().includes(q)))
        && (!st.dept || t.deptId === st.dept)
        && (!st.freeOnly || YU.select.seatsLeft(t) > 0))
      .sort(SORT_FN[st.sort] || SORT_FN.deadline);
  };
  const hasFilters = () => { const st = ui(); return !!(st.q.trim() || st.dept || st.freeOnly); };

  // ---------- «Доска»
  function taskCard(t) {
    const dl = deadline(t.deadline), taken = YU.select.seatsTaken(t.id), mine = YU.select.mySubmission(t.id);
    return `<a class="panel task-card is-clickable tasks-card" href="#/missions/${esc(t.id)}">
      <div class="row-between"><span class="tasks-card-chips">${deptChip(t.deptId)}${t.status === 'draft' ? missionStatusPill(t.status) : ''}</span>${coins(t.coins)}</div>
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta"><span class="${dlClass(dl)}">${icon('calendar')}${dl.label}</span><span>${icon('map-pin')}${esc(t.location)}</span><span>${icon(proofIcon(t.proofType))}${proofLabel(t.proofType)}</span></div>
      <div class="task-foot"><span class="seats">${progress(taken, t.seats, 'is-thin')}${YU.t('missions.card.seats', { taken, total: t.seats })}</span>${mine ? subStatusPill(mine.status) : `<span class="btn btn-secondary btn-sm">${YU.t('missions.card.more')}</span>`}</div>
    </a>`;
  }

  function boardFilters() {
    const st = ui();
    // label is ready-to-print HTML: department names need escaping, catalogue text does not
    const chipBtn = (id, label, tone, active) => `<button type="button" class="filter-chip ${tone ? `tone-${esc(tone)}` : ''} ${active ? 'is-active' : ''}" data-tasks-dept="${esc(id)}">${tone ? '<span class="dot"></span>' : ''}${label}</button>`;
    return `<div class="filters tasks-filters">
      <label class="search">${icon('search')}<input class="input input-sm" id="tasks-search" type="search" value="${esc(st.q)}" placeholder="${YU.t('missions.search.placeholder')}" aria-label="${YU.t('missions.search.label')}"></label>
      <div class="filters filters-scroll tasks-depts">${chipBtn('', YU.t('missions.filter.allDepts'), '', !st.dept)}${YU.state.departments.map((d) => chipBtn(d.id, esc(d.name), d.tone, st.dept === d.id)).join('')}</div>
      <select class="select select-sm" id="tasks-sort" aria-label="${YU.t('missions.sort.label')}">${SORTS.map((k) => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${YU.t(`missions.sort.${k}`)}</option>`).join('')}</select>
      <button type="button" class="filter-chip ${st.freeOnly ? 'is-active' : ''}" data-tasks-free>${icon('users')}${YU.t('missions.filter.freeOnly')}</button>
    </div>`;
  }

  function boardGrid() {
    const list = filteredBoard();
    if (list.length) return `<div class="cards-3">${list.map(taskCard).join('')}</div>`;
    if (hasFilters()) return `<div class="panel">${U.empty({ icon: 'search', title: YU.t('missions.empty.noResults.title'), text: YU.t('missions.empty.noResults.text'), action: `<button type="button" class="btn btn-secondary btn-sm" data-tasks-reset>${YU.t('missions.filter.reset')}</button>` })}</div>`;
    const creator = YU.can('missions.create');
    return `<div class="panel">${U.empty({
      icon: 'clipboard-list', title: YU.t('missions.empty.board.title'),
      text: creator ? YU.t('missions.empty.board.textCreator') : YU.t('missions.empty.board.text'),
      action: creator ? `<a class="btn btn-primary btn-sm" href="${newTaskHref()}">${YU.t('missions.action.new')}</a>` : '',
    })}</div>`;
  }
  const boardTab = () => `<div id="tasks-board">${boardFilters()}<div id="tasks-grid">${boardGrid()}</div></div>`;

  // ---------- «Мои»
  function mineRow({ s, t }) {
    const dl = deadline(t.deadline), pts = s.coinsAwarded || 0;
    const line = s.status === 'pending' ? YU.t('missions.mine.line.pending', { when: timeAgo(s.submittedAt) })
      : s.status === 'rejected' ? YU.t('missions.coordinatorComment', { comment: s.reviewComment || YU.t('missions.mine.rejectedFallback') })
      : s.status === 'approved' ? YU.t('missions.mine.line.approved', { when: timeAgo(s.reviewedAt), coins: YU.t('coins.amount', { count: pts }) })
      : dl.label;
    return `<a class="list-item is-link tasks-row" href="#/missions/${esc(t.id)}">
      <span class="kpi-icon tone-${esc(deptTone(t))}">${icon(proofIcon(t.proofType))}</span>
      <span class="grow"><div class="list-title">${esc(t.title)}</div><div class="list-sub ${s.status === 'in_progress' ? dlClass(dl) : ''}">${line}</div></span>
      <span class="hide-mobile">${deptChip(t.deptId)}</span><span class="hide-mobile">${subStatusPill(s.status)}</span>${coins(s.status === 'approved' ? pts : t.coins)}
    </a>`;
  }

  function mineTab() {
    const rows = YU.select.mySubmissions().map((s) => ({ s, t: YU.mission(s.missionId) })).filter((x) => x.t);
    const limit = YU.state.settings.maxActiveMissions;
    if (!rows.length) return `<div class="panel">${U.empty({ icon: 'clipboard-list', title: YU.t('missions.empty.mine.title'), text: YU.t('missions.empty.mine.text', { count: limit }), action: `<a class="btn btn-primary btn-sm" href="#/missions?tab=board">${YU.t('missions.action.toBoard')}</a>` })}</div>`;
    const when = (x) => new Date(x.s.reviewedAt || x.s.submittedAt || x.s.takenAt);
    return GROUPS.map((status) => {
      const group = rows.filter((x) => x.s.status === status)
        .sort((a, b) => (status === 'in_progress' ? new Date(a.t.deadline) - new Date(b.t.deadline) : when(b) - when(a)));
      if (!group.length) return '';
      return `<section class="tasks-group">
        <div class="tasks-group-head"><span class="h2">${YU.t(`sub.status.${status}`)}</span><span class="pill pill-neutral">${group.length}</span></div>
        <div class="panel"><div class="list">${group.map(mineRow).join('')}</div></div>
      </section>`;
    }).join('');
  }

  // ---------- «Завершённые»
  function doneCard(t) {
    const done = participants(t).filter((s) => s.status === 'approved').map((s) => YU.user(s.userId)).filter(Boolean);
    const names = done.map((u) => u.name).join(', ');
    return `<a class="panel task-card is-clickable tasks-card tasks-card-muted" href="#/missions/${esc(t.id)}">
      <div class="row-between"><span class="tasks-card-chips">${deptChip(t.deptId)}${missionStatusPill(t.status)}</span>${coins(t.coins)}</div>
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta"><span>${icon('calendar-check')}${YU.t('missions.done.deadlineWas', { date: fmtDate(t.deadline) })}</span><span>${icon('map-pin')}${esc(t.location)}</span></div>
      <div class="task-foot"><span class="tasks-done-by">${done.length
        ? `<span class="avatar-stack">${done.slice(0, 4).map((u) => avatar(u, 'avatar-sm')).join('')}</span><span class="truncate">${done.length === 1 ? YU.t('missions.done.byOne', { names }) : YU.t('missions.done.byMany', { names })}</span>`
        : `${icon('users')}${YU.t('missions.done.nobody')}`}</span></div>
    </a>`;
  }

  function doneTab() {
    const list = doneTasks();
    if (!list.length) return `<div class="panel">${U.empty({ icon: 'check-check', title: YU.t('missions.empty.done.title'), text: YU.t('missions.empty.done.text'), action: `<a class="btn btn-secondary btn-sm" href="#/missions?tab=board">${YU.t('missions.action.toBoard')}</a>` })}</div>`;
    return `<div class="cards-3">${list.map(doneCard).join('')}</div>`;
  }

  // ---------- Page
  function render(params) {
    const me = YU.me(); if (!me) return '';
    const tab = tabOf(params);
    const open = YU.select.visibleMissions().filter((t) => t.status === 'open');
    const seats = open.reduce((a, t) => a + YU.select.seatsLeft(t), 0);
    const drafts = boardTasks().length - open.length;
    const lead = `${[
      YU.t('missions.lead.open', { count: open.length }),
      YU.t('missions.lead.seats', { count: seats }),
      ...(drafts ? [YU.t('missions.lead.drafts', { count: drafts })] : []),
    ].join(', ')}.`;
    const limit = YU.state.settings.maxActiveMissions;
    const actions = YU.can('missions.create') ? `<a class="btn btn-primary" href="${newTaskHref()}">${icon('plus')}${YU.t('missions.action.new')}</a>`
      : YU.select.myActiveCount() >= limit ? `<div class="notice notice-gold tasks-limit">${icon('info')}<span>${YU.t('missions.limitNotice', { count: limit })}</span></div>` : '';
    const counts = { board: boardTasks().length, mine: YU.select.mySubmissions().length, done: doneTasks().length };
    const tabLink = (id, label) => `<a class="tab ${tab === id ? 'is-active' : ''}" href="#/missions?tab=${id}">${label}<span class="count">${counts[id]}</span></a>`;
    return `<div class="page-head">
        <div><h1 class="h1">${YU.t('missions.title')} <em>${YU.t('missions.titleAccent')}</em></h1><p class="lead">${lead}</p></div>
        <div class="page-actions">${actions}</div>
      </div>
      <nav class="tabs tasks-tabs" aria-label="${YU.t('missions.tabs.label')}">${tabLink('board', YU.t('missions.tab.board'))}${YU.isParticipant() ? tabLink('mine', YU.t('missions.tab.mine')) : ''}${tabLink('done', YU.t('missions.tab.done'))}</nav>
      ${tab === 'mine' ? mineTab() : tab === 'done' ? doneTab() : boardTab()}`;
  }

  function mount(root, params) {
    if (!YU.me()) return;
    setUi({ tab: tabOf(params) });
    wireRoot(root);
    if (params.id) openTask(params.id);
    else if (drawerTask) { drawerTask = null; drawerMode = 'detail'; U.drawer.close(); }
  }

  // The router hands mount a fresh #view each render; the guard only matters if mount ever runs twice on one element
  function wireRoot(root) {
    if (wiredRoots.has(root)) return;
    wiredRoots.add(root);
    const refreshGrid = () => { const g = root.querySelector('#tasks-grid'); if (g) { g.innerHTML = boardGrid(); U.refreshIcons(); } };
    const refreshBoard = () => { const b = root.querySelector('#tasks-board'); if (b) { b.innerHTML = `${boardFilters()}<div id="tasks-grid">${boardGrid()}</div>`; U.refreshIcons(); } };
    U.on(root, 'input', '#tasks-search', U.debounce((e, el) => { setUi({ q: el.value }); refreshGrid(); }, SEARCH_DELAY));
    U.on(root, 'change', '#tasks-sort', (e, el) => { setUi({ sort: el.value }); refreshGrid(); });
    U.on(root, 'click', '[data-tasks-dept]', (e, el) => { setUi({ dept: el.dataset.tasksDept }); refreshBoard(); });
    U.on(root, 'click', '[data-tasks-free]', () => { setUi({ freeOnly: !ui().freeOnly }); refreshBoard(); });
    U.on(root, 'click', '[data-tasks-reset]', () => { setUi({ q: '', dept: '', sort: 'deadline', freeOnly: false }); refreshBoard(); });
  }

  // ---------- Detail drawer
  function openTask(id) {
    const t = YU.mission(id);
    const visible = t && (['open', 'closed'].includes(t.status) || YU.isCoordinatorOf(t.deptId));
    if (!visible) {
      drawerTask = null;
      if (U.drawer.isOpen()) U.drawer.close();
      U.toast(YU.tText('missions.notFound'), 'bad');
      location.hash = baseHash();
      return;
    }
    const same = drawerTask === id && U.drawer.isOpen();
    if (same && drawerMode === 'form') return;   // the user is filling the report, keep it
    drawerTask = id; drawerMode = 'detail';
    if (same) U.drawer.update(detailView(t)); else wireDrawer(U.drawer.open(detailView(t)));
  }

  function detailView(t) {
    const d = YU.dept(t.deptId);
    return {
      title: esc(t.title),
      sub: `<span class="row gap-8 wrap">${d ? esc(d.name) : YU.t('dept.all')}${missionStatusPill(t.status)}</span>`,
      body: detailBody(t),
      foot: detailFoot(t),
    };
  }

  const metaCell = (label, value, cls = '') => `<div><div class="tasks-meta-label">${label}</div><div class="tasks-meta-value ${cls}">${value}</div></div>`;

  function deadlineLabel(t, dl) {
    if (t.status === 'closed') return YU.t('missions.deadline.was', { date: fmtDate(t.deadline, { time: true }) });
    if (dl.days > 3) return YU.t('deadline.until', { date: fmtDate(t.deadline, { time: true }) });
    if (dl.days > 1) return YU.t('missions.deadline.withTime', { label: dl.label, time: fmtDate(t.deadline, { time: true }) });
    return dl.label;
  }

  function detailBody(t) {
    const dl = deadline(t.deadline), head = curatorOf(t), sub = YU.select.mySubmission(t.id);
    const dlCls = t.status === 'closed' ? '' : dl.tone === 'bad' ? 'text-bad' : dl.tone === 'warn' ? 'text-warn' : '';
    return `<div class="row-between wrap">${coins(t.coins, { lg: true })}</div>
      <div class="tasks-meta">
        ${metaCell(YU.t('missions.meta.deadline'), `${icon('calendar')}${deadlineLabel(t, dl)}`, dlCls)}
        ${metaCell(YU.t('missions.meta.place'), `${icon('map-pin')}${t.location ? esc(t.location) : YU.t('missions.meta.placeUnknown')}`)}
        ${metaCell(YU.t('missions.meta.seats'), `${icon('users')}${YU.t('missions.countOfTotal', { count: YU.select.seatsLeft(t), total: t.seats })}`)}
        ${metaCell(YU.t('missions.meta.proof'), `${icon(proofIcon(t.proofType))}${proofLabel(t.proofType)}`)}
        ${head ? metaCell(YU.t('role.coordinator'), `${icon('user-round')}<span class="truncate">${esc(head)}</span>`) : ''}
      </div>
      ${t.description ? `<div class="prose mt-20"><p>${esc(t.description)}</p></div>` : ''}
      ${t.requirements && t.requirements.length ? `<section class="tasks-section"><div class="h3">${YU.t('missions.reqs.title')}</div><ul class="tasks-reqs">${t.requirements.map((r) => `<li>${icon('check')}<span>${esc(r)}</span></li>`).join('')}</ul></section>` : ''}
      ${participantsBlock(t)}
      ${sub ? progressBlock(t, sub) : ''}`;
  }

  function participantsBlock(t) {
    const list = participants(t).map((s) => ({ s, u: YU.user(s.userId) })).filter((x) => x.u);
    const stack = list.slice(0, 6).map((x) => avatar(x.u, 'avatar-sm')).join('') + (list.length > 6 ? `<span class="avatar more">+${list.length - 6}</span>` : '');
    const label = list.length === 1 ? esc(list[0].u.name) : YU.t('missions.people.andMore', { name: list[0] ? list[0].u.name : '', count: list.length - 1 });
    const subLine = (s) => s.status === 'in_progress' ? YU.t('missions.people.taken', { when: timeAgo(s.takenAt) })
      : s.status === 'pending' ? YU.t('missions.people.submitted', { when: timeAgo(s.submittedAt) })
      : YU.t('missions.people.reviewed', { when: timeAgo(s.reviewedAt || s.submittedAt) });
    const names = YU.isCoordinatorOf(t.deptId) && list.length ? `<div class="list tasks-people-list mt-12">${list.map(({ s, u }) => `
      <div class="list-item">${avatar(u, 'avatar-sm')}<span class="grow"><div class="list-title">${esc(u.name)}</div><div class="list-sub">${subLine(s)}</div></span>${subStatusPill(s.status)}${s.status === 'pending' ? `<a class="btn btn-primary btn-sm" href="#/review/${esc(s.id)}">${YU.t('missions.action.review')}</a>` : ''}</div>`).join('')}</div>` : '';
    return `<section class="tasks-section">
      <div class="row-between"><span class="h3">${YU.t('missions.people.title')}</span><span class="small muted">${YU.t('missions.countOfTotal', { count: participants(t).length, total: t.seats })}</span></div>
      ${list.length
        ? `<div class="tasks-people mt-8"><span class="avatar-stack">${stack}</span><span class="small muted truncate">${label}</span></div>`
        : `<p class="small muted mt-8">${t.status === 'open' ? YU.t('missions.people.emptyOpen') : YU.t('missions.people.emptyClosed')}</p>`}
      ${names}
    </section>`;
  }

  function progressBlock(t, sub) {
    const st = sub.status, reviewer = sub.reviewedBy ? YU.user(sub.reviewedBy) : null, pts = sub.coinsAwarded || 0;
    const reviewedLine = sub.reviewedAt
      ? (reviewer ? YU.t('missions.progress.reviewedBy', { date: fmtDate(sub.reviewedAt, { time: true }), name: reviewer.name }) : esc(fmtDate(sub.reviewedAt, { time: true })))
      : st === 'pending' ? YU.t('missions.progress.pending') : YU.t('missions.progress.afterSubmit');
    const steps = [
      { title: YU.t('missions.progress.taken'), sub: esc(fmtDate(sub.takenAt, { time: true })), dot: 'is-done', ic: 'check' },
      { title: YU.t('missions.progress.submitted'), sub: sub.submittedAt ? esc(fmtDate(sub.submittedAt, { time: true })) : YU.t('missions.progress.awaitingReport'), dot: st === 'in_progress' ? 'is-now' : 'is-done', ic: st === 'in_progress' ? 'pencil' : 'check' },
      { title: YU.t('missions.progress.reviewed'),
        sub: reviewedLine,
        dot: st === 'approved' ? 'is-done' : st === 'rejected' ? 'tasks-tl-bad' : st === 'pending' ? 'is-now' : '',
        ic: st === 'approved' ? 'check' : st === 'rejected' ? 'x' : st === 'pending' ? 'clock' : '' },
    ];
    const notice = st === 'rejected' ? `<div class="notice tasks-notice-bad">${icon('alert-circle')}<span><b>${YU.t('missions.progress.rejected')}</b> ${sub.reviewComment ? esc(sub.reviewComment) : YU.t('missions.progress.rejectedFallback')}</span></div>`
      : st === 'approved' ? `<div class="notice notice-ok">${icon('check-circle-2')}<span>${YU.t('missions.progress.approved', { coins: YU.t('coins.amount', { count: pts }) })}${sub.reviewComment ? `. ${esc(sub.reviewComment)}` : ''}</span></div>`
      : st === 'pending' ? `<div class="notice notice-info">${icon('clock')}<span>${YU.t('missions.progress.inReview')}</span></div>` : '';
    const proofView = (p) => (p.type === 'photo' && p.url
      ? `<a class="tasks-photo-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><img ${U.photoSrc(p.url)} alt="${YU.t('missions.proof.photoAlt')}" loading="lazy"></a>`
      : p.type === 'link' && /^https?:\/\//i.test(p.label)
        ? `<a class="chip chip-lg" href="${esc(p.label)}" target="_blank" rel="noopener noreferrer">${icon('link')}<span class="truncate">${esc(p.label)}</span></a>`
        : chip(p.label || YU.tText(`missions.proof.${proofType(p.type)}`), '', { icon: proofIcon(p.type) }));
    const report = sub.comment ? `<div class="inset mt-12"><div class="micro muted">${YU.t('missions.report.yours')}</div><div class="small mt-8">${esc(sub.comment)}</div>${sub.proof ? `<div class="mt-8">${proofView(sub.proof)}</div>` : ''}</div>` : '';
    return `<section class="tasks-section"><div class="h3 mb-12">${YU.t('missions.progress.title')}</div>
      <div class="timeline">${steps.map((s) => `<div class="tl-item"><span class="tl-dot ${s.dot}">${s.ic ? icon(s.ic) : ''}</span><div><div class="tl-title">${s.title}</div><div class="tl-sub">${s.sub}</div></div></div>`).join('')}</div>
      ${notice}${report}</section>`;
  }

  function detailFoot(t) {
    const sub = YU.select.mySubmission(t.id), mgr = YU.isCoordinatorOf(t.deptId), left = YU.select.seatsLeft(t);
    const parts = [];
    if (mgr) {
      parts.push(`<a class="btn btn-secondary" href="#/review/mission/${esc(t.id)}">${icon('pencil')}${YU.t('missions.action.edit')}</a>`);
      if (t.status === 'open') parts.push(`<button class="btn btn-ghost" data-tasks-action="close">${YU.t('missions.action.closeMission')}</button>`);
      if (t.status === 'draft') parts.push(`<button class="btn btn-primary" data-tasks-action="publish">${icon('send')}${YU.t('missions.action.publish')}</button>`);
    }
    if (sub && sub.status === 'in_progress') {
      parts.push(`<button class="btn btn-ghost" data-tasks-action="drop">${YU.t('missions.action.drop')}</button>`, `<button class="btn btn-primary" data-tasks-action="report">${icon('send')}${YU.t('missions.action.submitReport')}</button>`);
    } else if (sub && sub.status === 'rejected' && t.status === 'open') {
      // A rejected report gave its seat back; sending it again needs one
      parts.push(left > 0
        ? `<button class="btn btn-primary" data-tasks-action="report">${icon('rotate-ccw')}${YU.t('missions.action.fixAndResubmit')}</button>`
        : `<button class="btn btn-primary" disabled>${YU.t('missions.action.noSeats')}</button>`);
    } else if (!sub && t.status === 'open' && YU.canSubscribe(t)) {
      parts.push(left > 0 ? `<button class="btn btn-primary" data-tasks-action="take">${icon('plus')}${YU.t('missions.action.take')}</button>` : `<button class="btn btn-primary" disabled>${YU.t('missions.action.noSeats')}</button>`);
    }
    return parts.length ? `<div class="tasks-foot">${parts.join('')}</div>` : '';
  }

  // ---------- Report form
  function reportView(t) {
    const dl = deadline(t.deadline), sub = YU.select.mySubmission(t.id);
    const prev = sub && sub.proof && sub.proof.type === t.proofType && t.proofType !== 'photo' ? sub.proof.label : '';
    const proofField = t.proofType === 'photo'
      ? `<div class="field" data-field="proof"><span class="label">${YU.t('missions.proof.photo')}</span>
          <label class="upload" for="tasks-photo">${icon('upload')}${YU.t('missions.report.pickPhoto')}<div class="micro mt-8">${YU.t('missions.report.photoHint', { size: MAX_PHOTO_MB })}</div>
            <input type="file" id="tasks-photo" name="photo" accept="image/jpeg,image/png,image/webp" class="sr-only">
          </label>
          <div class="tasks-upload-file" hidden></div></div>`
      : t.proofType === 'link'
        ? `<div class="field" data-field="proof"><label for="tasks-proof">${YU.t('missions.proof.link')}</label><input class="input" id="tasks-proof" name="proofLabel" type="url" value="${esc(prev)}" placeholder="https://drive.google.com/…"><span class="hint">${YU.t('missions.report.linkHint')}</span></div>`
        : `<div class="field" data-field="proof"><label for="tasks-proof">${YU.t('missions.proof.text')}</label><textarea class="textarea" id="tasks-proof" name="proofLabel" placeholder="${YU.t('missions.report.textPlaceholder')}">${esc(prev)}</textarea></div>`;
    return {
      title: esc(t.title),
      sub: YU.t('missions.report.sub', { proof: proofLabel(t.proofType).toLowerCase() }),
      body: `<form id="tasks-report" class="col gap-14 tasks-report" novalidate>
        ${sub && sub.status === 'rejected' && sub.reviewComment ? `<div class="notice tasks-notice-bad">${icon('alert-circle')}<span>${YU.t('missions.coordinatorComment', { comment: sub.reviewComment })}</span></div>` : ''}
        ${dl.past ? `<div class="notice notice-warn">${icon('alarm-clock')}<span>${YU.t('missions.report.latePenalty', { pct: YU.state.settings.latePenaltyPct })}</span></div>` : ''}
        <div class="field" data-field="comment"><label for="tasks-comment">${YU.t('missions.report.commentLabel')}</label><textarea class="textarea" id="tasks-comment" name="comment" placeholder="${YU.t('missions.report.commentPlaceholder')}">${esc(sub && sub.comment ? sub.comment : '')}</textarea></div>
        ${proofField}
      </form>`,
      foot: `<div class="tasks-foot"><button class="btn btn-ghost" data-tasks-action="back">${icon('chevron-left')}${YU.t('missions.action.back')}</button><button class="btn btn-primary" data-tasks-action="send">${icon('send')}${YU.t('missions.action.send')}</button></div>`,
    };
  }

  // Messages come from the catalogue, already escaped by t()
  function showErrors(form, errors) {
    form.querySelectorAll('[data-field]').forEach((f) => {
      const msg = errors[f.dataset.field];
      const ctl = f.querySelector('.input, .textarea, .upload');
      if (ctl) ctl.classList.toggle('is-invalid', !!msg);
      const old = f.querySelector('.error'); if (old) old.remove();
      if (msg) f.insertAdjacentHTML('beforeend', `<span class="error">${msg}</span>`);
    });
  }

  // The drawer may have been closed or switched to another mission while an action was in flight
  const drawerShows = (id) => drawerTask === id && U.drawer.isOpen();

  async function sendReport(t) {
    const el = U.drawer.el(), form = el && el.querySelector('#tasks-report'); if (!form) return;
    const data = U.formData(form);
    const isPhoto = t.proofType === 'photo';
    const comment = (data.comment || '').trim(), proof = (data.proofLabel || '').trim();
    const errors = {};
    if (!comment) errors.comment = YU.t('missions.error.comment');
    if (isPhoto && !pickedPhoto) errors.proof = YU.t('missions.error.photo');
    else if (!isPhoto && !proof) errors.proof = t.proofType === 'link' ? YU.t('missions.error.link') : YU.t('missions.error.text');
    else if (t.proofType === 'link' && !/^https?:\/\/\S+$/i.test(proof)) errors.proof = YU.t('missions.error.linkFormat');
    showErrors(form, errors);
    if (Object.keys(errors).length) return;
    // drawerMode stays 'form' while the request runs, so a re-render in the meantime keeps what the user typed
    const r = await U.busy(el.querySelector('[data-tasks-action="send"]'), () => YU.actions.submitReport(t.id, isPhoto ? { comment, file: pickedPhoto } : { comment, proofLabel: proof }));
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(YU.tText('missions.toast.reportSent'), 'ok');
    setPhoto(el, null);
    if (!drawerShows(t.id)) return;
    drawerMode = 'detail';
    U.drawer.update(detailView(YU.mission(t.id)));
  }

  // The chosen photo lives here until the report is sent; it is cleared whenever the form opens or closes
  function setPhoto(el, file) {
    if (photoPreview) { URL.revokeObjectURL(photoPreview); photoPreview = null; }
    pickedPhoto = file || null;
    const box = el.querySelector('.upload'), slot = el.querySelector('.tasks-upload-file');
    if (!box || !slot) return;
    if (!file) { slot.innerHTML = ''; slot.hidden = true; box.hidden = false; return; }
    photoPreview = URL.createObjectURL(file);
    slot.innerHTML = `<img class="tasks-photo-preview" src="${photoPreview}" alt="${YU.t('missions.report.photoChosenAlt')}">
      <span class="grow truncate">${esc(file.name)}</span>
      <button type="button" class="btn btn-ghost btn-sm btn-icon" data-tasks-action="unupload" aria-label="${YU.t('missions.report.removePhoto')}">${icon('x')}</button>`;
    slot.hidden = false; box.hidden = true;
    U.refreshIcons();
  }

  function pickPhoto(el, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { showErrors(el.querySelector('#tasks-report'), { proof: YU.t('missions.error.photoType') }); input.value = ''; return; }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) { showErrors(el.querySelector('#tasks-report'), { proof: YU.t('missions.error.photoSize', { size: MAX_PHOTO_MB }) }); input.value = ''; return; }
    showErrors(el.querySelector('#tasks-report'), {});
    setPhoto(el, file);
  }

  // ---------- Actions
  // Runs a mission action from a drawer button and refreshes the details if the drawer still shows that mission
  async function runAction(btn, t, run, doneMsg) {
    const r = await U.busy(btn, run);
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(doneMsg, 'ok');
    const fresh = YU.mission(t.id);
    if (fresh && drawerShows(t.id)) U.drawer.update(detailView(fresh));
  }

  const takeTask = (btn, t) => runAction(btn, t, () => YU.actions.takeTask(t.id), YU.t('missions.toast.taken'));
  const publishTask = (btn, t) => runAction(btn, t, () => YU.actions.publishTask(t.id), YU.t('missions.toast.published'));

  async function dropTask(t) {
    const ok = await U.confirm({ title: YU.t('missions.drop.title'), text: YU.t('missions.drop.text', { name: t.title }), ok: YU.t('missions.action.drop'), danger: true });
    if (!ok) return;
    await runAction(null, t, () => YU.actions.dropTask(t.id), YU.t('missions.toast.dropped'));
  }

  async function closeTask(t) {
    const ok = await U.confirm({ title: YU.t('missions.close.title'), text: YU.t('missions.close.text', { name: t.title }), ok: YU.t('missions.action.closeMission'), danger: true });
    if (!ok) return;
    await runAction(null, t, () => YU.actions.closeTask(t.id), YU.t('missions.toast.closed'));
  }

  function openReport(t) {
    drawerMode = 'form';
    const el = U.drawer.update(reportView(t));
    if (el) setPhoto(el, null);
    const ta = el && el.querySelector('#tasks-comment');
    if (ta) setTimeout(() => ta.focus(), 60);
  }

  // drawer.open() hands out a fresh element each time (old listeners leave with the old element), so wire after every open.
  // drawer.update() keeps the element, so these handlers survive each re-render of the details.
  function wireDrawer(el) {
    if (!el) return;
    const current = () => (drawerTask ? YU.mission(drawerTask) : null);
    U.on(el, 'click', '[data-tasks-action]', (e, btn) => {
      const t = current(); if (!t) return;
      const act = btn.dataset.tasksAction;
      if (act === 'take') takeTask(btn, t);
      else if (act === 'drop') dropTask(t);
      else if (act === 'close') closeTask(t);
      else if (act === 'publish') publishTask(btn, t);
      else if (act === 'report') openReport(t);
      else if (act === 'back') { drawerMode = 'detail'; U.drawer.update(detailView(t)); }
      else if (act === 'send') sendReport(t);
      else if (act === 'unupload') { setPhoto(el, null); const input = el.querySelector('#tasks-photo'); if (input) input.value = ''; }
    });
    U.on(el, 'change', '#tasks-photo', (e, input) => pickPhoto(el, input));
    U.on(el, 'submit', '#tasks-report', (e) => { e.preventDefault(); const t = current(); if (t) sendReport(t); });
    // Links inside the drawer lead to other screens: close it first so it does not linger over them
    U.on(el, 'click', 'a[href^="#/"]', () => { if (!drawerTask) return; drawerTask = null; drawerMode = 'detail'; U.drawer.close(); });
  }

  // Closing the drawer (X, scrim, Escape) is handled globally in ui.js; afterwards we return the URL to the board
  const afterLayerClose = () => {
    if (!drawerTask || U.drawer.isOpen() || !onTasksRoute()) return;
    drawerTask = null; drawerMode = 'detail';
    location.hash = baseHash();
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-layer]') || e.target.id === 'scrim') afterLayerClose(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') afterLayerClose(); });
  window.addEventListener('hashchange', () => { if (!onTasksRoute()) { drawerTask = null; drawerMode = 'detail'; } });

  YU.screens.missions = { title: () => YU.t('missions.pageTitle'), render, mount };
})();

;
/* js/screens/rating.js */
/* Rating — semester and all-time leaderboard: my position, podium, full table and a department race. */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, progress, deptChip, chip, pill, fmtNum } = U;

  const PERIODS = ['semester', 'total'];
  // Period ids travel in the hash, so they stay as they are; the catalogue carries their labels
  const periodLabel = (p) => YU.t(`rating.period.${p}`);
  const POINTS_KEY = { semester: 'coinsSemester', total: 'coinsTotal' };
  const DEFAULT_UI = { period: 'semester', dept: '', q: '' };
  const PODIUM_SIZE = 3;
  const SEARCH_DELAY = 150;

  // ---------- UI state. Lives in YU.state.ui.rating; the hash query wins whenever it carries period or dept
  const validPeriod = (p) => (PERIODS.includes(p) ? p : 'semester');
  const validDept = (id) => (id && YU.dept(id) ? id : '');
  const normalize = (raw) => ({ period: validPeriod(raw.period), dept: validDept(raw.dept), q: String(raw.q || '') });
  const resolveUi = (params) => {
    const stored = { ...DEFAULT_UI, ...(YU.state.ui.rating || {}) };
    const query = (params && params.query) || {};
    const src = 'period' in query || 'dept' in query ? query : stored;
    return normalize({ ...src, q: stored.q });
  };
  const hashFor = (ui) => `#/rating?period=${ui.period}${ui.dept ? `&dept=${encodeURIComponent(ui.dept)}` : ''}`;

  // ---------- Small pieces
  const profileHref = (u) => `#/profile/${esc(u.id)}`;
  const deptCell = (u) => (u.deptId ? deptChip(u.deptId) : chip(YU.roleName(u.role), 'slate'));
  const boardFor = (ui) => {
    const board = YU.select.leaderboard(ui.period, ui.dept || null);
    const needle = ui.q.trim().toLowerCase();
    // A name matches in the script it is shown in and in the one it was typed in
    const rows = needle ? board.filter((u) => `${u.name} ${u.raw ? u.raw.name : ''} ${u.group || ''}`.toLowerCase().includes(needle)) : board;
    return { key: POINTS_KEY[ui.period], board, rows, needle };
  };

  // ---------- Head controls: period, department chips, name search
  function controls(ui) {
    const chips = YU.state.departments.map((d) => `
      <button type="button" class="filter-chip tone-${esc(d.tone)} ${ui.dept === d.id ? 'is-active' : ''}" data-dept="${esc(d.id)}" aria-pressed="${ui.dept === d.id}"><span class="dot"></span>${esc(d.name)}</button>`).join('');
    return `<div class="rating-controls">
      <div class="seg" role="group" aria-label="${YU.t('rating.periodLabel')}">${PERIODS.map((p) => `<button type="button" class="${ui.period === p ? 'is-active' : ''}" data-period="${p}" aria-pressed="${ui.period === p}">${periodLabel(p)}</button>`).join('')}</div>
      <div class="filters filters-scroll">
        <button type="button" class="filter-chip ${ui.dept ? '' : 'is-active'}" data-dept="" aria-pressed="${!ui.dept}">${YU.t('rating.allDepts')}</button>${chips}
      </div>
      <label class="search rating-search">${icon('search')}<input class="input input-sm" type="search" placeholder="${YU.t('rating.searchPlaceholder')}" value="${esc(ui.q)}" aria-label="${YU.t('rating.searchLabel')}"></label>
    </div>`;
  }

  // ---------- My position strip. Only when I am in the (department-filtered) board
  function myStrip(ui, me, board, key) {
    const idx = board.findIndex((u) => u.id === me.id);
    if (idx < 0) {
      // Someone who does not take missions has no place to chase
      if (ui.dept || !YU.isParticipant()) return '';
      const why = ui.period === 'semester' ? YU.t('rating.noCoins.semester') : YU.t('rating.noCoins.total');
      return `<div class="notice notice-info">${icon('info')}<span>${why} <a href="#/missions">${YU.t('rating.noCoins.link')}</a></span></div>`;
    }
    const above = board[idx - 1] || null, below = board[idx + 1] || null;
    const gapUp = above ? above[key] - me[key] : 0;
    const gapDown = below ? me[key] - below[key] : 0;
    const deptName = ui.dept ? YU.dept(ui.dept).name : '';
    const place = deptName
      ? YU.t('rating.myPlaceInDept', { rank: idx + 1, total: board.length, dept: deptName })
      : YU.t('rating.myPlace', { rank: idx + 1, total: board.length });
    const hint = !above
      ? (below && gapDown > 0 ? YU.t('rating.hint.topLead', { count: gapDown }) : YU.t('rating.hint.top'))
      : gapUp > 0 ? YU.t('rating.hint.gapUp', { count: gapUp }) : YU.t('rating.hint.tied');
    return `<section class="panel rating-me">
      ${avatar(me, 'avatar-lg')}
      <div class="rating-me-text"><div class="h3">${place}</div><div class="small muted">${hint}</div></div>
      ${coins(me[key], { lg: true })}
      ${YU.can('profile.own') ? `<a class="btn btn-ghost btn-sm hide-mobile" href="#/profile">${YU.t('nav.myProfile')}</a>` : ''}
    </section>`;
  }

  // ---------- Podium: columns 2-1-3, the winner taller; stacks 1-2-3 on mobile via CSS order
  function podiumCard(u, rank, key) {
    const lv = U.levelFor(u.coinsTotal);
    const badges = u.badges.length;
    return `<article class="panel rating-podium-card is-${rank}">
      <span class="rank is-${rank}">${rank}</span>
      ${avatar(u, 'avatar-xl')}
      <a class="rating-podium-name" href="${profileHref(u)}">${esc(u.name)}</a>
      ${deptCell(u)}
      <div class="display rating-podium-points">${fmtNum(u[key])}</div>
      <span class="pill pill-gold">${icon('sparkles')}${esc(lv.level.name)}</span>
      <div class="small muted">${YU.t('rating.missionsCount', { count: u.missionsDone })}, ${YU.t('rating.badgesCount', { count: badges })}</div>
    </article>`;
  }
  function podium(top, key) {
    const order = [top[1], top[0], top[2]];
    return `<section class="rating-podium" aria-label="${YU.t('rating.podiumLabel')}">${order.map((u) => podiumCard(u, top.indexOf(u) + 1, key)).join('')}</section>`;
  }

  // ---------- Full table
  function tableRow(u, rank, key, meId) {
    const isMe = u.id === meId;
    const lv = U.levelFor(u.coinsTotal);
    return `<tr class="is-link ${isMe ? 'is-me' : ''}" data-href="${profileHref(u)}">
      <td><span class="rank ${rank <= PODIUM_SIZE ? `is-${rank}` : ''}">${rank}</span></td>
      <td><div class="cell-user">${avatar(u, 'avatar-sm')}<div class="rating-cell-text"><a class="rating-name truncate" href="${profileHref(u)}">${esc(u.name)}${isMe ? ` ${YU.t('rating.you')}` : ''}</a><div class="micro muted">${esc(u.group || '')}</div></div></div></td>
      <td class="hide-phone">${deptCell(u)}</td>
      <td class="hide-mobile">${pill(lv.level.name, 'neutral')}</td>
      <td class="num hide-mobile">${u.missionsDone}</td>
      <td class="hide-phone">${u.streakWeeks > 0 ? `<span class="rating-streak">${icon('flame')}${YU.t('rating.streak', { count: u.streakWeeks })}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num">${coins(u[key])}</td>
    </tr>`;
  }
  function tablePanel(ui, me, board, rows, key, needle) {
    const head = ui.dept ? YU.t('rating.table.deptHead', { name: YU.dept(ui.dept).name }) : YU.t('rating.table.allMembers');
    const sub = needle ? YU.t('rating.table.found', { count: rows.length }) : YU.t('rating.membersCount', { count: rows.length });
    const body = rows.length
      ? `<div class="table-wrap"><table class="table rating-table">
          <thead><tr><th>#</th><th>${YU.t('rating.table.th.member')}</th><th class="hide-phone">${YU.t('rating.table.th.dept')}</th><th class="hide-mobile">${YU.t('rating.table.th.level')}</th><th class="num hide-mobile">${YU.t('rating.table.th.missions')}</th><th class="hide-phone">${YU.t('rating.table.th.streak')}</th><th class="num">${YU.t('rating.table.th.coins')}</th></tr></thead>
          <tbody>${rows.map((u) => tableRow(u, board.indexOf(u) + 1, key, me.id)).join('')}</tbody>
        </table></div>`
      : U.empty({
        icon: 'search', title: YU.t('rating.table.empty.title'),
        text: needle ? YU.t('rating.table.empty.searchText') : YU.t('rating.table.empty.deptText'),
        action: `<button type="button" class="btn btn-secondary btn-sm" data-action="clear">${YU.t('rating.table.reset')}</button>`,
      });
    return `<section class="panel"><div class="panel-head"><span class="h2">${head}</span><span class="small muted">${sub}</span></div><div class="mt-12">${body}</div></section>`;
  }

  // ---------- Department race: sum of the period's coins across active people, bar relative to the leader
  function deptsPanel(ui, key) {
    const stats = YU.state.departments
      .map((d) => {
        const members = YU.state.users.filter((u) => u.status === 'active' && u.deptId === d.id);
        return { d, count: members.length, sum: members.reduce((a, u) => a + (u[key] || 0), 0) };
      })
      .sort((a, b) => b.sum - a.sum || a.d.name.localeCompare(b.d.name, YU.i18n.current() || 'ru'));
    const max = Math.max(1, ...stats.map((s) => s.sum));
    const rows = stats.map(({ d, count, sum }) => {
      const active = ui.dept === d.id;
      return `<a class="list-item is-link rating-dept ${active ? 'is-active' : ''}" href="${esc(hashFor({ ...ui, dept: active ? '' : d.id }))}" title="${active ? YU.t('rating.depts.showAll') : YU.t('rating.depts.showOnly', { name: d.name })}">
        <span class="row-between">${deptChip(d.id)}<span class="mono-num small">${fmtNum(sum)}</span></span>
        ${progress(sum, max, 'is-thin')}
        <span class="micro muted">${YU.t('rating.membersCount', { count })}${active ? `, ${YU.t('rating.depts.shown')}` : ''}</span>
      </a>`;
    });
    return `<aside class="panel rating-depts">
      <div class="panel-head"><span class="h2">${YU.t('rating.depts.title')}</span><span class="small muted">${periodLabel(ui.period)}</span></div>
      ${rows.length ? `<div class="list mt-12">${rows.join('')}</div>` : U.empty({ icon: 'building-2', title: YU.t('rating.depts.empty.title'), text: YU.t('rating.depts.empty.text') })}
      <div class="panel-foot"><span class="micro muted">${YU.t('rating.depts.foot')}</span></div>
    </aside>`;
  }

  // ---------- Compose
  function content(ui, me) {
    const { key, board, rows, needle } = boardFor(ui);
    const showPodium = !needle && rows.length >= PODIUM_SIZE;
    return `<div class="rating-layout">
      <div class="rating-main">
        ${myStrip(ui, me, board, key)}
        ${showPodium ? podium(board.slice(0, PODIUM_SIZE), key) : ''}
        ${tablePanel(ui, me, board, rows, key, needle)}
      </div>
      ${deptsPanel(ui, key)}
    </div>`;
  }

  function render(params) {
    const me = YU.me(); if (!me) return '';
    const ui = resolveUi(params);
    return `<div class="rating-screen">
      <div class="page-head">
        <div><h1 class="h1">${YU.t('rating.heading')} <em>${YU.t('rating.headingAccent')}</em></h1><p class="lead">${YU.t('rating.lead')}</p></div>
      </div>
      ${controls(ui)}
      <div class="rating-content">${content(ui, me)}</div>
    </div>`;
  }

  // ---------- Interaction. Period and dept go through the hash (router re-renders); search re-draws locally to keep focus
  function redraw(root, ui) {
    const me = YU.me(); if (!me) return;
    const host = root.querySelector('.rating-content'); if (!host) return;
    host.innerHTML = content(ui, me);
    const input = root.querySelector('.rating-search .input');
    if (input && input.value !== ui.q) input.value = ui.q;
    U.refreshIcons();
  }
  // Decide by what actually changed, not by comparing hash strings: a bare '#/rating' entry must not push a hash on the first keystroke
  function apply(root, patch) {
    const prev = normalize({ ...DEFAULT_UI, ...(YU.state.ui.rating || {}) });
    const ui = normalize({ ...prev, ...patch });
    YU.state.ui.rating = ui;
    if (ui.period !== prev.period || ui.dept !== prev.dept) { location.hash = hashFor(ui); return; }
    redraw(root, ui);
  }
  // Keep the address bar shareable when stored filters won over a bare hash. replaceState does not fire hashchange, so no extra render
  function syncHash(ui) {
    const target = hashFor(ui);
    if (location.hash === target) return;
    try { history.replaceState(null, '', target); } catch (err) { /* URL stays bare; filters still apply from state */ }
  }

  function mount(root, params) {
    const me = YU.me(); if (!me) return;
    const ui = resolveUi(params);
    YU.state.ui.rating = ui;
    syncHash(ui);
    // The router hands a fresh #view to every mount, so handlers are wired per render and the debounce follows this root
    const searchLater = U.debounce((q) => apply(root, { q }), SEARCH_DELAY);
    U.on(root, 'click', '.rating-screen [data-period]', (e, el) => apply(root, { period: el.dataset.period }));
    U.on(root, 'click', '.rating-screen [data-dept]', (e, el) => apply(root, { dept: el.dataset.dept }));
    U.on(root, 'input', '.rating-screen .rating-search .input', (e, el) => searchLater(el.value));
    U.on(root, 'click', '.rating-screen [data-action="clear"]', () => apply(root, { dept: '', q: '' }));
    U.on(root, 'click', '.rating-screen tr[data-href]', (e, el) => {
      if (e.target.closest('a, button')) return;
      location.hash = el.dataset.href;
    });
  }

  YU.screens.rating = { title: () => YU.t('rating.pageTitle'), render, mount };
})();

;
/* js/screens/rewards.js */
/* Rewards — coin shop, redeem flow and my redemptions. Balance is YU.me().balance; codes come from YU.actions.redeemReward. */
(function () {
  const U = YU.ui;
  const { esc, icon, coins, pill, fmtNum, fmtDate } = U;

  const TABS = ['shop', 'history'];
  const ALL = 'all';
  const LOW_STOCK = 3;
  const DEFAULT_UI = { tab: 'shop', cat: ALL, sort: 'asc', affordable: false };
  // Tone and icon per redemption status; the label is rewards.redemption.<status>
  const REDEMPTION_STATUS = { reserved: ['warn', 'clock'], issued: ['ok', 'check'] };

  // ---------- UI state: survives re-renders, query only seeds it
  const ui = () => ({ ...DEFAULT_UI, ...(YU.state.ui.rewards || {}) });
  const setUi = (patch) => { YU.state.ui.rewards = { ...ui(), ...patch }; };
  const tabFrom = (params) => {
    const q = params && params.query ? params.query.tab : '';
    // Only someone who can redeem has rewards of their own to list
    if (!YU.can('rewards.redeem')) return 'shop';
    if (TABS.includes(q)) return q;
    return TABS.includes(ui().tab) ? ui().tab : 'shop';
  };

  // ---------- Data helpers (pure)
  const byNewest = (a, b) => new Date(b.at) - new Date(a.at);
  const isSoldOut = (r) => r.stock !== null && r.stock <= 0;
  // The shop order of the categories, read per render so it follows the active language
  const categoryOrder = () => YU.t('rewards.categoryOrder').split(',').map((c) => c.trim());
  const categories = () => {
    const order = categoryOrder();
    const rank = (c) => { const i = order.indexOf(c); return i < 0 ? order.length : i; };
    return [...new Set(YU.state.rewards.map((r) => r.category))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ru'));
  };
  const activeCat = (st) => (st.cat !== ALL && categories().includes(st.cat) ? st.cat : ALL);
  const filteredRewards = (me, st) => {
    const cat = activeCat(st), dir = st.sort === 'desc' ? -1 : 1;
    return YU.state.rewards
      .filter((r) => cat === ALL || r.category === cat)
      .filter((r) => !st.affordable || (r.cost <= me.balance && !isSoldOut(r)))
      .sort((a, b) => dir * (a.cost - b.cost) || a.title.localeCompare(b.title, 'ru'));
  };
  const myRedemptions = (me) => YU.select.userRedemptions(me.id).slice().sort(byNewest);
  const mySpends = (me) => YU.select.userTransactions(me.id).filter((t) => t.refType === 'reward').sort(byNewest);
  const redemptionPill = (s) => {
    const st = REDEMPTION_STATUS[s];
    return st ? pill(YU.t(`rewards.redemption.${s}`), st[0], st[1]) : pill(s, 'neutral');
  };

  // ---------- Page head
  function balanceCard(me) {
    return `<div class="hero-card on-dark rewards-balance">
      <div class="hero-label">${YU.t('rewards.balance.label')}</div>
      <div class="display hero-value">${fmtNum(me.balance)}</div>
      <div class="micro muted">${YU.t('rewards.balance.earned', { total: me.coinsTotal })}</div>
    </div>`;
  }

  // ---------- Shop
  function stockLabel(r) {
    if (isSoldOut(r)) return `<span class="text-bad">${YU.t('rewards.stock.soldOut')}</span>`;
    if (r.stock === null) return YU.t('rewards.stock.unlimited');
    const text = r.stock === 1 ? YU.t('rewards.stock.lastOne') : YU.t('rewards.stock.left', { count: r.stock });
    return r.stock <= LOW_STOCK ? `<span class="text-warn">${text}</span>` : text;
  }

  function rewardCard(r, me) {
    const soldOut = isSoldOut(r);
    const short = Math.max(0, r.cost - me.balance);
    const mayRedeem = YU.can('rewards.redeem');
    const enabled = mayRedeem && !soldOut && short === 0;
    const hint = !soldOut && short ? YU.t('rewards.hint.short', { count: short }) : '';
    return `<article class="panel rewards-card ${soldOut ? 'is-soldout' : ''}">
      <div class="rewards-art tone-${esc(r.tone)}">${icon(r.icon)}</div>
      <div class="rewards-card-body">
        <span class="chip">${esc(r.category)}</span>
        <div class="h3">${esc(r.title)}</div>
        <p class="small muted clamp-2">${esc(r.desc)}</p>
        <div class="rewards-card-foot">
          <div class="col">${coins(r.cost)}<span class="micro muted">${stockLabel(r)}</span></div>
          ${mayRedeem ? `<div class="col rewards-card-cta">
            <button class="btn btn-primary btn-sm" data-rewards-redeem="${esc(r.id)}" ${enabled ? '' : 'disabled'}>${soldOut ? YU.t('rewards.cta.soldOut') : YU.t('rewards.cta.redeem')}</button>
            ${hint ? `<span class="micro muted">${hint}</span>` : ''}
          </div>` : ''}
        </div>
      </div>
    </article>`;
  }

  function shopEmpty(st, total) {
    const reset = `<button class="btn btn-secondary btn-sm" data-rewards-reset>${YU.t('rewards.empty.showAll')}</button>`;
    if (!total) return U.empty({ icon: 'gift', title: YU.t('rewards.empty.shop.title'), text: YU.t('rewards.empty.shop.text'), action: `<a class="btn btn-secondary btn-sm" href="#/missions">${YU.t('rewards.empty.toMissions')}</a>` });
    if (st.affordable) return U.empty({ icon: 'wallet', title: YU.t('rewards.empty.afford.title'), text: YU.t('rewards.empty.afford.text'), action: `<div class="row gap-8 wrap">${reset}<a class="btn btn-primary btn-sm" href="#/missions">${YU.t('rewards.empty.findMission')}</a></div>` });
    return U.empty({ icon: 'filter', title: YU.t('rewards.empty.category.title'), text: YU.t('rewards.empty.category.text'), action: reset });
  }

  function shopSection(me) {
    const st = ui(), cat = activeCat(st);
    const list = filteredRewards(me, st);
    const catChip = (value, label) => `<button class="filter-chip ${cat === value ? 'is-active' : ''}" data-rewards-cat="${esc(value)}">${esc(label)}</button>`;
    return `
      <div class="rewards-toolbar">
        <div class="filters filters-scroll">${catChip(ALL, YU.t('rewards.filter.all'))}${categories().map((c) => catChip(c, c)).join('')}</div>
        <div class="row gap-8 wrap">
          <div class="seg" aria-label="${YU.t('rewards.sort.label')}">
            <button class="${st.sort !== 'desc' ? 'is-active' : ''}" data-rewards-sort="asc">${YU.t('rewards.sort.asc')}</button>
            <button class="${st.sort === 'desc' ? 'is-active' : ''}" data-rewards-sort="desc">${YU.t('rewards.sort.desc')}</button>
          </div>
          ${YU.can('rewards.redeem') ? `<button class="filter-chip ${st.affordable ? 'is-active' : ''}" data-rewards-afford="${st.affordable ? '0' : '1'}" aria-pressed="${st.affordable}">${icon('wallet')}${YU.t('rewards.filter.affordable')}</button>` : ''}
        </div>
      </div>
      ${list.length ? `<div class="cards-4 rewards-grid">${list.map((r) => rewardCard(r, me)).join('')}</div>` : `<div class="panel">${shopEmpty(st, YU.state.rewards.length)}</div>`}`;
  }

  // ---------- History: my redemptions + what the coins went on
  function redemptionsPanel(mine) {
    const rows = mine.map((rd) => { const r = YU.reward(rd.rewardId); return `
      <div class="list-item">
        <span class="kpi-icon tone-${esc(r ? r.tone : 'slate')}">${icon(r ? r.icon : 'gift')}</span>
        <span class="grow"><div class="list-title truncate">${r ? esc(r.title) : YU.t('rewards.history.removed')}</div>
          <div class="list-sub">${esc(fmtDate(rd.at, { time: true }))}${r ? `, ${esc(r.category)}` : ''}</div></span>
        <span class="rewards-hist-right"><span class="kbd">${esc(rd.code)}</span>${redemptionPill(rd.status)}</span>
      </div>`; }).join('');
    return `<section class="panel">
      <div class="panel-head"><span class="h2">${YU.t('rewards.myRewards')}</span><span class="small muted hide-mobile">${YU.t('rewards.pickupNote')}</span></div>
      ${mine.length ? `<div class="list mt-12">${rows}</div>` : U.empty({ icon: 'gift', title: YU.t('rewards.empty.mine.title'), text: YU.t('rewards.empty.mine.text'), action: `<button class="btn btn-primary btn-sm" data-rewards-tab="shop">${YU.t('rewards.empty.toShop')}</button>` })}
    </section>`;
  }

  function spendsPanel(me) {
    const spends = mySpends(me);
    const total = spends.reduce((a, t) => a + Math.abs(t.delta), 0);
    const rows = spends.map((tx) => { const r = YU.reward(tx.refId); return `
      <div class="list-item">
        <span class="kpi-icon tone-${esc(r ? r.tone : 'slate')}">${icon(r ? r.icon : 'coins')}</span>
        <span class="grow"><div class="list-title truncate">${esc((tx.refId && YU.reward(tx.refId) || {}).title || tx.reason)}</div><div class="list-sub">${esc(fmtDate(tx.at, { time: true }))}</div></span>
        ${coins(tx.delta, { sign: true })}
      </div>`; }).join('');
    return `<section class="panel">
      <div class="panel-head"><span class="h2">${YU.t('rewards.spends.title')}</span>${total ? `<span class="small muted">${YU.t('rewards.spends.total', { total })}</span>` : ''}</div>
      ${rows ? `<div class="list mt-12">${rows}</div>` : U.empty({ icon: 'history', title: YU.t('rewards.empty.spends.title'), text: YU.t('rewards.empty.spends.text'), action: `<a class="btn btn-secondary btn-sm" href="#/profile?tab=history">${YU.t('rewards.empty.allEarnings')}</a>` })}
    </section>`;
  }

  const historyTab = (me, mine) => `<div class="two-col rewards-history">${redemptionsPanel(mine)}${spendsPanel(me)}</div>`;

  // ---------- Redeem flow. The modal lives outside #view, so after the action we update it by hand.
  const setModal = (el, { title, sub, body, foot }) => {
    const h = el.querySelector('.modal-head .h2'); if (h && title !== undefined) h.innerHTML = title;
    const s = el.querySelector('.modal-head .muted'); if (s && sub !== undefined) s.innerHTML = sub;
    const b = el.querySelector('.modal-body'); if (b && body !== undefined) b.innerHTML = body;
    const f = el.querySelector('.modal-foot'); if (f && foot !== undefined) f.innerHTML = foot;
    U.refreshIcons();
  };

  const successBody = (r, rd, balance) => `<div class="rewards-success">
      <span class="badge-art tone-gold">${icon('check')}</span>
      <div class="h2 mt-12">${YU.t('rewards.success.title')}</div>
      <p class="small muted mt-4">${YU.t('rewards.success.spent', { count: r.cost, balance })}</p>
      <div class="display rewards-code mt-16">${esc(rd.code)}</div>
      <p class="small muted-2 mt-12">${YU.t('rewards.success.showCode')}</p>
    </div>`;

  function openRedeemModal(rewardId) {
    const me = YU.me(), r = YU.reward(rewardId);
    if (!me || !r) return U.toast(YU.tText('rewards.notFound'), 'bad');
    const after = me.balance - r.cost;
    const el = U.modal.open({
      title: YU.t('rewards.redeem.title'),
      sub: YU.t('rewards.redeem.sub'),
      body: `
        <div class="rewards-summary">
          <div class="rewards-art rewards-art-sm tone-${esc(r.tone)}">${icon(r.icon)}</div>
          <div class="grow">
            <span class="chip">${esc(r.category)}</span>
            <div class="h3 mt-8">${esc(r.title)}</div>
            <p class="small muted mt-4">${esc(r.desc)}</p>
          </div>
        </div>
        <div class="inset rewards-calc mt-16">
          <div class="row-between"><span class="small muted-2">${YU.t('rewards.redeem.now')}</span>${coins(me.balance)}</div>
          <div class="row-between"><span class="small muted-2">${YU.t('rewards.redeem.after')}</span>${coins(after)}</div>
        </div>
        <div class="notice notice-info mt-16">${icon('map-pin')}<span>${YU.t('rewards.pickupNote')}. ${YU.t('rewards.redeem.codeHint')}</span></div>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button>
        <button class="btn btn-gold" id="rewards-confirm">${icon('coins')}${YU.t('rewards.redeem.confirm', { count: r.cost })}</button>`,
    });
    if (!el) return;
    const confirmBtn = el.querySelector('#rewards-confirm');
    confirmBtn.onclick = async () => {
      const res = await U.busy(confirmBtn, () => YU.actions.redeemReward(r.id));
      if (!res.ok) return U.toast(res.error, 'bad');
      // The modal may have been closed while the request was running; the code is in notifications and «Мои награды» anyway
      if (!el.isConnected || !U.modal.isOpen()) return U.toast(YU.tText('rewards.success.toastWithCode', { code: res.redemption.code }), 'gold', 'gift');
      const balance = YU.me() ? YU.me().balance : after;
      setModal(el, {
        title: esc(r.title),
        sub: YU.t('rewards.success.sub'),
        body: successBody(r, res.redemption, balance),
        foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('rewards.success.done')}</button><button class="btn btn-primary" id="rewards-go-history">${icon('gift')}${YU.t('rewards.myRewards')}</button>`,
      });
      U.toast(YU.tText('rewards.success.title'), 'gold', 'gift');
      el.querySelector('#rewards-go-history').onclick = () => { U.modal.close(); goTab('history'); };
    };
  }

  // ---------- Compose
  function render(params) {
    const me = YU.me(); if (!me) return '';
    const tab = tabFrom(params);
    const mine = myRedemptions(me);
    const redeems = YU.can('rewards.redeem');
    const tabBtn = (id, label, count) => `<button class="tab ${tab === id ? 'is-active' : ''}" role="tab" aria-selected="${tab === id}" data-rewards-tab="${id}">${label}<span class="count">${count}</span></button>`;
    return `
      <div class="page-head">
        <div><h1 class="h1">${YU.t('rewards.heading')} <em>${YU.t('rewards.headingAccent')}</em></h1><p class="lead">${YU.t('rewards.lead')}</p></div>
        <div class="page-actions">${redeems ? balanceCard(me) : YU.can('rewards.manage') ? `<a class="btn btn-primary" href="#/admin/rewards">${icon('settings-2')}${YU.t('rewards.action.manage')}</a>` : ''}</div>
      </div>
      ${redeems ? `<div class="tabs mb-20" role="tablist">${tabBtn('shop', YU.t('rewards.tab.shop'), YU.state.rewards.length)}${tabBtn('history', YU.t('rewards.myRewards'), mine.length)}</div>` : ''}
      ${tab === 'history' ? historyTab(me, mine) : `<div id="rewards-shop">${shopSection(me)}</div>`}`;
  }

  // Tabs are routes (#/rewards?tab=…), so switching goes through the hash and the router re-renders
  const goTab = (tab) => {
    setUi({ tab });
    const target = `#/rewards?tab=${tab}`;
    if (location.hash !== target) location.hash = target;
  };
  // Filters are pure UI state: swap only the shop section, handlers are delegated from root
  const refreshShop = (root) => {
    const host = root.querySelector('#rewards-shop'), me = YU.me();
    if (!host || !me) return;
    host.innerHTML = shopSection(me);
    U.refreshIcons();
  };

  const wired = new WeakSet();
  function mount(root, params) {
    const me = YU.me(); if (!me) return;
    setUi({ tab: tabFrom(params) });
    // #view is reused for every render, so delegate once per root instead of stacking listeners
    if (wired.has(root)) return;
    wired.add(root);
    U.on(root, 'click', '[data-rewards-tab]', (e, el) => goTab(el.dataset.rewardsTab));
    U.on(root, 'click', '[data-rewards-cat]', (e, el) => { setUi({ cat: el.dataset.rewardsCat }); refreshShop(root); });
    U.on(root, 'click', '[data-rewards-sort]', (e, el) => { setUi({ sort: el.dataset.rewardsSort }); refreshShop(root); });
    U.on(root, 'click', '[data-rewards-afford]', (e, el) => { setUi({ affordable: el.dataset.rewardsAfford === '1' }); refreshShop(root); });
    U.on(root, 'click', '[data-rewards-reset]', () => { setUi({ cat: ALL, affordable: false }); refreshShop(root); });
    U.on(root, 'click', '[data-rewards-redeem]', (e, el) => openRedeemModal(el.dataset.rewardsRedeem));
  }

  YU.screens.rewards = { title: () => YU.t('nav.rewards'), render, mount };
})();

;
/* js/screens/news.js */
/* News — feed with a featured pinned story and category filters, plus a full article page with likes and sharing. */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, chip, pill, fmtNum, fmtDate, timeAgo } = U;
  // Category values are what a news row stores and what travels in the hash, so they stay
  // as they are; every place that shows one labels it through the catalogue.
  const CATEGORIES = Object.keys(YU.NEWS_CATEGORIES);
  const catLabel = (c) => YU.newsCategoryLabel(c);
  const ALSO_COUNT = 3;
  const SEARCH_DELAY = 150;

  // ---------- State & data helpers
  const ui = () => (YU.state.ui.news = YU.state.ui.news || { cat: '', q: '', viewed: {} });
  // Whoever runs the news: the leader, admins and the news department's coordinators
  const canManage = () => YU.canManageNews();
  const isDraft = (n) => n.status === 'draft';
  // A post's first picture fills its cover and a gallery of several shows how many; the server decides who may fetch them
  const pictures = (n) => n.pictures || [];
  const coverCls = (n) => (pictures(n).length ? ' has-img' : '');
  const coverImg = (n) => (pictures(n).length ? `<img class="news-cover-img" ${U.photoSrc(pictures(n)[0].url)} alt="${YU.t('news.picture.alt')}" loading="lazy">` : '');
  const coverCount = (n) => (pictures(n).length > 1 ? `<span class="pill news-cover-pill news-cover-count" title="${YU.t('news.gallery.count', { count: pictures(n).length })}">${icon('images')}${pictures(n).length}</span>` : '');
  // Active filters: a ?cat= in the URL wins over what the screen remembers; search lives only in state
  const filtersFor = (params) => {
    const st = ui(), q = (params && params.query) || {};
    const cat = q.cat !== undefined ? q.cat : st.cat;
    return { cat: CATEGORIES.includes(cat) ? cat : '', q: st.q || '' };
  };
  const author = (n) => YU.user(n.authorId);
  // Display-ready: a stored name is escaped here, the fallback comes from the catalogue already escaped
  const authorName = (n) => { const u = author(n); return u ? esc(u.name) : YU.t('news.defaultAuthor'); };
  const authorSub = (u) => { if (!u) return ''; const d = YU.dept(u.deptId); return d ? `${YU.roleName(u.role)}, ${d.name}` : YU.roleName(u.role); };
  // Published items are visible to everyone, drafts only to the people who run the news
  const visibleNews = (id) => { const n = YU.newsItem(id); return n && (!isDraft(n) || canManage()) ? n : null; };
  const matches = (n, { cat, q }) => {
    if (cat && n.category !== cat) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    // In the reader's language and in the one it was written in
    const src = n.raw || {};
    return [n.title, n.excerpt, ...(n.body || []), src.title, src.excerpt, ...(src.body || [])].some((t) => String(t || '').toLowerCase().includes(s));
  };
  // Whoever runs the news sees drafts first (they need a decision), then published pinned-first as the selector sorts them
  const feedItems = (f) => {
    const drafts = canManage() ? YU.state.news.filter(isDraft) : [];
    return [...drafts, ...YU.select.publishedNews()].filter((n) => matches(n, f));
  };
  // Both branches are locale text, never stored data, so this needs no escaping at the call sites
  const whenLine = (n) => (isDraft(n) ? YU.t('news.draftNotPublished') : timeAgo(n.publishedAt));
  const stat = (ic, n, cls = 'small') => `<span class="news-stat ${cls} muted">${icon(ic)}${fmtNum(n)}</span>`;
  const href = (n) => `#/news/${esc(n.id)}`;

  // ---------- Feed
  function toolbar(f) {
    const chips = ['', ...CATEGORIES].map((c) => `<button class="filter-chip ${f.cat === c ? 'is-active' : ''}" data-cat="${esc(c)}">${c ? esc(catLabel(c)) : YU.t('news.category.all')}</button>`).join('');
    return `<div class="news-toolbar">
      <div class="filters filters-scroll">${chips}</div>
      <label class="search news-search">${icon('search')}<input class="input" id="news-q" type="text" placeholder="${YU.t('news.searchPlaceholder')}" value="${esc(f.q)}" autocomplete="off" aria-label="${YU.t('news.searchLabel')}"></label>
    </div>`;
  }

  function featuredCard(n) {
    const u = author(n);
    return `<article class="panel news-featured is-clickable" data-href="${href(n)}">
      <div class="news-cover is-wide on-dark tone-${esc(n.tone)}${coverCls(n)}">${coverImg(n)}${coverCount(n) ? `<div class="news-cover-tags">${coverCount(n)}</div>` : ''}</div>
      <div class="news-featured-body">
        <div class="row gap-8 wrap"><span class="pill pill-gold">${icon('pin')}${YU.t('news.pinned')}</span>${chip(catLabel(n.category), n.tone)}</div>
        <a class="h1 news-featured-title" href="${href(n)}">${esc(n.title)}</a>
        <p class="news-featured-excerpt">${esc(n.excerpt)}</p>
        <div class="news-byline">
          ${avatar(u, 'avatar-sm')}<span class="small news-byline-name">${authorName(n)}</span><span class="small muted">${whenLine(n)}</span>
          <span class="news-byline-stats">${stat('heart', n.likes)}${stat('eye', n.views)}</span>
        </div>
      </div>
    </article>`;
  }

  function newsCard(n) {
    const u = author(n), draft = isDraft(n);
    return `<article class="panel news-card is-clickable" data-href="${href(n)}">
      <div class="news-cover on-dark tone-${esc(n.tone)}${coverCls(n)}">${coverImg(n)}<div class="news-cover-tags">${draft ? pill(YU.t('mission.status.draft'), 'warn', 'file-pen-line') : ''}<span class="pill news-cover-pill">${esc(catLabel(n.category))}</span>${coverCount(n)}</div></div>
      <div class="news-card-body">
        <a class="h3 clamp-2 news-card-title" href="${href(n)}">${esc(n.title)}</a>
        <p class="small muted clamp-3">${esc(n.excerpt)}</p>
        <div class="news-card-foot">
          ${avatar(u, 'avatar-sm')}<span class="small news-card-author truncate">${authorName(n)}</span>
          ${draft
            ? `<a class="btn btn-ghost btn-sm" href="#/admin/news/${esc(n.id)}">${icon('pencil')}${YU.t('news.action.edit')}</a>`
            : `<span class="micro muted">${whenLine(n)}</span>${stat('heart', n.likes, 'micro')}`}
        </div>
      </div>
    </article>`;
  }

  function emptyFeed(f) {
    if (f.cat || f.q) return U.empty({
      icon: 'search', title: YU.t('news.empty.filtered.title'),
      text: f.q ? YU.t('news.empty.filtered.searchText') : YU.t('news.empty.filtered.catText'),
      action: `<button class="btn btn-secondary btn-sm" data-action="reset">${YU.t('news.action.showAll')}</button>`,
    });
    return U.empty({
      icon: 'newspaper', title: YU.t('news.empty.title'),
      text: canManage() ? YU.t('news.empty.adminText') : YU.t('news.empty.text'),
      action: canManage() ? `<a class="btn btn-primary btn-sm" href="#/admin/news/new">${YU.t('news.action.new')}</a>` : '',
    });
  }

  function feed(f) {
    const items = feedItems(f);
    if (!items.length) return `<div class="panel">${emptyFeed(f)}</div>`;
    const featured = items.filter((n) => n.pinned && !isDraft(n));
    const rest = items.filter((n) => !featured.includes(n));
    return `${featured.map(featuredCard).join('')}${rest.length ? `<div class="cards-3">${rest.map(newsCard).join('')}</div>` : ''}`;
  }

  function renderFeed(params) {
    const f = filtersFor(params);
    return `
      <div class="page-head">
        <div><h1 class="h1">${YU.t('news.heading')} <em>${YU.t('news.headingAccent')}</em></h1><p class="lead">${YU.t('news.lead')}</p></div>
        <div class="page-actions">${canManage() ? `<a class="btn btn-primary" href="#/admin/news/new">${icon('plus')}${YU.t('news.action.new')}</a>` : ''}</div>
      </div>
      ${toolbar(f)}
      <div id="news-feed">${feed(f)}</div>`;
  }

  function mountFeed(root, params) {
    const st = ui();
    Object.assign(st, filtersFor(params));
    // Category lives in the URL so the view is shareable; same hash means no hashchange, so refresh by hand
    const go = (hash) => { if (location.hash === hash) YU.router.refresh(); else location.hash = hash; };
    // Search re-fills only the feed so the input keeps focus while typing
    const refill = () => { const host = U.$('#news-feed', root); if (host) { host.innerHTML = feed(filtersFor(params)); U.refreshIcons(); } };
    const onSearch = U.debounce((v) => { st.q = v.trim(); refill(); }, SEARCH_DELAY);

    U.on(root, 'click', '[data-cat]', (e, el) => { st.cat = el.dataset.cat; go(st.cat ? `#/news?cat=${encodeURIComponent(st.cat)}` : '#/news'); });
    U.on(root, 'input', '#news-q', (e, el) => onSearch(el.value));
    U.on(root, 'click', '[data-action="reset"]', () => { st.q = ''; st.cat = ''; go('#/news'); });
    U.on(root, 'click', '[data-href]', (e, el) => { if (e.target.closest('a, button')) return; location.hash = el.dataset.href; });
  }

  // ---------- Article
  const backLink = () => `<div class="mb-16"><a class="btn btn-ghost btn-sm" href="#/news">${icon('chevron-left')}${YU.t('news.action.allNews')}</a></div>`;

  function notFound() {
    return `${backLink()}<div class="panel news-article">${U.empty({
      icon: 'newspaper', title: YU.t('news.notFound.title'),
      text: YU.t('news.notFound.text'),
      action: `<a class="btn btn-primary btn-sm" href="#/news">${YU.t('news.action.toFeed')}</a>`,
    })}</div>`;
  }

  function alsoRead(n) {
    const list = YU.select.publishedNews().filter((x) => x.id !== n.id)
      .sort((a, b) => (b.category === n.category) - (a.category === n.category))
      .slice(0, ALSO_COUNT);
    const rows = list.map((x) => `
      <a class="list-item is-link news-also-item" href="${href(x)}">
        <span class="news-cover news-swatch tone-${esc(x.tone)}"></span>
        <span class="grow"><div class="list-title clamp-2">${esc(x.title)}</div><div class="list-sub">${esc(timeAgo(x.publishedAt))}, ${esc(catLabel(x.category))}</div></span>
        ${icon('chevron-right', 'news-also-arrow')}
      </a>`).join('');
    return `<section class="news-also">
      <div class="row-between mb-12"><span class="h2">${YU.t('news.also.title')}</span><a class="btn btn-ghost btn-sm" href="#/news">${YU.t('news.action.allNews')}</a></div>
      <div class="panel">${rows ? `<div class="list">${rows}</div>` : U.empty({ icon: 'newspaper', title: YU.t('news.also.empty.title'), text: YU.t('news.also.empty.text') })}</div>
    </section>`;
  }

  function articleActions(n) {
    if (isDraft(n)) return `<div class="notice notice-warn">${icon('file-pen-line')}<span>${YU.t('news.draftNotice')}</span></div>
      <div class="news-article-actions"><a class="btn btn-primary" href="#/admin/news/${esc(n.id)}">${icon('pencil')}${YU.t('news.action.openInAdmin')}</a></div>`;
    const liked = YU.state.liked.includes(n.id);
    return `<div class="news-article-actions">
      <button class="btn btn-secondary news-like ${liked ? 'is-liked' : ''}" data-action="like" aria-pressed="${liked}">${icon('heart')}${YU.t('news.action.like', { count: n.likes })}</button>
      <button class="btn btn-secondary" data-action="share">${icon('share-2')}${YU.t('news.action.share')}</button>
      ${canManage() ? `<a class="btn btn-ghost" href="#/admin/news/${esc(n.id)}">${icon('pencil')}${YU.t('news.action.edit')}</a>` : ''}
    </div>`;
  }

  function renderArticle(n) {
    const u = author(n), draft = isDraft(n);
    const body = n.body && n.body.length ? n.body : [n.excerpt];
    return `${backLink()}
      <article class="news-article">
        <div class="row gap-8 wrap">${chip(catLabel(n.category), n.tone)}${n.pinned ? `<span class="pill pill-gold">${icon('pin')}${YU.t('news.pinned')}</span>` : ''}${draft ? pill(YU.t('mission.status.draft'), 'warn', 'file-pen-line') : ''}</div>
        <h1 class="h1 news-article-title">${esc(n.title)}</h1>
        <div class="news-article-meta">
          <div class="row gap-10">${avatar(u)}<div class="news-author"><div class="news-author-name truncate">${authorName(n)}</div><div class="micro muted truncate">${esc(authorSub(u))}</div></div></div>
          <div class="news-article-stats small muted">
            <span>${icon('calendar')}${draft ? YU.t('news.notPublished') : esc(fmtDate(n.publishedAt, { full: true, time: true }))}</span>
            <span>${icon('eye')}<span data-news-views>${fmtNum(n.views)}</span></span>
          </div>
        </div>
        ${gallery(n)}
        <div class="prose news-article-body">${body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        ${articleActions(n)}
      </article>
      ${alsoRead(n)}`;
  }

  // ---------- Gallery
  // One picture fills the cover; several become a lead picture and a strip of the rest. Every tile opens the viewer.
  const galleryImg = (n, i, cls = '') => {
    const p = pictures(n)[i], size = p.width && p.height ? ` width="${p.width}" height="${p.height}"` : '';
    return `<img class="${cls}" ${U.photoSrc(p.url)} alt="${YU.t('news.gallery.alt', { n: i + 1, total: pictures(n).length })}" loading="${i ? 'lazy' : 'eager'}"${size}>`;
  };
  const galleryTile = (n, i, cls = '') => `<button type="button" class="news-gallery-tile ${cls}" data-photo="${i}" aria-label="${YU.t('news.gallery.open')}">${galleryImg(n, i)}</button>`;
  function gallery(n) {
    const pics = pictures(n);
    if (pics.length <= 1) return `<div class="news-cover is-wide on-dark tone-${esc(n.tone)}${coverCls(n)}">${pics.length ? galleryTile(n, 0, 'is-cover') : ''}</div>`;
    return `<div class="news-gallery" data-count="${pics.length}">${galleryTile(n, 0, 'is-lead')}<div class="news-gallery-strip">${pics.slice(1).map((p, i) => galleryTile(n, i + 1)).join('')}</div></div>`;
  }

  const SWIPE_PX = 40;
  // The viewer: one picture at a time, stepped with the arrows, the keyboard or a swipe. Each step draws a fresh
  // <img>, so the app's data-auth-src loader (mobile/src/native.js) picks it up like any other picture.
  function openViewer(n, start) {
    const pics = pictures(n); if (!pics.length) return;
    const many = pics.length > 1;
    let i = Math.min(Math.max(start, 0), pics.length - 1), touchX = null;
    const onKey = (e) => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    const el = U.modal.open({
      title: esc(n.title),
      body: `<div class="news-viewer">
        <div class="news-viewer-stage" data-viewer-stage></div>
        <div class="news-viewer-bar" ${many ? '' : 'hidden'}>
          <button type="button" class="btn btn-secondary btn-sm btn-icon" data-viewer="-1" aria-label="${YU.t('news.gallery.prev')}">${icon('chevron-left')}</button>
          <span class="small muted" data-viewer-pos></span>
          <button type="button" class="btn btn-secondary btn-sm btn-icon" data-viewer="1" aria-label="${YU.t('news.gallery.next')}">${icon('chevron-right')}</button>
        </div>
      </div>`,
      wide: true,
      onClose: () => document.removeEventListener('keydown', onKey),
    });
    if (!el) return;
    const draw = () => {
      el.querySelector('[data-viewer-stage]').innerHTML = galleryImg(n, i, 'news-viewer-img');
      el.querySelector('[data-viewer-pos]').textContent = YU.tText('news.gallery.position', { n: i + 1, total: pics.length });
    };
    const step = (d) => { if (many) { i = (i + d + pics.length) % pics.length; draw(); } };
    el.onclick = (e) => { const b = e.target.closest('[data-viewer]'); if (b) step(Number(b.dataset.viewer)); };
    el.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', onKey);
    draw(); U.refreshIcons();
  }

  function share() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return U.toast(YU.tText('news.share.manual'), 'info', 'link');
    // The app's own address is a local origin nobody else can open: share the website's instead
    const link = window.YUNative ? `${window.YUNative.apiOrigin}/${location.hash}` : location.href;
    navigator.clipboard.writeText(link).then(
      () => U.toast(YU.tText('news.share.copied'), 'ok', 'link'),
      () => U.toast(YU.tText('news.share.failed'), 'bad'),
    );
  }

  function mountArticle(root, n) {
    const st = ui();
    st.viewed = st.viewed || {};
    if (!isDraft(n) && !st.viewed[n.id]) {
      st.viewed[n.id] = true;
      // Counted in the background: viewNews never re-renders, it only patches the counter if the article is still open
      YU.actions.viewNews(n.id).then((r) => {
        const route = YU.router.current(), el = U.$('[data-news-views]');
        if (r.ok && el && route && route.name === 'news' && route.params.id === n.id) el.textContent = fmtNum(r.views);
      });
    }
    U.on(root, 'click', '[data-action="like"]', async (e, btn) => {
      const r = await U.busy(btn, () => YU.actions.toggleLike(n.id));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.toast(r.liked ? YU.t('news.like.added') : YU.t('news.like.removed'), 'ok', 'heart');
    });
    U.on(root, 'click', '[data-action="share"]', share);
    U.on(root, 'click', '[data-photo]', (e, btn) => openViewer(n, Number(btn.dataset.photo)));
  }

  // ---------- Screen
  function render(params) {
    const me = YU.me(); if (!me) return '';
    if (!params.id) return renderFeed(params);
    const n = visibleNews(params.id);
    return n ? renderArticle(n) : notFound();
  }

  function mount(root, params) {
    const me = YU.me(); if (!me) return;
    if (!params.id) return mountFeed(root, params);
    const n = visibleNews(params.id);
    if (n) mountArticle(root, n);
  }

  YU.screens.news = {
    title: (params) => { const n = params && params.id ? visibleNews(params.id) : null; return n ? n.title : YU.t('news.pageTitle'); },
    render,
    mount,
  };
})();

;
/* js/screens/profile.js */
/* Profile — own page (#/profile) and public page of another member (#/profile/:id). Tabs live in the query (?tab=).
   The account, password and sign-ins are on the settings page (settings.js). */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, progress, chip, deptChip, pill, subStatusPill, fmtNum, fmtDate, timeAgo, deadline, markField } = U;
  // Avatar tones: the id goes into the form, the name comes from profile.tone.<id>
  const TONES = ['violet', 'coral', 'green', 'teal', 'blue', 'pink', 'gold', 'navy', 'slate'];
  // Pill tone per transaction type; the label is profile.tx.<type>, unknown types fall back to profile.tx.other
  const TX_TONE = { mission: 'info', reward: 'gold', bonus: 'ok', manual: 'neutral' };
  const PROOF_ICON = { photo: 'camera', link: 'link', text: 'file-text' };
  const MAX_PHOTO_MB = 10;
  const TAB_KEYS = { badges: 'profile.tab.badges', history: 'profile.tab.history', missions: 'nav.missions' };
  const ROLE_PILL = { admin: 'dark', leader: 'gold', coordinator: 'info' };
  // The leader and admins run the union rather than take part in it: no coins, level or badges of their own
  const isController = (user) => !YU.participates(user);

  let ctx = null; // refreshed on every mount; delegated handlers read from it

  // ---------- Context
  const uiState = () => YU.state.ui.profile || { tab: 'badges' };
  const resolve = (params = {}) => {
    const me = YU.me(); if (!me) return null;
    const user = params.id ? YU.user(params.id) : me;
    if (!user) return { me, user: null };
    const own = user.id === me.id, isAdmin = YU.can('*');
    // An admin runs the union rather than takes part in it: no badges, history or missions of their own
    const tabs = isController(user) ? [] : ['badges', (own || isAdmin) && 'history', 'missions'].filter(Boolean);
    const wanted = params.query && params.query.tab, saved = uiState().tab;
    const tab = tabs.includes(wanted) ? wanted : tabs.includes(saved) ? saved : tabs[0] || null;
    return { me, user, own, isAdmin, tabs, tab, base: params.id ? `#/profile/${user.id}` : '#/profile' };
  };
  const deptTone = (deptId) => { const d = YU.dept(deptId); return d ? d.tone : 'slate'; };
  // A department member shows their department; people above departments show their role
  const roleBadge = (user) => user.deptId ? deptChip(user.deptId)
    : ROLE_PILL[user.role] ? pill(YU.roleName(user.role), ROLE_PILL[user.role], user.role === 'admin' ? 'shield-check' : '')
    : chip(YU.t('role.volunteer'), 'slate');
  // Participations with their mission; the own page and an admin see everything, visitors what was accepted
  const userSubs = (c) => (c.own ? YU.select.mySubmissions() : YU.state.submissions.filter((s) => s.userId === c.user.id && (c.isAdmin || s.status === 'approved')))
    .map((s) => ({ s, t: YU.mission(s.missionId) })).filter((x) => x.t);
  // An admin takes a mission away from the person whose page this is
  const removeButton = (c, s) => (c.isAdmin && !c.own ? `<button type="button" class="btn btn-ghost btn-sm btn-icon" data-profile-remove="${esc(s.id)}" data-title="${esc(YU.mission(s.missionId).title)}" aria-label="${YU.t('profile.missions.remove')}">${icon('x')}</button>` : '');
  const userTx = (c) => YU.select.userTransactions(c.user.id).slice().sort((a, b) => new Date(b.at) - new Date(a.at));
  const tabCount = (c, id) => id === 'badges' ? c.user.badges.filter((b) => YU.badge(b)).length : id === 'history' ? userTx(c).length : id === 'missions' ? userSubs(c).length : 0;

  // ---------- Header panel
  function head(c) {
    const { user, own, isAdmin } = c;
    const lv = U.levelFor(user.coinsTotal), rank = YU.select.rankOf(user.id);
    // A volunteer outside any department is "in the system"; everyone with a role or a department is in the union
    const unaffiliated = user.role === 'volunteer' && !user.deptId;
    const joined = YU.t(unaffiliated ? 'profile.meta.joinedSystem' : 'profile.meta.joinedUnion', { date: fmtDate(user.joinedAt, { year: true }) });
    // Every part is escaped on its own, so the translated wording goes in as it is
    const meta = [unaffiliated ? '' : YU.roleName(user.role), esc(user.group), esc(user.school), joined].filter(Boolean).join(', ');
    // The server only sends contacts the viewer may see (own, coordinator of the member's department, admin)
    const showContacts = !!user.email;
    const controller = isController(user);
    const actions = own
      ? `<button class="btn btn-secondary" data-profile-action="edit">${icon('pencil')}${YU.t('profile.action.edit')}</button><a class="btn btn-secondary" href="#/settings">${icon('settings')}${YU.t('nav.settings')}</a>${controller ? `<a class="btn btn-primary" href="#/admin">${icon('shield-check')}${YU.t('profile.action.adminPanel')}</a>` : ''}`
      : isAdmin && !controller ? `<button class="btn btn-gold" data-profile-action="coins">${icon('coins')}${YU.t('profile.coins.title')}</button><a class="btn btn-secondary" href="#/admin/users/${esc(user.id)}">${icon('shield')}${YU.t('profile.action.role')}</a>` : '';
    const stats = controller ? controllerStats(user) : [
      [YU.t('profile.stat.semester'), fmtNum(user.coinsSemester)],
      [YU.t('profile.stat.total'), fmtNum(user.coinsTotal)],
      [YU.t('profile.stat.rank'), rank ? `#${rank}` : '—'],
      [YU.t('profile.stat.streak'), `${user.streakWeeks} <span class="small">${YU.t('profile.stat.weeksShort')}</span>`],
      [YU.t('profile.stat.missionsDone'), fmtNum(user.missionsDone)],
      own ? [YU.t('profile.stat.balance'), fmtNum(user.balance)] : null,
    ].filter(Boolean);
    return `<section class="panel profile-head">
      ${user.status === 'blocked' && isAdmin ? `<div class="notice profile-notice-bad">${icon('ban')}<span><b>${YU.t('profile.blocked.title')}</b> ${user.blockReason ? esc(user.blockReason) : YU.t('profile.blocked.noReason')}. ${YU.t('profile.blocked.unlockIn')} <a href="#/admin/users/${esc(user.id)}">${YU.t('profile.blocked.userCard')}</a>.</span></div>` : ''}
      <div class="profile-head-main">
        ${avatar(user, 'avatar-xxl')}
        <div class="profile-head-info">
          <h1 class="h1">${esc(user.name)}</h1>
          <div class="profile-meta">${roleBadge(user)}<span class="small muted-2">${meta}</span></div>
          ${user.bio ? `<p class="profile-bio">${esc(user.bio)}</p>` : ''}
          ${showContacts ? `<div class="profile-contacts">
            <span>${icon('mail')}<a href="mailto:${esc(user.email)}">${esc(user.email)}</a></span>
            ${user.phone ? `<span>${icon('phone')}${esc(user.phone)}</span>` : ''}
            ${!own && user.lastActive ? `<span>${icon('activity')}${YU.t('profile.lastSeen', { ago: timeAgo(user.lastActive) })}</span>` : ''}
          </div>` : ''}
        </div>
        ${actions ? `<div class="profile-head-actions">${actions}</div>` : ''}
      </div>
      ${controller ? '' : `<div class="profile-level">
        <span class="pill pill-gold">${icon('sparkles')}${esc(lv.level.name)}</span>
        ${progress(user.coinsTotal - lv.level.min, lv.next ? lv.next.min - lv.level.min : 1, 'is-gold')}
        <span class="micro muted">${lv.next ? YU.t('profile.level.toNext', { name: lv.next.name, count: lv.toNext }) : YU.t('profile.level.max')}</span>
      </div>`}
      <div class="stat-grid profile-stats">${stats.map(([label, value]) => `<div class="stat"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`).join('')}</div>
    </section>`;
  }

  // What an admin's work adds up to, in place of the coins and missions a member collects
  function controllerStats(user) {
    const missions = YU.state.missions.filter((t) => t.createdBy === user.id).length;
    const news = YU.state.news.filter((n) => n.authorId === user.id && n.status === 'published').length;
    // The activity log only reaches admins, so the count shows only to them
    const actions = YU.can('*') ? YU.state.audit.filter((a) => a.actorId === user.id).length : null;
    return [
      [YU.t('profile.stat.missionsCreated'), fmtNum(missions)],
      [YU.t('profile.stat.newsPublished'), fmtNum(news)],
      actions === null ? null : [YU.t('profile.stat.actionsLogged'), fmtNum(actions)],
    ].filter(Boolean);
  }

  const tabsBar = (c) => c.tabs.length < 2 ? '' : `<div class="tabs profile-tabs" role="tablist">${c.tabs.map((id) => { const n = tabCount(c, id); return `
    <button class="tab ${id === c.tab ? 'is-active' : ''}" role="tab" aria-selected="${id === c.tab}" data-profile-tab="${id}">${YU.t(TAB_KEYS[id])}${n ? `<span class="count">${n}</span>` : ''}</button>`; }).join('')}</div>`;

  // ---------- Tab: badges
  function badgesTab(c) {
    const all = YU.state.badges, have = new Set(c.user.badges);
    if (!all.length) return `<section class="panel">${U.empty({ icon: 'award', title: YU.t('profile.badges.empty.title'), text: YU.t('profile.badges.empty.text') })}</section>`;
    const earned = all.filter((b) => have.has(b.id)).length;
    return `<div class="row-between mb-12"><span class="h2">${YU.t('profile.tab.badges')}</span><span class="small muted">${YU.t('profile.badges.earnedOf', { earned, total: all.length })}</span></div>
      ${c.own && !earned ? `<div class="notice notice-info mb-16">${icon('info')}<span>${YU.t('profile.badges.firstHint', { title: all[0].title })} <a href="#/missions">${YU.t('profile.badges.openMissions')}</a></span></div>` : ''}
      <div class="profile-badges">${all.map((b) => { const got = have.has(b.id); return `
        <div class="badge-tile ${got ? '' : 'is-locked'}" title="${got ? esc(b.title) : YU.t('profile.badges.locked')}">
          <span class="badge-art tone-${esc(b.tone)}">${icon(got ? b.icon : 'lock')}</span>
          <span class="h3">${esc(b.title)}</span>
          <span class="micro muted">${esc(b.desc)}</span>
        </div>`; }).join('')}</div>`;
  }

  // ---------- Tab: coin history
  // A transaction keeps the title its mission or reward had when the coins moved; while that row
  // exists it is named by its current title in the reader's language instead
  const reasonOf = (t) => {
    const row = t.refType === 'mission' && t.refId ? YU.mission(t.refId) : t.refType === 'reward' && t.refId ? YU.reward(t.refId) : null;
    return row ? row.title : t.reason;
  };
  const txRow = (t) => {
    const kind = TX_TONE[t.refType] || 'neutral';
    const label = YU.t(TX_TONE[t.refType] ? `profile.tx.${t.refType}` : 'profile.tx.other');
    const by = t.refType === 'manual' && t.by ? YU.user(t.by) : null;
    const mission = t.refType === 'mission' && t.refId ? YU.mission(t.refId) : null;
    return `<tr>
      <td class="small muted">${esc(fmtDate(t.at, { time: true }))}</td>
      <td><div class="list-title">${mission ? `<a href="#/missions/${esc(mission.id)}">${esc(mission.title)}</a>` : esc(reasonOf(t))}</div>${by ? `<div class="micro muted">${esc(by.name)}</div>` : ''}</td>
      <td>${pill(label, kind)}</td>
      <td class="num">${coins(t.delta, { sign: true })}</td>
    </tr>`;
  };
  function historyTab(c) {
    const rows = userTx(c);
    if (!rows.length) return `<section class="panel">${U.empty({
      icon: 'history', title: YU.t('profile.history.empty.title'),
      text: c.own ? YU.t('profile.history.empty.own') : YU.t('profile.history.empty.other'),
      action: c.own ? `<a class="btn btn-primary btn-sm" href="#/missions">${YU.t('profile.toMissions')}</a>` : '',
    })}</section>`;
    const earned = rows.filter((t) => t.delta > 0).reduce((a, t) => a + t.delta, 0);
    const spent = rows.filter((t) => t.delta < 0).reduce((a, t) => a + t.delta, 0);
    return `<section class="panel profile-history">
      <div class="panel-head"><span class="h2">${YU.t('profile.tab.history')}</span><span class="small muted">${YU.t('profile.history.ops', { count: rows.length })}</span></div>
      <div class="table-wrap mt-12"><table class="table">
        <thead><tr><th>${YU.t('profile.history.col.date')}</th><th>${YU.t('profile.history.col.what')}</th><th>${YU.t('profile.history.col.type')}</th><th class="num">${YU.t('profile.history.col.coins')}</th></tr></thead>
        <tbody>${rows.map(txRow).join('')}</tbody>
      </table></div>
      <div class="panel-foot">
        <span class="small muted">${YU.t('profile.history.totalAll')}</span>
        <span class="row gap-8 wrap"><span class="small muted">${YU.t('profile.history.credited')}</span>${coins(earned, { sign: true })}<span class="small muted">${YU.t('profile.history.spent')}</span>${coins(Math.abs(spent))}</span>
      </div>
    </section>`;
  }

  // ---------- Tab: missions
  const activeRow = (c, { s, t }) => {
    const dl = deadline(t.deadline);
    const sub = s.status === 'pending' ? YU.t('profile.missions.pending', { ago: timeAgo(s.submittedAt) })
      : s.status === 'rejected' ? YU.t('profile.missions.rejected', { comment: s.reviewComment || YU.t('profile.missions.rejectedFallback') })
      : `${dl.label}, ${esc(t.location)}`;
    const row = `<a class="list-item is-link grow" href="#/missions/${esc(t.id)}">
      <span class="kpi-icon tone-${esc(deptTone(t.deptId))}">${icon(PROOF_ICON[t.proofType] || 'clipboard-list')}</span>
      <span class="grow"><div class="list-title">${esc(t.title)}</div><div class="list-sub ${dl.soon && s.status === 'in_progress' ? 'deadline-soon' : ''}">${sub}</div></span>
      <span class="hide-mobile">${subStatusPill(s.status)}</span>${coins(t.coins)}
    </a>`;
    // A button cannot sit inside the link, so the admin's remove button stands beside the row
    const remove = removeButton(c, s);
    return remove ? `<div class="row gap-8">${row}${remove}</div>` : row;
  };
  const doneRow = (c, { s, t }) => `<div class="list-item">
    <span class="kpi-icon tone-${esc(deptTone(t.deptId))}">${icon('check')}</span>
    <span class="grow"><div class="list-title">${esc(t.title)}</div><div class="list-sub">${YU.t('profile.missions.accepted', { date: fmtDate(s.reviewedAt) })}${s.reviewComment ? YU.t('profile.missions.acceptedBy', { comment: s.reviewComment }) : ''}</div></span>
    <span class="hide-mobile">${deptChip(t.deptId)}</span>${coins(s.coinsAwarded || 0)}${removeButton(c, s)}
  </div>`;
  function tasksTab(c) {
    const subs = userSubs(c);
    const active = subs.filter((x) => x.s.status !== 'approved').sort((a, b) => new Date(a.t.deadline) - new Date(b.t.deadline));
    const done = subs.filter((x) => x.s.status === 'approved').sort((a, b) => new Date(b.s.reviewedAt || 0) - new Date(a.s.reviewedAt || 0));
    // The missions in progress show on the own page and to an admin, who can take one away
    const activePanel = !(c.own || c.isAdmin) ? '' : `<section class="panel profile-list">
      <div class="panel-head"><span class="h2">${YU.t('profile.missions.now')}</span><span class="small muted">${active.length ? YU.t('profile.missions.count', { count: active.length }) : ''}</span></div>
      ${active.length ? `<div class="list mt-12">${active.map((x) => activeRow(c, x)).join('')}</div>`
        : U.empty({ icon: 'clipboard-list', title: YU.t('profile.missions.activeEmpty.title'), text: YU.t('profile.missions.activeEmpty.text', { max: YU.state.settings.maxActiveMissions }), action: c.own ? `<a class="btn btn-primary btn-sm" href="#/missions">${YU.t('profile.missions.pick')}</a>` : '' })}
    </section>`;
    const donePanel = `<section class="panel profile-list">
      <div class="panel-head"><span class="h2">${YU.t('profile.missions.done')}</span><span class="small muted">${done.length ? YU.t('profile.missions.count', { count: done.length }) : ''}</span></div>
      ${done.length ? `<div class="list mt-12">${done.map((x) => doneRow(c, x)).join('')}</div>`
        : U.empty({ icon: 'check-check', title: YU.t('profile.missions.doneEmpty.title'), text: c.own ? YU.t('profile.missions.doneEmpty.own') : YU.t('profile.missions.doneEmpty.other'), action: c.own && !active.length ? `<a class="btn btn-secondary btn-sm" href="#/missions">${YU.t('profile.toMissions')}</a>` : '' })}
    </section>`;
    return `<div class="col gap-20">${activePanel}${donePanel}</div>`;
  }

  const TAB_RENDER = { badges: badgesTab, history: historyTab, missions: tasksTab };

  // ---------- Modals

  function openEditModal() {
    const me = YU.me(); if (!me) return;
    const el = U.modal.open({
      title: YU.t('profile.edit.title'),
      sub: YU.t('profile.edit.sub'),
      body: `<form id="pf-edit" class="col gap-14" novalidate>
        <div class="field"><span class="label">${YU.t('profile.edit.photo')}</span>
          <div class="profile-photo-row">
            ${avatar(me, 'avatar-xl', 'profile-photo-preview')}
            <div class="col gap-8">
              <div class="row gap-8 wrap">
                <label class="btn btn-secondary btn-sm" for="pf-photo">${icon('upload')}${YU.t('profile.edit.pickPhoto')}<input type="file" id="pf-photo" name="photo" accept="image/jpeg,image/png,image/webp" class="sr-only"></label>
                <button type="button" class="btn btn-ghost btn-sm" id="pf-photo-remove" ${me.avatarUrl ? '' : 'hidden'}>${icon('x')}${YU.t('profile.edit.removePhoto')}</button>
              </div>
              <span class="hint">${YU.t('profile.edit.photoHint', { size: MAX_PHOTO_MB })}</span>
            </div>
          </div>
        </div>
        <div class="field"><label for="pf-name">${YU.t('profile.edit.name')}</label><input class="input" id="pf-name" name="name" value="${esc(YU.sourceOf(me).name)}" maxlength="60" autocomplete="name"><span class="error" hidden>${YU.t('profile.edit.nameError')}</span></div>
        <div class="field"><label for="pf-phone">${YU.t('profile.edit.phone')}</label><input class="input" id="pf-phone" name="phone" value="${esc(me.phone || '')}" placeholder="+998 90 000-00-00" inputmode="tel" autocomplete="tel"></div>
        <div class="field"><label for="pf-bio">${YU.t('profile.edit.bio')}</label><textarea class="textarea" id="pf-bio" name="bio" maxlength="160" placeholder="${YU.t('profile.edit.bioPlaceholder')}">${esc(me.bio || '')}</textarea><span class="hint">${YU.t('profile.edit.bioHint')}</span></div>
        <div class="field"><span class="label">${YU.t('profile.edit.tone')}</span>
          <div class="profile-swatches" role="radiogroup" aria-label="${YU.t('profile.edit.tone')}">${TONES.map((tone) => { const label = YU.t(`profile.tone.${tone}`); return `<label class="profile-swatch" title="${label}"><input type="radio" name="tone" value="${tone}" aria-label="${label}" ${tone === me.tone ? 'checked' : ''}>${avatar({ ...me, tone }, 'avatar-lg')}</label>`; }).join('')}</div>
        </div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="pf-save">${icon('check')}${YU.t('profile.edit.save')}</button>`,
    });
    if (!el) return;
    const form = el.querySelector('#pf-edit');
    const saveBtn = el.querySelector('#pf-save');
    // The picture: chosen here, sent after the rest of the profile saves; a removal is sent the same way
    const photoInput = el.querySelector('#pf-photo'), photoRemove = el.querySelector('#pf-photo-remove'), preview = el.querySelector('.profile-photo-preview');
    let photoFile = null, photoRemoved = false, previewUrl = null;
    const showPreview = (url) => {
      let img = preview.querySelector('img');
      if (!url) { if (img) img.remove(); preview.classList.remove('has-photo'); return; }
      if (!img) { img = document.createElement('img'); img.className = 'avatar-photo'; img.alt = ''; preview.appendChild(img); }
      img.removeAttribute('data-auth-src'); img.setAttribute('data-auth-state', 'ok'); img.src = url;
      preview.classList.add('has-photo');
    };
    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0]; if (!file) return;
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) { U.toast(YU.tText('profile.edit.photoTooBig', { size: MAX_PHOTO_MB }), 'bad'); photoInput.value = ''; return; }
      photoFile = file; photoRemoved = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      showPreview(previewUrl);
      photoRemove.hidden = false;
    };
    photoRemove.onclick = () => {
      photoFile = null; photoRemoved = true; photoInput.value = '';
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      showPreview(null);
      photoRemove.hidden = true;
    };
    const save = async () => {
      const f = U.formData(form);
      const name = String(f.name || '').trim();
      const badName = name.length < 2;
      markField(form, '#pf-name', badName);
      if (badName) return;
      const r = await U.busy(saveBtn, async () => {
        const saved = await YU.actions.updateUser(me.id, { name, phone: String(f.phone || '').trim(), bio: String(f.bio || '').trim(), tone: f.tone || me.tone || 'slate' });
        if (!saved.ok) return saved;
        if (photoFile) return YU.actions.setAvatar(photoFile);
        if (photoRemoved && me.avatarUrl) return YU.actions.removeAvatar();
        return saved;
      });
      if (!r.ok) return U.toast(r.error || YU.t('profile.edit.saveFailed'), 'bad');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      U.modal.close();
      U.toast(YU.tText('profile.edit.saved'), 'ok');
    };
    form.onsubmit = (e) => { e.preventDefault(); save(); };
    saveBtn.onclick = save;
  }

  function openCoinsModal() {
    const user = ctx && ctx.user ? YU.user(ctx.user.id) : null; if (!user) return;
    const el = U.modal.open({
      title: YU.t('profile.coins.title'),
      sub: YU.t('profile.coins.sub', { name: user.name, count: user.balance }),
      body: `<form id="pf-points" class="col gap-14" novalidate>
        <div class="field"><label for="pf-delta">${YU.t('profile.coins.amountLabel')}</label><input class="input" id="pf-delta" name="delta" type="number" step="5" placeholder="${YU.t('profile.coins.amountPlaceholder')}" inputmode="numeric"><span class="hint">${YU.t('profile.coins.amountHint')}</span><span class="error" hidden>${YU.t('profile.coins.amountError')}</span></div>
        <div class="field"><label for="pf-reason">${YU.t('profile.coins.reasonLabel')}</label><input class="input" id="pf-reason" name="reason" maxlength="120" placeholder="${YU.t('profile.coins.reasonPlaceholder')}"><span class="hint">${YU.t('profile.coins.reasonHint')}</span><span class="error" hidden>${YU.t('profile.coins.reasonError')}</span></div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="pf-points-save">${icon('coins')}${YU.t('profile.coins.submit')}</button>`,
    });
    if (!el) return;
    const form = el.querySelector('#pf-points');
    const saveBtn = el.querySelector('#pf-points-save');
    const save = async () => {
      const f = U.formData(form);
      const delta = Math.round(+f.delta), reason = String(f.reason || '').trim();
      const badDelta = !Number.isFinite(delta) || delta === 0, badReason = !reason;
      markField(form, '#pf-reason', badReason);
      markField(form, '#pf-delta', badDelta);
      if (badDelta || badReason) return;
      const r = await U.busy(saveBtn, () => YU.actions.adjustCoins(user.id, delta, reason));
      if (!r.ok) return U.toast(r.error || YU.t('profile.coins.failed'), 'bad');
      U.modal.close();
      // The name stays out of t(): the toast is plain text, so an escaped apostrophe would show up in it
      U.toast(`${YU.t(delta > 0 ? 'profile.coins.credited' : 'profile.coins.debited', { count: Math.abs(delta) })}: ${user.name}`, 'gold');
    };
    form.onsubmit = (e) => { e.preventDefault(); save(); };
    saveBtn.onclick = save;
  }

  // ---------- Settings handlers
  async function logout() {
    const ok = await U.confirm({ title: YU.t('profile.logout.confirmTitle'), text: YU.t('profile.logout.confirmText'), ok: YU.t('nav.signOut'), danger: true });
    if (!ok) return;
    const r = await YU.actions.logout();
    if (!r.ok) U.toast(r.error || YU.t('profile.logout.failed'), 'bad');
  }

  // ---------- Screen
  // ---------- Shortcuts (own page, phones only): what the phone header has no room for. Settings and the
  // admin panel are head buttons already; search, the shop, review, news management and signing out live here.
  const quickRow = ({ href, action, ic, tone, label, danger = false }) => {
    const inner = `<span class="kpi-icon tone-${tone}">${icon(ic)}</span><span class="grow list-title">${label}</span>${icon('chevron-right')}`;
    return href ? `<a class="list-item is-link" href="${href}">${inner}</a>`
      : `<button type="button" class="list-item is-link ${danger ? 'is-danger' : ''}" data-profile-action="${action}">${inner}</button>`;
  };
  function quickLinks(c) {
    const rows = [
      { action: 'search', ic: 'search', tone: 'blue', label: YU.t('search.title') },
      YU.can('rewards.view') && { href: '#/rewards', ic: 'gift', tone: 'gold', label: YU.t('nav.rewards') },
      YU.can('review.panel') && { href: '#/review', ic: 'clipboard-check', tone: 'teal', label: YU.t('nav.review') },
      c.me.role !== 'admin' && YU.canManageNews() && { href: '#/admin/news', ic: 'newspaper', tone: 'violet', label: YU.t('nav.manageNews') },
      { action: 'logout', ic: 'log-out', tone: 'coral', label: YU.t('nav.signOut'), danger: true },
    ].filter(Boolean);
    return `<section class="panel profile-quick only-mobile"><div class="list">${rows.map(quickRow).join('')}</div></section>`;
  }

  function render(params) {
    const c = resolve(params); if (!c) return '';
    if (!c.user) return U.empty({ icon: 'user-round', title: YU.t('profile.notFound.title'), text: YU.t('profile.notFound.text'), action: `<a class="btn btn-primary" href="#/rating">${YU.t('profile.notFound.action')}</a>` });
    return `${head(c)}${c.own ? quickLinks(c) : ''}${tabsBar(c)}${c.tab ? `<div class="profile-body ${c.tabs.length < 2 ? 'mt-20' : ''}">${TAB_RENDER[c.tab](c)}</div>` : ''}`;
  }

  function mount(root, params) {
    const c = resolve(params); if (!c) return;
    ctx = c;
    // Remember the tab only for the own page so a visit to someone else's profile does not reset it
    if (c.user && c.own) YU.state.ui.profile = { ...uiState(), tab: c.tab };
    // The router hands mount a fresh #view every render, so delegate on every mount; handlers read the current ctx
    U.on(root, 'click', '[data-profile-tab]', (e, el) => { if (ctx) location.hash = `${ctx.base}?tab=${el.dataset.profileTab}`; });
    U.on(root, 'click', '[data-profile-remove]', async (e, el) => {
      if (!ctx) return;
      const name = ctx.user.name, title = el.dataset.title;
      if (!await U.confirm({ title: YU.tText('profile.missions.removeConfirm', { name, title }), text: YU.tText('profile.missions.removeText'), ok: YU.tText('profile.missions.remove'), danger: true })) return;
      const r = await YU.actions.removeSubmission(el.dataset.profileRemove);
      U.toast(r.ok ? YU.tText('profile.missions.removed', { name }) : r.error, r.ok ? 'ok' : 'bad');
    });
    U.on(root, 'click', '[data-profile-action]', (e, el) => {
      const action = el.dataset.profileAction;
      if (action === 'edit') openEditModal();
      else if (action === 'coins') openCoinsModal();
      else if (action === 'logout') logout();
      else if (action === 'search') YU.app.openSearch();
    });
  }

  const title = (params) => {
    const me = YU.me(), user = params && params.id ? YU.user(params.id) : me;
    return !user || !me || user.id === me.id ? YU.t('nav.profile') : user.name;
  };

  YU.screens.profile = { title, render, mount };
})();

;
/* js/screens/settings.js */
/* Settings — #/settings. The device-level choices (theme, launch screen), the account language, and the
   account itself: email and sign-out, password, signed-in devices, deletion. The account sections came
   here from the profile page, so their wording still lives under profile.* in the catalogues.
   All classes prefixed .set- */
(function () {
  const U = YU.ui;
  const { esc, icon, fmtDate, timeAgo, markField } = U;
  const THEME_ICON = { light: 'sun', dark: 'moon', system: 'monitor' };

  // ---------- Choices
  // One choice in a group: a toggle button that is pressed while chosen. label and hint arrive HTML-safe (YU.t output or esc()'d text).
  const option = ({ group, value, active, tile, label, hint = '' }) => `
    <button type="button" class="set-option ${active ? 'is-active' : ''}" aria-pressed="${active ? 'true' : 'false'}" data-set="${group}" data-value="${esc(value)}">
      <span class="set-option-tile">${tile}</span>
      <span class="set-option-text"><span class="set-option-label">${label}</span>${hint ? `<span class="set-option-hint">${hint}</span>` : ''}</span>
      <span class="set-option-check" aria-hidden="true">${icon('check')}</span>
    </button>`;

  const section = ({ id, title, text, options, cols = false }) => `
    <section class="panel">
      <div class="panel-head"><span class="h2" id="set-${id}-title">${title}</span></div>
      <div class="panel-body col gap-12">
        <p class="small muted set-text">${text}</p>
        <div class="set-options ${cols ? 'is-cols' : ''}" role="group" aria-labelledby="set-${id}-title">${options}</div>
      </div>
    </section>`;

  function themeSection() {
    const now = YU.theme.current();
    const hint = (mode) => (mode === 'system'
      ? YU.t('settings.theme.systemHint', { mode: YU.t(`theme.${YU.theme.resolved()}`) })
      : YU.t(`settings.theme.${mode}Hint`));
    return section({
      id: 'theme', title: YU.t('settings.theme.title'), text: YU.t('settings.theme.text'),
      options: YU.theme.modes.map((mode) => option({ group: 'theme', value: mode, active: mode === now, tile: icon(THEME_ICON[mode]), label: YU.t(`settings.theme.${mode}`), hint: hint(mode) })).join(''),
    });
  }

  function languageSection() {
    const now = YU.i18n.current();
    return section({
      id: 'language', title: YU.t('settings.language.title'), text: YU.t('settings.language.text'), cols: true,
      options: YU.i18n.locales.map((l) => option({ group: 'language', value: l.id, active: l.id === now, tile: esc(l.short), label: esc(l.label) })).join(''),
    });
  }

  function startSection() {
    const now = YU.prefs.start();
    return section({
      id: 'start', title: YU.t('settings.start.title'), text: YU.t('settings.start.text'), cols: true,
      options: YU.prefs.startScreens.map((s) => option({ group: 'start', value: s.id, active: s.id === now, tile: icon(s.icon), label: YU.t(s.key) })).join(''),
    });
  }

  // ---------- Account
  function accountSection(me) {
    return `
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('profile.settings.account')}</span></div>
        <div class="panel-body set-account">
          <div class="field"><label for="set-email">${YU.t('profile.settings.email')}</label><input class="input" id="set-email" value="${esc(me.email)}" readonly><span class="hint">${YU.t('profile.settings.emailHint')}</span></div>
          <div class="set-account-side"><span class="small muted">${YU.t('profile.settings.logoutHint')}</span><button type="button" class="btn btn-danger" data-set-action="logout">${icon('log-out')}${YU.t('nav.signOut')}</button></div>
        </div>
      </section>`;
  }

  function passwordSection() {
    return `
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('profile.settings.password')}</span></div>
        <div class="panel-body">
          <form id="set-password" class="col gap-10" novalidate>
            <div class="field" data-field="currentPassword"><label for="set-current">${YU.t('profile.settings.currentPassword')}</label><input class="input" id="set-current" name="currentPassword" type="password" autocomplete="current-password" maxlength="128"></div>
            <div class="field" data-field="newPassword"><label for="set-new">${YU.t('profile.settings.newPassword')}</label><input class="input" id="set-new" name="newPassword" type="password" autocomplete="new-password" maxlength="128"><span class="hint">${YU.t('profile.settings.newPasswordHint')}</span></div>
            <span class="form-error" id="set-password-error" role="alert" hidden></span>
            <div><button class="btn btn-primary" type="submit" id="set-password-save">${icon('check')}${YU.t('profile.settings.changePassword')}</button></div>
          </form>
        </div>
      </section>`;
  }

  function sessionsSection() {
    return `
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('profile.settings.sessions')}</span><button type="button" class="btn btn-secondary btn-sm" data-set-action="revoke-others">${YU.t('profile.settings.revokeOthers')}</button></div>
        <div class="panel-body"><div id="set-sessions" class="small muted">${YU.t('profile.settings.sessionsLoading')}</div></div>
      </section>`;
  }

  // The phone app: where to get it; inside the app the same page says whether a newer build is out
  function appSection() {
    return `
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('app.settings.title')}</span></div>
        <div class="panel-body row-between wrap gap-12">
          <span class="small muted">${YU.t(window.YUNative ? 'app.settings.textApp' : 'app.settings.textWeb')}</span>
          <a class="btn btn-secondary" href="#/app">${icon('smartphone')}${YU.t('app.settings.open')}</a>
        </div>
      </section>`;
  }
  // The Telegram bot: the same platform in a chat, plus every notification delivered there.
  // Linking opens the bot with a one-time code, so no password is ever typed into Telegram.
  function telegramSection() {
    return `
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('settings.telegram.title')}</span></div>
        <div class="panel-body" id="set-telegram"><span class="small muted">${YU.t('settings.telegram.loading')}</span></div>
      </section>`;
  }
  async function loadTelegram(root) {
    const box = root.querySelector('#set-telegram'); if (!box) return;
    const r = await YU.actions.telegramStatus();
    if (!box.isConnected) return;
    if (!r.ok) { box.innerHTML = `<span class="small muted">${esc(r.error)}</span>`; return; }
    if (!r.enabled || !r.bot) { box.innerHTML = `<span class="small muted">${YU.t('settings.telegram.off')}</span>`; return; }
    if (r.link) {
      const who = r.link.username ? `@${r.link.username}` : (r.link.firstName || 'Telegram');
      box.innerHTML = `
        <div class="row-between wrap gap-12">
          <span class="small"><b>${YU.t('settings.telegram.linked', { name: who })}</b><br><span class="muted">${YU.t('settings.telegram.linkedText')}</span></span>
          <span class="row gap-8 wrap">
            <a class="btn btn-secondary" href="https://t.me/${esc(r.bot)}" target="_blank" rel="noopener">${icon('send')}${YU.t('settings.telegram.openBot')}</a>
            <button type="button" class="btn btn-danger" data-set-action="telegram-unlink">${icon('unlink')}${YU.t('settings.telegram.unlink')}</button>
          </span>
        </div>`;
    } else {
      box.innerHTML = `
        <div class="row-between wrap gap-12">
          <span class="small muted">${YU.t('settings.telegram.text', { bot: `@${r.bot}` })}</span>
          <button type="button" class="btn btn-primary" data-set-action="telegram-connect">${icon('send')}${YU.t('settings.telegram.connect')}</button>
        </div>`;
    }
    U.refreshIcons();
  }
  async function telegramConnect(btn) {
    const r = await U.busy(btn, () => YU.actions.telegramLinkCode());
    if (!r.ok) return U.toast(r.error, 'bad');
    // The link carries the code; the bot ties this chat to the account as soon as it is opened
    const opened = window.open(r.url, '_blank', 'noopener');
    const box = document.querySelector('#set-telegram');
    if (box) {
      box.innerHTML = `
        <div class="col gap-8">
          <span class="small">${YU.t('settings.telegram.codeHint', { minutes: r.expiresInMinutes })}</span>
          <span><a class="btn btn-primary" href="${esc(r.url)}" target="_blank" rel="noopener">${icon('send')}${YU.t('settings.telegram.openBot')}</a></span>
          <span class="small muted">${YU.t('settings.telegram.afterLink')}</span>
        </div>`;
      U.refreshIcons();
    }
    if (!opened) U.toast(YU.tText('settings.telegram.popupBlocked'), 'info');
  }
  async function telegramUnlink(btn) {
    const sure = await U.confirm({ title: YU.t('settings.telegram.unlinkTitle'), text: YU.t('settings.telegram.unlinkText'), danger: true, ok: YU.t('settings.telegram.unlink') });
    if (!sure) return;
    const r = await U.busy(btn, () => YU.actions.telegramUnlink());
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(YU.tText('settings.telegram.unlinked'), 'ok');
    const root = btn.closest('.settings');
    if (root) loadTelegram(root);
  }

  function deleteSection() {
    return `
      <section class="panel settings-wide set-danger">
        <div class="panel-head"><span class="h2">${YU.t('profile.settings.deleteAccount')}</span></div>
        <div class="panel-body row-between wrap gap-10">
          <span class="small muted-2 set-danger-text">${YU.t('profile.settings.deleteText')} <a href="#/privacy">${YU.t('profile.settings.privacyLink')}</a></span>
          <button type="button" class="btn btn-danger" data-set-action="delete-account">${icon('trash-2')}${YU.t('profile.settings.deleteAccount')}</button>
        </div>
      </section>`;
  }

  const deviceName = (ua) => {
    if (/android/i.test(ua)) return YU.t('profile.device.android');
    if (/iphone|ipad/i.test(ua)) return YU.t('profile.device.apple');
    if (/macintosh/i.test(ua)) return YU.t('profile.device.mac');
    if (/windows/i.test(ua)) return YU.t('profile.device.windows');
    return YU.t('profile.device.other');
  };
  async function loadSessions(root) {
    const box = root.querySelector('#set-sessions'); if (!box) return;
    const r = await YU.actions.listSessions();
    if (!box.isConnected) return;
    if (!r.ok) { box.textContent = r.error; return; }
    box.classList.remove('muted');
    box.innerHTML = `<div class="list">${r.sessions.map((s) => `
      <div class="list-item"><span class="kpi-icon tone-slate">${icon('monitor')}</span>
        <span class="grow"><div class="list-title">${deviceName(s.userAgent)}${s.current ? ` · ${YU.t('profile.session.current')}` : ''}</div>
        <div class="list-sub">${YU.t('profile.session.line', { date: fmtDate(s.createdAt, { time: true }), ago: timeAgo(s.lastSeenAt) })}</div></span></div>`).join('')}</div>`;
    U.refreshIcons();
  }
  async function changePassword(form) {
    const f = U.formData(form), err = form.querySelector('#set-password-error');
    const fail = (msg, sel) => { err.textContent = msg; err.hidden = false; markField(form, sel, true); };
    err.hidden = true;
    markField(form, '#set-current', false); markField(form, '#set-new', false);
    if (!f.currentPassword) return fail(YU.t('profile.password.needCurrent'), '#set-current');
    if (String(f.newPassword || '').length < 8) return fail(YU.t('profile.password.tooShort'), '#set-new');
    const r = await U.busy(form.querySelector('#set-password-save'), () => YU.actions.changePassword(f.currentPassword, f.newPassword));
    // A wrong current password, or too many wrong ones in a row, is about the current-password field
    if (!r.ok) return fail(r.error, r.code === 'wrong_password' || r.code === 'rate_limited' ? '#set-current' : '#set-new');
    form.reset();
    U.toast(YU.tText('profile.password.changed'), 'ok');
    YU.emit('change');
  }
  async function revokeOthers(btn) {
    const r = await U.busy(btn, () => YU.actions.revokeOtherSessions());
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(r.ended ? YU.t('profile.sessions.revoked', { count: r.ended }) : YU.t('profile.sessions.noneOther'), 'ok');
    YU.emit('change');
  }
  async function deleteAccount() {
    const sure = await U.confirm({
      title: YU.t('profile.delete.confirmTitle'), danger: true, ok: YU.t('profile.settings.deleteAccount'),
      text: YU.t('profile.delete.confirmText'),
    });
    if (!sure) return;
    const password = await U.askPassword(YU.t('profile.delete.passwordReason'));
    if (!password) return;
    const r = await YU.actions.deleteAccount(password);
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(YU.tText('profile.delete.done'), 'info');
  }
  async function logout(btn) {
    const r = await U.busy(btn, () => YU.actions.logout());
    if (!r.ok) U.toast(r.error, 'bad');
  }

  // ---------- Screen
  function render() {
    const me = YU.me(); if (!me) return '';
    return `
      <div class="page-head">
        <div><h1 class="h1">${YU.t('settings.heading')} <em>${YU.t('settings.headingAccent')}</em></h1><p class="lead">${YU.t('settings.lead')}</p></div>
      </div>
      <div class="settings">${themeSection()}${languageSection()}${startSection()}${appSection()}${telegramSection()}${accountSection(me)}${passwordSection()}${sessionsSection()}${deleteSection()}</div>`;
  }

  const APPLY = {
    theme: (value) => YU.theme.set(value),
    language: (value) => YU.i18n.set(value),
    start: (value) => {
      const screen = YU.prefs.startScreens.find((s) => s.id === YU.prefs.setStart(value));
      U.toast(YU.tText('settings.start.saved', { screen: YU.tText(screen.key) }), 'ok');
    },
  };
  const ACTIONS = { logout, 'revoke-others': revokeOthers, 'delete-account': () => deleteAccount(), 'telegram-connect': telegramConnect, 'telegram-unlink': telegramUnlink };

  function mount(root) {
    U.on(root, 'click', '[data-set]', async (e, el) => {
      e.preventDefault();
      if (el.getAttribute('aria-pressed') === 'true') return;
      const { set: group, value } = el.dataset;
      if (!APPLY[group]) return;
      await APPLY[group](value);
      // The change re-rendered the screen, so the pressed option is a new element: keep the keyboard on it
      const again = document.querySelector(`.set-option[data-set="${group}"][data-value="${value}"]`);
      if (again) again.focus();
    });
    U.on(root, 'click', '[data-set-action]', (e, el) => { const run = ACTIONS[el.dataset.setAction]; if (run) run(el); });
    U.on(root, 'submit', '#set-password', (e, form) => { e.preventDefault(); changePassword(form); });
    loadSessions(root);
    loadTelegram(root);
  }

  YU.screens.settings = { title: () => YU.t('settings.title'), render, mount };
})();

;
/* js/screens/review.js */
/* Coordinator — review queue, department missions and the shared mission form. Curators see their own dept, admins pick one or all. */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, deptChip, pill, missionStatusPill, subStatusPill, fmtNum, deadline, fmtDate, timeAgo } = U;
  const PROOF_ICON = { photo: 'camera', link: 'link', text: 'file-text' };
  // Catalogue keys, not words: these are module-level, so they must resolve at render time
  const PROOF_NAME = { photo: 'review.proof.name.photo', link: 'review.proof.name.link', text: 'review.proof.name.text' };
  const TABS = [['queue', 'review.tabs.queue'], ['progress', 'review.tabs.progress'], ['history', 'review.tabs.history'], ['missions', 'review.tabs.missions']];
  const TASK_FILTERS = [['all', 'review.filters.all'], ['open', 'review.filters.open'], ['draft', 'review.filters.draft'], ['closed', 'review.filters.closed']];
  const TASK_ORDER = { open: 0, draft: 1, closed: 2, archived: 3 };
  const MIN_COINS = 5, WEEK_MS = 7 * 86400000;

  // ---------- UI state, scope, small helpers
  const ui = () => YU.state.ui.coordinator || (YU.state.ui.coordinator = { tab: 'queue', dept: null, taskStatus: 'all' });
  const setUi = (patch) => { YU.state.ui.coordinator = { ...ui(), ...patch }; };
  // Leaders and admins run every department; a coordinator only their own.
  const isWide = () => YU.isUnionWide();
  const scopeDept = (me) => (isWide() ? ui().dept : me.deptId);
  const scopeName = (deptId) => (YU.dept(deptId) ? YU.dept(deptId).name : YU.t('dept.all'));
  const deptTone = (deptId) => (YU.dept(deptId) ? YU.dept(deptId).tone : 'slate');
  // The hash always carries tab, dept and status, so every chip click changes the URL and the router re-renders
  const baseHash = (tab = ui().tab) => {
    const q = [`tab=${tab}`];
    if (isWide()) q.push(`dept=${ui().dept || 'all'}`);
    if (tab === 'missions') q.push(`status=${ui().taskStatus}`);
    return `#/review?${q.join('&')}`;
  };
  const syncUi = (params) => {
    const q = (params && params.query) || {}, patch = {};
    if (TABS.some(([id]) => id === q.tab)) patch.tab = q.tab;
    if (isWide() && q.dept !== undefined) patch.dept = YU.dept(q.dept) ? q.dept : null;
    if (TASK_FILTERS.some(([id]) => id === q.status)) patch.taskStatus = q.status;
    if (Object.keys(patch).length) setUi(patch);
  };
  const scopeTasks = (deptId) => YU.state.missions.filter((t) => !deptId || t.deptId === deptId);
  // Submissions joined with their mission and author, limited to the scope
  const scopeSubs = (deptId) => YU.state.submissions
    .map((s) => ({ s, t: YU.mission(s.missionId), u: YU.user(s.userId) }))
    .filter((x) => x.t && x.u && (!deptId || x.t.deptId === deptId));
  const scopeStats = (deptId) => (deptId ? YU.select.deptStats(deptId)
    : YU.state.departments.map((d) => YU.select.deptStats(d.id))
      .reduce((acc, st) => Object.fromEntries(Object.keys(st).map((k) => [k, (acc[k] || 0) + st[k]])), {}));
  const isLate = (s, t) => !!s.submittedAt && new Date(s.submittedAt) > new Date(t.deadline);
  const lateCoins = (t) => Math.round(t.coins * (1 - YU.state.settings.latePenaltyPct / 100));
  const deadlineCls = (dl) => (dl.tone === 'warn' ? 'text-warn' : dl.tone === 'bad' ? 'text-bad' : '');
  // A photo sent without a caption carries no label of its own
  const proofText = (proof) => proof.label || YU.tText(`missions.proof.${proof.type === 'photo' ? 'photo' : 'text'}`);
  const proofChip = (proof, cls = '') => (proof
    ? `<span class="chip coordinator-proof-chip ${cls}" title="${esc(proofText(proof))}">${icon(PROOF_ICON[proof.type] || 'file-text')}<span class="truncate">${esc(proofText(proof))}</span></span>` : '');
  const personLine = (u) => `<div class="list-title">${esc(u.name)} <span class="small muted coordinator-group">${esc(u.group)}</span></div>`;
  const setErr = (form, name, msg) => {
    const f = form.querySelector(`[name="${name}"]`), e = form.querySelector(`[data-err="${name}"]`);
    if (f) f.classList.toggle('is-invalid', !!msg);
    if (e) { e.hidden = !msg; e.textContent = msg || ''; }
  };

  // ---------- Page pieces
  const deptFilters = (deptId) => `<div class="filters filters-scroll mb-16">
    <button class="filter-chip ${!deptId ? 'is-active' : ''}" data-coordinator-dept="">${YU.t('dept.all')}</button>
    ${YU.state.departments.map((d) => `<button class="filter-chip tone-${esc(d.tone)} ${deptId === d.id ? 'is-active' : ''}" data-coordinator-dept="${esc(d.id)}"><span class="dot"></span>${esc(d.name)}</button>`).join('')}
  </div>`;

  const kpis = (st, subs, deptId) => {
    const oldest = subs.filter((x) => x.s.status === 'pending').sort((a, b) => new Date(a.s.submittedAt) - new Date(b.s.submittedAt))[0];
    const rejected = subs.filter((x) => x.s.status === 'rejected').length;
    return `<div class="cards-4 coordinator-kpis kpi-row">
      ${U.kpi({ label: YU.t('review.kpi.pending.label'), value: st.pending, icon: 'clock', tone: 'coral', sub: oldest ? YU.t('review.kpi.pending.oldest', { time: timeAgo(oldest.s.submittedAt) }) : YU.t('review.kpi.pending.empty') })}
      ${U.kpi({ label: YU.t('review.kpi.inProgress.label'), value: st.inProgress, icon: 'loader-circle', tone: 'blue', sub: YU.t('review.kpi.inProgress.sub', { count: st.open }) })}
      ${U.kpi({ label: YU.t('review.kpi.approved.label'), value: st.approved, icon: 'check', tone: 'green', sub: rejected ? YU.t('review.kpi.approved.rejected', { count: rejected }) : YU.t('review.kpi.approved.none') })}
      ${U.kpi({ label: YU.t('review.kpi.coins.label'), value: fmtNum(st.coinsAwarded), icon: 'coins', tone: 'gold', sub: deptId ? YU.t('review.kpi.coins.dept') : YU.t('review.kpi.coins.union') })}
    </div>`;
  };

  const queueTab = (subs) => {
    const rows = subs.filter((x) => x.s.status === 'pending').sort((a, b) => new Date(a.s.submittedAt) - new Date(b.s.submittedAt));
    if (!rows.length) return `<section class="panel">${U.empty({ icon: 'check-check', title: YU.t('review.queue.empty.title'), text: YU.t('review.queue.empty.text'), action: `<a class="btn btn-secondary btn-sm" href="${baseHash('progress')}">${YU.t('review.action.whoInProgress')}</a>` })}</section>`;
    return `<section class="panel"><div class="list">${rows.map(({ s, t, u }) => `
      <div class="list-item coordinator-row">
        ${avatar(u)}
        <div class="grow">
          ${personLine(u)}
          <div class="list-sub">${esc(t.title)}</div>
          <div class="coordinator-row-meta"><span>${YU.t('review.queue.submitted', { time: timeAgo(s.submittedAt) })}</span>${isWide() ? deptChip(t.deptId) : ''}${proofChip(s.proof)}${isLate(s, t) ? pill(YU.t('review.queue.late'), 'warn', 'alarm-clock') : ''}</div>
        </div>
        <div class="coordinator-row-side">${coins(t.coins)}<a class="btn btn-primary btn-sm" href="#/review/${esc(s.id)}">${YU.t('review.action.check')}</a></div>
      </div>`).join('')}</div></section>`;
  };

  const progressTab = (subs) => {
    const rows = subs.filter((x) => x.s.status === 'in_progress').sort((a, b) => new Date(a.t.deadline) - new Date(b.t.deadline));
    if (!rows.length) return `<section class="panel">${U.empty({ icon: 'loader-circle', title: YU.t('review.progress.empty.title'), text: YU.t('review.progress.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/review/new">${icon('plus')}${YU.t('review.action.newMission')}</a>` })}</section>`;
    return `<section class="panel"><div class="list">${rows.map(({ s, t, u }) => { const dl = deadline(t.deadline); return `
      <div class="list-item coordinator-row">
        ${avatar(u)}
        <div class="grow">
          ${personLine(u)}
          <div class="list-sub">${esc(t.title)}</div>
          <div class="coordinator-row-meta"><span>${YU.t('review.progress.taken', { time: timeAgo(s.takenAt) })}</span><span class="${deadlineCls(dl)}">${icon('calendar')}${esc(dl.label)}</span>${isWide() ? deptChip(t.deptId) : ''}</div>
        </div>
        <div class="coordinator-row-side">${coins(t.coins)}<a class="btn btn-ghost btn-sm" href="#/missions/${esc(t.id)}">${YU.t('review.action.openMission')}</a></div>
      </div>`; }).join('')}</div></section>`;
  };

  const historyTab = (subs) => {
    const rows = subs.filter((x) => x.s.status === 'approved' || x.s.status === 'rejected').sort((a, b) => new Date(b.s.reviewedAt) - new Date(a.s.reviewedAt));
    if (!rows.length) return `<section class="panel">${U.empty({ icon: 'history', title: YU.t('review.history.empty.title'), text: YU.t('review.history.empty.text'), action: `<a class="btn btn-secondary btn-sm" href="${baseHash('queue')}">${YU.t('review.action.toQueue')}</a>` })}</section>`;
    return `<section class="panel"><div class="list">${rows.map(({ s, t, u }) => { const by = YU.user(s.reviewedBy); return `
      <div class="list-item coordinator-row">
        ${avatar(u)}
        <div class="grow">
          ${personLine(u)}
          <div class="list-sub">${esc(t.title)}</div>
          <div class="coordinator-row-meta">${subStatusPill(s.status)}<span>${by ? YU.t('review.history.reviewedBy', { time: timeAgo(s.reviewedAt), name: by.name }) : YU.t('review.history.reviewed', { time: timeAgo(s.reviewedAt) })}</span>${isWide() ? deptChip(t.deptId) : ''}</div>
        </div>
        <div class="coordinator-row-side">${s.status === 'approved' ? coins(s.coinsAwarded || 0, { sign: true }) : `<span class="small muted">${YU.t('review.history.noCoins')}</span>`}<a class="btn btn-ghost btn-sm" href="#/review/${esc(s.id)}">${YU.t('review.action.open')}</a></div>
      </div>`; }).join('')}</div></section>`;
  };

  const taskRow = (t) => {
    const dl = deadline(t.deadline), by = YU.user(t.createdBy), live = t.status === 'open' || t.status === 'draft';
    return `<tr>
      <td><a class="coordinator-task-link" href="#/missions/${esc(t.id)}">${esc(t.title)}</a>${isWide() ? `<div class="coordinator-td-sub">${deptChip(t.deptId)}</div>` : ''}</td>
      <td>${missionStatusPill(t.status)}</td>
      <td class="num">${coins(t.coins)}</td>
      <td class="num">${YU.t('review.table.seatsOf', { taken: YU.select.seatsTaken(t.id), total: t.seats })}</td>
      <td>${live ? `<span class="${deadlineCls(dl)}">${esc(dl.label)}</span>` : `<span class="muted">${esc(fmtDate(t.deadline))}</span>`}</td>
      <td class="hide-mobile">${esc(by ? by.name : '—')}</td>
      <td class="ta-right"><button class="btn btn-ghost btn-sm btn-icon" data-coordinator-menu="${esc(t.id)}" aria-label="${YU.t('review.table.rowMenu')}">${icon('more-horizontal')}</button></td>
    </tr>`;
  };

  const tasksTab = (deptId) => {
    const all = scopeTasks(deptId), flt = ui().taskStatus;
    const matches = (t, f) => f === 'all' || (f === 'closed' ? t.status === 'closed' || t.status === 'archived' : t.status === f);
    const bar = `<div class="filters filters-scroll mb-12">${TASK_FILTERS.map(([id, label]) => `<button class="filter-chip ${flt === id ? 'is-active' : ''}" data-coordinator-status="${id}">${YU.t(label)}<span class="coordinator-count">${all.filter((t) => matches(t, id)).length}</span></button>`).join('')}</div>`;
    if (!all.length) return bar + `<section class="panel">${U.empty({ icon: 'clipboard-list', title: YU.t('review.missions.empty.title'), text: YU.t('review.missions.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/review/new">${icon('plus')}${YU.t('review.action.newMission')}</a>` })}</section>`;
    const list = all.filter((t) => matches(t, flt)).sort((a, b) => (TASK_ORDER[a.status] - TASK_ORDER[b.status]) || (new Date(a.deadline) - new Date(b.deadline)));
    if (!list.length) return bar + `<section class="panel">${U.empty({ icon: 'filter', title: YU.t('review.missions.noMatch.title'), text: YU.t('review.missions.noMatch.text'), action: `<button class="btn btn-secondary btn-sm" data-coordinator-status="all">${YU.t('review.action.showAll')}</button>` })}</section>`;
    return bar + `<section class="panel"><div class="table-wrap"><table class="table is-stack">
      <thead><tr><th>${YU.t('review.table.mission')}</th><th>${YU.t('review.table.status')}</th><th class="num">${YU.t('review.table.coins')}</th><th class="num">${YU.t('review.table.seats')}</th><th>${YU.t('review.table.deadline')}</th><th class="hide-mobile">${YU.t('review.table.author')}</th><th></th></tr></thead>
      <tbody>${list.map(taskRow).join('')}</tbody>
    </table></div></section>`;
  };

  function render(params) {
    const me = YU.me(); if (!me) return '';
    syncUi(params);
    // lead already carries escaped params from t(), so it goes in as-is
    const head = (lead) => `<div class="page-head">
      <div><h1 class="h1">${YU.t('review.head.title')} <em>${YU.t('review.head.titleAccent')}</em></h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
      <div class="page-actions"><a class="btn btn-primary" href="#/review/new">${icon('plus')}${YU.t('review.action.newMission')}</a></div>
    </div>`;
    if (!isWide() && !me.deptId) return head('') + U.empty({ icon: 'building-2', title: YU.t('review.noDept.title'), text: YU.t('review.noDept.text'), action: `<a class="btn btn-secondary btn-sm" href="#/">${YU.t('action.home')}</a>` });
    const deptId = scopeDept(me), st = scopeStats(deptId), subs = scopeSubs(deptId), tab = ui().tab;
    const counts = {
      queue: subs.filter((x) => x.s.status === 'pending').length,
      progress: subs.filter((x) => x.s.status === 'in_progress').length,
      history: subs.filter((x) => x.s.status === 'approved' || x.s.status === 'rejected').length,
      missions: scopeTasks(deptId).length,
    };
    const lead = YU.t('review.lead.text', {
      scope: scopeName(deptId),
      pending: YU.t('review.lead.pending', { count: st.pending }),
      inProgress: YU.t('review.lead.inProgress', { count: st.inProgress }),
    });
    const body = tab === 'missions' ? tasksTab(deptId) : tab === 'progress' ? progressTab(subs) : tab === 'history' ? historyTab(subs) : queueTab(subs);
    return `${head(lead)}
      ${isWide() ? deptFilters(deptId) : ''}
      ${kpis(st, subs, deptId)}
      <div class="tabs mt-24">${TABS.map(([id, label]) => `<button class="tab ${id === tab ? 'is-active' : ''}" data-coordinator-tab="${id}">${YU.t(label)}<span class="count">${counts[id]}</span></button>`).join('')}</div>
      <div class="mt-16">${body}</div>`;
  }

  // ---------- Drawers live outside #view: track what we opened and put the hash back when they close
  let opened = null, unwatchFn = null;
  const unwatch = () => { if (unwatchFn) { unwatchFn(); unwatchFn = null; } };
  function watchClose() {
    unwatch();
    const check = () => setTimeout(() => {
      if (U.drawer.isOpen()) return;
      unwatch(); opened = null;
      if (/^#\/review\//.test(location.hash)) location.hash = baseHash();
    }, 0);
    const onClick = (e) => {
      if (e.target.closest('#drawer a[href^="#"]')) { unwatch(); opened = null; U.drawer.close(); return; }
      if (e.target.closest('#drawer [data-close-layer]') || e.target.id === 'scrim') check();
    };
    const onKey = (e) => { if (e.key === 'Escape') check(); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    unwatchFn = () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }
  // Closes the drawer and returns to the list, unless the user already navigated elsewhere while the request was running
  const finish = (msg, kind, tab, since) => {
    U.toast(msg, kind);
    if (since !== undefined && since !== YU.router.token()) return;
    opened = null; unwatch(); U.drawer.close(); location.hash = baseHash(tab);
  };
  const bail = (msg, tab) => { U.toast(msg, 'bad'); location.hash = baseHash(tab); return false; };

  function mount(root, params) {
    const me = YU.me(); if (!me) return;
    syncUi(params);
    U.on(root, 'click', '[data-coordinator-tab]', (e, el) => { setUi({ tab: el.dataset.coordinatorTab }); location.hash = baseHash(el.dataset.coordinatorTab); });
    U.on(root, 'click', '[data-coordinator-dept]', (e, el) => { setUi({ dept: el.dataset.coordinatorDept || null }); location.hash = baseHash(); });
    U.on(root, 'click', '[data-coordinator-status]', (e, el) => { setUi({ taskStatus: el.dataset.coordinatorStatus }); location.hash = baseHash('missions'); });
    U.on(root, 'click', '[data-coordinator-menu]', (e, el) => openMissionMenu(el, el.dataset.coordinatorMenu));

    const key = params.id === 'new' ? 'new' : params.id === 'mission' ? (params.sub ? `mission:${params.sub}` : null) : params.id ? `sub:${params.id}` : null;
    if (!key) { if (opened) { opened = null; unwatch(); if (U.drawer.isOpen()) U.drawer.close(); } return; }
    if (key === opened && U.drawer.isOpen()) return;   // re-render after an action: keep what the user typed
    opened = key;
    const ok = key === 'new' ? openMissionForm(me, null) : key.startsWith('mission:') ? openMissionForm(me, params.sub) : openReview(me, params.id);
    if (!ok) opened = null;
  }

  // ---------- Dept missions row menu
  function openMissionMenu(el, id) {
    const t = YU.mission(id); if (!t) return;
    const run = async (action, msg) => { const r = await action(); if (!r.ok) return U.toast(r.error, 'bad'); U.toast(typeof msg === 'function' ? msg(r) : msg, 'ok'); };
    const items = [
      { label: YU.t('review.action.open'), icon: 'eye', onClick: () => { location.hash = `#/missions/${t.id}`; } },
      { label: YU.t('review.action.edit'), icon: 'pencil', onClick: () => { location.hash = `#/review/mission/${t.id}`; } },
    ];
    if (t.status === 'draft') items.push({ label: YU.t('review.action.publish'), icon: 'send', onClick: () => run(() => YU.actions.publishTask(t.id), YU.t('review.toast.published')) });
    if (t.status === 'open') items.push({ label: YU.t('action.close'), icon: 'lock', onClick: async () => {
      if (await U.confirm({ title: YU.t('review.confirm.close.title'), text: YU.t('review.confirm.close.text', { title: t.title }), ok: YU.t('review.action.closeMission') })) run(() => YU.actions.closeTask(t.id), YU.t('review.toast.closed'));
    } });
    items.push('sep', { label: YU.t('review.action.delete'), icon: 'trash-2', danger: true, onClick: async () => {
      if (await U.confirm({ title: YU.t('review.confirm.delete.title'), text: YU.t('review.confirm.delete.text', { title: t.title }), ok: YU.t('review.action.delete'), danger: true })) run(() => YU.actions.deleteTask(t.id), (r) => (r.archived ? YU.t('review.toast.archived') : YU.t('review.toast.deleted')));
    } });
    U.menu(el, items);
  }

  // ---------- Review drawer
  const proofBlock = (proof, t) => {
    if (!proof) return `<div class="small muted mt-8">${YU.t('review.proof.none')}</div>`;
    if (proof.type === 'photo') {
      return proof.url
        ? `<a class="coordinator-proof-photo mt-8" href="${esc(proof.url)}" target="_blank" rel="noopener noreferrer" title="${YU.t('review.proof.openFull')}"><img ${U.photoSrc(proof.url)} alt="${YU.t('review.proof.photoAlt')}" loading="lazy"></a>`
        : `<div class="coordinator-proof coordinator-proof-photo-missing tone-${esc(deptTone(t.deptId))} mt-8">${icon('camera')}<span class="small">${YU.t('review.proof.photoMissing')}</span></div>`;
    }
    if (proof.type === 'link') {
      return /^https?:\/\//i.test(proof.label)
        ? `<div class="mt-8"><a class="chip coordinator-proof-chip chip-lg" href="${esc(proof.label)}" target="_blank" rel="noopener noreferrer">${icon('link')}<span class="truncate">${esc(proof.label)}</span></a></div>`
        : `<div class="mt-8">${proofChip(proof, 'chip-lg')}</div>`;
    }
    return `<blockquote class="coordinator-proof coordinator-proof-quote mt-8">${esc(proof.label)}</blockquote>`;
  };
  const decisionBlock = (s) => {
    const by = YU.user(s.reviewedBy);
    return `<div class="coordinator-section"><div class="h3">${YU.t('review.decision.title')}</div>
      <div class="inset mt-8">
        <div class="row-between wrap">${subStatusPill(s.status)}${s.status === 'approved' ? coins(s.coinsAwarded || 0, { sign: true }) : `<span class="small muted">${YU.t('review.decision.noCoins')}</span>`}</div>
        <div class="small muted mt-8">${by ? esc(by.name) : YU.t('role.coordinator')}, ${esc(fmtDate(s.reviewedAt, { time: true }))}</div>
        ${s.reviewComment ? `<div class="prose mt-8">${esc(s.reviewComment)}</div>` : ''}
      </div></div>`;
  };
  const reviewBody = (s, t, u, late, prefill) => {
    const lv = U.levelFor(u.coinsTotal), pct = YU.state.settings.latePenaltyPct;
    const reqs = t.requirements.length
      ? `<div class="col gap-8 mt-8">${t.requirements.map((r, i) => `<label class="check"><input type="checkbox" id="rv-req-${i}">${esc(r)}</label>`).join('')}</div>`
      : `<div class="small muted mt-8">${YU.t('review.detail.noRequirements')}</div>`;
    return `
      <div class="inset coordinator-user">
        ${avatar(u, 'avatar-lg')}
        <div class="grow">
          <a class="list-title" href="#/profile/${esc(u.id)}">${esc(u.name)}</a>
          <div class="small muted">${esc(u.group)}, ${esc(u.school)}</div>
          <div class="row gap-8 wrap mt-8">
            <span class="pill pill-gold">${icon('sparkles')}${esc(lv.level.name)}</span>
            <span class="small muted">${YU.t('review.detail.missionsDone', { count: u.missionsDone })}</span>
            ${u.streakWeeks ? `<span class="small muted coordinator-streak">${icon('flame')}${YU.t('review.detail.streak', { count: u.streakWeeks })}</span>` : ''}
          </div>
        </div>
      </div>
      ${s.status === 'in_progress'
        ? `<div class="notice notice-info mt-16">${icon('loader-circle')}<span>${YU.t('review.detail.inProgressNotice', { deadline: deadline(t.deadline).label })}</span></div>`
        : `<div class="coordinator-section"><div class="h3">${YU.t('review.detail.whatDone')}</div><div class="prose mt-8">${esc(s.comment || '—')}</div></div>
           <div class="coordinator-section"><div class="h3">${YU.t('review.detail.proofTitle', { kind: YU.t(PROOF_NAME[(s.proof && s.proof.type) || t.proofType] || 'review.proof.name.file') })}</div>${proofBlock(s.proof, t)}</div>`}
      ${s.status === 'pending' ? `
      <div class="coordinator-section">
        <div class="row-between"><div class="h3">${YU.t('review.detail.requirements')}</div><span class="micro muted">${YU.t('review.detail.requirementsHint')}</span></div>${reqs}
      </div>
      ${late ? `<div class="notice notice-warn mt-16">${icon('alarm-clock')}<span>${YU.t('review.detail.lateNotice', { date: fmtDate(t.deadline, { time: true }), pct, amount: YU.t('coins.amount', { count: prefill }), coins: t.coins })}</span></div>` : ''}
      <form id="coordinator-review" class="col gap-16 mt-16" novalidate>
        <div class="field"><label for="rv-coins">${YU.t('review.decide.coinsLabel')}</label><input class="input" id="rv-coins" name="coins" type="number" min="0" step="1" value="${prefill}"><span class="hint">${YU.t('review.decide.coinsHint', { coins: t.coins })}</span><span class="error" data-err="points" hidden></span></div>
        <div class="field"><label for="rv-comment">${YU.t('review.decide.commentLabel')}</label><textarea class="textarea" id="rv-comment" name="comment" placeholder="${YU.t('review.decide.commentPlaceholder')}"></textarea><span class="hint">${YU.t('review.decide.commentHint')}</span><span class="error" data-err="comment" hidden></span></div>
      </form>` : s.status === 'in_progress' ? '' : decisionBlock(s)}`;
  };

  function openReview(me, subId) {
    const s = YU.submission(subId), t = s && YU.mission(s.missionId), u = s && YU.user(s.userId);
    if (!s || !t || !u) return bail(YU.t('review.error.subNotFound'));
    if (!YU.isCoordinatorOf(t.deptId)) return bail(YU.t('review.error.otherDept'));
    const pending = s.status === 'pending', late = isLate(s, t), prefill = late ? lateCoins(t) : t.coins;
    const el = U.drawer.open({
      title: esc(t.title),
      sub: isWide() ? YU.t('review.detail.reportFromDept', { name: u.name, dept: scopeName(t.deptId) }) : YU.t('review.detail.reportFrom', { name: u.name }),
      body: reviewBody(s, t, u, late, prefill),
      foot: pending
        ? `<button class="btn btn-danger" data-review="reject">${icon('x')}${YU.t('review.action.reject')}</button><button class="btn btn-primary" data-review="approve">${icon('check')}<span>${YU.t('review.action.approve')}<span data-approve-n>${prefill}</span></span></button>`
        : `<button class="btn btn-secondary" data-close-layer>${YU.t('action.close')}</button>`,
    });
    if (!el) return false;
    watchClose();
    if (pending) wireReview(el, s);
    return true;
  }

  function wireReview(el, s) {
    const form = el.querySelector('#coordinator-review'), pts = form.querySelector('#rv-coins'), cmt = form.querySelector('#rv-comment'), n = el.querySelector('[data-approve-n]');
    pts.oninput = () => { n.textContent = Math.max(0, Math.round(+pts.value || 0)); setErr(form, 'coins', ''); };
    cmt.oninput = () => setErr(form, 'comment', '');
    const approveBtn = el.querySelector('[data-review="approve"]'), rejectBtn = el.querySelector('[data-review="reject"]');
    approveBtn.onclick = async () => {
      const v = Math.round(+pts.value);
      if (pts.value === '' || !Number.isFinite(v) || v < 0) { setErr(form, 'coins', YU.t('review.decide.errCoins')); pts.focus(); return; }
      const since = YU.router.token();
      const r = await U.busy(approveBtn, () => YU.actions.approveSubmission(s.id, { coins: v, comment: cmt.value.trim() }));
      if (!r.ok) return U.toast(r.error, 'bad');
      finish(YU.t('review.toast.approved', { coins: r.coins }), 'gold', undefined, since);
    };
    rejectBtn.onclick = async () => {
      if (!cmt.value.trim()) { setErr(form, 'comment', YU.t('review.decide.errComment')); cmt.focus(); return; }
      const since = YU.router.token();
      const r = await U.busy(rejectBtn, () => YU.actions.rejectSubmission(s.id, { comment: cmt.value.trim() }));
      if (!r.ok) return U.toast(r.error, 'bad');
      finish(YU.t('review.toast.rejected'), 'info', undefined, since);
    };
  }

  // ---------- Mission form drawer (create and edit share one form)
  const missionFormBody = (me, t) => {
    const wide = isWide();
    const deptId = t ? t.deptId : wide ? (ui().dept || (YU.state.departments[0] || {}).id) : me.deptId;
    const depts = wide ? YU.state.departments : [YU.dept(deptId)].filter(Boolean);
    const dl = U.toInputValue(t ? t.deadline : new Date(YU.now().getTime() + WEEK_MS));
    const v = (k, d = '') => esc(t ? t[k] : d);
    const seg = (name, val, opts) => `<div class="seg" data-seg="${name}">${opts.map(([id, label]) => `<button type="button" class="${id === val ? 'is-active' : ''}" data-val="${id}">${label}</button>`).join('')}</div><input type="hidden" name="${name}" value="${esc(val)}">`;
    return `<form id="coordinator-task-form" class="coordinator-form" novalidate>
      <div class="field full"><label for="tf-title">${YU.t('review.form.titleLabel')}</label><input class="input" id="tf-title" name="title" value="${v('title')}" maxlength="120" placeholder="${YU.t('review.form.titlePlaceholder')}"><span class="error" data-err="title" hidden></span></div>
      <div class="field full"><label for="tf-dept">${YU.t('review.form.deptLabel')}</label><select class="select" id="tf-dept" name="deptId" ${wide ? '' : 'disabled'}>${depts.map((d) => `<option value="${esc(d.id)}" ${d.id === deptId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>${wide ? '' : `<span class="hint">${YU.t('review.form.deptHint')}</span>`}</div>
      <div class="field full"><label for="tf-desc">${YU.t('review.form.descLabel')}</label><textarea class="textarea" id="tf-desc" name="description" placeholder="${YU.t('review.form.descPlaceholder')}">${v('description')}</textarea></div>
      <div class="field"><label for="tf-coins">${YU.t('review.form.coinsLabel')}</label><input class="input" id="tf-coins" name="coins" type="number" min="${MIN_COINS}" step="5" value="${v('coins', 30)}"><span class="hint">${YU.t('review.form.coinsHint', { min: MIN_COINS })}</span><span class="error" data-err="points" hidden></span></div>
      <div class="field"><label for="tf-seats">${YU.t('review.form.seatsLabel')}</label><input class="input" id="tf-seats" name="seats" type="number" min="1" value="${v('seats', 2)}"><span class="hint">${YU.t('review.form.seatsHint')}</span><span class="error" data-err="seats" hidden></span></div>
      <div class="field full"><label for="tf-deadline">${YU.t('review.form.deadlineLabel')}</label><input class="input" id="tf-deadline" name="deadline" type="datetime-local" value="${esc(dl)}"><span class="error" data-err="deadline" hidden></span></div>
      <div class="field"><span class="label">${YU.t('review.form.proofLabel')}</span>${seg('proofType', t ? t.proofType : 'photo', [['photo', YU.t('review.form.proof.photo')], ['link', YU.t('review.form.proof.link')], ['text', YU.t('review.form.proof.text')]])}</div>
      <div class="field full"><label for="tf-loc">${YU.t('review.form.locationLabel')}</label><input class="input" id="tf-loc" name="location" value="${v('location')}" placeholder="${YU.t('review.form.locationPlaceholder')}"></div>
      <div class="field full"><label for="tf-req">${YU.t('review.form.requirementsLabel')}</label><textarea class="textarea" id="tf-req" name="requirements" placeholder="${YU.t('review.form.requirementsPlaceholder')}">${esc(t ? t.requirements.join('\n') : '')}</textarea><span class="hint">${YU.t('review.form.requirementsHint')}</span></div>
    </form>`;
  };

  function openMissionForm(me, missionId) {
    const t = missionId ? YU.mission(missionId) : null;
    if (missionId && !t) return bail(YU.t('review.error.missionNotFound'), 'missions');
    if (t && !YU.isCoordinatorOf(t.deptId)) return bail(YU.t('review.error.editOtherDept'), 'missions');
    const el = U.drawer.open({
      title: t ? YU.t('review.form.titleEdit') : YU.t('review.form.titleNew'),
      sub: t ? esc(t.title) : isWide() ? YU.t('review.form.subWide') : YU.t('review.form.subDept', { dept: scopeName(me.deptId) }),
      body: missionFormBody(me, t && YU.sourceOf(t)) + (t ? YU.contentTranslations.panel('mission', t) : ''),
      foot: t
        ? `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" data-save="keep">${icon('check')}${YU.t('review.action.save')}</button>`
        : `<button class="btn btn-secondary" data-save="draft">${YU.t('review.action.saveDraft')}</button><button class="btn btn-primary" data-save="open">${icon('send')}${YU.t('review.action.publish')}</button>`,
    });
    if (!el) return false;
    if (t) YU.contentTranslations.mount(el, 'mission', t);
    watchClose();
    const form = el.querySelector('#coordinator-task-form');
    form.onsubmit = (e) => e.preventDefault();
    form.oninput = (e) => { if (e.target.name) setErr(form, e.target.name, ''); };
    form.onclick = (e) => {
      const b = e.target.closest('[data-seg] button'); if (!b) return;
      const seg = b.closest('[data-seg]');
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
      form.querySelector(`input[name="${seg.dataset.seg}"]`).value = b.dataset.val;
    };
    el.querySelectorAll('[data-save]').forEach((b) => { b.onclick = () => saveTask(b, form, me, t, b.dataset.save); });
    setTimeout(() => form.querySelector('#tf-title').focus(), 60);
    return true;
  }

  async function saveTask(btn, form, me, t, mode) {
    const f = U.formData(form);
    const pts = Math.round(+f.coins), seats = Math.round(+f.seats), when = U.fromInputValue(f.deadline);
    // A deadline that is already past is only a problem when it is being set: fixing a typo in the title
    // of a mission whose deadline has gone must still be possible
    const deadlineChanged = !t || !when || when.getTime() !== new Date(t.deadline).getTime();
    const deadlineBad = !when || (deadlineChanged && (!t || t.status === 'open') && when <= YU.now());
    const errors = [
      ['title', !f.title.trim() && YU.t('review.form.errTitle')],
      ['coins', !(pts >= MIN_COINS) && YU.t('review.form.errCoins', { min: MIN_COINS })],
      ['seats', !(seats >= 1) && YU.t('review.form.errSeats')],
      ['deadline', deadlineBad && YU.t('review.form.errDeadline')],
    ];
    errors.forEach(([k, msg]) => setErr(form, k, msg || ''));
    const first = errors.find(([, msg]) => msg);
    if (first) { const el = form.querySelector(`[name="${first[0]}"]`); if (el) el.focus(); return; }
    const data = {
      title: f.title.trim(), deptId: isWide() ? f.deptId : me.deptId, description: (f.description || '').trim(), coins: pts, seats,
      ...(deadlineChanged ? { deadline: when.toISOString() } : {}), location: (f.location || '').trim(), proofType: f.proofType,
      requirements: (f.requirements || '').split('\n').map((x) => x.trim()).filter(Boolean),
    };
    const since = YU.router.token();
    const r = await U.busy(btn, () => (t ? YU.actions.updateTask(t.id, data) : YU.actions.createTask({ ...data, status: mode })));
    if (!r.ok) return U.toast(r.error, 'bad');
    setUi({ tab: 'missions', taskStatus: 'all' });   // show the saved mission, whatever filter was active
    finish(t ? YU.t('review.toast.saved') : mode === 'draft' ? YU.t('review.toast.draftSaved') : YU.t('review.toast.published'), 'ok', 'missions', since);
  }

  YU.screens.review = { title: () => YU.t('review.pageTitle'), render, mount };
})();

;
/* js/screens/admin-core.js */
/* Admin panel — the #/admin shell (section nav + content column) and its core sections:
   overview, users, departments, audit, settings.
   Content sections (missions, news, rewards, coins) live in admin-content.js and register into the same YU.adminSections registry. */
(function () {
  const U = YU.ui;
  const { esc, icon, avatar, coins, deptChip, pill, fmtNum, fmtDate, timeAgo, levelFor } = U;
  const TONES = YU.TONES;
  const ROLE_PILL = { admin: 'dark', leader: 'gold', coordinator: 'info', volunteer: 'ok' };
  const DAY = 86400000, MONTH_DAYS = 30, AUDIT_PAGE = 50;
  // The role dialog's "another department" choice: a name typed in, created when the dialog is saved
  const NEW_DEPT = '__new';

  // ---------- Shared helpers
  const uiState = (key, defaults) => (YU.state.ui[key] = YU.state.ui[key] || { ...defaults });
  // A section is for admins unless it says who else may open it (the news section opens to whoever runs the news)
  const allowed = (s) => (s.allowed ? s.allowed() : YU.can('*'));
  const sections = () => YU.adminSections.filter(allowed).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const findSection = (id) => { const list = sections(); return list.find((s) => s.id === id) || list.find((s) => s.id === 'overview') || list[0] || null; };
  // A section names itself either with a function that reads the catalogue or with a plain string
  const secTitle = (s) => (s ? (typeof s.title === 'function' ? s.title() : s.title || '') : '');
  const sectionParams = (p) => ({ id: p.sub || null, sub: null, query: p.query || {} });
  const goto = (hash) => { location.hash = hash; };
  const stripQuery = (base) => { if (location.hash.includes('?')) goto(base); };
  const deptName = (id) => { const d = YU.dept(id); return d ? d.name : ''; };
  // The coordinator as the admin typed it on the department, read in the viewer's script like any person's name
  const headName = (d) => YU.i18n.personName(d.headName || '');
  const inUnion = (u) => !!u.deptId && u.status === 'active';
  const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
  const has = (q, ...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q));
  // Modals opened from a route (#/admin/users/u5) return the hash to the section's base on close, so links stay shareable
  let routeBase = '';
  const leaveRoute = () => { const b = routeBase; routeBase = ''; if (b && location.hash.startsWith(b)) goto(b); };
  document.addEventListener('click', (e) => { if (routeBase && (e.target.id === 'scrim' || (e.target.closest('#modal') && e.target.closest('[data-close-layer]')))) leaveRoute(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && routeBase) leaveRoute(); });
  // Inline validation: message under the field, red border on the control
  const fieldError = (form, name, msg) => {
    const input = form.querySelector(`[name="${name}"]`); if (!input) return;
    const wrap = input.closest('.field') || input.parentElement;
    input.classList.toggle('is-invalid', !!msg);
    let err = wrap.querySelector('.error');
    if (!msg) { if (err) err.remove(); return; }
    if (!err) { err = document.createElement('span'); err.className = 'error'; wrap.appendChild(err); }
    err.textContent = msg;
  };
  const options = (items, selected, label = (x) => x.name) => items.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
  const deptOptions = (selected, blank = '') => (blank ? `<option value="">${esc(blank)}</option>` : '') + options(YU.state.departments, selected);
  const roleOptions = (selected) => YU.ROLE_IDS.map((k) => [k, YU.roleName(k)]).map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  // title and sub come from t(), which escapes whatever it interpolates, so they are already HTML-safe
  const linkRow = (href, ic, tone, title, sub) => `<a class="list-item is-link admin-row" href="${href}"><span class="kpi-icon tone-${U.safeTone(tone)}">${icon(ic)}</span><span class="grow"><div class="list-title">${title}</div><div class="list-sub">${sub}</div></span><span class="btn btn-secondary btn-sm">${YU.t('admin.action.open')}</span></a>`;

  // ---------- Shell: left nav of registered sections, right column renders the current one
  // A section that fails to draw shows its fallback, and the cause goes to the console so it can be fixed
  const safe = (fn, fallback) => { try { return fn(); } catch (err) { console.error('[admin section]', err); return fallback; } };
  function render(params) {
    const me = YU.me(); if (!me) return '';
    const sec = findSection(params.id || 'overview'), sp = sectionParams(params);
    const nav = sections().map((s) => { const active = sec && s.id === sec.id, c = s.count ? safe(() => s.count(), 0) : 0; return `
      <a class="nav-item ${active ? 'is-active' : ''}" href="#/admin/${esc(s.id)}" ${active ? 'aria-current="page"' : ''}>${icon(s.icon || 'circle')}<span>${esc(secTitle(s))}</span>${c ? `<span class="nav-count">${fmtNum(c)}</span>` : ''}</a>`; }).join('');
    const content = sec
      ? safe(() => sec.render(sp), U.empty({ icon: 'alert-circle', title: YU.t('admin.sectionFailed.title'), text: YU.t('admin.sectionFailed.text') }))
      : U.empty({ icon: 'compass', title: YU.t('admin.noSections.title'), text: YU.t('admin.noSections.text') });
    // Someone who only runs the news gets that section alone, without the administration headline around it
    const whole = YU.can('*');
    return `
      <div class="page-head admin-head">
        <div>${whole ? `<h1 class="h1">${YU.t('admin.headline')} <em>${YU.t('admin.headlineAccent')}</em></h1><p class="lead">${YU.t('admin.lead')}</p>` : `<h1 class="h1">${esc(secTitle(sec))}</h1>`}</div>
        <div class="page-actions admin-actions">${sec && sec.actions ? safe(() => sec.actions(sp), '') : ''}</div>
      </div>
      <div class="admin-layout ${sections().length > 1 ? '' : 'is-single'}">
        ${sections().length > 1 ? `<nav class="admin-nav panel" aria-label="${YU.t('admin.navLabel')}">${nav}</nav>` : ''}
        <div class="admin-content">${content}</div>
      </div>`;
  }
  function mount(root, params) {
    if (!params.sub) routeBase = '';
    const sec = findSection(params.id || 'overview');
    if (sec && sec.mount) sec.mount(root, sectionParams(params));
  }
  const title = (params) => { const sec = findSection(params.id || 'overview'); return sec && sec.id !== 'overview' ? YU.t('admin.title.section', { section: secTitle(sec) }) : YU.t('admin.title'); };
  YU.screens.admin = { title, render, mount };

  // ---------- Overview
  function overviewRender() {
    const an = YU.state.analytics, last = an.coinsAwarded.length - 1, cur = an.coinsAwarded[last], prev = an.coinsAwarded[last - 1] || 0;
    const diff = prev ? Math.round(((cur - prev) / prev) * 100) : 0;
    const members = YU.state.users.filter(inUnion), fresh = members.filter((u) => YU.now() - new Date(u.joinedAt) < MONTH_DAYS * DAY).length;
    const open = YU.state.missions.filter((t) => t.status === 'open'), seats = open.reduce((a, t) => a + YU.select.seatsLeft(t), 0);
    const pending = YU.select.pendingReviews().slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const reserved = YU.state.redemptions.filter((r) => r.status === 'reserved').length;
    const taskDrafts = YU.state.missions.filter((t) => t.status === 'draft').length, newsDrafts = YU.state.news.filter((n) => n.status === 'draft').length;
    const blocked = YU.state.users.filter((u) => u.status === 'blocked').length;
    const kpis = [
      U.kpi({ label: YU.t('admin.overview.kpi.members'), value: fmtNum(members.length), icon: 'users', tone: 'blue', delta: fresh ? YU.t('admin.overview.kpi.membersDelta', { count: fresh }) : '', sub: YU.t('admin.overview.kpi.membersNone') }),
      U.kpi({ label: YU.t('admin.overview.kpi.openMissions'), value: fmtNum(open.length), icon: 'clipboard-list', tone: 'violet', sub: YU.t('admin.overview.kpi.seatsLeft', { count: seats }) }),
      U.kpi({ label: YU.t('admin.overview.kpi.weekCoins'), value: fmtNum(cur), icon: 'coins', tone: 'gold', delta: YU.t('admin.overview.kpi.weekDelta', { diff: `${diff > 0 ? '+' : ''}${diff}` }), deltaTone: diff < 0 ? 'bad' : 'ok' }),
      U.kpi({ label: YU.t('admin.overview.kpi.pendingReports'), value: fmtNum(pending.length), icon: 'clipboard-check', tone: 'coral', sub: YU.t('admin.overview.kpi.allDepts') }),
      U.kpi({ label: YU.t('admin.overview.kpi.reserved'), value: fmtNum(reserved), icon: 'gift', tone: 'pink', sub: YU.t('admin.overview.kpi.reservedSub') }),
    ];
    const attention = [
      pending.length ? linkRow('#/review', 'clipboard-check', 'blue', YU.t('admin.overview.attention.pending', { count: pending.length }), YU.t('admin.overview.attention.pendingSub', { when: timeAgo(pending[0].submittedAt) })) : '',
      taskDrafts ? linkRow('#/admin/missions', 'file-pen-line', 'slate', YU.t('admin.overview.attention.missionDrafts', { count: taskDrafts }), YU.t('admin.overview.attention.missionDraftsSub')) : '',
      newsDrafts ? linkRow('#/admin/news', 'newspaper', 'slate', YU.t('admin.overview.attention.newsDrafts', { count: newsDrafts }), YU.t('admin.overview.attention.newsDraftsSub')) : '',
      blocked ? linkRow('#/admin/users?status=blocked', 'ban', 'coral', YU.t('admin.overview.attention.blocked', { count: blocked }), YU.t('admin.overview.attention.blockedSub')) : '',
    ].filter(Boolean);
    const deptRows = YU.state.departments.map((d) => { const st = YU.select.deptStats(d.id); return `
      <tr><td>${deptChip(d.id)}</td><td>${d.headName ? `<span class="small">${esc(headName(d))}</span>` : `<span class="small muted">${YU.t('admin.dept.noHead')}</span>`}</td><td class="num">${st.volunteers}</td><td class="num">${st.open}</td><td class="num">${st.pending}</td><td class="num">${fmtNum(an.byDept[d.id] || 0)}</td><td class="num">${coins(st.coinsAwarded)}</td></tr>`; }).join('');
    return `<div class="admin-kpis kpi-row">${kpis.join('')}</div>
      <div class="two-col">
        <section class="panel"><div class="panel-head"><span class="h2">${YU.t('admin.overview.coinsChart')}</span><span class="small muted">${YU.t('admin.overview.lastWeeks', { count: an.weeks.length })}</span></div><div class="panel-body">${U.bars(an.coinsAwarded, an.weeks, { highlight: last })}</div></section>
        <section class="panel"><div class="panel-head"><span class="h2">${YU.t('admin.overview.activeMembers')}</span></div><div class="panel-body"><div class="kpi-value">${fmtNum(an.activeVolunteers[last])}</div><div class="small muted mt-8">${YU.t('admin.overview.activeMembersSub', { week: an.weeks[last] })}</div><div class="mt-16">${U.sparkline(an.activeVolunteers, { h: 80, cls: 'admin-spark' })}</div></div></section>
      </div>
      <section class="panel"><div class="panel-head"><span class="h2">${YU.t('admin.section.departments')}</span><a class="btn btn-ghost btn-sm" href="#/admin/departments">${YU.t('admin.overview.deptsManage')}</a></div>
        ${deptRows ? `<div class="table-wrap mt-12"><table class="table is-compact is-stack"><thead><tr><th>${YU.t('admin.overview.table.dept')}</th><th>${YU.t('role.coordinator')}</th><th class="num">${YU.t('admin.overview.table.members')}</th><th class="num">${YU.t('admin.overview.table.open')}</th><th class="num">${YU.t('sub.status.pending')}</th><th class="num">${YU.t('admin.overview.table.semesterMissions')}</th><th class="num">${YU.t('admin.overview.table.coins')}</th></tr></thead><tbody>${deptRows}</tbody></table></div>`
          : U.empty({ icon: 'building-2', title: YU.t('admin.depts.empty.title'), text: YU.t('admin.depts.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/admin/departments/new">${YU.t('admin.depts.new')}</a>` })}
      </section>
      <section class="panel"><div class="panel-head"><span class="h2">${YU.t('admin.overview.attention.title')}</span>${attention.length ? `<span class="small muted">${YU.t('admin.overview.attention.count', { count: attention.length })}</span>` : ''}</div>
        ${attention.length ? `<div class="list mt-12">${attention.join('')}</div>` : U.empty({ icon: 'check-check', title: YU.t('admin.overview.allGood.title'), text: YU.t('admin.overview.allGood.text') })}
      </section>`;
  }
  const overviewActions = () => `<a class="btn btn-primary" href="#/admin/missions/new">${icon('plus')}${YU.t('admin.overview.newMission')}</a><a class="btn btn-secondary" href="#/admin/news/new">${icon('newspaper')}${YU.t('admin.overview.newNews')}</a><a class="btn btn-secondary" href="#/admin/rewards/new">${icon('gift')}${YU.t('admin.overview.newReward')}</a>`;

  // ---------- Users
  const USERS_DEFAULT = { q: '', role: '', dept: '', status: '', sort: 'coins', dir: 'desc' };
  const usersUi = (params) => {
    const st = uiState('adminUsers', USERS_DEFAULT);
    if (params && params.query) ['q', 'role', 'dept', 'status'].forEach((k) => { if (params.query[k] !== undefined) st[k] = params.query[k]; });
    return st;
  };
  const filterUsers = (st) => {
    const q = st.q.trim().toLowerCase(), dir = st.dir === 'asc' ? 1 : -1;
    return YU.state.users
      .filter((u) => has(q, u.name, u.raw && u.raw.name, u.group, u.email) && (!st.role || u.role === st.role) && (!st.dept || u.deptId === st.dept) && (!st.status || u.status === st.status))
      .sort((a, b) => (st.sort === 'name' ? dir * byName(a, b) : dir * (a.coinsSemester - b.coinsSemester) || byName(a, b)));
  };
  const sortHead = (st, key, label, cls = '') => `<th class="${cls}"><button type="button" class="admin-sort ${st.sort === key ? `is-active is-${st.dir}` : ''}" data-action="admin-users-sort" data-sort="${key}">${label}${icon(st.sort === key ? 'chevron-down' : 'arrow-up-down')}</button></th>`;
  function usersTable(st) {
    const rows = filterUsers(st), me = YU.me();
    if (!rows.length) return U.empty({ icon: 'search', title: YU.t('admin.users.empty.title'), text: YU.t('admin.users.empty.text'), action: `<button class="btn btn-secondary btn-sm" data-action="admin-users-reset">${YU.t('admin.filters.reset')}</button>` });
    return `<div class="table-wrap"><table class="table is-compact is-stack"><thead><tr>${sortHead(st, 'name', YU.t('admin.users.col.name'))}<th>${YU.t('admin.users.col.role')}</th><th>${YU.t('admin.users.col.dept')}</th><th>${YU.t('admin.users.col.level')}</th>${sortHead(st, 'points', YU.t('admin.users.col.coins'), 'num')}<th class="num">${YU.t('admin.users.col.missions')}</th><th>${YU.t('admin.users.col.lastSeen')}</th><th>${YU.t('admin.users.col.status')}</th><th></th></tr></thead><tbody>
      ${rows.map((u) => `<tr>
        <td><div class="cell-user">${avatar(u, 'avatar-sm')}<span class="admin-cell"><a class="list-title truncate admin-user-name" href="${u.id === me.id ? '#/profile' : `#/profile/${u.id}`}">${esc(u.name)}${u.id === me.id ? ` ${YU.t('admin.users.you')}` : ''}</a><div class="micro muted">${esc(u.group)}, ${esc(u.school)}</div></span></div></td>
        <td>${pill(YU.roleName(u.role), ROLE_PILL[u.role] || 'neutral')}</td>
        <td>${u.deptId ? deptChip(u.deptId) : '<span class="muted">—</span>'}</td>
        <td class="small">${YU.participates(u) ? esc(levelFor(u.coinsTotal).level.name) : '<span class="muted">—</span>'}</td>
        <td class="num" style="white-space:nowrap">${YU.participates(u) ? `${coins(u.coinsSemester)}<div class="micro muted">${YU.t('admin.users.totalCoins', { count: u.coinsTotal })}</div>` : '<span class="muted">—</span>'}</td>
        <td class="num">${u.missionsDone}</td>
        <td class="small muted">${esc(timeAgo(u.lastActive))}</td>
        <td>${u.status === 'blocked' ? pill(YU.t('admin.users.blocked'), 'bad', 'ban') : pill(YU.t('admin.users.active'), 'ok')}</td>
        <td class="ta-right"><button class="btn btn-ghost btn-sm btn-icon" data-action="admin-user-menu" data-id="${u.id}" aria-label="${YU.t('admin.users.rowActions', { name: u.name })}">${icon('more-horizontal')}</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  function usersRender(params) {
    const st = usersUi(params);
    return `<div class="admin-toolbar">
        <div class="search">${icon('search')}<input class="input" data-admin-filter="q" placeholder="${YU.t('admin.users.searchPlaceholder')}" value="${esc(st.q)}" autocomplete="off" aria-label="${YU.t('admin.users.searchLabel')}"></div>
        <select class="select" data-admin-filter="role" aria-label="${YU.t('admin.users.roleFilter')}"><option value="">${YU.t('admin.users.allRoles')}</option>${roleOptions(st.role)}</select>
        <select class="select" data-admin-filter="dept" aria-label="${YU.t('admin.users.deptFilter')}"><option value="">${YU.t('admin.users.allDepts')}</option>${deptOptions(st.dept)}</select>
        <select class="select" data-admin-filter="status" aria-label="${YU.t('admin.users.statusFilter')}"><option value="">${YU.t('admin.users.anyStatus')}</option><option value="active" ${st.status === 'active' ? 'selected' : ''}>${YU.t('admin.users.statusActive')}</option><option value="blocked" ${st.status === 'blocked' ? 'selected' : ''}>${YU.t('admin.users.statusBlocked')}</option></select>
      </div>
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('admin.section.users')} <span class="muted" id="admin-users-count">${filterUsers(st).length}</span></span><span class="small muted hide-mobile">${YU.t('admin.users.sortHint')}</span></div>
        <div id="admin-users-table" class="mt-12">${usersTable(st)}</div>
      </section>`;
  }
  function usersMount(root, params) {
    // Filters and sorting redraw only the table so the search field keeps focus
    const redraw = () => {
      const box = root.querySelector('#admin-users-table'), st = usersUi(); if (!box) return;
      box.innerHTML = usersTable(st);
      const c = root.querySelector('#admin-users-count'); if (c) c.textContent = filterUsers(st).length;
      U.refreshIcons();
    };
    U.on(root, 'input', 'input[data-admin-filter="q"]', U.debounce((e, el) => { usersUi().q = el.value; stripQuery('#/admin/users'); redraw(); }, 150));
    U.on(root, 'change', 'select[data-admin-filter]', (e, el) => { usersUi()[el.dataset.adminFilter] = el.value; stripQuery('#/admin/users'); redraw(); });
    U.on(root, 'click', '[data-action="admin-users-sort"]', (e, el) => { const st = usersUi(), key = el.dataset.sort; st.dir = st.sort === key ? (st.dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'; st.sort = key; redraw(); });
    U.on(root, 'click', '[data-action="admin-users-reset"]', () => { Object.assign(usersUi(), USERS_DEFAULT); stripQuery('#/admin/users'); YU.router.refresh(); });
    U.on(root, 'click', '[data-action="admin-user-menu"]', (e, el) => userMenu(el, el.dataset.id));
    if (params.id && YU.user(params.id) && !U.modal.isOpen()) { routeBase = '#/admin/users'; openRoleModal(params.id); }
  }
  function userMenu(anchor, id) {
    const u = YU.user(id), me = YU.me(); if (!u) return;
    const self = u.id === me.id;
    const items = [
      { label: YU.t('admin.users.menu.profile'), icon: 'user-round', onClick: () => goto(self ? '#/profile' : `#/profile/${u.id}`) },
      { label: YU.t('admin.users.menu.role'), icon: 'shield', onClick: () => openRoleModal(u.id) },
      // One's own details are edited in the settings, like everyone's
      ...(self ? [] : [
        { label: YU.t('admin.users.menu.details'), icon: 'pencil', onClick: () => openDetailsModal(u.id) },
        { label: YU.t('admin.users.menu.password'), icon: 'key-round', onClick: () => openPasswordModal(u.id) },
      ]),
      // The leader and admins run the union and hold no coins of their own
      ...(YU.participates(u) ? [{ label: YU.t('admin.users.menu.coins'), icon: 'coins', onClick: () => openCoinsModal(u.id) }] : []),
    ];
    if (!self) {
      items.push(u.status === 'blocked' ? { label: YU.t('admin.action.unblock'), icon: 'check', onClick: () => unblock(u.id) } : { label: YU.t('admin.action.block'), icon: 'ban', danger: true, onClick: () => openBlockModal(u.id) });
      items.push({ label: YU.t('admin.users.menu.delete'), icon: 'trash-2', danger: true, onClick: () => deleteUser(u.id) });
    }
    U.menu(anchor, items);
  }
  // Removing someone is confirmed twice: here in words, then with the admin's password, which the server asks for
  async function deleteUser(id) {
    const u = YU.user(id); if (!u) return;
    if (!await U.confirm({ title: YU.tText('admin.delete.title', { name: u.name }), text: YU.tText('admin.delete.text'), ok: YU.tText('admin.delete.ok'), danger: true })) return;
    const r = await YU.actions.deleteUser(id);
    // An empty error is the password prompt being dismissed: nothing happened, nothing to say
    if (!r.ok) { if (r.error) U.toast(r.error, 'bad'); return; }
    U.toast(YU.tText('admin.delete.toast', { name: u.name }), 'ok', 'trash-2');
  }
  function openRoleModal(id) {
    const u = YU.user(id), me = YU.me(); if (!u) return;
    // updateUser only lets you edit your own name, phone, bio and tone — so the admin cannot change their own role or department
    if (u.id === me.id) { U.toast(YU.tText('admin.role.selfDenied'), 'info', 'shield'); return leaveRoute(); }
    const roleNow = YU.roleName(u.role).toLowerCase();
    const el = U.modal.open({
      title: esc(u.name),
      sub: u.deptId
        ? YU.t('admin.role.subWithDept', { group: u.group, school: u.school, role: roleNow, dept: deptName(u.deptId) })
        : YU.t('admin.role.sub', { group: u.group, school: u.school, role: roleNow }),
      body: `<form id="admin-role-form" class="col gap-14">
        <div class="field"><label for="admin-role">${YU.t('admin.role.roleLabel')}</label><select class="select" id="admin-role" name="role">${roleOptions(u.role)}</select><span class="hint">${YU.t('admin.role.roleHint')}</span></div>
        <div class="field"><label for="admin-dept">${YU.t('admin.role.deptLabel')}</label><select class="select" id="admin-dept" name="deptId">${deptOptions(u.deptId, YU.t('admin.role.noDept'))}<option value="${NEW_DEPT}">${YU.t('admin.role.newDeptOption')}</option></select></div>
        <div class="field" id="admin-dept-new" hidden><label for="admin-dept-name">${YU.t('admin.role.newDeptLabel')}</label><input class="input" id="admin-dept-name" name="deptName" maxlength="40" placeholder="${YU.t('admin.dept.namePlaceholder')}" autocomplete="off"><span class="hint">${YU.t('admin.role.newDeptHint')}</span></div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="admin-role-save">${icon('check')}${YU.t('admin.action.save')}</button>`,
    });
    if (!el) return;
    // "Another department…" reveals a field for its name; the department itself is made when the dialog is saved
    const deptSelect = el.querySelector('#admin-dept'), newWrap = el.querySelector('#admin-dept-new');
    deptSelect.onchange = () => { const custom = deptSelect.value === NEW_DEPT; newWrap.hidden = !custom; if (custom) el.querySelector('#admin-dept-name').focus(); };
    const saveBtn = el.querySelector('#admin-role-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-role-form'), f = U.formData(form);
      const custom = f.deptId === NEW_DEPT, deptName = custom ? String(f.deptName || '').trim() : '', deptId = custom ? null : f.deptId || null;
      fieldError(form, 'deptName', custom && !deptName ? YU.t('admin.dept.error.name') : '');
      if (custom && !deptName) return;
      if (f.role === 'coordinator' && !deptId && !deptName) return fieldError(form, 'deptId', YU.t('admin.role.error.needDept'));
      if (f.role === 'leader' && (deptId || deptName)) return fieldError(form, 'deptId', YU.t('admin.role.error.leaderNoDept'));
      const r = await U.busy(saveBtn, () => YU.actions.updateUser(u.id, { role: f.role, deptId, deptName }));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.modal.close(); leaveRoute();
      U.toast(f.role !== u.role ? YU.t('admin.role.toast.roleChanged', { name: u.name, role: YU.roleName(f.role).toLowerCase() }) : YU.t('admin.role.toast.deptUpdated', { name: u.name }), 'ok');
    };
  }
  // The admin corrects what a person shows on their profile: the stored name is edited (the view may be transliterated)
  function openDetailsModal(id) {
    const u = YU.user(id); if (!u) return;
    const stored = { name: (u.raw && u.raw.name) || u.name, email: u.email || '', group: u.group || '', school: u.school || '', phone: u.phone || '', bio: u.bio || '' };
    const field = (name, label, attrs) => `<div class="field"><label for="admin-details-${name}">${label}</label><input class="input" id="admin-details-${name}" name="${name}" value="${esc(stored[name])}" ${attrs} autocomplete="off"></div>`;
    const el = U.modal.open({
      title: YU.t('admin.details.title'), sub: YU.t('admin.details.sub', { name: u.name }),
      body: `<form id="admin-details-form" class="col gap-14" novalidate>
        ${field('name', YU.t('profile.edit.name'), 'maxlength="60"')}
        ${field('email', YU.t('admin.details.emailLabel'), 'type="email" inputmode="email" maxlength="254"')}
        ${field('group', YU.t('auth.register.groupLabel'), 'maxlength="20"')}
        ${field('school', YU.t('auth.register.schoolLabel'), 'maxlength="20"')}
        ${field('phone', YU.t('profile.edit.phone'), 'maxlength="30" inputmode="tel"')}
        <div class="field"><label for="admin-details-bio">${YU.t('profile.edit.bio')}</label><textarea class="textarea" id="admin-details-bio" name="bio" maxlength="160" placeholder="${YU.t('profile.edit.bioPlaceholder')}">${esc(stored.bio)}</textarea></div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="admin-details-save">${icon('check')}${YU.t('admin.action.save')}</button>`,
    });
    if (!el) return;
    const saveBtn = el.querySelector('#admin-details-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-details-form'), f = U.formData(form);
      const next = Object.fromEntries(Object.keys(stored).map((k) => [k, String(f[k] || '').trim()]));
      next.email = next.email.toLowerCase();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email);
      fieldError(form, 'name', next.name.length >= 2 ? '' : YU.t('admin.details.error.name'));
      fieldError(form, 'email', emailOk ? '' : YU.t('admin.details.error.email'));
      fieldError(form, 'group', next.group.length >= 2 ? '' : YU.t('admin.details.error.group'));
      if (next.name.length < 2 || !emailOk || next.group.length < 2) return;
      // Only what changed is sent, so the audit entry records exactly that
      const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== stored[k]));
      if (!Object.keys(patch).length) return U.toast(YU.tText('admin.settings.noChanges'), 'info');
      const r = await U.busy(saveBtn, () => YU.actions.updateUserDetails(u.id, patch));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.modal.close();
      U.toast(YU.tText('admin.details.toast', { name: YU.i18n.personName(next.name) }), 'ok');
    };
  }
  // A new password for someone who lost theirs: typed in the clear so the admin can pass it on; the server
  // asks for the admin's own password before it lands, and the person's devices are signed out
  function openPasswordModal(id) {
    const u = YU.user(id); if (!u) return;
    const el = U.modal.open({
      title: YU.t('admin.password.title'), sub: YU.t('admin.password.sub', { name: u.name }),
      body: `<form id="admin-password-form" class="col gap-14" novalidate>
        <div class="field"><label for="admin-password-new">${YU.t('admin.password.label')}</label><input class="input" id="admin-password-new" name="password" type="text" autocomplete="off" spellcheck="false" maxlength="128" placeholder="${YU.t('admin.password.placeholder')}"><span class="hint">${YU.t('admin.password.hint')}</span></div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="admin-password-save">${icon('key-round')}${YU.t('admin.password.save')}</button>`,
    });
    if (!el) return;
    const saveBtn = el.querySelector('#admin-password-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-password-form'), password = String(U.formData(form).password || '');
      fieldError(form, 'password', password.length >= 8 ? '' : YU.t('admin.password.error.short'));
      if (password.length < 8) return;
      const r = await U.busy(saveBtn, () => YU.actions.setUserPassword(u.id, password));
      if (!r.ok) { if (r.error) U.toast(r.error, 'bad'); return; }
      U.modal.close();
      U.toast(YU.tText('admin.password.toast', { name: u.name }), 'ok', 'key-round');
    };
  }
  function openCoinsModal(id) {
    const u = YU.user(id); if (!u) return;
    let sign = 1;
    const el = U.modal.open({
      title: YU.t('admin.coins.title'), sub: YU.t('admin.coins.sub', { name: u.name, semester: u.coinsSemester, balance: u.balance }),
      body: `<form id="admin-points-form" class="col gap-14">
        <div class="field"><div class="seg" id="admin-points-sign"><button type="button" class="is-active" data-sign="1">${YU.t('admin.coins.award')}</button><button type="button" data-sign="-1">${YU.t('admin.coins.deduct')}</button></div><span class="hint">${YU.t('admin.coins.signHint')}</span></div>
        <div class="field"><label for="admin-amount">${YU.t('admin.coins.amountLabel')}</label><input class="input" id="admin-amount" name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="${YU.t('admin.coins.amountPlaceholder')}"></div>
        <div class="field"><label for="admin-reason">${YU.t('admin.coins.reasonLabel')}</label><input class="input" id="admin-reason" name="reason" placeholder="${YU.t('admin.coins.reasonPlaceholder')}" maxlength="120"><span class="hint">${YU.t('admin.coins.reasonHint')}</span></div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-gold" id="admin-points-save">${icon('coins')}<span id="admin-points-label">${YU.t('admin.coins.award')}</span></button>`,
    });
    if (!el) return;
    el.querySelector('#admin-points-sign').onclick = (e) => {
      const b = e.target.closest('[data-sign]'); if (!b) return;
      sign = +b.dataset.sign;
      el.querySelectorAll('#admin-points-sign button').forEach((x) => x.classList.toggle('is-active', x === b));
      el.querySelector('#admin-points-label').textContent = sign > 0 ? YU.t('admin.coins.award') : YU.t('admin.coins.deduct');
    };
    const saveBtn = el.querySelector('#admin-points-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-points-form'), f = U.formData(form), amount = Math.round(+f.amount), reason = f.reason.trim();
      fieldError(form, 'amount', amount > 0 ? '' : YU.t('admin.coins.error.amount'));
      fieldError(form, 'reason', reason ? '' : YU.t('admin.coins.error.reason'));
      if (!(amount > 0) || !reason) return;
      const balance = (YU.user(u.id) || u).balance;
      if (sign < 0 && amount > balance) return fieldError(form, 'amount', YU.t('admin.coins.error.max', { max: balance }));
      const r = await U.busy(saveBtn, () => YU.actions.adjustCoins(u.id, sign * amount, reason));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.modal.close();
      U.toast(sign > 0 ? YU.t('admin.coins.toast.awarded', { amount, name: u.name }) : YU.t('admin.coins.toast.deducted', { amount, name: u.name }), 'gold');
    };
  }
  function openBlockModal(id) {
    const u = YU.user(id); if (!u) return;
    const el = U.modal.open({
      title: YU.t('admin.block.title', { name: u.name }), sub: YU.t('admin.block.sub'),
      body: `<form id="admin-block-form"><div class="field"><label for="admin-block-reason">${YU.t('admin.block.reasonLabel')}</label><textarea class="textarea" id="admin-block-reason" name="reason" placeholder="${YU.t('admin.block.reasonPlaceholder')}"></textarea></div></form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-danger" id="admin-block-save">${icon('ban')}${YU.t('admin.action.block')}</button>`,
    });
    if (!el) return;
    const saveBtn = el.querySelector('#admin-block-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-block-form'), reason = U.formData(form).reason.trim();
      if (!reason) return fieldError(form, 'reason', YU.t('admin.block.error.reason'));
      const r = await U.busy(saveBtn, () => YU.actions.blockUser(u.id, reason));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.modal.close(); U.toast(YU.tText('admin.block.toast', { name: u.name }), 'ok', 'ban');
    };
  }
  async function unblock(id) {
    const u = YU.user(id); if (!u) return;
    if (!await U.confirm({ title: YU.t('admin.unblock.title', { name: u.name }), text: u.blockReason ? YU.t('admin.unblock.reason', { reason: u.blockReason }) : YU.t('admin.unblock.noReason'), ok: YU.t('admin.action.unblock') })) return;
    const r = await YU.actions.unblockUser(id);
    U.toast(r.ok ? YU.t('admin.unblock.toast', { name: u.name }) : r.error, r.ok ? 'ok' : 'bad');
  }

  // ---------- Departments
  const tonePicker = (selected) => `<div class="admin-tones" role="radiogroup" aria-label="${YU.t('admin.dept.toneLabel')}">${TONES.map((t) => `<label class="admin-tone tone-${t}" title="${t}"><input type="radio" name="tone" value="${t}" ${t === selected ? 'checked' : ''} class="sr-only"></label>`).join('')}</div>`;
  function departmentsRender() {
    const depts = YU.state.departments;
    if (!depts.length) return `<section class="panel">${U.empty({ icon: 'building-2', title: YU.t('admin.depts.empty.title'), text: YU.t('admin.depts.empty.text'), action: `<button class="btn btn-primary btn-sm" data-action="admin-dept-new">${YU.t('admin.depts.new')}</button>` })}</section>`;
    return `<div class="cards-3">${depts.map((d) => { const st = YU.select.deptStats(d.id); return `
      <section class="panel admin-dept">
        <div class="admin-dept-head tone-${esc(d.tone)}"><span class="admin-dept-mark">${esc(d.name.slice(0, 1))}</span></div>
        <div class="panel-body">
          <div class="h2">${esc(d.name)}</div><p class="small muted mt-8">${esc(d.desc)}</p>
          <div class="row gap-10 mt-16">${d.headName ? `<span class="kpi-icon tone-${U.safeTone(d.tone)}">${icon('user-round')}</span><span class="admin-cell"><div class="small truncate admin-head-name">${esc(headName(d))}</div><div class="micro muted">${YU.t('admin.dept.headRole')}</div></span>` : `<span class="kpi-icon tone-slate">${icon('user-minus')}</span><span class="small muted">${YU.t('admin.dept.noHead')}</span>`}</div>
          <div class="admin-dept-stats mt-16">
            <div><div class="kpi-value">${st.volunteers}</div><div class="micro muted">${YU.t('admin.dept.membersWord', { count: st.volunteers })}</div></div>
            <div><div class="kpi-value">${st.open}</div><div class="micro muted">${YU.t('admin.dept.openWord', { count: st.open })}</div></div>
            <div><div class="kpi-value">${st.pending}</div><div class="micro muted">${YU.t('admin.dept.pendingLabel')}</div></div>
          </div>
        </div>
        <div class="panel-foot"><span class="micro muted">${YU.t('admin.dept.approvedSemester', { count: st.approved })}</span><span class="row gap-6"><button class="btn btn-ghost btn-sm btn-icon" data-action="admin-dept-delete" data-id="${esc(d.id)}" aria-label="${YU.t('admin.dept.delete')}">${icon('trash-2')}</button><button class="btn btn-secondary btn-sm" data-action="admin-dept-edit" data-id="${esc(d.id)}">${icon('pencil')}${YU.t('admin.dept.edit')}</button></span></div>
      </section>`; }).join('')}</div>`;
  }
  const departmentsActions = () => `<button class="btn btn-primary" data-action="admin-dept-new">${icon('plus')}${YU.t('admin.depts.new')}</button>`;
  // Its missions have to go first; the people stay and merely lose the department (coordinators become volunteers)
  async function deleteDepartment(id) {
    const d = YU.dept(id); if (!d) return;
    const st = YU.select.deptStats(id), missions = YU.state.missions.filter((m) => m.deptId === id).length;
    if (missions) return U.toast(YU.tText('admin.dept.error.hasMissions', { count: missions }), 'bad');
    if (!await U.confirm({ title: YU.tText('admin.dept.deleteConfirm', { name: d.name }), text: YU.tText('admin.dept.deleteText', { count: st.volunteers }), ok: YU.tText('admin.dept.delete'), danger: true })) return;
    const r = await YU.actions.deleteDepartment(id);
    U.toast(r.ok ? YU.tText('admin.dept.toast.deleted', { name: d.name }) : r.error, r.ok ? 'ok' : 'bad');
  }
  function departmentsMount(root, params) {
    U.on(root, 'click', '[data-action="admin-dept-new"]', () => openDeptModal(null));
    U.on(root, 'click', '[data-action="admin-dept-edit"]', (e, el) => openDeptModal(el.dataset.id));
    U.on(root, 'click', '[data-action="admin-dept-delete"]', (e, el) => deleteDepartment(el.dataset.id));
    if (params.id && !U.modal.isOpen() && (params.id === 'new' || YU.dept(params.id))) { routeBase = '#/admin/departments'; openDeptModal(params.id === 'new' ? null : params.id); }
  }
  function openDeptModal(id) {
    const d = id ? YU.dept(id) : null; if (id && !d) return;
    // The coordinator is typed, not picked: the people who run the union need not have an account yet
    const el = U.modal.open({
      title: d ? YU.t('admin.dept.editTitle', { name: d.name }) : YU.t('admin.depts.new'), sub: d ? YU.t('admin.dept.editSub') : YU.t('admin.dept.newSub'),
      body: `<form id="admin-dept-form" class="col gap-14">
        <div class="field"><label for="admin-dept-name">${YU.t('admin.dept.nameLabel')}</label><input class="input" id="admin-dept-name" name="name" value="${esc(d ? d.raw.name : '')}" placeholder="${YU.t('admin.dept.namePlaceholder')}" maxlength="40"></div>
        <div class="field"><label for="admin-dept-desc">${YU.t('admin.dept.descLabel')}</label><input class="input" id="admin-dept-desc" name="desc" value="${esc(d ? d.raw.desc : '')}" placeholder="${YU.t('admin.dept.descPlaceholder')}" maxlength="80"></div>
        <div class="field"><label for="admin-dept-head">${YU.t('role.coordinator')}</label><input class="input" id="admin-dept-head" name="headName" value="${esc(d ? d.headName || '' : '')}" placeholder="${YU.t('admin.dept.headPlaceholder')}" maxlength="60" autocomplete="off"><span class="hint">${YU.t('admin.dept.headHint')}</span></div>
        <div class="field"><span class="label">${YU.t('admin.dept.toneFieldLabel')}</span>${tonePicker(d ? d.tone : 'slate')}</div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button><button class="btn btn-primary" id="admin-dept-save">${icon('check')}${d ? YU.t('admin.action.save') : YU.t('admin.dept.create')}</button>`,
    });
    if (!el) return;
    const saveBtn = el.querySelector('#admin-dept-save');
    saveBtn.onclick = async () => {
      const form = el.querySelector('#admin-dept-form'), f = U.formData(form), name = f.name.trim();
      if (!name) return fieldError(form, 'name', YU.t('admin.dept.error.name'));
      if (YU.state.departments.some((x) => x.id !== id && [x.name, x.raw.name].some((n) => n.toLowerCase() === name.toLowerCase()))) return fieldError(form, 'name', YU.t('admin.dept.error.duplicate'));
      const data = { name, desc: f.desc.trim(), tone: f.tone || 'slate', headName: f.headName.trim() };
      const r = await U.busy(saveBtn, () => (d ? YU.actions.updateDepartment(d.id, data) : YU.actions.createDepartment(data)));
      if (!r.ok) return U.toast(r.error, 'bad');
      U.modal.close(); leaveRoute();
      U.toast(d ? YU.t('admin.dept.toast.updated', { name }) : YU.t('admin.dept.toast.created', { name }), 'ok');
    };
  }

  // ---------- Audit log
  const AUDIT_DEFAULT = { q: '', actor: '', limit: AUDIT_PAGE };
  const auditUi = () => uiState('adminAudit', AUDIT_DEFAULT);
  // Entries written since migration 006 carry a message key and its raw params and read in the viewer's
  // language; older ones show the Russian they were recorded with. The object column has a key of its own
  // (<key>.target) only where it holds words to translate; otherwise it is names and titles as typed.
  // tr is YU.t for the table (its output is HTML-safe already) or YU.tText for plain-text search.
  const keyed = (tr, key, params) => { if (!key) return null; const out = tr(key, params); return out === key ? null : out; };
  // An entry's params read like the rest of the page. A name is a person's, except for a department, level
  // or semester, which is reference data in the viewer's language rather than a name to transliterate.
  const ref = (list, name) => { const row = (list || []).find((x) => x.raw && x.raw.name === name); return row ? row.name : name; };
  const auditParams = (key, params) => {
    const p = params || {};
    if (/^activity\.audit\.dept\./.test(key)) return { ...p, name: ref(YU.state.departments, p.name) };
    if (/^activity\.audit\.level\./.test(key)) return { ...p, name: ref(YU.state.levels, p.name) };
    if (/^activity\.audit\.semester\./.test(key)) return p;
    return YU.activityParams(p);
  };
  // An entry recorded before keys existed is matched back to its key through the Russian templates
  const auditAction = (a, tr) => {
    if (a.actionKey) return keyed(tr, a.actionKey, auditParams(a.actionKey, a.params));
    const old = YU.i18n.legacy('activity.audit.', a.action);
    return old ? keyed(tr, old.key, auditParams(old.key, old.params)) : null;
  };
  const auditTarget = (a, tr) => keyed(tr, a.actionKey && `${a.actionKey}.target`, auditParams(a.actionKey, a.params));
  // The object column as plain text, rebuilt from what the entry recorded in the shapes the server writes
  // (a person, «a title», a person — «a title», a person — a reason), so a person reads in the viewer's
  // script and a title in the viewer's language. Older entries are read back from the stored text.
  const QUOTED_TITLE = /^activity\.audit\.(mission|news|reward)\./;
  function auditObject(a) {
    const own = auditTarget(a, YU.tText);
    if (own) return own;
    if (a.actionKey && a.params && !a.params.fields && !a.params.email) {
      const p = auditParams(a.actionKey, a.params);
      if (p.name && p.title) return `${p.name} — «${p.title}»`;
      if (p.name && p.reason) return `${p.name} — ${p.reason}`;
      if (p.title) return QUOTED_TITLE.test(a.actionKey) ? `«${p.title}»` : p.title;
      if (p.name) return p.name;
    }
    const t = a.target || '';
    let m = /^(.+?) — «(.+)»$/su.exec(t);
    if (m) { const p = YU.activityParams({ name: m[1], title: m[2] }); return `${p.name} — «${p.title}»`; }
    m = /^«(.+)»$/su.exec(t);
    if (m) return `«${YU.activityParams({ title: m[1] }).title}»`;
    m = /^(.+?) — (.+)$/su.exec(t);
    if (m) return `${YU.activityParams({ name: m[1] }).name} — ${m[2]}`;
    return t;
  }
  const auditRows = (st) => {
    const q = st.q.trim().toLowerCase();
    return YU.state.audit.filter((a) => {
      const u = YU.user(a.actorId);
      return (!st.actor || a.actorId === st.actor) && has(q, auditAction(a, YU.tText) ?? a.action, auditObject(a), a.target, u && u.name, u && u.raw && u.raw.name);
    })
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  };
  function auditTable(st) {
    const rows = auditRows(st), shown = rows.slice(0, st.limit);
    if (!rows.length) return U.empty({ icon: 'history', title: YU.t('admin.audit.empty.title'), text: YU.t('admin.audit.empty.text'), action: `<button class="btn btn-secondary btn-sm" data-action="admin-audit-reset">${YU.t('admin.filters.reset')}</button>` });
    return `<div class="table-wrap"><table class="table is-compact is-stack"><thead><tr><th>${YU.t('admin.audit.col.when')}</th><th>${YU.t('admin.audit.col.who')}</th><th>${YU.t('admin.audit.col.action')}</th><th>${YU.t('admin.audit.col.target')}</th></tr></thead><tbody>
      ${shown.map((a) => { const u = YU.user(a.actorId); return `<tr><td class="small muted admin-nowrap">${esc(fmtDate(a.at, { time: true }))}</td><td>${u ? U.userLine(u, YU.roleName(u.role)) : `<span class="muted">${a.actorName ? esc(YU.i18n.personName(a.actorName)) : YU.t('admin.audit.system')}</span>`}</td><td>${auditAction(a, YU.t) ?? esc(a.action)}</td><td class="small muted-2">${esc(auditObject(a))}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="panel-foot"><span class="small muted">${YU.t('admin.audit.shown', { shown: shown.length, total: rows.length })}</span>${rows.length > shown.length ? `<button class="btn btn-secondary btn-sm" data-action="admin-audit-more">${YU.t('admin.audit.more')}</button>` : ''}</div>`;
  }
  function auditRender() {
    const st = auditUi();
    const actors = [...new Set(YU.state.audit.map((a) => a.actorId))].map((id) => YU.user(id)).filter(Boolean).sort(byName);
    return `<div class="admin-toolbar">
        <div class="search">${icon('search')}<input class="input" data-admin-audit="q" placeholder="${YU.t('admin.audit.searchPlaceholder')}" value="${esc(st.q)}" autocomplete="off" aria-label="${YU.t('admin.audit.searchLabel')}"></div>
        <select class="select" data-admin-audit="actor" aria-label="${YU.t('admin.audit.actorFilter')}"><option value="">${YU.t('admin.audit.allActors')}</option>${options(actors, st.actor)}</select>
      </div>
      <section class="panel">
        <div class="panel-head"><span class="h2">${YU.t('admin.section.audit')}</span><span class="small muted">${YU.t('admin.audit.count', { count: YU.state.audit.length })}</span></div>
        <div id="admin-audit-table" class="mt-12">${auditTable(st)}</div>
      </section>`;
  }
  function auditMount(root) {
    const redraw = () => { const box = root.querySelector('#admin-audit-table'); if (!box) return; box.innerHTML = auditTable(auditUi()); U.refreshIcons(); };
    U.on(root, 'input', 'input[data-admin-audit="q"]', U.debounce((e, el) => { const st = auditUi(); st.q = el.value; st.limit = AUDIT_PAGE; redraw(); }, 150));
    U.on(root, 'change', 'select[data-admin-audit="actor"]', (e, el) => { const st = auditUi(); st.actor = el.value; st.limit = AUDIT_PAGE; redraw(); });
    U.on(root, 'click', '[data-action="admin-audit-more"]', () => { auditUi().limit += AUDIT_PAGE; redraw(); });
    U.on(root, 'click', '[data-action="admin-audit-reset"]', () => { Object.assign(auditUi(), AUDIT_DEFAULT); YU.router.refresh(); });
  }

  // ---------- Settings
  function settingsRender() {
    const s = YU.state.settings;
    const row = (label, hint, control) => `<div class="list-item"><span class="grow"><div class="list-title">${label}</div><div class="list-sub">${hint}</div></span>${control}</div>`;
    const sw = (key, label, hint) => row(label, hint, `<button type="button" class="switch ${s[key] ? 'is-on' : ''}" role="switch" aria-checked="${!!s[key]}" aria-label="${label}" data-action="admin-switch" data-key="${key}"></button>`);
    const num = (key, label, hint, attrs) => row(label, hint, `<span class="field admin-num"><input class="input input-sm num" type="number" name="${key}" value="${esc(s[key])}" ${attrs} aria-label="${label}"></span>`);
    const panel = (title, rows) => `<section class="panel"><div class="panel-head"><span class="h2">${title}</span></div><div class="list mt-12">${rows}</div></section>`;
    return `<form id="admin-settings" class="admin-settings col gap-20">
      ${panel(YU.t('admin.settings.registration'), sw('registrationOpen', YU.t('admin.settings.registrationOpen'), YU.t('admin.settings.registrationOpenHint')) + row(YU.t('admin.settings.domainLabel'), YU.t('admin.settings.domainHint'), `<span class="field admin-domain"><input class="input input-sm" name="allowedDomain" value="${esc(s.allowedDomain)}" placeholder="student.inha.uz" aria-label="${YU.t('admin.settings.domainLabel')}"></span>`))}
      ${panel(YU.t('admin.settings.coinsLimits'), num('maxActiveMissions', YU.t('admin.settings.maxActiveMissions'), YU.t('admin.settings.maxActiveMissionsHint'), 'min="1" max="10"') + num('latePenaltyPct', YU.t('admin.settings.latePenalty'), YU.t('admin.settings.latePenaltyHint'), 'min="0" max="100"') + num('maxMissionCoins', YU.t('admin.settings.maxMissionCoins'), YU.t('admin.settings.maxMissionCoinsHint'), 'min="5" max="1000"'))}
      ${panel(YU.t('admin.settings.news'), row(YU.t('admin.settings.newsDept'), YU.t('admin.settings.newsDeptHint'), `<span class="field admin-domain"><select class="select input-sm" name="newsDeptId" aria-label="${YU.t('admin.settings.newsDept')}">${deptOptions(s.newsDeptId || '', YU.t('admin.settings.newsDeptNone'))}</select></span>`))}
      <div class="row-between wrap"><span class="small muted">${YU.t('admin.settings.note')}</span><button type="submit" class="btn btn-primary" id="admin-settings-save">${icon('check')}${YU.t('admin.settings.save')}</button></div>
    </form>
    <section class="panel mt-24"><div class="panel-head"><span class="h2">${YU.t('admin.semester.title')}</span><span class="small muted">${YU.t('admin.semester.current', { name: YU.state.org.semester, date: fmtDate(YU.state.org.semesterStart, { year: true }) })}</span></div>
      <form id="admin-semester" class="panel-body row gap-10 wrap" novalidate>
        <span class="field admin-semester-name"><input class="input input-sm" name="name" maxlength="40" placeholder="${YU.t('admin.semester.placeholder')}" aria-label="${YU.t('admin.semester.nameLabel')}"></span>
        <button type="submit" class="btn btn-secondary btn-sm" id="admin-semester-start">${icon('calendar-plus')}${YU.t('admin.semester.start')}</button>
        <span class="small muted">${YU.t('admin.semester.note')}</span>
      </form>
    </section>`;
  }
  async function startSemester(form) {
    const name = String(U.formData(form).name || '').trim();
    if (!name) return fieldError(form, 'name', YU.t('admin.semester.error.name'));
    fieldError(form, 'name', '');
    if (!await U.confirm({ title: YU.t('admin.semester.confirm.title', { name }), text: YU.t('admin.semester.confirm.text'), ok: YU.t('admin.semester.confirm.ok') })) return;
    const r = await U.busy(form.querySelector('#admin-semester-start'), () => YU.actions.startSemester(name));
    U.toast(r.ok ? YU.t('admin.semester.toast', { name }) : r.error, r.ok ? 'ok' : 'bad');
  }
  async function saveSettings(form) {
    const f = U.formData(form);
    const patch = { allowedDomain: f.allowedDomain.trim().toLowerCase(), maxActiveMissions: +f.maxActiveMissions, latePenaltyPct: +f.latePenaltyPct, maxMissionCoins: +f.maxMissionCoins, newsDeptId: f.newsDeptId || null };
    form.querySelectorAll('[data-action="admin-switch"]').forEach((el) => { patch[el.dataset.key] = el.classList.contains('is-on'); });
    const inRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    // min and max mirror the input attributes, so they stay as written instead of being grouped like a counted number
    const range = (min, max) => YU.t('admin.settings.error.range', { min: String(min), max: String(max) });
    const checks = [
      // Empty opens sign-up to any address
      ['allowedDomain', /^([a-z0-9.-]+\.[a-z]{2,})?$/.test(patch.allowedDomain), YU.t('admin.settings.error.domain')],
      ['maxActiveMissions', inRange(patch.maxActiveMissions, 1, 10), range(1, 10)],
      ['latePenaltyPct', inRange(patch.latePenaltyPct, 0, 100), range(0, 100)],
      ['maxMissionCoins', inRange(patch.maxMissionCoins, 5, 1000), range(5, 1000)],
    ];
    checks.forEach(([name, ok, msg]) => fieldError(form, name, ok ? '' : msg));
    if (checks.some(([, ok]) => !ok)) return U.toast(YU.tText('admin.settings.error.fields'), 'bad');
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => YU.state.settings[k] !== v));
    if (!Object.keys(changed).length) return U.toast(YU.tText('admin.settings.noChanges'), 'info');
    const r = await U.busy(form.querySelector('#admin-settings-save'), () => YU.actions.updateSettings(changed));
    U.toast(r.ok ? YU.t('admin.settings.toast.saved') : r.error, r.ok ? 'ok' : 'bad');
  }
  function settingsMount(root) {
    U.on(root, 'click', '[data-action="admin-switch"]', (e, el) => { const on = !el.classList.contains('is-on'); el.classList.toggle('is-on', on); el.setAttribute('aria-checked', String(on)); });
    U.on(root, 'submit', '#admin-settings', (e, form) => { e.preventDefault(); saveSettings(form); });
    U.on(root, 'submit', '#admin-semester', (e, form) => { e.preventDefault(); startSemester(form); });
  }

  YU.adminSections.push(
    { id: 'overview', title: () => YU.t('admin.section.overview'), icon: 'layout-dashboard', order: 10, render: overviewRender, actions: overviewActions },
    { id: 'users', title: () => YU.t('admin.section.users'), icon: 'users', order: 20, render: usersRender, mount: usersMount },
    { id: 'departments', title: () => YU.t('admin.section.departments'), icon: 'building-2', order: 40, render: departmentsRender, mount: departmentsMount, actions: departmentsActions },
    { id: 'audit', title: () => YU.t('admin.section.audit'), icon: 'history', order: 90, render: auditRender, mount: auditMount },
    { id: 'settings', title: () => YU.t('admin.section.settings'), icon: 'settings', order: 100, render: settingsRender, mount: settingsMount },
  );
})();

;
/* js/screens/admin-content.js */
/* Admin content sections — missions, news, rewards, coins & levels.
   Each one is pushed into YU.adminSections and rendered by the admin shell inside its content column. */
(function () {
  const U = YU.ui, A = YU.actions;
  const { esc, icon, avatar, coins, progress, deptChip, missionStatusPill, pill, chip, fmtNum, deadline, fmtDate, relDay } = U;
  YU.adminSections = YU.adminSections || [];
  const TONES = YU.TONES;
  // Category and status lists read the catalogue on every call: the locale can change between renders
  // Categories are stored as the canonical values in constants.js and only labelled per language
  const NEWS_CATS = () => Object.keys(YU.NEWS_CATEGORIES);
  const REWARD_CATS = () => Object.keys(YU.REWARD_CATEGORIES);
  const DEFAULT_NEWS_CAT = NEWS_CATS()[0], DEFAULT_REWARD_CAT = REWARD_CATS()[0];
  const newsCatPairs = (list) => list.map((c) => [c, YU.newsCategoryLabel(c)]);
  const rewardCatPairs = (list) => list.map((c) => [c, YU.rewardCategoryLabel(c)]);
  const REWARD_ICONS = ['shirt', 'coffee', 'sticker', 'award', 'ticket', 'map-pinned', 'utensils', 'graduation-cap', 'battery-charging', 'gift', 'star', 'medal'];
  const BADGE_ICONS = ['footprints', 'camera', 'flame', 'sunrise', 'star', 'medal', 'trophy', 'graduation-cap', 'heart-handshake', 'party-popper', 'award', 'shield', 'sparkles'];
  const TASK_STATUSES = () => [['', YU.t('adminContent.filter.anyStatus')], ['open', YU.t('mission.status.open')], ['draft', YU.t('mission.status.draft')], ['closed', YU.t('mission.status.closed')], ['archived', YU.t('mission.status.archived')]];
  const DAY = 86400000;

  // ---------- Shared helpers
  const base = (section) => `#/admin/${section}`;
  const goBack = (section) => { if (location.hash.startsWith(`${base(section)}/`)) location.hash = base(section); };
  // Awaits an action and reports it. An empty error means the button was already busy, so nothing is shown.
  const done = async (pending, msg, kind = 'ok') => {
    const r = await pending;
    if (!r.ok) { if (r.error !== '') U.toast(r.error || YU.t('error.generic'), 'bad'); return false; }
    if (msg) U.toast(typeof msg === 'function' ? msg(r) : msg, kind);
    return true;
  };
  // People who earn coins, levels and badges: every active account except admins, who run the union
  const participants = () => YU.state.users.filter((u) => u.status === 'active' && YU.participates(u)).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const userPairs = () => participants().map((u) => [u.id, `${u.name}, ${u.group}`]);
  const withExtra = (list, extra) => [...new Set([...list, ...extra])];
  const userCell = (u) => `<span class="cell-user">${avatar(u, 'avatar-sm')}<span class="small truncate">${esc(u ? u.name : '—')}</span></span>`;
  const menuBtn = (id) => `<button class="btn btn-ghost btn-sm btn-icon" data-menu="${id}" aria-label="${YU.t('adminContent.menu.label')}">${icon('more-horizontal')}</button>`;

  // Per-section UI state. Query keys (#/admin/missions?status=draft) override it once per distinct query string
  const uiState = (key, defaults, query, keys) => {
    const st = YU.state.ui[key] || (YU.state.ui[key] = { ...defaults });
    const given = keys.filter((k) => query[k] !== undefined);
    const sig = given.map((k) => `${k}=${query[k]}`).join('&');
    if (given.length && st.seenQuery !== sig) { given.forEach((k) => { st[k] = query[k]; }); st.seenQuery = sig; }
    return st;
  };
  // Section root is a fresh element every render, so delegated listeners never pile up on #view
  const sectionBox = (root, cls) => { const box = root.querySelector(`.${cls}`) || root; U.on(box, 'submit', 'form', (e) => e.preventDefault()); return box; };
  const noMatch = () => U.empty({ icon: 'search', title: YU.t('adminContent.noMatch.title'), text: YU.t('adminContent.noMatch.text'), action: `<button class="btn btn-secondary btn-sm" data-act="reset">${YU.t('adminContent.noMatch.reset')}</button>` });
  // Toolbar filters re-render through YU.emit; the search box keeps its caret across the re-render
  const wireFilters = (box, st, defaults) => {
    U.on(box, 'change', 'select[data-filter]', (e, el) => { st[el.dataset.filter] = el.value; YU.emit('change'); });
    U.on(box, 'input', 'input[data-filter="q"]', (e, el) => { st.q = el.value; st.caret = el.selectionStart; st.refocus = true; YU.emit('change'); });
    U.on(box, 'click', '[data-act="reset"]', () => { Object.assign(st, defaults); YU.emit('change'); });
    if (st.refocus) { st.refocus = false; const i = box.querySelector('input[data-filter="q"]'); if (i) { i.focus(); i.setSelectionRange(st.caret, st.caret); } }
  };

  // Form atoms. Labels wrap their control, so no ids are needed and duplicates across page + modal are impossible
  const opts = (pairs, cur) => pairs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const input = (name, value = '', attrs = '') => `<input class="input" name="${name}" value="${esc(value)}" ${attrs}>`;
  const textarea = (name, value = '', attrs = '', cls = '') => `<textarea class="textarea ${cls}" name="${name}" ${attrs}>${esc(value)}</textarea>`;
  const select = (name, pairs, cur) => `<select class="select" name="${name}">${opts(pairs, cur)}</select>`;
  const field = (label, control, hint = '', wrap = true) => `<div class="field">${wrap ? `<label>${esc(label)}${control}</label>` : `<span class="label">${esc(label)}</span>${control}`}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
  const seg = (name, pairs, cur) => `<div class="seg" data-seg="${name}">${pairs.map(([v, l]) => `<button type="button" class="${v === cur ? 'is-active' : ''}" data-val="${v}">${esc(l)}</button>`).join('')}<input type="hidden" name="${name}" value="${esc(cur)}"></div>`;
  const toggle = (name, on, text) => `<div class="row gap-10"><button type="button" class="switch ${on ? 'is-on' : ''}" data-switch role="switch" aria-checked="${on}" aria-label="${esc(text)}"></button><input type="hidden" name="${name}" value="${on ? '1' : ''}"><span class="small muted">${esc(text)}</span></div>`;
  const tonePicker = (cur) => `<div class="adminc-swatches" role="radiogroup" aria-label="${YU.t('adminContent.label.color')}">${TONES.map((t) => `<label class="adminc-swatch tone-${t}" title="${t}"><input type="radio" name="tone" value="${t}" aria-label="${t}"${t === cur ? ' checked' : ''}><i></i></label>`).join('')}</div>`;
  const iconPicker = (list, cur) => `<div class="adminc-icons" role="radiogroup" aria-label="${YU.t('adminContent.label.icon')}">${list.map((i) => `<label class="adminc-icon-opt" title="${i}"><input type="radio" name="icon" value="${i}" aria-label="${i}"${i === cur ? ' checked' : ''}><span>${icon(i)}</span></label>`).join('')}</div>`;

  // Inline validation: errors = { fieldName: message }. Returns true when the form is clean
  const showErrors = (form, errors) => {
    U.$$('.field .error', form).forEach((e) => e.remove());
    U.$$('.is-invalid', form).forEach((e) => e.classList.remove('is-invalid'));
    Object.entries(errors).forEach(([name, msg]) => {
      const ctl = form.querySelector(`[name="${name}"]`); if (!ctl) return;
      ctl.classList.add('is-invalid');
      const f = ctl.closest('.field'); if (f) f.insertAdjacentHTML('beforeend', `<span class="error">${esc(msg)}</span>`);
    });
    const first = form.querySelector('.is-invalid'); if (first) first.focus();
    return !Object.keys(errors).length;
  };
  // Drawer/modal wiring. Handlers are assigned, not added: #drawer and #modal are reused between openings
  const wire = (el, acts, onInput) => {
    el.onsubmit = (e) => e.preventDefault();
    el.onclick = (e) => {
      const sb = e.target.closest('[data-seg] button');
      if (sb) { const box = sb.closest('[data-seg]'); U.$$('button', box).forEach((b) => b.classList.toggle('is-active', b === sb)); box.querySelector('input').value = sb.dataset.val; if (onInput) onInput(); }
      const sw = e.target.closest('[data-switch]');
      if (sw) { const on = sw.classList.toggle('is-on'); sw.setAttribute('aria-checked', on); sw.nextElementSibling.value = on ? '1' : ''; if (onInput) onInput(); }
      const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](b);
    };
    el.oninput = onInput || null; el.onchange = onInput || null;
  };
  // Live art preview inside reward/badge modals
  const previewArt = (el) => {
    const art = el.querySelector('.adminc-art-preview'); if (!art) return;
    const pick = (n) => { const c = el.querySelector(`[name="${n}"]:checked`); return c ? c.value : ''; };
    art.className = `${art.dataset.base} adminc-art-preview tone-${U.safeTone(pick('tone') || 'navy')}`;
    art.innerHTML = icon(pick('icon') || 'gift');
    U.refreshIcons();
  };

  // Route-bound layers (#/admin/<section>/<id>): opened from mount once, hash returns to the section when they close by any means
  let layerFor = null, watcher = null;
  const openLayer = (kind, section, id, via, o) => {
    const el = U[kind].open(o); if (!el) return null;
    layerFor = via ? `${section}/${id}` : null;
    if (via) {
      const host = U.$(kind === 'drawer' ? '#drawer' : '#modal-wrap');
      if (watcher) watcher.disconnect();
      watcher = new MutationObserver(() => { if (!host.hidden) return; watcher.disconnect(); watcher = null; layerFor = null; goBack(section); });
      watcher.observe(host, { attributes: true, attributeFilter: ['hidden'] });
    }
    return el;
  };
  const routeLayer = (params, section, kind, open) => {
    if (!params.id) return;
    if (U[kind].isOpen() && layerFor === `${section}/${params.id}`) return;
    open(params.id, true);
  };
  const closeLayer = (kind, section) => { U[kind].close(); goBack(section); };
  const footer = (extra) => `<button class="btn btn-secondary" data-close-layer>${YU.t('action.cancel')}</button>${extra}`;

  // ---------- Missions
  const TASK_DEFAULTS = { q: '', dept: '', status: '' };
  const taskRow = (t) => {
    const dl = deadline(t.deadline), taken = YU.select.seatsTaken(t.id), live = t.status === 'open' || t.status === 'draft';
    return `<tr>
      <td class="adminc-title-cell"><a class="adminc-link" href="#/missions/${t.id}">${esc(t.title)}</a><div class="adminc-sub">${deptChip(t.deptId)}</div></td>
      <td>${missionStatusPill(t.status)}</td>
      <td>${coins(t.coins)}</td>
      <td><div class="adminc-seats"><span class="num small">${YU.t('adminContent.missions.seatsOf', { taken, seats: t.seats })}</span>${progress(taken, t.seats, 'is-thin')}</div></td>
      <td class="small ${live && dl.tone === 'bad' ? 'text-bad' : live && dl.tone === 'warn' ? 'text-warn' : 'muted'}">${esc(live ? dl.label : fmtDate(t.deadline))}</td>
      <td>${userCell(YU.user(t.createdBy))}</td>
      <td class="ta-right">${menuBtn(t.id)}</td>
    </tr>`;
  };
  function tasksRender(params) {
    const st = uiState('admincTasks', TASK_DEFAULTS, params.query || {}, ['dept', 'status']);
    const all = YU.state.missions, count = (s) => all.filter((t) => t.status === s).length, q = st.q.trim().toLowerCase();
    const rows = all.filter((t) => (!st.dept || t.deptId === st.dept) && (!st.status || t.status === st.status) && (!q || `${t.title} ${t.raw ? t.raw.title : ''}`.toLowerCase().includes(q)))
      .slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `<div class="adminc adminc-missions">
      <div class="adminc-head">
        <div><div class="h2">${YU.t('nav.missions')}</div><div class="row gap-8 wrap mt-8">${pill(YU.t('adminContent.missions.statOpen', { count: count('open') }), 'ok')}${pill(YU.t('adminContent.missions.statDrafts', { count: count('draft') }), 'warn')}${pill(YU.t('adminContent.missions.statClosed', { count: count('closed') }), 'neutral')}${pill(YU.t('adminContent.missions.statPending', { count: YU.select.pendingReviews().length }), 'info')}</div></div>
        <a class="btn btn-primary" href="#/admin/missions/new">${icon('plus')}${YU.t('adminContent.missions.new')}</a>
      </div>
      <div class="adminc-toolbar">
        <label class="search">${icon('search')}<input class="input" data-filter="q" value="${esc(st.q)}" placeholder="${YU.t('adminContent.missions.searchPlaceholder')}" aria-label="${YU.t('adminContent.label.search')}"></label>
        <select class="select" data-filter="dept" aria-label="${YU.t('adminContent.label.dept')}">${opts([['', YU.t('adminContent.filter.allDepts')], ...YU.state.departments.map((d) => [d.id, d.name])], st.dept)}</select>
        <select class="select" data-filter="status" aria-label="${YU.t('adminContent.label.status')}">${opts(TASK_STATUSES(), st.status)}</select>
      </div>
      <section class="panel">${rows.length ? `<div class="table-wrap"><table class="table is-stack"><thead><tr><th>${YU.t('adminContent.missions.thMission')}</th><th>${YU.t('adminContent.label.status')}</th><th>${YU.t('adminContent.label.coins')}</th><th>${YU.t('adminContent.missions.thSeats')}</th><th>${YU.t('adminContent.label.deadline')}</th><th>${YU.t('adminContent.label.author')}</th><th></th></tr></thead><tbody>${rows.map(taskRow).join('')}</tbody></table></div>`
        : all.length ? noMatch() : U.empty({ icon: 'clipboard-list', title: YU.t('adminContent.missions.empty.title'), text: YU.t('adminContent.missions.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/admin/missions/new">${YU.t('adminContent.missions.new')}</a>` })}</section>
    </div>`;
  }
  function taskMenu(el, t) {
    if (!t) return;
    U.menu(el, [
      { label: YU.t('adminContent.action.open'), icon: 'eye', onClick: () => { location.hash = `#/missions/${t.id}`; } },
      { label: YU.t('adminContent.action.edit'), icon: 'pencil', onClick: () => { location.hash = `#/admin/missions/${t.id}`; } },
      ...(t.status === 'draft' ? [{ label: YU.t('adminContent.action.publish'), icon: 'send', onClick: () => done(A.publishTask(t.id), YU.t('adminContent.missions.published')) }] : []),
      ...(t.status === 'open' ? [{ label: YU.t('action.close'), icon: 'lock', onClick: () => done(A.closeTask(t.id), YU.t('adminContent.missions.closed')) }] : []),
      'sep',
      { label: YU.t('adminContent.action.delete'), icon: 'trash-2', danger: true, onClick: async () => { if (await U.confirm({ title: YU.t('adminContent.missions.deleteTitle'), text: YU.t('adminContent.missions.deleteText', { title: t.title }), ok: YU.t('adminContent.action.delete'), danger: true })) done(A.deleteTask(t.id), (r) => (r.archived ? YU.t('adminContent.missions.archived') : YU.t('adminContent.missions.deleted'))); } },
    ]);
  }
  // Shared mission form (same fields as the coordinator screen, §6)
  const taskForm = (t) => `<form class="adminc-form" id="task-form">
      ${field(YU.t('adminContent.label.name'), input('title', t.title, `placeholder="${YU.t('adminContent.missions.titlePlaceholder')}" maxlength="120"`))}
      <div class="form-grid">
        ${field(YU.t('adminContent.label.dept'), select('deptId', [['', YU.t('adminContent.missions.pickDept')], ...YU.state.departments.map((d) => [d.id, d.name])], t.deptId))}
        ${field(YU.t('adminContent.missions.locationLabel'), input('location', t.location, `placeholder="${YU.t('adminContent.missions.locationPlaceholder')}"`))}
      </div>
      ${field(YU.t('adminContent.label.description'), textarea('description', t.description, `placeholder="${YU.t('adminContent.missions.descriptionPlaceholder')}" rows="4"`))}
      <div class="form-grid">
        ${field(YU.t('adminContent.label.coins'), input('coins', t.coins ?? 30, 'type="number" min="0" step="5"'))}
        ${field(YU.t('adminContent.missions.seatsLabel'), input('seats', t.seats ?? 1, 'type="number" min="1"'))}
        ${field(YU.t('adminContent.label.deadline'), input('deadline', U.toInputValue(t.deadline || new Date(YU.now().getTime() + 7 * DAY)), 'type="datetime-local"'))}
        ${field(YU.t('adminContent.missions.proofLabel'), seg('proofType', [['photo', YU.t('adminContent.missions.proof.photo')], ['link', YU.t('adminContent.missions.proof.link')], ['text', YU.t('adminContent.missions.proof.text')]], t.proofType || 'photo'), '', false)}
      </div>
      ${field(YU.t('adminContent.missions.requirementsLabel'), textarea('requirements', (t.requirements || []).join('\n'), `placeholder="${YU.t('adminContent.missions.requirementsPlaceholder')}" rows="3"`, 'adminc-short'), YU.t('adminContent.missions.requirementsHint'))}
    </form>`;
  function readTaskForm(form, publish) {
    const f = U.formData(form), errors = {}, when = U.fromInputValue(f.deadline);
    if (!f.title.trim()) errors.title = YU.t('adminContent.missions.errTitle');
    if (!f.deptId) errors.deptId = YU.t('adminContent.missions.pickDept');
    if (f.coins === '' || !(+f.coins >= 0)) errors.coins = YU.t('adminContent.missions.errCoins');
    if (!(+f.seats >= 1)) errors.seats = YU.t('adminContent.missions.errSeats');
    if (!when) errors.deadline = YU.t('adminContent.missions.errDeadline');
    else if (publish && when < YU.now()) errors.deadline = YU.t('adminContent.missions.errDeadlinePast');
    if (!showErrors(form, errors)) return null;
    return { title: f.title.trim(), deptId: f.deptId, description: f.description.trim(), coins: Math.round(+f.coins), seats: Math.round(+f.seats), deadline: when.toISOString(),
      location: f.location.trim(), proofType: f.proofType, requirements: f.requirements.split('\n').map((s) => s.trim()).filter(Boolean) };
  }
  function openTaskForm(id) {
    const isNew = id === 'new', t = isNew ? {} : YU.mission(id);
    if (!t) { U.toast(YU.tText('adminContent.missions.notFound'), 'bad'); goBack('missions'); return; }
    const isDraft = isNew || t.status === 'draft';
    const el = openLayer('drawer', 'missions', id, true, {
      title: isNew ? YU.t('adminContent.missions.new') : esc(t.title),
      sub: isNew ? YU.t('adminContent.missions.newSub') : `<span class="row gap-8">${deptChip(t.deptId)}${missionStatusPill(t.status)}</span>`,
      body: taskForm(isNew ? t : YU.sourceOf(t)) + (isNew ? '' : YU.contentTranslations.panel('mission', t)),
      foot: footer(isDraft ? `<button class="btn btn-secondary" data-act="draft">${icon('file-pen-line')}${YU.t('adminContent.action.saveDraft')}</button><button class="btn btn-primary" data-act="publish">${icon('send')}${YU.t('adminContent.action.publish')}</button>` : `<button class="btn btn-primary" data-act="save">${icon('check')}${YU.t('adminContent.action.save')}</button>`),
    });
    if (!el) return;
    if (!isNew) YU.contentTranslations.mount(el, 'mission', t);
    const submit = async (status, btn) => {
      const data = readTaskForm(el.querySelector('#task-form'), status === 'open'); if (!data) return;
      const pending = U.busy(btn, () => (isNew ? A.createTask({ ...data, status }) : A.updateTask(id, status ? { ...data, status } : data)));
      if (await done(pending, status === 'draft' ? YU.t('adminContent.toast.draftSaved') : status === 'open' ? YU.t('adminContent.missions.published') : YU.t('adminContent.missions.saved'))) closeLayer('drawer', 'missions');
    };
    wire(el, { draft: (b) => submit('draft', b), publish: (b) => submit('open', b), save: (b) => submit(null, b) });
  }
  function tasksMount(root, params) {
    const box = sectionBox(root, 'adminc-missions');
    wireFilters(box, YU.state.ui.admincTasks, TASK_DEFAULTS);
    U.on(box, 'click', '[data-menu]', (e, el) => taskMenu(el, YU.mission(el.dataset.menu)));
    routeLayer(params, 'missions', 'drawer', openTaskForm);
  }

  // ---------- News
  const NEWS_DEFAULTS = { q: '', cat: '', status: '' };
  const newsRow = (n) => `<tr>
      <td class="stack-hide"><span class="adminc-cover tone-${U.safeTone(n.tone)}" aria-hidden="true"></span></td>
      <td class="adminc-title-cell stack-lead">${n.pinned ? icon('pin', 'adminc-pin') : ''}<a class="adminc-link" href="#/news/${n.id}">${esc(n.title)}</a></td>
      <td>${chip(YU.newsCategoryLabel(n.category))}</td>
      <td>${n.status === 'published' ? pill(YU.t('adminContent.news.statusPublished'), 'ok') : pill(YU.t('mission.status.draft'), 'warn')}</td>
      <td>${userCell(YU.user(n.authorId))}</td>
      <td class="small muted">${n.publishedAt ? esc(fmtDate(n.publishedAt)) : '—'}</td>
      <td class="num">${fmtNum(n.views)}</td><td class="num">${fmtNum(n.likes)}</td>
      <td class="ta-right">${menuBtn(n.id)}</td>
    </tr>`;
  function newsRender(params) {
    const st = uiState('admincNews', NEWS_DEFAULTS, params.query || {}, ['cat', 'status']);
    const all = YU.state.news, q = st.q.trim().toLowerCase();
    const cats = withExtra(NEWS_CATS(), all.map((n) => n.category));
    const rows = all.filter((n) => (!st.cat || n.category === st.cat) && (!st.status || n.status === st.status) && (!q || `${n.title} ${n.raw ? n.raw.title : ''}`.toLowerCase().includes(q)))
      .slice().sort((a, b) => (b.pinned - a.pinned) || ((b.status === 'draft') - (a.status === 'draft')) || (new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)));
    const drafts = all.filter((n) => n.status === 'draft').length;
    return `<div class="adminc adminc-news">
      <div class="adminc-head">
        <div><div class="h2">${YU.t('nav.news')}</div><div class="small muted mt-8">${YU.t('adminContent.news.inFeed', { count: all.length - drafts })}${drafts ? `, ${YU.t('adminContent.news.draftsWaiting', { count: drafts })}` : ''}</div></div>
        <a class="btn btn-primary" href="#/admin/news/new">${icon('plus')}${YU.t('adminContent.news.new')}</a>
      </div>
      <div class="adminc-toolbar">
        <label class="search">${icon('search')}<input class="input" data-filter="q" value="${esc(st.q)}" placeholder="${YU.t('adminContent.news.searchPlaceholder')}" aria-label="${YU.t('adminContent.label.search')}"></label>
        <select class="select" data-filter="cat" aria-label="${YU.t('adminContent.label.category')}">${opts([['', YU.t('adminContent.filter.allCategories')], ...newsCatPairs(cats)], st.cat)}</select>
        <select class="select" data-filter="status" aria-label="${YU.t('adminContent.label.status')}">${opts([['', YU.t('adminContent.filter.anyStatus')], ['published', YU.t('adminContent.news.statusPublished')], ['draft', YU.t('mission.status.draft')]], st.status)}</select>
      </div>
      <section class="panel">${rows.length ? `<div class="table-wrap"><table class="table is-stack"><thead><tr><th></th><th>${YU.t('adminContent.label.heading')}</th><th>${YU.t('adminContent.label.category')}</th><th>${YU.t('adminContent.label.status')}</th><th>${YU.t('adminContent.label.author')}</th><th>${YU.t('adminContent.label.date')}</th><th class="num">${YU.t('adminContent.news.thViews')}</th><th class="num">${YU.t('adminContent.news.thLikes')}</th><th></th></tr></thead><tbody>${rows.map(newsRow).join('')}</tbody></table></div>`
        : all.length ? noMatch() : U.empty({ icon: 'newspaper', title: YU.t('adminContent.news.empty.title'), text: YU.t('adminContent.news.empty.text'), action: `<a class="btn btn-primary btn-sm" href="#/admin/news/new">${YU.t('adminContent.news.new')}</a>` })}</section>
    </div>`;
  }
  function newsMenu(el, n) {
    if (!n) return;
    U.menu(el, [
      { label: YU.t('adminContent.action.open'), icon: 'eye', onClick: () => { location.hash = `#/news/${n.id}`; } },
      { label: YU.t('adminContent.action.edit'), icon: 'pencil', onClick: () => { location.hash = `#/admin/news/${n.id}`; } },
      ...(n.status === 'draft' ? [{ label: YU.t('adminContent.action.publish'), icon: 'send', onClick: () => done(A.publishNews(n.id), YU.t('adminContent.news.published')) }] : []),
      { label: n.pinned ? YU.t('adminContent.news.unpin') : YU.t('adminContent.news.pin'), icon: 'pin', onClick: () => done(A.updateNews(n.id, { pinned: !n.pinned }), n.pinned ? YU.t('adminContent.news.unpinned') : YU.t('adminContent.news.pinned')) },
      'sep',
      { label: YU.t('adminContent.action.delete'), icon: 'trash-2', danger: true, onClick: async () => { if (await U.confirm({ title: YU.t('adminContent.news.deleteTitle'), text: YU.t('adminContent.news.deleteText', { title: n.title }), ok: YU.t('adminContent.action.delete'), danger: true })) done(A.deleteNews(n.id), YU.t('adminContent.news.deleted')); } },
    ]);
  }
  const coverPreview = (title, tone, category, pinned) => `<div class="news-cover is-wide on-dark adminc-preview tone-${esc(tone)}">
      <div class="adminc-preview-tags">${pinned ? `<span class="pill pill-gold">${icon('pin')}${YU.t('adminContent.news.important')}</span>` : ''}<span class="pill adminc-preview-cat">${esc(YU.newsCategoryLabel(category))}</span></div>
      <div class="adminc-preview-title">${title.trim() ? esc(title) : `<span class="adminc-preview-ph">${YU.t('adminContent.news.headingGhost')}</span>`}</div>
    </div>`;
  const MAX_PICTURE_MB = 10, MAX_PICTURES = 10;
  // The gallery as the editor holds it: the post's pictures and the files just chosen, in the order they will
  // show, the first of them the cover. Each tile moves or drops itself; the picker takes several files at once.
  const galleryItems = (n) => (n.pictures || []).map((p) => ({ key: p.id, id: p.id, url: p.url }));
  const galleryTile = (item, i, total) => `<li class="adminc-pic ${item.file ? 'is-new' : ''}" data-key="${esc(item.key)}">
      <img class="adminc-pic-img" ${item.file ? `src="${esc(item.preview)}"` : U.photoSrc(item.url)} alt="">
      ${i === 0 ? `<span class="pill pill-gold adminc-pic-cover">${YU.t('adminContent.news.cover')}</span>` : ''}
      <span class="adminc-pic-tools">
        <button type="button" class="icon-btn" data-pic="earlier" ${i === 0 ? 'disabled' : ''} aria-label="${YU.t('adminContent.news.moveEarlier')}">${icon('arrow-left')}</button>
        <button type="button" class="icon-btn" data-pic="later" ${i === total - 1 ? 'disabled' : ''} aria-label="${YU.t('adminContent.news.moveLater')}">${icon('arrow-right')}</button>
        <button type="button" class="icon-btn" data-pic="remove" aria-label="${YU.t('adminContent.news.removePicture')}">${icon('x')}</button>
      </span>
    </li>`;
  const galleryField = (items) => field(YU.t('adminContent.news.picturesLabel'), `<div class="adminc-gallery">
      <ul class="adminc-pics" ${items.length ? '' : 'hidden'}>${items.map((it, i) => galleryTile(it, i, items.length)).join('')}</ul>
      <label class="upload adminc-gallery-pick" ${items.length >= MAX_PICTURES ? 'hidden' : ''}>${icon('upload')}${YU.t('adminContent.news.pickPictures')}<div class="micro mt-8">${YU.t('adminContent.news.picturesHint', { size: MAX_PICTURE_MB, max: MAX_PICTURES })}</div><input type="file" name="picture" accept="image/jpeg,image/png,image/webp" multiple class="sr-only"></label>
    </div>`, '', false);
  const newsForm = (n) => `<form class="adminc-form" id="news-form">
      ${coverPreview(n.title || '', n.tone || 'navy', n.category || DEFAULT_NEWS_CAT, !!n.pinned)}
      ${field(YU.t('adminContent.label.heading'), input('title', n.title, `placeholder="${YU.t('adminContent.news.headingPlaceholder')}" maxlength="120"`))}
      <div data-gallery>${galleryField(galleryItems(n))}</div>
      <div class="form-grid">
        ${field(YU.t('adminContent.label.category'), select('category', newsCatPairs(withExtra(NEWS_CATS(), YU.state.news.map((x) => x.category))), n.category || DEFAULT_NEWS_CAT))}
        ${field(YU.t('adminContent.news.pin'), toggle('pinned', !!n.pinned, YU.t('adminContent.news.pinHint')), '', false)}
      </div>
      ${field(YU.t('adminContent.news.coverColorLabel'), tonePicker(n.tone || 'navy'), '', false)}
      ${field(YU.t('adminContent.news.excerptLabel'), textarea('excerpt', n.excerpt, `placeholder="${YU.t('adminContent.news.excerptPlaceholder')}" rows="2"`, 'adminc-short'), YU.t('adminContent.news.excerptHint'))}
      ${field(YU.t('adminContent.news.bodyLabel'), textarea('body', (n.body || []).join('\n\n'), `placeholder="${YU.t('adminContent.news.bodyPlaceholder')}" rows="8"`), YU.t('adminContent.news.bodyHint'))}
    </form>`;
  function openNewsEditor(id) {
    const isNew = id === 'new', n = isNew ? {} : YU.newsItem(id);
    if (!n) { U.toast(YU.tText('adminContent.news.notFound'), 'bad'); goBack('news'); return; }
    const published = !isNew && n.status === 'published';
    const el = openLayer('drawer', 'news', id, true, {
      title: isNew ? YU.t('adminContent.news.new') : esc(n.title),
      sub: isNew ? YU.t('adminContent.news.newSub') : published ? YU.t('adminContent.news.publishedSub', { date: fmtDate(n.publishedAt, { time: true }), count: n.views }) : YU.t('adminContent.news.draftSub'),
      body: newsForm(isNew ? n : YU.sourceOf(n)) + (isNew ? '' : YU.contentTranslations.panel('news', n)),
      foot: footer(published ? `<button class="btn btn-primary" data-act="save">${icon('check')}${YU.t('adminContent.action.save')}</button>` : `<button class="btn btn-secondary" data-act="draft">${icon('file-pen-line')}${YU.t('adminContent.action.saveDraft')}</button><button class="btn btn-primary" data-act="publish">${icon('send')}${YU.t('adminContent.action.publish')}</button>`),
    });
    if (!el) return;
    if (!isNew) YU.contentTranslations.mount(el, 'news', n);
    // The gallery as it will be saved: the post's pictures and the files just chosen, in order; the ones taken
    // out are remembered for the save. Listeners sit on the form, which is fresh for every opening of the drawer.
    const form = el.querySelector('#news-form');
    let items = galleryItems(n), newKey = 0;
    const removed = [], previews = [];
    const redraw = () => { const box = form.querySelector('[data-gallery]'); if (box) { box.innerHTML = galleryField(items); U.refreshIcons(); } };
    U.on(form, 'change', 'input[name="picture"]', (e, input) => {
      const files = Array.from(input.files || []);
      input.value = '';
      if (!files.length) return;
      const errors = {};
      if (files.length > MAX_PICTURES - items.length) errors.picture = YU.t('adminContent.news.tooManyPictures', { max: MAX_PICTURES });
      else if (files.some((f) => !/^image\/(jpeg|png|webp)$/.test(f.type))) errors.picture = YU.t('adminContent.news.pictureType');
      else if (files.some((f) => f.size > MAX_PICTURE_MB * 1024 * 1024)) errors.picture = YU.t('adminContent.news.pictureSize', { size: MAX_PICTURE_MB });
      if (!showErrors(form, errors)) return;
      items = [...items, ...files.map((file) => { const preview = URL.createObjectURL(file); previews.push(preview); return { key: `new-${newKey++}`, file, preview }; })];
      redraw();
    });
    U.on(form, 'click', '[data-pic]', (e, btn) => {
      const i = items.findIndex((it) => it.key === btn.closest('[data-key]').dataset.key); if (i < 0) return;
      if (btn.dataset.pic === 'remove') {
        if (items[i].id) removed.push(items[i].id);
        items = items.filter((it, k) => k !== i);
      } else {
        const j = btn.dataset.pic === 'earlier' ? i - 1 : i + 1; if (j < 0 || j >= items.length) return;
        const next = items.slice(); next[i] = items[j]; next[j] = items[i]; items = next;
      }
      redraw();
    });
    const submit = async (mode, btn) => {
      const form = el.querySelector('#news-form'), f = U.formData(form), errors = {};
      if (!f.title.trim()) errors.title = YU.t('adminContent.news.errTitle');
      if (mode === 'publish' && !f.body.trim()) errors.body = YU.t('adminContent.news.errBody');
      if (!showErrors(form, errors)) return;
      const data = { title: f.title.trim(), category: f.category, tone: f.tone, pinned: !!f.pinned, excerpt: f.excerpt.trim(), body: f.body.trim() };
      // Publishing an existing draft is part of the same update, so it either all saves or nothing does; the gallery
      // follows on its own once the text is safe: the removed pictures come off first (so a swap in a full gallery
      // has room), each new one goes up, then the order is sent when it changed. A failure there is reported, not fatal.
      const pending = U.busy(btn, async () => {
        const saved = isNew
          ? await A.createNews({ ...data, status: mode === 'publish' ? 'published' : 'draft' })
          : await A.updateNews(id, mode === 'publish' && n.status === 'draft' ? { ...data, status: 'published' } : data);
        if (!saved.ok) return saved;
        const newsId = isNew ? saved.news.id : id;
        const stuck = [];
        for (const uploadId of removed) {
          const p = await A.removeNewsPicture(newsId, uploadId);
          if (!p.ok) { stuck.push(uploadId); U.toast(YU.tText('adminContent.news.pictureRemoveFailed', { error: p.error }), 'bad'); }
        }
        const placed = [];
        for (const it of items) {
          if (it.id) { placed.push(it.id); continue; }
          const p = await A.uploadNewsPicture(newsId, it.file);
          if (p.ok) placed.push(p.picture.id); else U.toast(YU.tText('adminContent.news.pictureFailed', { error: p.error }), 'bad');
        }
        // A picture that would not come off is still on the server, so the order has to name it too
        const order = [...placed, ...stuck];
        const before = (n.pictures || []).map((p) => p.id);
        if (order.length > 1 && (removed.length || items.some((it) => it.file) || order.join() !== before.join())) {
          const p = await A.orderNewsPictures(newsId, order);
          if (!p.ok) U.toast(YU.tText('adminContent.news.pictureOrderFailed', { error: p.error }), 'bad');
        }
        return saved;
      });
      if (await done(pending, mode === 'publish' ? YU.t('adminContent.news.published') : mode === 'draft' ? YU.t('adminContent.toast.draftSaved') : YU.t('adminContent.news.saved'))) {
        previews.forEach((url) => URL.revokeObjectURL(url));
        closeLayer('drawer', 'news');
      }
    };
    const preview = () => {
      const f = U.formData(el.querySelector('#news-form')), box = el.querySelector('.adminc-preview'); if (!box) return;
      box.outerHTML = coverPreview(f.title, f.tone, f.category, !!f.pinned); U.refreshIcons();
    };
    wire(el, { draft: (b) => submit('draft', b), publish: (b) => submit('publish', b), save: (b) => submit('save', b) }, preview);
  }
  function newsMount(root, params) {
    const box = sectionBox(root, 'adminc-news');
    wireFilters(box, YU.state.ui.admincNews, NEWS_DEFAULTS);
    U.on(box, 'click', '[data-menu]', (e, el) => newsMenu(el, YU.newsItem(el.dataset.menu)));
    routeLayer(params, 'news', 'drawer', openNewsEditor);
  }

  // ---------- Rewards
  const rewardCard = (r) => {
    const n = YU.state.redemptions.filter((x) => x.rewardId === r.id).length;
    return `<article class="panel adminc-reward">
      <div class="adminc-reward-art tone-${U.safeTone(r.tone)}">${icon(r.icon)}</div>
      <div class="adminc-reward-body">
        <div class="h3">${esc(r.title)}</div>
        <div class="row gap-8 wrap">${chip(r.category)}${coins(r.cost)}</div>
        <div class="small ${r.stock === 0 ? 'text-bad' : 'muted'}">${r.stock === null ? YU.t('adminContent.rewards.stockUnlimited') : r.stock === 0 ? YU.t('adminContent.rewards.stockOut') : YU.t('adminContent.rewards.stockLeft', { count: r.stock })}, ${YU.t('adminContent.rewards.reserved', { count: n })}</div>
      </div>
      <div class="adminc-reward-actions"><button class="btn btn-secondary btn-sm" data-edit-reward="${r.id}">${icon('pencil')}${YU.t('adminContent.action.change')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del-reward="${r.id}" aria-label="${YU.t('adminContent.action.delete')}">${icon('trash-2')}</button></div>
    </article>`;
  };
  const redemptionRow = (rd) => {
    const u = YU.user(rd.userId), rw = YU.reward(rd.rewardId), issued = rd.status === 'issued';
    return `<tr class="${issued ? 'adminc-muted' : ''}">
      <td><span class="cell-user">${avatar(u, 'avatar-sm')}<span style="min-width:0"><div class="list-title truncate">${esc(u ? u.name : '—')}</div><div class="micro muted">${esc(u ? u.group : '')}</div></span></span></td>
      <td>${rw ? esc(rw.title) : `<span class="muted">${YU.t('adminContent.rewards.gone')}</span>`}</td>
      <td><span class="kbd">${esc(rd.code)}</span></td>
      <td class="small muted">${esc(fmtDate(rd.at, { time: true }))}</td>
      <td>${issued ? pill(YU.t('adminContent.rewards.issued'), 'ok', 'check') : pill(YU.t('adminContent.rewards.awaiting'), 'warn', 'clock')}</td>
      <td class="ta-right">${issued ? `<span class="micro muted">${rd.issuedAt ? esc(relDay(rd.issuedAt)) : ''}</span>` : `<button class="btn btn-ok btn-sm" data-issue="${rd.id}">${icon('check')}${YU.t('adminContent.rewards.issued')}</button>`}</td>
    </tr>`;
  };
  function rewardsRender() {
    const rs = YU.state.rewards, reds = YU.state.redemptions.slice().sort((a, b) => ((a.status === 'issued') - (b.status === 'issued')) || (new Date(b.at) - new Date(a.at)));
    const waiting = reds.filter((r) => r.status === 'reserved').length;
    return `<div class="adminc adminc-rewards">
      <div class="adminc-head">
        <div><div class="h2">${YU.t('nav.rewards')}</div><div class="small muted mt-8">${YU.t('adminContent.rewards.inShop', { count: rs.length })}, ${YU.t('adminContent.rewards.bookingsWaiting', { count: waiting })}</div></div>
        <button class="btn btn-primary" data-act="new-reward">${icon('plus')}${YU.t('adminContent.rewards.new')}</button>
      </div>
      ${rs.length ? `<div class="cards-4">${rs.map(rewardCard).join('')}</div>` : `<section class="panel">${U.empty({ icon: 'gift', title: YU.t('adminContent.rewards.empty.title'), text: YU.t('adminContent.rewards.empty.text'), action: `<button class="btn btn-primary btn-sm" data-act="new-reward">${YU.t('adminContent.rewards.new')}</button>` })}</section>`}
      <section class="panel mt-24">
        <div class="panel-head"><span class="h2">${YU.t('adminContent.rewards.bookingsTitle')}</span><span class="small muted hide-mobile">${YU.t('adminContent.rewards.bookingsHint')}</span></div>
        ${reds.length ? `<div class="table-wrap mt-12"><table class="table is-stack"><thead><tr><th>${YU.t('adminContent.rewards.thWho')}</th><th>${YU.t('adminContent.rewards.thReward')}</th><th>${YU.t('adminContent.rewards.thCode')}</th><th>${YU.t('adminContent.label.date')}</th><th>${YU.t('adminContent.label.status')}</th><th></th></tr></thead><tbody>${reds.map(redemptionRow).join('')}</tbody></table></div>`
          : U.empty({ icon: 'ticket', title: YU.t('adminContent.rewards.bookingsEmpty.title'), text: YU.t('adminContent.rewards.bookingsEmpty.text') })}
      </section>
    </div>`;
  }
  function openRewardModal(id, via) {
    const isNew = id === 'new', r = isNew ? { title: '', tone: 'navy', icon: 'gift', category: DEFAULT_REWARD_CAT, cost: 100, stock: null, desc: '' } : YU.reward(id);
    if (!r) { U.toast(YU.tText('adminContent.rewards.notFound'), 'bad'); goBack('rewards'); return; }
    // The form edits what was written, not the reader's translation
    const src = isNew ? r : YU.sourceOf(r);
    const el = openLayer('modal', 'rewards', id, via, {
      title: isNew ? YU.t('adminContent.rewards.new') : esc(r.title), sub: isNew ? YU.t('adminContent.rewards.newSub') : YU.t('adminContent.rewards.editSub'), wide: true,
      body: `<form class="adminc-form" id="reward-form">
        <div class="adminc-art-row"><div class="adminc-reward-art adminc-art-preview tone-${U.safeTone(r.tone)}" data-base="adminc-reward-art">${icon(r.icon)}</div><div class="grow">${field(YU.t('adminContent.label.name'), input('title', src.title, `placeholder="${YU.t('adminContent.rewards.titlePlaceholder')}" maxlength="80"`))}</div></div>
        <div class="form-grid">
          ${field(YU.t('adminContent.label.category'), select('category', rewardCatPairs(withExtra(REWARD_CATS(), YU.state.rewards.map((x) => x.raw.category))), src.category))}
          ${field(YU.t('adminContent.rewards.costLabel'), input('cost', r.cost, 'type="number" min="0" step="10"'))}
          ${field(YU.t('adminContent.rewards.stockLabel'), input('stock', r.stock === null ? '' : r.stock, `type="number" min="0" placeholder="${YU.t('adminContent.rewards.stockPlaceholder')}"`), YU.t('adminContent.rewards.stockHint'))}
          ${field(YU.t('adminContent.label.description'), textarea('desc', src.desc, `placeholder="${YU.t('adminContent.rewards.descPlaceholder')}" rows="2"`, 'adminc-short'))}
        </div>
        ${field(YU.t('adminContent.label.icon'), iconPicker(REWARD_ICONS, r.icon), '', false)}
        ${field(YU.t('adminContent.label.color'), tonePicker(r.tone), '', false)}
      </form>${isNew ? '' : YU.contentTranslations.panel('reward', r)}`,
      foot: footer(`<button class="btn btn-primary" data-act="save">${icon('check')}${isNew ? YU.t('adminContent.rewards.add') : YU.t('adminContent.action.save')}</button>`),
    });
    if (!el) return;
    if (!isNew) YU.contentTranslations.mount(el, 'reward', r);
    wire(el, { save: async (btn) => {
      const form = el.querySelector('#reward-form'), f = U.formData(form), errors = {};
      if (!f.title.trim()) errors.title = YU.t('adminContent.rewards.errTitle');
      if (f.cost === '' || !(+f.cost >= 0)) errors.cost = YU.t('adminContent.rewards.errCost');
      if (f.stock !== '' && !(+f.stock >= 0)) errors.stock = YU.t('adminContent.rewards.errStock');
      if (!showErrors(form, errors)) return;
      const data = { title: f.title.trim(), category: f.category, cost: Math.round(+f.cost), stock: f.stock === '' ? null : Math.round(+f.stock), desc: f.desc.trim(), icon: f.icon, tone: f.tone };
      if (await done(U.busy(btn, () => (isNew ? A.createReward(data) : A.updateReward(id, data))), isNew ? YU.t('adminContent.rewards.added') : YU.t('adminContent.rewards.saved'))) closeLayer('modal', 'rewards');
    } }, () => previewArt(el));
  }
  function rewardsMount(root, params) {
    const box = sectionBox(root, 'adminc-rewards');
    U.on(box, 'click', '[data-act="new-reward"]', () => openRewardModal('new', false));
    U.on(box, 'click', '[data-edit-reward]', (e, el) => openRewardModal(el.dataset.editReward, false));
    U.on(box, 'click', '[data-del-reward]', async (e, el) => {
      const r = YU.reward(el.dataset.delReward); if (!r) return;
      if (await U.confirm({ title: YU.t('adminContent.rewards.deleteTitle'), text: YU.t('adminContent.rewards.deleteText', { title: r.title }), ok: YU.t('adminContent.action.delete'), danger: true })) done(A.deleteReward(r.id), YU.t('adminContent.rewards.deleted'));
    });
    U.on(box, 'click', '[data-issue]', (e, el) => done(U.busy(el, () => A.issueRedemption(el.dataset.issue)), YU.t('adminContent.rewards.handedOver')));
    routeLayer(params, 'rewards', 'modal', openRewardModal);
  }

  // ---------- Points & levels
  const levelRow = (l, users) => {
    const n = users.filter((u) => U.levelFor(u.coinsTotal).level.id === l.id).length;
    return `<tr><td><span class="pill pill-gold">${icon('sparkles')}${esc(l.name)}</span></td><td class="small muted">${YU.t('adminContent.coins.levelFrom', { count: l.min })}</td><td class="num">${n}</td>
      <td class="ta-right"><button class="btn btn-secondary btn-sm" data-edit-level="${l.id}">${YU.t('adminContent.action.change')}</button></td></tr>`;
  };
  const badgeTile = (b, users) => {
    const n = users.filter((u) => u.badges.includes(b.id)).length;
    return `<div class="badge-tile adminc-badge">
      <button class="btn btn-ghost btn-sm btn-icon adminc-badge-edit" data-edit-badge="${b.id}" aria-label="${YU.t('adminContent.coins.editBadge')}">${icon('pencil')}</button>
      <span class="badge-art tone-${U.safeTone(b.tone)}">${icon(b.icon)}</span>
      <span class="h3">${esc(b.title)}</span><span class="small muted">${esc(b.desc)}</span>
      <span class="micro adminc-count">${YU.t('adminContent.coins.badgeOwners', { count: n })}</span>
    </div>`;
  };
  const txRow = (tx) => {
    const u = YU.user(tx.userId), by = YU.user(tx.by);
    return `<div class="list-item">${avatar(u, 'avatar-sm')}
      <span class="grow"><div class="list-title truncate">${esc(u ? u.name : '—')}</div><div class="list-sub truncate">${esc((tx.refType === 'mission' && YU.mission(tx.refId) || tx.refType === 'reward' && YU.reward(tx.refId) || {}).title || tx.reason)}${by ? `, ${esc(by.name)}` : ''}</div></span>
      <span class="adminc-tx-right">${coins(tx.delta, { sign: true })}<span class="micro muted">${esc(fmtDate(tx.at, { time: true }))}</span></span>
    </div>`;
  };
  function coinsRender() {
    const users = participants(), s = YU.state.settings, pairs = userPairs();
    const manual = YU.state.transactions.filter((t) => t.refType === 'manual').slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
    return `<div class="adminc adminc-points">
      <div class="adminc-head">
        <div><div class="h2">${YU.t('adminContent.coins.title')}</div><div class="small muted mt-8">${YU.t('adminContent.coins.sub')}</div></div>
        <button class="btn btn-primary" data-act="new-badge">${icon('plus')}${YU.t('adminContent.coins.newBadge')}</button>
      </div>
      <div class="bento">
        <section class="panel span-7"><div class="panel-head"><span class="h2">${YU.t('adminContent.coins.levelsTitle')}</span><span class="small muted">${YU.t('adminContent.coins.levelCount', { count: YU.state.levels.length })}</span></div>
          ${YU.state.levels.length ? `<div class="table-wrap mt-12"><table class="table is-compact is-stack"><thead><tr><th>${YU.t('adminContent.coins.thLevel')}</th><th>${YU.t('adminContent.coins.thThreshold')}</th><th class="num">${YU.t('adminContent.coins.thMembers')}</th><th></th></tr></thead><tbody>${YU.state.levels.map((l) => levelRow(l, users)).join('')}</tbody></table></div>` : U.empty({ icon: 'sparkles', title: YU.t('adminContent.coins.levelsEmpty.title'), text: YU.t('adminContent.coins.levelsEmpty.text') })}
        </section>
        <section class="panel span-5"><div class="panel-head"><span class="h2">${YU.t('adminContent.coins.rulesTitle')}</span><a class="btn btn-ghost btn-sm" href="#/admin/settings">${YU.t('adminContent.action.change')}</a></div><div class="panel-body">
          <div class="list">
            <div class="list-item"><span class="grow"><div class="list-title">${YU.t('adminContent.coins.ruleMaxActive')}</div></span><b>${fmtNum(s.maxActiveMissions)}</b></div>
            <div class="list-item"><span class="grow"><div class="list-title">${YU.t('adminContent.coins.ruleLatePenalty')}</div></span><b>${fmtNum(s.latePenaltyPct)}%</b></div>
            <div class="list-item"><span class="grow"><div class="list-title">${YU.t('adminContent.coins.ruleMaxPerMission')}</div></span>${coins(s.maxMissionCoins)}</div>
          </div>
        </div></section>
        <section class="panel span-12"><div class="panel-head"><span class="h2">${YU.t('adminContent.coins.badgesTitle')}</span><span class="small muted">${YU.t('adminContent.coins.badgeCount', { count: YU.state.badges.length })}</span></div>
          <div class="panel-body">${YU.state.badges.length ? `<div class="cards-4">${YU.state.badges.map((b) => badgeTile(b, users)).join('')}</div>` : U.empty({ icon: 'award', title: YU.t('adminContent.coins.badgesEmpty.title'), text: YU.t('adminContent.coins.badgesEmpty.text'), action: `<button class="btn btn-primary btn-sm" data-act="new-badge">${YU.t('adminContent.coins.newBadge')}</button>` })}</div>
        </section>
        <section class="panel span-5"><div class="panel-head"><span class="h2">${YU.t('adminContent.coins.awardTitle')}</span></div><div class="panel-body">
          ${pairs.length && YU.state.badges.length ? `<form class="adminc-form" id="award-form">
            ${field(YU.t('adminContent.label.recipient'), select('userId', pairs, ''))}
            ${field(YU.t('adminContent.label.badge'), select('badgeId', YU.state.badges.map((b) => [b.id, b.title]), ''))}
            <div class="form-actions"><button type="button" class="btn btn-primary" data-act="award">${icon('award')}${YU.t('adminContent.coins.awardButton')}</button></div>
          </form>` : U.empty({ icon: 'award', title: YU.t('adminContent.coins.awardEmpty.title'), text: YU.t('adminContent.coins.awardEmpty.text') })}
        </div></section>
        <section class="panel span-7"><div class="panel-head"><span class="h2">${YU.t('adminContent.coins.adjustTitle')}</span><span class="small muted hide-mobile">${YU.t('adminContent.coins.adjustHint')}</span></div><div class="panel-body">
          <form class="adminc-form" id="adjust-form"><div class="form-grid">
            ${field(YU.t('adminContent.label.recipient'), select('userId', pairs, ''))}
            ${field(YU.t('adminContent.label.coins'), input('delta', '', `type="number" step="5" placeholder="${YU.t('adminContent.coins.deltaPlaceholder')}"`), YU.t('adminContent.coins.deltaHint'))}
            <div class="full">${field(YU.t('adminContent.label.reason'), input('reason', '', `placeholder="${YU.t('adminContent.coins.reasonPlaceholder')}" maxlength="120"`))}</div>
          </div><div class="form-actions"><button type="button" class="btn btn-gold" data-act="adjust">${icon('coins')}${YU.t('adminContent.coins.adjustButton')}</button></div></form>
        </div>
          ${manual.length ? `<div class="divider"></div><div class="panel-head"><span class="h3">${YU.t('adminContent.coins.recentManual')}</span></div><div class="list mt-8">${manual.map(txRow).join('')}</div>` : U.empty({ icon: 'history', title: YU.t('adminContent.coins.manualEmpty.title'), text: YU.t('adminContent.coins.manualEmpty.text') })}
        </section>
      </div>
    </div>`;
  }
  function openLevelModal(id, via) {
    const l = YU.state.levels.find((x) => x.id === id);
    if (!l) { U.toast(YU.tText('adminContent.coins.levelNotFound'), 'bad'); goBack('coins'); return; }
    const el = openLayer('modal', 'coins', id, via, {
      title: YU.t('adminContent.coins.levelTitle', { name: l.name }), sub: YU.t('adminContent.coins.levelSub'),
      body: `<form class="adminc-form" id="level-form">${field(YU.t('adminContent.label.name'), input('name', l.raw.name, 'maxlength="40"'))}${field(YU.t('adminContent.coins.thresholdLabel'), input('min', l.min, 'type="number" min="0" step="50"'), YU.t('adminContent.coins.thresholdHint'))}</form>`,
      foot: footer(`<button class="btn btn-primary" data-act="save">${icon('check')}${YU.t('adminContent.action.save')}</button>`),
    });
    if (!el) return;
    wire(el, { save: async (btn) => {
      const form = el.querySelector('#level-form'), f = U.formData(form), errors = {};
      if (!f.name.trim()) errors.name = YU.t('adminContent.coins.errLevelName');
      if (f.min === '' || !(+f.min >= 0)) errors.min = YU.t('adminContent.coins.errThreshold');
      if (!showErrors(form, errors)) return;
      if (await done(U.busy(btn, () => A.updateLevel(id, { name: f.name.trim(), min: Math.round(+f.min) })), YU.t('adminContent.coins.levelSaved'), 'gold')) closeLayer('modal', 'points');
    } });
  }
  function openBadgeModal(id, via) {
    const isNew = id === 'new', b = isNew ? { title: '', desc: '', icon: 'award', tone: 'gold' } : YU.badge(id);
    if (!b) { U.toast(YU.tText('adminContent.coins.badgeNotFound'), 'bad'); goBack('coins'); return; }
    const owners = isNew ? 0 : YU.state.users.filter((u) => u.badges.includes(id)).length;
    const el = openLayer('modal', 'coins', id, via, {
      title: isNew ? YU.t('adminContent.coins.newBadge') : esc(b.title), sub: isNew ? YU.t('adminContent.coins.badgeNewSub') : YU.t('adminContent.coins.badgeOwnedBy', { count: owners }), wide: true,
      body: `<form class="adminc-form" id="badge-form">
        <div class="adminc-art-row"><span class="badge-art adminc-art-preview tone-${U.safeTone(b.tone)}" data-base="badge-art">${icon(b.icon)}</span><div class="grow">${field(YU.t('adminContent.label.name'), input('title', isNew ? b.title : b.raw.title, `placeholder="${YU.t('adminContent.coins.badgeTitlePlaceholder')}" maxlength="40"`))}</div></div>
        ${field(YU.t('adminContent.coins.badgeDescLabel'), input('desc', isNew ? b.desc : b.raw.desc, `placeholder="${YU.t('adminContent.coins.badgeDescPlaceholder')}" maxlength="80"`))}
        ${field(YU.t('adminContent.label.icon'), iconPicker(BADGE_ICONS, b.icon), '', false)}
        ${field(YU.t('adminContent.label.color'), tonePicker(b.tone), '', false)}
      </form>`,
      foot: `${isNew ? '' : `<button class="btn btn-danger" data-act="delete">${icon('trash-2')}${YU.t('adminContent.action.delete')}</button><span class="grow"></span>`}${footer(`<button class="btn btn-primary" data-act="save">${icon('check')}${isNew ? YU.t('adminContent.coins.badgeCreate') : YU.t('adminContent.action.save')}</button>`)}`,
    });
    if (!el) return;
    wire(el, {
      save: async (btn) => {
        const form = el.querySelector('#badge-form'), f = U.formData(form), errors = {};
        if (!f.title.trim()) errors.title = YU.t('adminContent.coins.errBadgeTitle');
        if (!showErrors(form, errors)) return;
        const data = { title: f.title.trim(), desc: f.desc.trim(), icon: f.icon, tone: f.tone };
        if (await done(U.busy(btn, () => (isNew ? A.createBadge(data) : A.updateBadge(id, data))), isNew ? YU.t('adminContent.coins.badgeCreated') : YU.t('adminContent.coins.badgeSaved'))) closeLayer('modal', 'points');
      },
      delete: async () => {
        const ok = await U.confirm({ title: YU.t('adminContent.coins.badgeDeleteTitle'), text: YU.t('adminContent.coins.badgeDeleteText', { title: b.title, count: owners }), ok: YU.t('adminContent.action.delete'), danger: true });
        if (!ok) return openBadgeModal(id, via);
        if (await done(A.deleteBadge(id), YU.t('adminContent.coins.badgeDeleted'))) goBack('coins');
      },
    }, () => previewArt(el));
  }
  function adjustCoins(form, btn) {
    const f = U.formData(form), errors = {}, d = Math.round(+f.delta);
    if (!f.delta || !d) errors.delta = YU.t('adminContent.coins.errDelta');
    if (!f.reason.trim()) errors.reason = YU.t('adminContent.coins.errReason');
    if (!showErrors(form, errors)) return;
    done(U.busy(btn, () => A.adjustCoins(f.userId, d, f.reason.trim())), d > 0 ? YU.t('adminContent.coins.credited', { count: d }) : YU.t('adminContent.coins.debited', { count: -d }), 'gold');
  }
  function coinsMount(root, params) {
    const box = sectionBox(root, 'adminc-points');
    const acts = {
      'new-badge': () => openBadgeModal('new', false),
      award: (btn) => { const f = U.formData(box.querySelector('#award-form')), b = YU.badge(f.badgeId); done(U.busy(btn, () => A.awardBadge(f.userId, f.badgeId)), b ? YU.t('adminContent.coins.badgeAwardedNamed', { title: b.title }) : YU.t('adminContent.coins.badgeAwarded')); },
      adjust: (btn) => adjustCoins(box.querySelector('#adjust-form'), btn),
    };
    U.on(box, 'click', '[data-act]', (e, el) => { if (acts[el.dataset.act]) acts[el.dataset.act](el); });
    U.on(box, 'click', '[data-edit-level]', (e, el) => openLevelModal(el.dataset.editLevel, false));
    U.on(box, 'click', '[data-edit-badge]', (e, el) => openBadgeModal(el.dataset.editBadge, false));
    routeLayer(params, 'coins', 'modal', (id, via) => (id === 'new' || YU.badge(id) ? openBadgeModal(id, via) : openLevelModal(id, via)));
  }

  // title is a getter: the registry is built at load time, but the shell reads it on every render,
  // so the catalogue is consulted after it has loaded and again whenever the locale changes
  YU.adminSections.push(
    { id: 'missions', get title() { return YU.t('nav.missions'); }, icon: 'clipboard-list', order: 50, render: tasksRender, mount: tasksMount, count: () => YU.state.missions.filter((t) => t.status === 'draft').length },
    { id: 'news', get title() { return YU.t('nav.news'); }, icon: 'newspaper', order: 60, render: newsRender, mount: newsMount, count: () => YU.state.news.filter((n) => n.status === 'draft').length, allowed: () => YU.canManageNews() },
    { id: 'rewards', get title() { return YU.t('nav.rewards'); }, icon: 'gift', order: 70, render: rewardsRender, mount: rewardsMount, count: () => YU.state.redemptions.filter((r) => r.status === 'reserved').length },
    { id: 'coins', get title() { return YU.t('adminContent.coins.title'); }, icon: 'coins', order: 80, render: coinsRender, mount: coinsMount },
  );
})();

;
/* js/screens/admin-app.js */
/* Admin panel — the mobile app section (#/admin/app): publish a new Android build, see what is served now and
   what came before. The server reads the version from the APK itself, so the form is just the file and a note.
   All classes prefixed .adminapp- */
(function () {
  const U = YU.ui;
  const { esc, icon, fmtDate } = U;
  const MB = 1024 * 1024;
  const fmtSize = (bytes) => `${(bytes / MB).toFixed(1).replace(/\.0$/, '')} MB`;
  // The releases as last fetched; null until the first load, so a re-render while loading shows a hint, not an empty list
  let releases = null;

  function current() {
    const r = releases && releases[0];
    if (!releases) return `<p class="small muted">${YU.t('app.page.loading')}</p>`;
    if (!r) return `<p class="small muted">${YU.t('app.admin.none')}</p>`;
    return `<div class="adminapp-current">
      <span class="kpi-icon tone-blue">${icon('smartphone')}</span>
      <span class="grow"><div class="list-title">${YU.t('app.page.version', { version: r.versionName })} <span class="micro muted">(${r.versionCode})</span></div>
        <div class="list-sub">${r.hosted ? YU.t('app.page.meta', { size: fmtSize(r.bytes), date: fmtDate(r.publishedAt, { year: true }) }) : `${YU.t('app.admin.sourceLink')}, ${esc(fmtDate(r.publishedAt, { year: true }))}`}</div></span>
      <a class="btn btn-secondary btn-sm" href="#/app">${icon('external-link')}${YU.t('admin.action.open')}</a>
    </div>`;
  }

  function history() {
    if (!releases || !releases.length) return '';
    return `<section class="panel"><div class="panel-head"><span class="h2">${YU.t('app.admin.history')}</span></div>
      <div class="table-wrap mt-12"><table class="table is-compact is-stack"><thead><tr><th>${YU.t('app.admin.col.version')}</th><th>${YU.t('app.admin.col.size')}</th><th>${YU.t('app.admin.col.date')}</th><th>${YU.t('app.admin.col.notes')}</th><th></th></tr></thead><tbody>
        ${releases.map((r) => `<tr><td><b>${esc(r.versionName)}</b> <span class="micro muted">(${r.versionCode})</span></td><td class="small">${r.hosted ? fmtSize(r.bytes) : `<a href="${esc(r.link)}" target="_blank" rel="noopener">${YU.t('app.admin.sourceLink')}</a>`}</td><td class="small muted">${esc(fmtDate(r.publishedAt, { year: true }))}</td><td class="small muted-2">${esc(r.notes)}</td>
          <td class="ta-right"><button type="button" class="btn btn-ghost btn-sm btn-icon" data-app-remove="${esc(r.id)}" data-version="${esc(r.versionName)}" aria-label="${YU.t('app.admin.remove')}">${icon('trash-2')}</button></td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  function render() {
    return `<section class="panel">
        <div class="panel-head"><div><div class="h2">${YU.t('app.admin.title')}</div><div class="small muted mt-8">${YU.t('app.admin.sub')}</div></div></div>
        <div class="panel-body col gap-16">
          <div><div class="label mb-8">${YU.t('app.admin.current')}</div><div id="adminapp-current">${current()}</div></div>
          <form id="adminapp-form" class="col gap-14" novalidate>
            <div class="field"><label for="adminapp-file">${YU.t('app.admin.fileLabel')}</label><input class="input" type="file" id="adminapp-file" name="apk" accept=".apk,application/vnd.android.package-archive"></div>
            <div class="field"><label for="adminapp-notes">${YU.t('app.admin.notesLabel')}</label><input class="input" id="adminapp-notes" name="notes" maxlength="500" placeholder="${YU.t('app.admin.notesPlaceholder')}"><span class="hint">${YU.t('app.admin.hint')}</span></div>
            <div><button type="submit" class="btn btn-primary" id="adminapp-publish">${icon('upload')}${YU.t('app.admin.publish')}</button></div>
          </form>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><div class="h2">${YU.t('app.admin.linkTitle')}</div><div class="small muted mt-8">${YU.t('app.admin.linkSub')}</div></div></div>
        <form id="adminapp-link-form" class="panel-body col gap-14" novalidate>
          <div class="field"><label for="adminapp-link">${YU.t('app.admin.linkLabel')}</label><input class="input" id="adminapp-link" name="url" type="url" maxlength="500" placeholder="https://drive.google.com/file/d/…/view" autocomplete="off"><span class="hint">${YU.t('app.admin.linkHint')}</span></div>
          <div class="field"><label for="adminapp-link-name">${YU.t('app.admin.versionNameLabel')}</label><input class="input" id="adminapp-link-name" name="versionName" maxlength="40" placeholder="1.3" autocomplete="off"></div>
          <div class="field"><label for="adminapp-link-code">${YU.t('app.admin.versionCodeLabel')}</label><input class="input" id="adminapp-link-code" name="versionCode" type="number" min="1" step="1" inputmode="numeric" placeholder="4"><span class="hint">${YU.t('app.admin.versionCodeHint')}</span></div>
          <div class="field"><label for="adminapp-link-notes">${YU.t('app.admin.notesLabel')}</label><input class="input" id="adminapp-link-notes" name="notes" maxlength="500" placeholder="${YU.t('app.admin.notesPlaceholder')}"></div>
          <div><button type="submit" class="btn btn-primary" id="adminapp-publish-link">${icon('link')}${YU.t('app.admin.publishLink')}</button></div>
        </form>
      </section>
      <div id="adminapp-history">${history()}</div>`;
  }

  async function publishLink(root, form) {
    const f = U.formData(form), url = String(f.url || '').trim(), versionName = String(f.versionName || '').trim(), versionCode = Math.round(+f.versionCode);
    const bad = (name, msg) => { const input = form.querySelector(`[name="${name}"]`), wrap = input.closest('.field'); const old = wrap.querySelector('.error'); if (old) old.remove(); input.classList.toggle('is-invalid', !!msg); if (msg) { const e = document.createElement('span'); e.className = 'error'; e.textContent = msg; wrap.appendChild(e); } };
    bad('url', /^https:\/\/\S+$/.test(url) ? '' : YU.tText('app.admin.error.link'));
    bad('versionName', versionName ? '' : YU.tText('app.admin.error.version'));
    bad('versionCode', versionCode > 0 ? '' : YU.tText('app.admin.error.version'));
    if (!/^https:\/\/\S+$/.test(url) || !versionName || !(versionCode > 0)) return;
    const r = await U.busy(form.querySelector('#adminapp-publish-link'), () => YU.actions.publishAppLink({ url, versionName, versionCode, notes: String(f.notes || '').trim() }));
    if (!r.ok) return U.toast(r.error, 'bad');
    form.reset();
    U.toast(YU.tText('app.admin.toast.published', { version: r.release.versionName }), 'ok', 'link');
    load(root);
  }

  async function load(root) {
    const r = await YU.api.get('/app/android/releases');
    releases = r.ok ? r.releases : [];
    if (!r.ok) U.toast(r.error, 'bad');
    const cur = root.querySelector('#adminapp-current'), hist = root.querySelector('#adminapp-history');
    if (cur) cur.innerHTML = current();
    if (hist) hist.innerHTML = history();
    U.refreshIcons();
  }

  async function publish(root, form) {
    const fileInput = form.querySelector('#adminapp-file'), file = fileInput.files && fileInput.files[0];
    const err = form.querySelector('#adminapp-file').closest('.field').querySelector('.error');
    if (err) err.remove();
    if (!file) { fileInput.classList.add('is-invalid'); const e = document.createElement('span'); e.className = 'error'; e.textContent = YU.tText('app.admin.error.file'); fileInput.closest('.field').appendChild(e); return; }
    fileInput.classList.remove('is-invalid');
    const btn = form.querySelector('#adminapp-publish');
    const r = await U.busy(btn, () => YU.actions.publishAppRelease(file, form.querySelector('#adminapp-notes').value.trim()));
    if (!r.ok) return U.toast(r.error, 'bad');
    form.reset();
    U.toast(YU.tText('app.admin.toast.published', { version: r.release.versionName }), 'ok', 'smartphone');
    load(root);
  }

  async function remove(root, id, version) {
    if (!await U.confirm({ title: YU.tText('app.admin.removeConfirm', { version }), ok: YU.tText('app.admin.remove'), danger: true })) return;
    const r = await YU.actions.deleteAppRelease(id);
    if (!r.ok) return U.toast(r.error, 'bad');
    U.toast(YU.tText('app.admin.toast.removed', { version }), 'ok');
    load(root);
  }

  function mount(root) {
    U.on(root, 'submit', '#adminapp-form', (e, form) => { e.preventDefault(); publish(root, form); });
    U.on(root, 'submit', '#adminapp-link-form', (e, form) => { e.preventDefault(); publishLink(root, form); });
    U.on(root, 'click', '[data-app-remove]', (e, el) => remove(root, el.dataset.appRemove, el.dataset.version));
    load(root);
  }

  YU.adminSections.push({ id: 'app', title: () => YU.t('app.admin.section'), icon: 'smartphone', order: 95, render, mount });
})();

;
/* js/app.js */
/* App chrome: top pill navigation, notifications, search, mobile tab bar, footer. */
(function () {
  const { esc, icon, avatar, $, on, timeAgo, fmtNum, plural, themeToggle } = YU.ui;

  const NAV = [
    { id: 'dashboard', path: '#/', key: 'nav.dashboard', icon: 'layout-dashboard' },
    { id: 'missions', path: '#/missions', key: 'nav.missions', icon: 'clipboard-list', count: () => YU.select.myActiveCount() },
    { id: 'news', path: '#/news', key: 'nav.news', icon: 'newspaper' },
    { id: 'rating', path: '#/rating', key: 'nav.rating', icon: 'trophy' },
    { id: 'rewards', path: '#/rewards', key: 'nav.rewards', icon: 'gift', perm: 'rewards.view' },
    { id: 'profile', path: '#/profile', key: 'nav.profile', icon: 'user-round', tabOnly: true },
  ];
  const TABS = ['dashboard', 'missions', 'news', 'rating', 'profile'];
  // Matches the layout.css breakpoint where the nav pill and header links give way to the tab bar
  const PHONE = window.matchMedia('(max-width: 900px)');
  const visibleNav = () => NAV.filter((i) => !i.tabOnly && (!i.perm || YU.can(i.perm)));
  const isActive = (item, route) => route.name === item.id;

  function renderTopbar(route) {
    const me = YU.me(); if (!me) return;
    const unread = YU.select.unreadCount();
    const pending = YU.isUnionWide() ? YU.select.pendingReviews().length : me.role === 'coordinator' ? YU.select.pendingReviews(me.deptId).length : 0;
    const tb = $('#topbar');
    tb.innerHTML = `
      <a class="logo" href="#/" aria-label="${esc(YU.t('nav.homeLabel'))}">${YU.ui.mark()}youth union</a>
      <nav class="nav-pill" aria-label="${esc(YU.t('nav.main'))}">
        ${visibleNav().map((i) => { const c = i.count ? i.count() : 0; return `
          <a class="nav-item ${isActive(i, route) ? 'is-active' : ''}" href="${i.path}" ${isActive(i, route) ? 'aria-current="page"' : ''}>${esc(YU.t(i.key))}${c ? `<span class="nav-count">${c}</span>` : ''}</a>`; }).join('')}
      </nav>
      <div class="topbar-actions">
        ${YU.can('review.panel') ? `<a class="btn btn-primary btn-sm hide-mobile ${route.name === 'review' ? 'is-here' : ''}" href="#/review" title="${esc(YU.t('nav.review'))}">${icon('clipboard-check')}<span class="topbar-label">${esc(YU.t('nav.review'))}</span>${pending ? `<span class="nav-count is-alert" style="background:var(--orange);color:var(--navy);border-radius:999px;padding:1px 7px;font-size:11px">${pending}</span>` : ''}</a>` : ''}
        ${me.role === 'admin' ? `<a class="btn btn-primary btn-sm hide-mobile" href="#/admin" title="${esc(YU.t('nav.admin'))}">${icon('shield-check')}<span class="topbar-label">${esc(YU.t('nav.admin'))}</span>${pending ? `<span style="background:var(--orange);color:var(--navy);border-radius:999px;padding:1px 7px;font-size:11px;font-weight:800">${pending}</span>` : ''}</a>`
          : YU.canManageNews() ? `<a class="btn btn-primary btn-sm hide-mobile ${route.name === 'admin' ? 'is-here' : ''}" href="#/admin/news" title="${esc(YU.t('nav.manageNews'))}">${icon('newspaper')}<span class="topbar-label">${esc(YU.t('nav.manageNews'))}</span></a>` : ''}
        ${themeToggle('hide-mobile')}
        <button class="icon-btn hide-mobile" id="tb-search" aria-label="${esc(YU.t('search.label'))}" title="${esc(YU.t('search.title'))}">${icon('search')}</button>
        <div style="position:relative">
          <button class="icon-btn" id="tb-bell" aria-label="${esc(unread ? YU.t('notif.labelUnread', { count: unread }) : YU.t('notif.label'))}" aria-expanded="false">${icon('bell')}${unread ? '<span class="badge-dot"></span>' : ''}</button>
          <div id="tb-notif" class="popover" hidden></div>
        </div>
        <button class="me-pill hide-mobile" id="tb-me" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(YU.t('nav.profileMenu'))}">${avatar(me)}<span>${meLabel(me)}</span></button>
      </div>`;

    $('#tb-search', tb).onclick = openSearch;
    $('#tb-bell', tb).onclick = (e) => { e.stopPropagation(); toggleNotifications(); };
    $('#tb-me', tb).onclick = (e) => { e.stopPropagation(); openMeMenu(e.currentTarget); };
    YU.motion.marker($('.nav-pill', tb), $('.nav-pill .nav-item.is-active', tb), 'nav');
  }

  // The pill text: coins for a participant, the role for everyone who runs the union
  const meLabel = (me) => esc(YU.isParticipant() ? YU.t('coins.amount', { count: me.coinsSemester }) : YU.roleName(me.role));

  // The desktop pill's menu. A second press closes it. On a phone the badge in the tab bar leads to the
  // profile page instead, which carries the shortcuts the phone header hides (see profile.js).
  function openMeMenu(anchor) {
    if (anchor.getAttribute('aria-expanded') === 'true') { YU.ui.closeMenu(); return; }
    YU.ui.menu(anchor, [
      { label: YU.t('nav.myProfile'), icon: 'user-round', onClick: () => YU.router.go('#/profile') },
      { label: YU.t('nav.settings'), icon: 'settings', onClick: () => YU.router.go('#/settings') },
      { label: YU.t('search.title'), icon: 'search', onClick: openSearch },
      'sep',
      { label: YU.t('nav.signOut'), icon: 'log-out', danger: true, onClick: logout },
    ], { label: YU.tText('nav.profileMenu') });
  }

  async function logout() {
    const r = await YU.actions.logout();
    if (!r.ok) YU.ui.toast(r.error, 'bad');
  }

  // The last place in the tab bar is the member's own avatar, which leads to the profile page, so the
  // phone header holds only the logo and the bell
  function renderTabbar(route) {
    const me = YU.me(); if (!me) return;
    const items = TABS.filter((id) => id !== 'profile').map((id) => NAV.find((i) => i.id === id)).filter(Boolean);
    const here = route.name === 'profile' || route.name === 'settings';
    $('#tabbar').innerHTML = items.map((i) => `
      <a class="tab-item ${isActive(i, route) ? 'is-active' : ''}" href="${i.path}">${icon(i.icon)}<span>${esc(YU.t(i.key))}</span></a>`).join('')
      + `<a class="tab-item tab-me ${here ? 'is-active' : ''}" id="tab-me" href="#/profile" aria-label="${esc(YU.t('nav.myProfile'))}" ${here ? 'aria-current="page"' : ''}>${avatar(me)}</a>`;
    YU.motion.marker($('#tabbar'), $('#tabbar .tab-item.is-active'), 'tab');
  }

  function renderFooter() {
    let f = $('#foot');
    if (!f) { f = document.createElement('footer'); f.id = 'foot'; f.className = 'foot'; $('.main').appendChild(f); }
    f.hidden = false;
    f.innerHTML = `<span>Youth Union · ${esc(YU.state.org.university)}</span><span>${esc(YU.state.org.semester)}</span>`;
  }

  // ---- Notifications popover
  const KIND_ICON = { coins: 'coins', mission: 'clipboard-list', deadline: 'alarm-clock', rating: 'trophy', news: 'newspaper', review: 'clipboard-check', admin: 'shield-check', reward: 'gift' };
  // Sent since migration 006: a message key and its raw params, read in the viewer's language (YU.t output
  // is HTML-safe already). Older ones, or a key this catalogue lacks, show the Russian they were stored with.
  const notifHtml = (n) => {
    // One sent before keys existed is matched back to its key through the Russian templates
    const old = n.messageKey ? null : YU.i18n.legacy('activity.notify.', n.text);
    const key = n.messageKey || (old && old.key);
    const out = key ? YU.t(key, YU.activityParams(n.messageKey ? n.params : old.params)) : null;
    return out && out !== key ? out : esc(n.text);
  };
  function toggleNotifications() {
    const pop = $('#tb-notif'), bell = $('#tb-bell');
    if (!pop.hidden) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); return; }
    const list = YU.select.myNotifications().slice(0, 8);
    pop.innerHTML = `
      <div class="row-between" style="padding:18px 20px 10px">
        <span class="h2">${esc(YU.t('notif.title'))}</span>
        ${YU.select.unreadCount() ? `<button class="btn btn-secondary btn-sm" id="nt-read">${esc(YU.t('notif.readAll'))}</button>` : ''}
      </div>
      <div class="col gap-8" style="max-height:400px;overflow:auto;padding:0 12px 12px">
        ${list.length ? list.map((n) => `
          <div class="row gap-12" style="align-items:flex-start;padding:12px 12px;border-radius:16px;${n.read ? '' : 'background:var(--blue-soft)'}">
            <span style="width:36px;height:36px;border-radius:12px;background:rgba(61,102,245,.12);color:var(--blue);display:grid;place-items:center;flex:none">${icon(KIND_ICON[n.kind] || 'bell')}</span>
            <span style="min-width:0"><div class="small" style="font-weight:700;line-height:1.4">${notifHtml(n)}</div><div class="micro muted" style="margin-top:3px">${esc(timeAgo(n.at))}</div></span>
          </div>`).join('') : YU.ui.empty({ icon: 'bell-off', title: YU.t('notif.empty.title'), text: YU.t('notif.empty.text') })}
      </div>`;
    pop.hidden = false; bell.setAttribute('aria-expanded', 'true');
    YU.ui.refreshIcons();
    const read = $('#nt-read', pop);
    if (read) read.onclick = async () => { const r = await YU.ui.busy(read, () => YU.actions.markAllRead()); if (!r.ok) YU.ui.toast(r.error, 'bad'); };
    const close = (e) => { if (!e.target.closest('#tb-notif') && !e.target.closest('#tb-bell')) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  // ---- Global search (missions, news, people, rewards)
  function openSearch() {
    const el = YU.ui.modal.open({
      title: YU.t('search.title'),
      body: `<div class="search">${icon('search')}<input class="input" id="gs-input" placeholder="${esc(YU.t('search.placeholder'))}" autocomplete="off"></div><div id="gs-results" class="mt-16"></div>`,
      wide: true,
    });
    if (!el) return;
    const input = $('#gs-input', el), out = $('#gs-results', el);
    const canPeople = YU.can('review.panel');
    const run = () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { out.innerHTML = `<p class="small muted">${esc(YU.t('search.minChars'))}</p>`; return; }
      const has = (s) => String(s || '').toLowerCase().includes(q);
      const missions = YU.select.visibleMissions().filter((t) => has(t.title) || has(t.description)).slice(0, 5);
      const news = YU.select.publishedNews().filter((n) => has(n.title) || has(n.excerpt)).slice(0, 5);
      const people = canPeople ? YU.state.users.filter((u) => has(u.name) || has(u.raw && u.raw.name) || has(u.group) || has(u.email)).slice(0, 5) : [];
      const rewards = YU.can('rewards.view') ? YU.state.rewards.filter((r) => has(r.title)).slice(0, 4) : [];
      const group = (label, rows) => rows.length ? `<div class="eyebrow" style="margin:14px 4px 8px">${label}</div><div class="col gap-8">${rows}</div>` : '';
      const row = (href, ic, title, sub) => `<a class="list-item is-link" href="${href}" data-gs><span class="kpi-icon" style="width:34px;height:34px;border-radius:10px">${icon(ic)}</span><span style="min-width:0"><div class="list-title truncate">${esc(title)}</div><div class="list-sub truncate">${esc(sub)}</div></span></a>`;
      const html =
        group(YU.t('search.group.missions'), missions.map((t) => row(`#/missions/${t.id}`, 'clipboard-list', t.title, `${YU.dept(t.deptId).name}, ${YU.t('coins.amount', { count: t.coins })}`)).join('')) +
        group(YU.t('search.group.news'), news.map((n) => row(`#/news/${n.id}`, 'newspaper', n.title, YU.newsCategoryLabel(n.category))).join('')) +
        group(YU.t('search.group.people'), people.map((u) => row(`#/profile/${u.id}`, 'user-round', u.name, `${u.group}, ${YU.roleName(u.role)}`)).join('')) +
        group(YU.t('search.group.rewards'), rewards.map((r) => row('#/rewards', 'gift', r.title, YU.t('coins.amount', { count: r.cost }))).join(''));
      out.innerHTML = html || YU.ui.empty({ icon: 'search-x', title: YU.t('search.empty.title'), text: YU.t('search.empty.text') });
      YU.ui.refreshIcons();
    };
    input.oninput = YU.ui.debounce(run, 120);
    on(out, 'click', '[data-gs]', () => YU.ui.modal.close());
    run();
  }

  YU.app = {
    renderChrome(route) { renderTopbar(route); renderTabbar(route); renderFooter(); },
    hideChrome() { const f = $('#foot'); if (f) f.hidden = true; },
    openSearch,
  };

  // ---- Phone layout helpers, applied to whatever a screen draws into #view.
  // Stacked tables (.table.is-stack) print each cell's column name from the header, and
  // sideways-scrolling rows bring their active item into view — a re-render resets scrollLeft
  // to 0, which would otherwise hide the chip or section you just picked.
  const SCROLL_ROWS = '.filters-scroll, .admin-nav, .tabs';
  const centred = new WeakSet();
  function labelTable(table) {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => [...tr.cells].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
  }
  function centreActive(row) {
    if (centred.has(row)) return;
    centred.add(row);
    const active = row.querySelector('.is-active');
    if (!active || row.scrollWidth <= row.clientWidth) return;
    const r = row.getBoundingClientRect(), a = active.getBoundingClientRect();
    row.scrollLeft += (a.left + a.width / 2) - (r.left + r.width / 2);
  }
  // The router swaps #view for a fresh element on every render, so watch its stable parent
  const main = $('.main');
  if (main) {
    new MutationObserver(() => {
      const view = $('#view'); if (!view) return;
      view.querySelectorAll('.table.is-stack').forEach(labelTable);
      if (PHONE.matches) view.querySelectorAll(SCROLL_ROWS).forEach(centreActive);
    }).observe(main, { childList: true, subtree: true });
  }

  window.addEventListener('scroll', () => { const tb = $('#topbar'); if (tb) tb.classList.toggle('is-scrolled', window.scrollY > 8); }, { passive: true });
  // A window dragged across the phone breakpoint, or a tablet turned, swaps the nav pill for the tab bar:
  // the chrome is drawn again for the layout now in force (the screen itself keeps its state)
  const onLayoutChange = () => { const r = YU.router.current(); if (r && YU.state.session.loggedIn && !$('#topbar').hidden) { YU.app.renderChrome(r); YU.ui.refreshIcons(); } };
  if (PHONE.addEventListener) PHONE.addEventListener('change', onLayoutChange); else if (PHONE.addListener) PHONE.addListener(onLayoutChange);
  // One delegated handler covers the switcher wherever it is drawn — topbar or sign-in screens.
  // A second press on the open button closes the menu again.
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-lang-menu]');
    if (!el) return;
    e.stopPropagation();
    if (el.getAttribute('aria-expanded') === 'true') { YU.ui.closeMenu(); return; }
    const now = YU.i18n.current();
    YU.ui.menu(el, YU.i18n.locales.map((l) => ({ label: l.label, hint: l.short, checked: l.id === now, onClick: () => YU.i18n.set(l.id) })), { label: YU.tText('lang.switch') });
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (el) YU.theme.cycle();
  });

  document.addEventListener('DOMContentLoaded', () => YU.boot());
})();
