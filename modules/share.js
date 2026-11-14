// F5 — Share per file: the device share sheet if available, otherwise a small menu
// with "Copy link" and "WhatsApp". The link opens the site and highlights the file.
import { el, iconButton, copyText, siteUrl, openExternal } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { openOverlay } from './overlay.js';

export function shareUrl(file) {
  return siteUrl() + '#f=' + encodeURIComponent(file.name);
}

export function init(app) {
  const menu = (file, returnFocus) => {
    const url = shareUrl(file);
    openOverlay({
      label: t('share.title'),
      className: 'overlay-center',
      panelClass: 'menu-panel',
      returnFocus,
      build(panel, api) {
        panel.append(
          el('h2', { class: 'panel-title', text: t('share.title') }),
          el('p', { class: 'panel-sub' }, el('bdi', { text: file.title })),
          el('div', { class: 'menu-list' },
            el('button', {
              class: 'btn btn-wide', attrs: { type: 'button' },
              on: { click: async () => {
                const ok = await copyText(url);
                app.toast(ok ? t('share.copied') : t('share.copyFailed'), { type: ok ? 'success' : 'warn', duration: 2500 });
                api.close();
              } },
            }, icon('copy'), el('span', { text: t('share.copy') })),
            el('button', {
              class: 'btn btn-wide', attrs: { type: 'button' },
              on: { click: () => { openExternal('https://wa.me/?text=' + encodeURIComponent(file.title + '\n' + url)); api.close(); } },
            }, icon('whatsapp-logo'), el('span', { text: t('share.whatsapp') }))));
      },
    });
  };

  const share = (file, returnFocus) => {
    const url = shareUrl(file);
    if (typeof navigator.share === 'function') {
      try {
        navigator.share({ title: file.title, text: file.title, url }).catch((err) => {
          if (!err || err.name !== 'AbortError') menu(file, returnFocus);
        });
        return;
      } catch { /* fall through to the menu */ }
    }
    menu(file, returnFocus);
  };

  app.share = share;
  app.hook('rowActions', {
    order: 30,
    build(file) {
      const btn = iconButton(icon('share-network'), t('share.button'), () => share(file, btn), 'act-share');
      return btn;
    },
  });
}
