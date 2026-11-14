// F35 — Help that is always one tap away: floating "?", "?" in the top bar, the Help tile,
// the footer link — all open the same glass Help menu.
// If this module is off or fails, those "?" controls stay plain links to owner-guide.html.
import { el, mq } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { openOverlay } from './overlay.js';
import { makeTile } from './grid.js';

const TAG_ICON = { full: 'files', summary: 'article', print: 'printer', updated: 'arrows-clockwise', exam: 'exam' };

function section(title, iconName, open, ...content) {
  const d = el('details', { class: 'help-section' },
    el('summary', null, el('span', { class: 'tile-icon' }, icon(iconName)), el('span', { class: 'help-sum', text: title }), el('span', { class: 'caret' }, icon('caret-down'))),
    el('div', { class: 'help-body' }, ...content));
  if (open) d.open = true;
  return d;
}

/** The naming rules, shared with the Help menu (and mirrored on the owner guide page). */
export function namingContent() {
  const example = (text) => el('code', { class: 'code-line', attrs: { dir: 'auto' } }, el('bdi', { text }));
  const tags = el('ul', { class: 'tag-help' });
  for (const id of ['full', 'summary', 'print', 'updated', 'exam']) {
    tags.append(el('li', null,
      el('span', { class: 'badge badge-' + id }, icon(TAG_ICON[id]), el('span', { text: t('tag.' + id) })),
      el('code', { text: t('naming.tag.' + id), attrs: { dir: 'ltr' } }),
      el('span', { text: t('naming.tagDesc.' + id) })));
  }
  return [
    el('p', { text: t('naming.intro') }),
    example('Subject - Lesson title [Tag].ext'),
    example('Tawheed - Lesson 3 [Summary].pdf'),
    example('الفقه - الدرس 5 [ملخص] [طباعة].pdf'),
    el('ul', { class: 'help-list' },
      el('li', { text: t('naming.rule.subject') }),
      el('li', { text: t('naming.rule.other') }),
      el('li', { text: t('naming.rule.lesson') }),
      el('li', { text: t('naming.rule.tags') }),
      el('li', { text: t('naming.rule.unknown') })),
    tags,
  ];
}

export function init(app) {
  let current = null;

  const open = (trigger) => {
    if (current) return current;
    const entry = openOverlay({
      label: t('help.title'),
      className: 'overlay-sheet',
      panelClass: 'help-panel',
      returnFocus: trigger && trigger.focus ? trigger : document.activeElement,
      onClose() { current = null; },
      build(panel, api) {
        panel.append(el('h2', { class: 'panel-title' }, icon('question'), el('span', { text: t('help.title') })));
        panel.append(el('p', { class: 'panel-sub', text: t('help.intro') }));

        if (app.quickGuide) {
          panel.append(el('button', {
            class: 'btn btn-primary btn-wide', attrs: { type: 'button' },
            on: { click: () => { api.close(); setTimeout(() => app.quickGuide.open(), 60); } },
          }, icon('lightbulb'), el('span', { text: t('help.showGuide') })));
        }

        if (app.shortcutsList && mq('(hover: hover) and (pointer: fine)')) {
          const dl = el('dl', { class: 'keys' });
          for (const s of app.shortcutsList) {
            const keys = el('dt');
            s.keys.forEach((k, i) => {
              if (i) keys.append(el('span', { class: 'key-then', text: s.keys.length === 2 && s.keys[0] === 'g' ? t('keys.then') : '' }));
              keys.append(el('kbd', { text: k, attrs: { dir: 'ltr' } }));
            });
            dl.append(keys, el('dd', { text: t(s.label) }));
          }
          panel.append(section(t('help.shortcuts'), 'keyboard', false, dl));
        }

        panel.append(section(t('help.naming'), 'tag', false, ...namingContent()));

        if (app.pwa && app.pwa.canInstall()) {
          const body = [el('p', { text: t('help.installText') })];
          if (app.pwa.canPrompt()) {
            body.push(el('button', {
              class: 'btn btn-primary', attrs: { type: 'button' },
              on: { click: async () => { const ok = await app.pwa.promptInstall(); if (ok) api.close(); } },
            }, icon('device-mobile'), el('span', { text: t('help.installButton') })));
          } else if (app.pwa.isIOS) {
            body.push(el('p', { class: 'help-note', text: t('help.installIOS') }));
          }
          panel.append(section(t('help.install'), 'device-mobile', false, ...body));
        }

        if (app.contact) {
          const row = el('div', { class: 'btn-row' });
          if (app.contact.wa) {
            row.append(el('a', { class: 'btn', attrs: { href: app.contact.waWith(t('contact.problemMsg', { link: location.origin + location.pathname })), target: '_blank', rel: 'noopener noreferrer' } },
              icon('whatsapp-logo'), el('span', { text: t('share.whatsapp') })));
          }
          if (app.contact.insta) {
            row.append(el('a', { class: 'btn', attrs: { href: app.contact.insta, target: '_blank', rel: 'noopener noreferrer' } },
              icon('instagram-logo'), el('span', { text: '@' + app.contact.handle, attrs: { dir: 'ltr' } })));
          }
          panel.append(section(t('help.contact'), 'chat-circle-dots', false, el('p', { text: t('help.contactText') }), row));
        }

        panel.append(section(t('help.privacy'), 'shield-check', false,
          el('p', { text: t('footer.privacy') }), el('p', { text: t('help.privacyMore') })));

        panel.append(el('p', { class: 'help-foot' },
          el('a', { class: 'link', attrs: { href: 'owner-guide.html' } }, icon('pencil-simple'), el('span', { text: t('footer.ownerGuide') }))));
      },
    });
    if (entry.failed) return null;
    current = entry;
    app.sweep('help');
    return entry;
  };

  // Every [data-help] control opens the menu (they are plain links until this runs).
  document.addEventListener('click', (e) => {
    const trigger = e.target && e.target.closest ? e.target.closest('[data-help]') : null;
    if (!trigger) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    try {
      if (app.quickGuide && app.quickGuide.isOpen()) app.quickGuide.close();
      const entry = open(trigger);
      if (entry) e.preventDefault(); // if the menu could not open, the plain link still works
    } catch (err) {
      console.warn('[LNH] help failed, using the plain page:', err);
    }
  });

  app.hook('tiles', {
    id: 'help', order: 800,
    build() {
      const { tile, body } = makeTile('help', { className: 'tile-help', title: t('help.title'), icon: 'question' });
      body.append(el('p', { class: 'tile-text', text: t('help.tileText') }),
        el('div', { class: 'btn-row' },
          el('a', { class: 'btn', attrs: { href: 'owner-guide.html#naming', 'data-help': '' } }, icon('question'), el('span', { text: t('help.open') }))));
      return tile;
    },
  });

  app.help = { open: () => open(null), close: () => { if (current) current.close(); }, isOpen: () => !!current };
}
