// F31 — Large-file warning: a gentle toast ("Large file, use Wi-Fi") when a big file is
// downloaded. Never blocks. "Don't show again" lasts for this session.
import { t, fmtSize } from './i18n.js';

export function init(app) {
  app.on('download', ({ file }) => {
    if (!file || !app.isLarge(file)) return;
    if (app.store.session.get('largeHide', false)) return;
    app.toast(t('large.toast', { size: fmtSize(file.size) }), {
      type: 'warn',
      id: 'large-file',
      icon: 'wifi-high',
      duration: 7000,
      actions: [{ label: t('large.dontShow'), onClick: () => app.store.session.set('largeHide', true) }],
    });
  });
}
