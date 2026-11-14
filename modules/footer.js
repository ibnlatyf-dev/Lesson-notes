// F22 — Privacy note in the footer.  F23 — discreet owner links ("Add files", Owner guide).
// Only the repo owner can actually upload, so the link is safe for visitors to see.

export function init(app) {
  const privacy = document.getElementById('privacy-line');
  if (privacy) privacy.hidden = !app.flag('privacyNote');

  const owner = document.getElementById('owner-links');
  if (owner) owner.hidden = !app.flag('ownerLinks');
  if (!app.flag('ownerLinks')) return;

  const add = document.getElementById('link-add-files');
  if (add) {
    const repo = app.repo();
    const dir = String(app.config.filesDir || 'files').split('/').map(encodeURIComponent).join('/');
    if (repo) {
      add.href = 'https://github.com/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.name) +
        '/upload/' + repo.branch.split('/').map(encodeURIComponent).join('/') + '/' + dir;
      add.hidden = false;
    } else {
      add.hidden = true; // repo not known yet (set it in config.js)
    }
  }
}
