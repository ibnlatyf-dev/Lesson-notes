// F3 — Favourites: a star on every file (saved only on this device) + "My files" chip.
import { iconButton, vibrate } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { makeChip } from './grid.js';

export function init(app) {
  const saved = app.store.local.get('favs', []);
  const favs = new Set(Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : []);
  let mine = false;
  const save = () => app.store.local.set('favs', Array.from(favs));

  const paint = (btn, on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? t('fav.remove') : t('fav.add');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = '';
    btn.append(icon(on ? 'star-fill' : 'star'));
  };

  app.hook('rowActions', {
    order: 10,
    build(file) {
      const btn = iconButton(icon('star'), t('fav.add'), () => {
        const on = !favs.has(file.path);
        if (on) favs.add(file.path); else favs.delete(file.path);
        save();
        paint(btn, on);
        vibrate(8);
        if (on) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
        if (mine) app.applyFilters();
      }, 'act-fav');
      paint(btn, favs.has(file.path));
      return btn;
    },
  });

  app.hook('filterChips', {
    order: 10,
    build() {
      return makeChip(t('fav.mine'), mine, (btn) => {
        mine = !mine;
        btn.setAttribute('aria-pressed', mine ? 'true' : 'false');
        app.applyFilters();
      }, { icon: 'star', className: 'chip-mine' });
    },
  });

  app.hook('filters', { id: 'mine', active: () => mine, test: (f) => favs.has(f.path) });
  app.on('clear-filters', () => { mine = false; });
  app.favs = { has: (p) => favs.has(p), count: () => favs.size };
}
