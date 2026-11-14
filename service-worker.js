/* Lesson Notes Hub — service-worker.js (F7)
 * - Caches the app shell (pages, scripts, styles, fonts, icons) and the last file list.
 * - Pages, scripts, styles and JSON are "network first": when online you always get the
 *   newest version, so an old worker can never trap anyone on an old site.
 * - Files in /files are NEVER cached automatically (they are large). A file is kept
 *   only after the visitor opened or downloaded it (the page tells us which one).
 * - Bump VERSION when you change the site's code: old caches are deleted on activate.
 */
const VERSION = 'v1';
const SHELL = 'lnh-shell-' + VERSION;
const FILES = 'lnh-files';
const MAX_FILES = 40;
const FILES_DIR = 'files/';

const PRECACHE = [
  './', 'index.html', 'owner-guide.html', 'owner-guide.js', 'style.css', 'boot.js', 'script.js', 'config.js', 'translations.js',
  'manifest.webmanifest', 'files-index.json',
  'modules/storage.js', 'modules/util.js', 'modules/i18n.js', 'modules/parser.js', 'modules/loader.js',
  'modules/icons.js', 'modules/overlay.js', 'modules/toast.js', 'modules/grid.js', 'modules/page-shell.js',
  'modules/living-background.js', 'modules/reading-mode.js', 'modules/text-size.js', 'modules/subject-icons.js',
  'modules/descriptions.js', 'modules/reminder.js', 'modules/favourites.js', 'modules/done.js', 'modules/share.js',
  'modules/contact.js', 'modules/audio-player.js', 'modules/preview.js', 'modules/zip-download.js',
  'modules/timeline.js', 'modules/large-file.js', 'modules/recent.js', 'modules/exam-corner.js',
  'modules/glossary.js', 'modules/countdown.js', 'modules/qr-tile.js', 'modules/credits.js',
  'modules/extra-tiles.js', 'modules/updated-notice.js', 'modules/shortcuts.js', 'modules/back-to-top.js',
  'modules/footer.js', 'modules/pwa.js', 'modules/help.js', 'modules/quick-guide.js',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/lexend-latin-600-normal.woff2', 'fonts/lexend-latin-700-normal.woff2',
  'fonts/tajawal-arabic-400-normal.woff2', 'fonts/tajawal-arabic-500-normal.woff2', 'fonts/tajawal-arabic-700-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/bg-dark.jpg', 'icons/bg-light.jpg',
  'vendor/qrcode.min.js',
];

const marked = new Set(); // file URLs the visitor opened/downloaded in this session

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // one by one: a single missing file must not stop the install
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('lnh-shell-') && n !== SHELL).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'skip-waiting') self.skipWaiting();
  if (data.type === 'cache-file' && typeof data.url === 'string') {
    marked.add(data.url);
    if (marked.size > 200) marked.clear();
  }
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request, isPage) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(request), timeout(isPage ? 5000 : 4000)]);
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (isPage) {
      const home = (await cache.match('index.html')) || (await cache.match('./'));
      if (home) return home;
    }
    return fetch(request); // last try without the timeout
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) {
    fetch(request).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(request, res.clone()); }).catch(() => {});
    return hit;
  }
  const res = await fetch(request);
  if (res && res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function fileRequest(request) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok && res.status === 200 && res.type === 'basic' && marked.has(request.url)) {
    const copy = res.clone();
    (async () => {
      try {
        // keep one version per file, and not too many files
        const path = new URL(request.url).pathname;
        const keys = await cache.keys();
        for (const k of keys) if (new URL(k.url).pathname === path) await cache.delete(k);
        await cache.put(request, copy);
        const after = await cache.keys();
        for (let i = 0; i < after.length - MAX_FILES; i += 1) await cache.delete(after[i]);
      } catch (e) { /* storage full or blocked: ignore */ }
    })();
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;          // GitHub API etc.: untouched
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;
  const rel = url.pathname.slice(scope.length);

  if (rel.startsWith(FILES_DIR)) {
    if (request.headers.has('range')) return;               // audio seeking: straight to the network
    event.respondWith(fileRequest(request));
    return;
  }
  if (rel === 'service-worker.js' || rel === 'tests.html') return;

  const isPage = request.mode === 'navigate';
  if (isPage || /\.(html|js|mjs|css|json|webmanifest)$/i.test(rel) || rel === '') {
    event.respondWith(networkFirst(request, isPage));
    return;
  }
  event.respondWith(cacheFirst(request));
});
