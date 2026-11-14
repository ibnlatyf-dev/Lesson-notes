// Shared shell for the simple pages (owner-guide.html): language, theme, icons and the
// living background — the same look as the main site, with none of the file-list code.
import { CONFIG } from '../config.js';
import { store } from './storage.js';
import * as i18n from './i18n.js';
import { icon, hasIcon } from './icons.js';

export function initPage() {
  window.__lnhStarted = true;
  const root = document.documentElement;
  const listeners = new Map();
  const app = {
    config: CONFIG || {},
    store,
    lang: root.lang === 'ar' ? 'ar' : 'en',
    theme: root.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt).delete(fn);
    },
    emit(evt, data) {
      for (const fn of Array.from(listeners.get(evt) || [])) { try { fn(data); } catch (err) { console.warn('[LNH]', err); } }
    },
    sweep() { app.emit('sweep', 'page'); },
  };

  const motionOK = () => !root.classList.contains('reading') &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const fade = (fn) => {
    if (motionOK() && typeof document.startViewTransition === 'function') {
      try {
        let done = false;
        const once = () => { if (done) return; done = true; fn(); };
        const vt = document.startViewTransition(once);
        setTimeout(once, 450);
        for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) if (p && p.catch) p.catch(() => {});
        return;
      } catch { /* fall through */ }
    }
    root.classList.add('switching');
    fn();
    setTimeout(() => root.classList.remove('switching'), 360);
  };

  const paint = () => {
    i18n.applyStatic(document);
    const title = document.querySelector('[data-page-title]');
    if (title) document.title = i18n.t(title.getAttribute('data-page-title')) + ' · ' + i18n.t('site.title');
    const langLabel = document.querySelector('#btn-lang .lang-label');
    if (langLabel) langLabel.textContent = i18n.t('nav.langShort');
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      const slot = themeBtn.querySelector('.ic-slot');
      if (slot) { slot.textContent = ''; slot.append(icon(app.theme === 'dark' ? 'sun' : 'moon')); }
      const label = app.theme === 'dark' ? i18n.t('nav.themeLight') : i18n.t('nav.themeDark');
      themeBtn.setAttribute('aria-label', label);
      themeBtn.title = label;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', app.theme === 'dark' ? '#0B132B' : '#F7F5FB');
  };

  try {
    i18n.setLang(app.lang);
    document.querySelectorAll('[data-icon]').forEach((node) => {
      const name = node.getAttribute('data-icon');
      if (hasIcon(name) && !node.querySelector('svg')) node.prepend(icon(name));
    });
    paint();

    const langBtn = document.getElementById('btn-lang');
    if (langBtn) langBtn.addEventListener('click', () => {
      const next = app.lang === 'ar' ? 'en' : 'ar';
      fade(() => {
        app.lang = i18n.setLang(next);
        root.lang = next;
        root.dir = next === 'ar' ? 'rtl' : 'ltr';
        paint();
      });
      store.local.set('lang', next);
      app.sweep();
    });
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      app.theme = app.theme === 'dark' ? 'light' : 'dark';
      fade(() => { root.setAttribute('data-theme', app.theme); paint(); });
      store.local.set('theme', app.theme);
      app.emit('theme', app.theme);
      app.sweep();
    });
  } catch (err) {
    console.warn('[LNH] page shell failed:', err);
  }

  const features = (CONFIG && CONFIG.features) || {};
  if (features.livingBackground === false) {
    root.classList.add('bg-static');
  } else {
    import('./living-background.js')
      .then((m) => m.init(app))
      .catch((err) => { console.warn('[LNH] background unavailable:', err); root.classList.add('bg-static'); });
  }
  return app;
}
