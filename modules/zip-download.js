// F2 — "Download all" for a subject: zips that subject's files in the browser with the
// vendored JSZip. Progress bar, size warning, cancel, per-file failures are skipped and reported.
import { el, iconButton, fileUrl, loadScript } from './util.js';
import { icon } from './icons.js';
import { t, fmtSize, fmtNum } from './i18n.js';
import { openOverlay } from './overlay.js';

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'files';
}

export function init(app) {
  const run = (subject, trigger) => {
    const files = subject.files.slice();
    const total = files.reduce((s, f) => s + (f.size || 0), 0);
    const warnBytes = (Number(app.config.zipWarnMB) > 0 ? Number(app.config.zipWarnMB) : 50) * 1048576;
    const name = app.subjectName(subject.key);
    let ctrl = null;
    let cancelled = false;
    let finished = false;
    let objectUrl = '';

    const entry = openOverlay({
      label: t('zip.title', { name }),
      className: 'overlay-center',
      panelClass: 'menu-panel zip-panel',
      closeOnOutside: false,
      returnFocus: trigger,
      onClose() {
        cancelled = !finished;
        try { if (ctrl) ctrl.abort(); } catch { /* ignore */ }
        if (objectUrl) setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ } }, 60000);
      },
      build(panel, api) {
        const status = el('p', { class: 'zip-status', attrs: { 'aria-live': 'polite' } });
        const bar = el('div', { class: 'progress-bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': t('zip.progress') } },
          el('span', { class: 'progress-fill' }));
        const fill = bar.firstChild;
        const failedBox = el('div', { class: 'zip-failed', hidden: true });
        const buttons = el('div', { class: 'btn-row' });
        const setProgress = (k) => {
          const pct = Math.round(Math.min(1, Math.max(0, k)) * 100);
          fill.style.transform = 'scaleX(' + pct / 100 + ')';
          bar.setAttribute('aria-valuenow', String(pct));
        };
        const cancelBtn = el('button', { class: 'btn', text: t('common.cancel'), attrs: { type: 'button' }, on: { click: () => api.close() } });

        panel.append(
          el('h2', { class: 'panel-title' }, el('span', { text: t('zip.heading') + ' ' }), el('bdi', { text: name })),
          el('p', { class: 'panel-sub', text: t('zip.summary', { n: fmtNum(files.length), size: fmtSize(total) || '—' }) }),
          status, bar, failedBox, buttons);

        const start = async () => {
          buttons.textContent = '';
          buttons.append(cancelBtn);
          bar.hidden = false;
          status.textContent = t('zip.preparing');
          const failed = [];
          try {
            await loadScript('vendor/jszip.min.js');
            if (typeof window.JSZip !== 'function') throw new Error('JSZip missing');
            const zip = new window.JSZip();
            const used = new Set();
            let doneBytes = 0;
            for (let i = 0; i < files.length; i += 1) {
              if (cancelled) return;
              const f = files[i];
              status.textContent = t('zip.fetching', { i: fmtNum(i + 1), n: fmtNum(files.length) });
              try {
                ctrl = typeof AbortController === 'function' ? new AbortController() : null;
                const res = await fetch(fileUrl(f), { signal: ctrl ? ctrl.signal : undefined });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const blob = await res.blob();
                let entryName = safeName(f.name);
                let n = 2;
                while (used.has(entryName.toLowerCase())) { entryName = safeName(f.name).replace(/(\.[^.]*)?$/, ' (' + n + ')$1'); n += 1; }
                used.add(entryName.toLowerCase());
                zip.file(entryName, blob, { binary: true, date: f.ts ? new Date(f.ts) : new Date() });
              } catch (err) {
                if (cancelled) return;
                failed.push(f.name);
              }
              doneBytes += f.size || 0;
              setProgress(0.85 * (total > 0 ? doneBytes / total : (i + 1) / files.length));
            }
            if (cancelled) return;
            if (failed.length === files.length) throw new Error('all files failed');
            status.textContent = t('zip.packing');
            const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true },
              (meta) => { setProgress(0.85 + 0.15 * (meta.percent || 0) / 100); });
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            const a = el('a', { attrs: { href: objectUrl, download: safeName(name) + '.zip', hidden: true } });
            document.body.append(a);
            a.click();
            a.remove();
            finished = true;
            setProgress(1);
            status.textContent = failed.length
              ? t('zip.doneSome', { ok: fmtNum(files.length - failed.length), n: fmtNum(files.length) })
              : t('zip.done');
          } catch (err) {
            if (cancelled) return;
            finished = true;
            console.warn('[LNH] zip failed:', err);
            status.textContent = t('zip.failed');
            bar.hidden = true;
          }
          if (failed.length) {
            failedBox.hidden = false;
            failedBox.append(el('p', { text: t('zip.skipped') }));
            const ul = el('ul');
            for (const n of failed) ul.append(el('li', null, el('bdi', { text: n })));
            failedBox.append(ul);
          }
          buttons.textContent = '';
          buttons.append(el('button', { class: 'btn btn-primary', text: t('common.close'), attrs: { type: 'button' }, on: { click: () => api.close() } }));
        };

        if (total > warnBytes) {
          bar.hidden = true;
          status.textContent = t('zip.warn', { size: fmtSize(total) });
          status.classList.add('is-warn');
          buttons.append(
            el('button', { class: 'btn btn-primary', text: t('zip.continue'), attrs: { type: 'button' }, on: { click: () => { status.classList.remove('is-warn'); start(); } } }),
            cancelBtn);
        } else {
          start();
        }
      },
    });
    return entry;
  };

  app.hook('subjectHeader', {
    order: 20,
    build(subject) {
      if (subject.files.length < 2) return null;
      const btn = iconButton(icon('file-zip'), t('zip.button'), () => run(subject, btn), 'act-zip');
      return btn;
    },
  });
  app.zip = { run };
}
