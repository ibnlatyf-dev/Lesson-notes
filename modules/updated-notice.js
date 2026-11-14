// F4 — "3 new files since your last visit": a small dismissible glass banner.
// Uses the index dates and the stored last-visit time. Tapping it scrolls to and
// highlights the new files. The visit time is stored only after the page has loaded.
import { el } from './util.js';
import { icon } from './icons.js';
import { t, plural } from './i18n.js';

export function init(app) {
  let fresh = [];
  let dismissed = false;
  let node = null;

  const render = () => {
    if (node) { node.remove(); node = null; }
    if (dismissed || !fresh.length) return;
    const show = () => {
      const present = fresh.filter((p) => app.rows.has(p));
      if (!present.length) return;
      app.reveal(present[0]);
      for (const p of present) {
        const row = app.rows.get(p);
        if (!row) continue;
        row.classList.remove('flash');
        void row.offsetWidth;
        row.classList.add('flash');
        setTimeout(() => row.classList.remove('flash'), 2600);
      }
      app.sweep('jump');
    };
    node = el('div', { class: 'notice glass notice-new', attrs: { role: 'status' } },
      el('span', { class: 'notice-icon' }, icon('sparkle')),
      el('span', { class: 'notice-text', text: plural('notice.newFiles', fresh.length) }),
      el('button', { class: 'btn btn-small btn-primary', text: t('notice.show'), attrs: { type: 'button' }, on: { click: show } }),
      el('button', {
        class: 'icon-btn', attrs: { type: 'button', 'aria-label': t('common.dismiss'), title: t('common.dismiss') },
        on: { click: () => { dismissed = true; render(); } },
      }, icon('x')));
    app.dom.notices.prepend(node);
  };

  app.on('ready', () => {
    const now = Date.now();
    const last = Number(app.store.local.get('lastVisit', 0)) || 0;
    if (last > 0) {
      fresh = app.files.filter((f) => f.ts > last && f.ts <= now + 86400000).sort((a, b) => b.ts - a.ts).map((f) => f.path);
    }
    render();
    // remember this visit only once the page has really loaded
    const remember = () => setTimeout(() => app.store.local.set('lastVisit', now), 1500);
    if (document.readyState === 'complete') remember(); else window.addEventListener('load', remember, { once: true });
  });
  app.on('lang', render);
  app.updatedNotice = { fresh: () => fresh.slice() };
}
