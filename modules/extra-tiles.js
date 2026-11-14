// Optional extra tiles from config.js (extraTiles). Each entry needs enabled: true and a title.
// The Awqat app entry ships switched off.
import { el, isPlainObject, safeHttpUrl } from './util.js';
import { icon, hasIcon } from './icons.js';
import { pick } from './i18n.js';
import { makeTile } from './grid.js';

export function init(app) {
  const list = (Array.isArray(app.config.extraTiles) ? app.config.extraTiles : [])
    .filter((x) => isPlainObject(x) && x.enabled === true && (pick(x.title) || (x.title && (x.title.ar || x.title.en))));
  list.forEach((x, i) => {
    app.hook('tiles', {
      id: 'extra-' + String(x.id || i).replace(/[^\w-]/g, ''), order: 600 + i,
      build() {
        const title = pick(x.title);
        if (!title) return null;
        const { tile, body } = makeTile('extra', { className: 'tile-extra', title, icon: hasIcon(x.icon) ? x.icon : 'sparkle' });
        const text = pick(x.text);
        if (text) body.append(el('p', { class: 'tile-text' }, el('bdi', { text })));
        const url = safeHttpUrl(x.url);
        if (url) {
          body.append(el('div', { class: 'btn-row' },
            el('a', { class: 'btn', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } },
              icon('arrow-square-out'), el('bdi', { text: pick(x.linkLabel) || title }))));
        }
        return tile;
      },
    });
  });
}
