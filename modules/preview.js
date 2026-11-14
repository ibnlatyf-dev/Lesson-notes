// F1 — Preview before download, in a glass viewer.
// PDF: the browser's own viewer in an iframe (with a fallback). Images: shown directly.
// Word / PowerPoint cannot be previewed without sending them to an outside service,
// so they get an info card with the Download button. Files never leave this site.
import { el, bdi, fileUrl, iconButton } from './util.js';
import { icon } from './icons.js';
import { t, fmtDate, fmtSize, pick } from './i18n.js';
import { openOverlay } from './overlay.js';
import { buildBadges, buildDownloadLink, kindIcon } from './grid.js';

function infoCard(app, file, note) {
  const rows = el('dl', { class: 'info-list' });
  const add = (label, valueNode) => { rows.append(el('dt', { text: label }), el('dd', null, valueNode)); };
  add(t('preview.subject'), bdi(app.subjectName(file.subjectKey)));
  if (file.ext) add(t('preview.type'), el('span', { text: file.ext.toUpperCase(), attrs: { dir: 'ltr' } }));
  const size = fmtSize(file.size);
  if (size) add(t('preview.size'), el('span', { text: size }));
  if (file.date) add(t('preview.added'), el('span', { text: fmtDate(file.date, 'long') }));
  const card = el('div', { class: 'info-card' },
    el('span', { class: 'info-icon file-icon kind-' + file.kind }, icon(kindIcon(file.kind))));
  const desc = app.fileDesc ? pick(app.fileDesc(file)) : '';
  if (desc) card.append(el('p', { class: 'info-desc' }, bdi(desc)));
  card.append(rows);
  if (note) card.append(el('p', { class: 'info-note', text: note }));
  return card;
}

export function init(app) {
  const open = (file, row) => {
    const url = fileUrl(file);
    const returnFocus = row ? row.querySelector('.file-main') : document.activeElement;
    const entry = openOverlay({
      label: t('preview.label', { name: file.title }),
      className: 'overlay-viewer',
      panelClass: 'viewer',
      useHistory: true,
      returnFocus,
      build(panel) {
        const head = el('header', { class: 'viewer-head' },
          el('span', { class: 'file-icon kind-' + file.kind }, icon(kindIcon(file.kind))),
          el('div', { class: 'viewer-titles' },
            el('h2', { class: 'viewer-title' }, bdi(file.title)),
            buildBadges(app, file)));
        const stage = el('div', { class: 'viewer-stage' });
        const newTab = () => el('a', { class: 'btn', attrs: { href: url, target: '_blank', rel: 'noopener' } },
          icon('arrow-square-out'), el('span', { text: t('preview.newTab') }));
        const foot = el('footer', { class: 'viewer-foot' });

        if (file.kind === 'pdf') {
          const canEmbed = navigator.pdfViewerEnabled !== false;
          if (canEmbed) {
            stage.classList.add('stage-frame');
            stage.append(el('iframe', { class: 'viewer-frame', attrs: { src: url, title: file.title, loading: 'lazy' } }));
            foot.append(el('p', { class: 'viewer-hint', text: t('preview.pdfHint') }));
          } else {
            stage.append(infoCard(app, file, t('preview.pdfBlocked')));
          }
          foot.append(newTab());
        } else if (file.kind === 'image') {
          stage.classList.add('stage-image');
          const img = el('img', { class: 'viewer-image', attrs: { src: url, alt: file.title, decoding: 'async' } });
          img.addEventListener('error', () => {
            stage.textContent = '';
            stage.classList.remove('stage-image');
            stage.append(infoCard(app, file, t('preview.loadFailed')));
          });
          stage.append(img);
          foot.append(newTab());
        } else if (file.kind === 'audio') {
          stage.append(infoCard(app, file),
            el('audio', { class: 'viewer-audio', attrs: { controls: true, preload: 'none', src: url } }));
        } else {
          const note = file.kind === 'word' || file.kind === 'slides' ? t('preview.noPreviewOffice') : t('preview.noPreview');
          stage.append(infoCard(app, file, note));
        }

        if (app.share) {
          const shareBtn = iconButton(icon('share-network'), t('share.button'), () => app.share(file, shareBtn));
          foot.append(shareBtn);
        }
        foot.append(buildDownloadLink(app, file));
        panel.append(head, stage, foot);
      },
    });
    return !entry.failed;
  };

  app.hook('openers', { order: 50, open });
  app.preview = { open };
}
