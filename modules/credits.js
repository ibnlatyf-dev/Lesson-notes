// F25 — Credits tile: "Made by Sulaim" / "من إعداد سليم", with optional links from config.js.
import { el, isPlainObject, safeHttpUrl } from './util.js';
import { icon } from './icons.js';
import { t, pick } from './i18n.js';
import { makeTile } from './grid.js';

export function init(app) {
  app.hook('tiles', {
    id: 'credits', order: 900,
    build() {
      const { tile, body } = makeTile('credits', { className: 'tile-credits' });
      body.append(el('p', { class: 'credits-line' }, el('span', { class: 'tile-icon' }, icon('heart')), el('span', { text: t('credits.madeBy') })));
      const links = (Array.isArray(app.config.credits && app.config.credits.links) ? app.config.credits.links : [])
        .filter((l) => isPlainObject(l) && safeHttpUrl(l.url));
      if (links.length) {
        const row = el('div', { class: 'btn-row' });
        for (const l of links) {
          const label = pick(l.label) || l.url;
          row.append(el('a', { class: 'btn btn-small', attrs: { href: safeHttpUrl(l.url), target: '_blank', rel: 'noopener noreferrer' } },
            icon('link'), el('bdi', { text: label })));
        }
        body.append(row);
      }
      return tile;
    },
  });
}
