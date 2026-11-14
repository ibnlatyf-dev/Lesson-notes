// F12 — "Recently opened": the last 5 files opened or downloaded on this device, as glass chips.
import { el, bdi } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { makeTile, kindIcon } from './grid.js';

const MAX = 5;

export function init(app) {
  const saved = app.store.local.get('recent', []);
  let recent = Array.isArray(saved) ? saved.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  let tileRef = null;
  let listRef = null;

  const render = () => {
    if (!tileRef || !listRef) return;
    listRef.textContent = '';
    const files = recent.map((p) => app.files.find((f) => f.path === p)).filter(Boolean);
    for (const f of files) {
      listRef.append(el('li', null, el('button', {
        class: 'chip chip-file',
        attrs: { type: 'button', 'aria-label': t('file.open', { name: f.title }) },
        on: { click: () => app.open(f, null) },
      }, icon(kindIcon(f.kind)), bdi(f.title))));
    }
    const wasHidden = tileRef.hidden;
    tileRef.hidden = files.length === 0;
    if (wasHidden !== tileRef.hidden && app.ready) app.applyFilters();
  };

  const add = ({ file }) => {
    if (!file) return;
    recent = [file.path, ...recent.filter((p) => p !== file.path)].slice(0, MAX);
    app.store.local.set('recent', recent);
    render();
  };
  app.on('open', add);
  app.on('download', add);

  app.hook('tiles', {
    id: 'recent', order: 310,
    build() {
      const clear = el('button', {
        class: 'btn btn-small btn-ghost', text: t('recent.clear'), attrs: { type: 'button' },
        on: { click: () => { recent = []; app.store.local.remove('recent'); render(); } },
      });
      const { tile, body } = makeTile('recent', { className: 'tile-recent', title: t('recent.title'), icon: 'clock-counter-clockwise', headerExtra: clear });
      listRef = el('ul', { class: 'chip-list' });
      body.append(listRef);
      tileRef = tile;
      const files = recent.filter((p) => app.files.some((f) => f.path === p));
      tile.hidden = files.length === 0;
      const ready = app.ready;
      app.ready = false; // render() must not re-filter while the grid is still being built
      render();
      app.ready = ready;
      return tile;
    },
  });
}
