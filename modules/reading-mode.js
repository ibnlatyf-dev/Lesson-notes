// F21 — Reading-friendly mode: no animations, static background, less blur, calmer solid glass.
// Turns on by itself when the system asks for reduced motion (unless the visitor chose otherwise).
import { t } from './i18n.js';

export function init(app) {
  const root = document.documentElement;
  const btn = document.getElementById('btn-reading');
  let on = root.classList.contains('reading');

  const sync = () => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? t('nav.readingOff') : t('nav.readingOn');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    const text = btn.querySelector('.btn-label');
    if (text) text.textContent = t('nav.reading');
  };
  const set = (value, save) => {
    on = !!value;
    root.classList.toggle('reading', on);
    if (save) app.store.local.set('reading', on);
    sync();
    app.emit('reading', on);
  };

  if (btn) {
    btn.hidden = false;
    btn.addEventListener('click', () => {
      set(!on, true);
      app.toast(on ? t('reading.onToast') : t('reading.offToast'), { id: 'reading', duration: 2500 });
    });
  }
  try {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const follow = () => { if (app.store.local.get('reading', null) === null) set(m.matches, false); };
    if (m.addEventListener) m.addEventListener('change', follow);
  } catch { /* ignore */ }

  app.on('lang', sync);
  app.reading = { isOn: () => on, set };
  sync();
}
