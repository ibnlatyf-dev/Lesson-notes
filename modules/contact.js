// F24 — Contact tile (WhatsApp / Instagram from config.js) with "Request a file".
// F30 — "Report an error" button on each file (prefilled WhatsApp message).
// No contact in config = everything here stays hidden. Nothing is invented.
import { el, iconButton, whatsappLink, siteUrl, openExternal } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { makeTile } from './grid.js';

function extLink(href, iconName, label, cls) {
  return el('a', { class: 'btn ' + (cls || ''), attrs: { href, target: '_blank', rel: 'noopener noreferrer' } },
    icon(iconName), el('span', { text: label }));
}

export function init(app) {
  const c = app.config.contact || {};
  const wa = whatsappLink(c.whatsapp);
  const handle = String(c.instagram || '').trim().replace(/^@/, '');
  const insta = /^[A-Za-z0-9._]{1,30}$/.test(handle) ? 'https://www.instagram.com/' + handle + '/' : '';
  if (!wa && !insta) return;

  const waWith = (text) => whatsappLink(c.whatsapp, text);
  app.contact = { wa, insta, handle, waWith };

  if (app.flag('contact')) {
    app.hook('tiles', {
      id: 'contact', order: 520,
      build() {
        const { tile, body } = makeTile('contact', { className: 'tile-contact', title: t('contact.title'), icon: 'chat-circle-dots' });
        body.append(el('p', { class: 'tile-text', text: t('contact.text') }));
        const row = el('div', { class: 'btn-row' });
        if (wa) row.append(extLink(waWith(t('contact.requestMsg', { link: siteUrl() })), 'whatsapp-logo', t('contact.request'), 'btn-primary'));
        if (insta) {
          const a = extLink(insta, 'instagram-logo', '@' + handle);
          a.querySelector('span').setAttribute('dir', 'ltr');
          row.append(a);
        }
        body.append(row);
        return tile;
      },
    });
  }

  if (app.flag('report') && wa) {
    app.hook('rowActions', {
      order: 40,
      build(file) {
        return iconButton(icon('flag'), t('report.button'), () => {
          const link = siteUrl() + '#f=' + encodeURIComponent(file.name);
          openExternal(waWith(t('report.msg', { name: file.name, link })));
        }, 'act-report');
      },
    });
  }
}
