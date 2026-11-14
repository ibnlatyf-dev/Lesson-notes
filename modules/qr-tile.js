// F8 — QR code tile: a QR of the site link (without the hash), drawn locally with the
// vendored qrcode-generator. Plus "Copy link". Handy for showing on a screen in class.
import { el, svg, loadScript, copyText, siteUrl } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { makeTile } from './grid.js';

export function drawQr(text) {
  if (typeof window.qrcode !== 'function') throw new Error('qrcode missing');
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
  const q = 3; // quiet zone
  return svg('svg', { viewBox: (-q) + ' ' + (-q) + ' ' + (n + 2 * q) + ' ' + (n + 2 * q), class: 'qr-svg', role: 'img', 'aria-label': t('qr.alt'), 'shape-rendering': 'crispEdges' },
    svg('rect', { x: -q, y: -q, width: n + 2 * q, height: n + 2 * q, fill: '#ffffff' }),
    svg('path', { d, fill: '#0B132B' }));
}

export function init(app) {
  app.hook('tiles', {
    id: 'qr', order: 500,
    build() {
      const url = siteUrl();
      if (!url) return null;
      const { tile, body } = makeTile('qr', { className: 'tile-qr', title: t('qr.title'), icon: 'qr-code' });
      const box = el('div', { class: 'qr-box' }, el('span', { class: 'qr-wait', text: t('common.loading') }));
      const render = async () => {
        try {
          await loadScript('vendor/qrcode.min.js');
          box.textContent = '';
          box.append(drawQr(url));
        } catch (err) {
          console.warn('[LNH] QR code unavailable:', err);
          box.hidden = true;
        }
      };
      if (typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) { io.disconnect(); render(); }
        }, { rootMargin: '300px' });
        io.observe(tile);
      } else render();

      body.append(
        el('div', { class: 'qr-wrap' }, box,
          el('div', { class: 'qr-side' },
            el('p', { class: 'tile-text', text: t('qr.text') }),
            el('p', { class: 'qr-url', text: url, attrs: { dir: 'ltr' } }),
            el('button', {
              class: 'btn', attrs: { type: 'button' },
              on: { click: async () => {
                const ok = await copyText(url);
                app.toast(ok ? t('share.copied') : t('share.copyFailed'), { type: ok ? 'success' : 'warn', duration: 2500 });
              } },
            }, icon('copy'), el('span', { text: t('share.copy') })))));
      return tile;
    },
  });
}
