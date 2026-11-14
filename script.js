/* Lesson Notes Hub — script.js (the tiny core)
 * Core = load the file list, render the grid, search, language, theme.
 * Everything else is a separate module in /modules with its own init(),
 * its own switch in config.js, and its own try/catch: if one fails, it is
 * hidden and the rest of the site keeps working.
 */
import { CONFIG } from './config.js';
import { store } from './modules/storage.js';
import * as i18n from './modules/i18n.js';
import { parseFileName, normalizeText, isExamSubject, TAGS } from './modules/parser.js';
import { loadFileList, resolveRepo } from './modules/loader.js';
import { buildGrid, applyFilters, revealFile, watchResize, layoutGrid } from './modules/grid.js';
import { toast } from './modules/toast.js';
import { icon, hasIcon } from './modules/icons.js';
import { el, motionOK, vibrate, loadOptionalJson, isPlainObject, fileUrl } from './modules/util.js';

window.__lnhStarted = true;

const root = document.documentElement;
const { t } = i18n;

/* ---------- config (with optional test overrides; see tests.html) ---------- */
function mergeDeep(base, extra) {
  if (!isPlainObject(extra)) return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? mergeDeep(out[k], v) : v;
  }
  return out;
}
let config = isPlainObject(CONFIG) ? CONFIG : {};
try { if (isPlainObject(window.__LNH_TEST)) config = mergeDeep(config, window.__LNH_TEST); } catch { /* ignore */ }
if (!isPlainObject(config.features)) config.features = {};
if (!isPlainObject(config.repo)) config.repo = {};
if (!isPlainObject(config.data)) config.data = {};
if (!isPlainObject(config.contact)) config.contact = {};

/* ---------- the app object shared with modules ---------- */
const listeners = new Map();
const app = {
  config,
  store,
  i18n,
  t,
  lang: root.lang === 'ar' ? 'ar' : 'en',
  theme: root.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  ready: false,
  files: [],
  subjects: [],
  subjectMeta: {},
  list: { state: 'loading', source: null },
  state: { query: '', subject: null, types: new Set(), sort: 'lesson' },
  session: {},          // in-memory, per page load (tile open/closed, etc.)
  hooks: {
    tiles: [], rowActions: [], rowBadges: [], rowText: [], subjectHeader: [], subjectTop: [],
    filterChips: [], filters: [], openers: [], heroTop: [],
  },
  modules: {},
  pending: [],
  rows: new Map(),
  dom: { grid: document.getElementById('grid'), notices: document.getElementById('notices') },
  toast,

  flag(name) { return config.features[name] !== false; },

  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  },
  emit(evt, data) {
    const set = listeners.get(evt);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(data); } catch (err) { console.warn('[LNH] listener for "' + evt + '" failed:', err); }
    }
  },

  /** Register a hook; remembers which module added it so a failed module can be removed cleanly. */
  hook(type, def) {
    if (!app.hooks[type]) app.hooks[type] = [];
    def.owner = app._initing || 'core';
    app.hooks[type].push(def);
    return def;
  },

  isNew(file) {
    const days = Number(config.newDays) > 0 ? Number(config.newDays) : 7;
    return !!file.ts && Date.now() - file.ts < days * 86400000 && file.ts <= Date.now() + 86400000;
  },
  isLarge(file) {
    const mb = Number(config.largeFileMB) > 0 ? Number(config.largeFileMB) : 10;
    return file.size > mb * 1048576;
  },

  subjectName(key) {
    const meta = app.subjectMeta[key];
    const fromMeta = meta ? i18n.pick(meta) : '';
    if (fromMeta) return fromMeta;
    const s = app.subjects.find((x) => x.key === key);
    return s && s.name ? s.name : t('subject.other');
  },
  subjectIcon() { return 'book'; },      // replaced by modules/subject-icons.js (F13)
  subjectTint(subject, index) {
    const meta = app.subjectMeta[subject.key];
    if (meta && (meta.tint === 'a' || meta.tint === 'b')) return meta.tint;
    return index % 2 === 0 ? 'a' : 'b';
  },

  rebuild() {
    try { buildGrid(app); app.emit('rebuilt'); } catch (err) { console.error('[LNH] rebuild failed:', err); }
  },
  requestRebuild() {
    if (!app.ready || app._rebuildQueued) return;
    app._rebuildQueued = true;
    setTimeout(() => { app._rebuildQueued = false; reindex(); app.rebuild(); }, 0);
  },
  applyFilters(opts) { try { applyFilters(app, opts); } catch (err) { console.warn('[LNH] filter failed:', err); } },
  clearFilters() {
    app.state.query = '';
    app.state.subject = null;
    app.state.types.clear();
    app.emit('clear-filters');
    app.rebuild();
  },
  reveal(path, opts) {
    try { return revealFile(app, path, opts); } catch (err) { console.warn('[LNH] reveal failed:', err); return null; }
  },
  fileByName(name) { return app.files.find((f) => f.name === name || f.path === name) || null; },

  /** Open a file: the first module that can handle it wins; otherwise it just downloads. */
  open(file, row) {
    const openers = app.hooks.openers.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const o of openers) {
      try { if (o.open(file, row)) { app.emit('open', { file }); return; } }
      catch (err) { console.warn('[LNH] opener failed:', err); }
    }
    app.download(file);
  },
  download(file) {
    try {
      const a = el('a', { attrs: { href: fileUrl(file), download: file.name, hidden: true } });
      document.body.append(a);
      a.click();
      a.remove();
      app.emit('download', { file, el: null });
    } catch (err) { console.warn('[LNH] download failed:', err); }
  },

  sweep(kind) { app.emit('sweep', kind || 'page'); },

  setLang(next, opts) {
    const lang = next === 'ar' ? 'ar' : 'en';
    if (lang === app.lang && !(opts && opts.force)) return;
    withTransition(() => {
      app.lang = i18n.setLang(lang);
      root.lang = lang;
      root.dir = lang === 'ar' ? 'rtl' : 'ltr';
      applyStaticTexts();
      reindex();
      if (app.ready) app.rebuild();
      app.emit('lang', lang);
    });
    if (!(opts && opts.save === false)) store.local.set('lang', lang);
    vibrate(8);
    app.sweep('lang');
  },
  toggleLang() { app.setLang(app.lang === 'ar' ? 'en' : 'ar'); },

  setTheme(next, opts) {
    const theme = next === 'light' ? 'light' : 'dark';
    if (theme === app.theme) return;
    app.theme = theme;
    withTransition(() => {
      root.setAttribute('data-theme', theme);
      syncThemeUi();
    });
    if (!(opts && opts.save === false)) store.local.set('theme', theme);
    app.emit('theme', theme);
    app.sweep('theme');
  },
  toggleTheme() { app.setTheme(app.theme === 'dark' ? 'light' : 'dark'); },

  focusSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    try {
      input.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
      input.focus({ preventScroll: true });
      input.select();
    } catch { input.focus(); }
  },

  async reload() {
    app.dom.notices.textContent = '';
    const list = await loadFileList({ config, store: store.local });
    setList(list);
    app.rebuild();
    app.emit('reloaded');
  },

  repo() { return resolveRepo(config); },
};
window.__LNH = app; // handy for tests.html and for debugging in the console

/* ---------- smooth switch (language / theme) ---------- */
function withTransition(fn) {
  const run = () => { try { fn(); } catch (err) { console.error('[LNH] switch failed:', err); } };
  if (!motionOK() || document.visibilityState === 'hidden') { run(); return; }
  if (typeof document.startViewTransition === 'function') {
    try {
      // run exactly once, even if the browser never gets round to the transition (hidden or throttled page)
      let done = false;
      const once = () => { if (done) return; done = true; run(); };
      const vt = document.startViewTransition(once);
      setTimeout(once, 450);
      for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) if (p && p.catch) p.catch(() => {});
      return;
    } catch { /* fall through */ }
  }
  root.classList.add('switching');
  run();
  setTimeout(() => root.classList.remove('switching'), 360);
}

/* ---------- static texts and icons in index.html ---------- */
function applyStaticTexts() {
  i18n.applyStatic(document);
  document.title = t('site.title') + ' · ' + t('site.titleAlt');
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    const label = langBtn.querySelector('.lang-label');
    if (label) label.textContent = t('nav.langShort');
  }
  syncThemeUi();
}

function syncThemeUi() {
  const btn = document.getElementById('btn-theme');
  if (btn) {
    const holder = btn.querySelector('.ic-slot');
    if (holder) { holder.textContent = ''; holder.append(icon(app.theme === 'dark' ? 'sun' : 'moon')); }
    const label = app.theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    const text = btn.querySelector('.btn-label');
    if (text) text.textContent = label;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', app.theme === 'dark' ? '#0B132B' : '#F7F5FB');
}

function fillStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((node) => {
    const name = node.getAttribute('data-icon');
    if (hasIcon(name) && !node.querySelector('svg')) node.prepend(icon(name));
  });
}

/* ---------- file list ---------- */
function validateSubjects(json) {
  if (!isPlainObject(json)) return null;
  const out = {};
  for (const [name, v] of Object.entries(json)) {
    if (name.startsWith('_') || !isPlainObject(v)) continue;
    const m = {};
    if (typeof v.ar === 'string') m.ar = v.ar.slice(0, 80);
    if (typeof v.en === 'string') m.en = v.en.slice(0, 80);
    if (typeof v.icon === 'string') m.icon = v.icon;
    if (v.tint === 'a' || v.tint === 'b') m.tint = v.tint;
    out[normalizeText(name)] = m;
  }
  return out;
}

function setList(list) {
  const files = [];
  const groups = new Map();
  (list.files || []).forEach((f, i) => {
    const p = parseFileName(f.name);
    const subjectKey = normalizeText(p.subject);
    const ts = f.date ? Date.parse(f.date) : 0;
    const file = { ...f, ...p, id: 'f' + i, subjectKey, ts: Number.isFinite(ts) ? ts : 0, search: '' };
    files.push(file);
    if (!groups.has(subjectKey)) groups.set(subjectKey, { key: subjectKey, name: p.subject, files: [], isExam: isExamSubject(p.subject) });
    groups.get(subjectKey).files.push(file);
  });
  app.files = files;
  app.subjects = Array.from(groups.values());
  sortSubjects();
  app.list = {
    state: list.source === 'none' ? 'error' : 'ok',
    source: list.source,
    generated: list.generated || null,
    savedAt: list.savedAt || null,
  };
  reindex();
  showListNotice();
}

function sortSubjects() {
  const c = i18n.collator();
  app.subjects.sort((a, b) => {
    if (!a.key !== !b.key) return a.key ? -1 : 1; // "Other" goes last
    // larger subjects first, so tiles of similar height sit side by side (no half-empty tiles)
    const size = (x) => Math.min(x.files.length, 6);
    if (size(a) !== size(b)) return size(b) - size(a);
    return c.compare(app.subjectName(a.key), app.subjectName(b.key));
  });
}

/** (Re)build the text each file is searched by: name, subject (both languages), tags, description. */
function reindex() {
  sortSubjects();
  for (const f of app.files) {
    const meta = app.subjectMeta[f.subjectKey] || {};
    const tagWords = f.tags.map((id) => (TAGS[id] || []).join(' ')).join(' ');
    const dd = app.fileDesc ? app.fileDesc(f) : null;
    const desc = dd ? (dd.ar || '') + ' ' + (dd.en || '') : '';
    f.search = normalizeText([f.name, f.subject, meta.ar || '', meta.en || '', tagWords, desc].join(' '));
  }
}
app.reindex = reindex;

function showListNotice() {
  const box = app.dom.notices;
  const old = box.querySelector('.notice-list');
  if (old) old.remove();
  if (app.list.source !== 'cache') return;
  const when = app.list.savedAt ? i18n.fmtDate(app.list.savedAt) : '';
  box.append(el('div', { class: 'notice glass notice-list', attrs: { role: 'status' } },
    el('span', { class: 'notice-icon' }, icon('warning-circle')),
    el('span', { class: 'notice-text', text: when ? t('state.savedListDate', { date: when }) : t('state.savedList') }),
    el('button', { class: 'btn btn-small', attrs: { type: 'button' }, on: { click: () => app.reload() } },
      icon('arrows-clockwise'), el('span', { text: t('common.retry') }))));
}

/* ---------- navigation bar ---------- */
function wireNav() {
  const on = (id, fn) => { const n = document.getElementById(id); if (n) n.addEventListener('click', fn); return n; };
  on('btn-lang', () => app.toggleLang());
  on('btn-theme', () => app.toggleTheme());
  on('btn-search', () => app.focusSearch());

  const settings = document.getElementById('btn-settings');
  const panel = document.getElementById('nav-secondary');
  if (settings && panel) {
    const setOpen = (open) => {
      panel.classList.toggle('open', open);
      settings.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    settings.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!panel.classList.contains('open')); });
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== settings) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) { setOpen(false); settings.focus(); }
    });
  }

  // Island condenses a little once the page is scrolled.
  const wrap = document.querySelector('.nav-wrap');
  if (wrap) {
    let ticking = false;
    const update = () => { ticking = false; wrap.classList.toggle('scrolled', (window.scrollY || 0) > 24); };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
}

/* ---------- global safety net: a friendly toast, never a blank page ---------- */
let lastErrorToast = 0;
function onGlobalError(ev) {
  try {
    const msg = String((ev && (ev.message || (ev.reason && ev.reason.message))) || '');
    if (/ResizeObserver loop|Script error\.?$/i.test(msg)) return;
    if (ev && ev.reason && ev.reason.name === 'AbortError') return;
    console.warn('[LNH] caught error:', (ev && (ev.error || ev.reason)) || msg);
    const now = Date.now();
    if (now - lastErrorToast < 15000) return;
    lastErrorToast = now;
    toast(t('error.generic'), { type: 'error', id: 'global-error', duration: 6000 });
  } catch { /* never throw from the safety net */ }
}
window.addEventListener('error', (ev) => { if (ev && ev.target && ev.target !== window && !(ev.error)) return; onGlobalError(ev); });
window.addEventListener('unhandledrejection', onGlobalError);

/* ---------- feature modules ---------- */
// [config flag(s), file name]. A module loads only if at least one of its flags is on.
const MODULES = [
  [['livingBackground'], 'living-background'],
  [['readingMode'], 'reading-mode'],
  [['textSize'], 'text-size'],
  [['subjectIcons'], 'subject-icons'],
  [['descriptions'], 'descriptions'],
  [['reminder'], 'reminder'],
  [['favourites'], 'favourites'],
  [['done'], 'done'],
  [['share'], 'share'],
  [['contact', 'report'], 'contact'],
  [['audioPlayer'], 'audio-player'],
  [['preview'], 'preview'],
  [['zipDownload'], 'zip-download'],
  [['timeline'], 'timeline'],
  [['largeFileWarning'], 'large-file'],
  [['recent'], 'recent'],
  [['examCorner'], 'exam-corner'],
  [['glossary'], 'glossary'],
  [['countdown'], 'countdown'],
  [['qrTile'], 'qr-tile'],
  [['credits'], 'credits'],
  [['extraTiles'], 'extra-tiles'],
  [['updatedNotice'], 'updated-notice'],
  [['shortcuts'], 'shortcuts'],
  [['backToTop'], 'back-to-top'],
  [['privacyNote', 'ownerLinks'], 'footer'],
  [['pwa'], 'pwa'],
  [['help'], 'help'],
  [['quickGuide'], 'quick-guide'],
];

function removeHooksOf(name) {
  for (const type of Object.keys(app.hooks)) app.hooks[type] = app.hooks[type].filter((d) => d.owner !== name);
}

async function loadModules() {
  const jobs = MODULES.map(([flags, file]) => {
    if (!flags.some((f) => app.flag(f))) { app.modules[file] = 'off'; return null; }
    return import('./modules/' + file + '.js').then((mod) => ({ file, mod }), (err) => ({ file, err }));
  });
  for (const job of jobs) {
    if (!job) continue;
    const { file, mod, err } = await job;
    if (err || !mod || typeof mod.init !== 'function') {
      console.warn('[LNH] module "' + file + '" could not load; feature hidden.', err || '');
      app.modules[file] = 'failed';
      continue;
    }
    try {
      app._initing = file;
      const result = mod.init(app);
      app._initing = null;
      if (result && typeof result.then === 'function') {
        app.pending.push(result.catch((e) => {
          console.warn('[LNH] module "' + file + '" failed later; feature hidden.', e);
          app.modules[file] = 'failed';
          removeHooksOf(file);
          app.requestRebuild();
        }));
      }
      app.modules[file] = 'ok';
    } catch (e) {
      app._initing = null;
      console.warn('[LNH] module "' + file + '" failed; feature hidden.', e);
      app.modules[file] = 'failed';
      removeHooksOf(file);
    }
  }
}

/* ---------- deep links: #f=<file name> ---------- */
function handleHash() {
  try {
    const m = /^#f=(.+)$/.exec(location.hash || '');
    if (!m) return;
    const name = decodeURIComponent(m[1]);
    const file = app.fileByName(name);
    if (file) setTimeout(() => app.reveal(file.path), 350);
  } catch { /* bad hash: ignore */ }
}

/* ---------- start ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  i18n.setLang(app.lang);
  // If the reading-mode switch is turned off in config, only the system setting decides.
  if (!app.flag('readingMode')) root.classList.toggle('reading', !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  if (!app.flag('textSize')) root.style.setProperty('--text-scale', '1');
  fillStaticIcons();
  applyStaticTexts();
  wireNav();
  watchResize(app);

  const savedSort = store.local.get('sort', 'lesson');
  app.state.sort = ['lesson', 'newest', 'oldest', 'az'].includes(savedSort) ? savedSort : 'lesson';

  const listPromise = loadFileList({ config, store: store.local });
  const metaPromise = loadOptionalJson(config.data.subjects, validateSubjects);

  await loadModules();
  if (app.modules['living-background'] !== 'ok') root.classList.add('bg-static'); // calm static gradient instead
  const [list, meta] = await Promise.all([listPromise, metaPromise]);
  if (meta) app.subjectMeta = meta;
  await Promise.race([Promise.allSettled(app.pending), wait(2500)]);

  setList(list);
  app.dom.grid.classList.add('intro');
  setTimeout(() => app.dom.grid.classList.remove('intro'), 1400);
  app.rebuild();
  app.ready = true;
  root.classList.add('ready');
  app.emit('ready');
  handleHash();
  window.addEventListener('hashchange', handleHash);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { try { layoutGrid(app); app.emit('resize'); } catch { /* ignore */ } });
}

start().catch((err) => {
  console.error('[LNH] start failed:', err);
  try {
    app.list = { state: 'error', source: 'none' };
    app.rebuild();
    root.classList.add('ready');
  } catch { /* ignore */ }
});
