/* Lesson Notes Hub — boot.js
 * Tiny classic script that runs before anything paints.
 * 1) Defines the ONE safe storage helper (window.LNHStore). Nothing else in the
 *    site touches localStorage / sessionStorage directly.
 * 2) Applies the saved language, theme, text size and reading mode early so
 *    there is no flash of the wrong look.
 * 3) Shows a plain message if the main script can never start.
 */
(function () {
  'use strict';
  var PREFIX = 'lnh:';

  function makeStore(kind) {
    var real = null;
    var mem = {};
    try {
      real = window[kind];
      var probe = PREFIX + '__probe';
      real.setItem(probe, '1');
      real.removeItem(probe);
    } catch (e) {
      real = null; // blocked (private mode, in-app browser…): use memory only
    }
    return {
      persistent: !!real,
      get: function (key, fallback) {
        var raw = null;
        try { if (real) raw = real.getItem(PREFIX + key); } catch (e) { raw = null; }
        if (raw === null || raw === undefined) {
          raw = Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
        }
        if (raw === null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
      },
      set: function (key, value) {
        var raw;
        try { raw = JSON.stringify(value); } catch (e) { return false; }
        if (raw === undefined) return false;
        mem[key] = raw;
        try { if (real) { real.setItem(PREFIX + key, raw); return true; } } catch (e) { /* quota or blocked */ }
        return false;
      },
      remove: function (key) {
        delete mem[key];
        try { if (real) real.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
      }
    };
  }

  var store = { local: makeStore('localStorage'), session: makeStore('sessionStorage'), makeStore: makeStore };
  window.LNHStore = store;

  function mq(q) {
    try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; }
  }

  try {
    var root = document.documentElement;

    // Language: saved choice, otherwise the device language (F32).
    var lang = store.local.get('lang', null);
    if (lang !== 'ar' && lang !== 'en') {
      var nav = '';
      try { nav = String((navigator.languages && navigator.languages[0]) || navigator.language || ''); } catch (e) { nav = ''; }
      lang = nav.toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
    }
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Theme: saved choice, otherwise the system setting (dark unless the system asks for light).
    var theme = store.local.get('theme', null);
    if (theme !== 'dark' && theme !== 'light') theme = mq('(prefers-color-scheme: light)') ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);

    // Text size (F20)
    var steps = [0.9, 1, 1.2, 1.4];
    var step = store.local.get('textStep', 1);
    if (typeof step !== 'number' || !steps[step]) step = 1;
    root.style.setProperty('--text-scale', String(steps[step]));

    // Reading mode (F21): saved choice, otherwise follows prefers-reduced-motion.
    var reading = store.local.get('reading', null);
    if (reading !== true && reading !== false) reading = mq('(prefers-reduced-motion: reduce)');
    if (reading) root.classList.add('reading');

    // Low-end devices get lighter blur.
    var lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;
    var lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;
    if (lowMem || lowCpu || mq('(prefers-reduced-transparency: reduce)')) root.classList.add('low-end');

    root.classList.add('js');
  } catch (e) { /* never block the page */ }

  // If the main script never starts (very old browser, blocked modules), say so plainly.
  window.__lnhStarted = false;
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (window.__lnhStarted) return;
      var box = document.getElementById('fatal');
      if (box) box.hidden = false;
    }, 4000);
  });
})();
