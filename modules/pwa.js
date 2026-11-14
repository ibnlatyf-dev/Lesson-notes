// F7 — Offline install (PWA): registers the service worker (HTTPS or localhost only),
// shows a "new version, refresh" toast, and keeps the install prompt for the Help menu.
import { t } from './i18n.js';
import { fileUrl } from './util.js';

export function init(app) {
  let deferred = null;
  let reloading = false;
  const ua = String(navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  let standalone = false;
  try { standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { standalone = false; }

  app.pwa = {
    isIOS,
    standalone,
    canPrompt: () => !!deferred,
    canInstall: () => !standalone && (!!deferred || isIOS),
    async promptInstall() {
      if (!deferred) return false;
      const ev = deferred;
      deferred = null;
      try {
        ev.prompt();
        const choice = await ev.userChoice;
        app.emit('installable');
        return !!choice && choice.outcome === 'accepted';
      } catch { return false; }
    },
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    app.emit('installable');
  });
  window.addEventListener('appinstalled', () => { deferred = null; standalone = true; app.pwa.standalone = true; app.emit('installable'); });

  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;

  const offerRefresh = (worker) => {
    app.toast(t('pwa.update'), {
      type: 'info', id: 'pwa-update', duration: 0, icon: 'arrows-clockwise',
      actions: [{
        label: t('pwa.refresh'), primary: true,
        onClick: () => {
          reloading = true;
          try { worker.postMessage({ type: 'skip-waiting' }); } catch { /* ignore */ }
          setTimeout(() => location.reload(), 1200); // even if the worker never answers
        },
      }],
    });
  };

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('service-worker.js');
      if (reg.waiting && navigator.serviceWorker.controller) offerRefresh(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerRefresh(worker);
        });
      });
      // look for a newer version whenever the tab comes back
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.info('[LNH] offline mode not available:', err && err.message);
    }
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
  });
  if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });

  // Keep a file for offline use only after the visitor opened or downloaded it.
  const maxBytes = (Number(app.config.offlineFileMaxMB) > 0 ? Number(app.config.offlineFileMaxMB) : 20) * 1048576;
  const remember = ({ file }) => {
    try {
      if (!file || file.kind === 'audio' || (file.size || 0) > maxBytes) return;
      const ctl = navigator.serviceWorker.controller;
      if (ctl) ctl.postMessage({ type: 'cache-file', url: new URL(fileUrl(file), location.href).href });
    } catch { /* ignore */ }
  };
  app.on('download', remember);
  app.on('open', remember);
}
