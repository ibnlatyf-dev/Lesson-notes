// File-list loader with fallbacks (section 3.3):
//   1) files-index.json (static, built by the GitHub Action)
//   2) GitHub API (one request)        — only if 1 fails
//   3) last good list saved on device  — only if 1 and 2 fail
// File contents are never downloaded here.
import { fetchJson, isPlainObject } from './util.js';

const CACHE_KEY = 'lastList';

/** Work out owner/repo/branch from config, or from a *.github.io address. */
export function resolveRepo(config, loc) {
  const r = (config && config.repo) || {};
  let owner = String(r.owner || '').trim();
  let name = String(r.name || '').trim();
  const branch = String(r.branch || 'main').trim() || 'main';
  const l = loc || (typeof location !== 'undefined' ? location : null);
  if ((!owner || !name) && l && /\.github\.io$/i.test(l.hostname || '')) {
    const host = l.hostname.replace(/\.github\.io$/i, '');
    const seg = String(l.pathname || '').split('/').filter(Boolean)[0] || '';
    if (!owner) owner = host;
    if (!name) name = seg && !/\.html?$/i.test(seg) ? seg : host + '.github.io';
  }
  const ok = /^[\w.-]+$/.test(owner) && /^[\w.-]+$/.test(name) && /^[\w./-]+$/.test(branch);
  return ok ? { owner, name, branch } : null;
}

function cleanPath(p, filesDir) {
  if (typeof p !== 'string') return '';
  let path = p.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
  if (!path || path.length > 600) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return '';           // no schemes (http:, javascript: …)
  if (path.split('/').some((s) => s === '..' || s === '')) return '';
  if (!path.startsWith(filesDir + '/')) path = filesDir + '/' + path;
  return path;
}

/** Validate + tidy an index. Throws if the overall shape is wrong; bad entries are dropped. */
export function validateIndex(json, filesDir = 'files') {
  const list = Array.isArray(json) ? json : isPlainObject(json) && Array.isArray(json.files) ? json.files : null;
  if (!list) throw new Error('index: wrong shape');
  const seen = new Set();
  const files = [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const path = cleanPath(item.path != null ? item.path : item.name, filesDir);
    if (!path || seen.has(path)) continue;
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (!name || name.startsWith('.')) continue;
    seen.add(path);
    const size = Number(item.size);
    let date = null;
    if (typeof item.date === 'string' && Number.isFinite(Date.parse(item.date))) date = new Date(item.date).toISOString();
    files.push({ path, name, size: Number.isFinite(size) && size > 0 ? size : 0, date });
  }
  const generated = isPlainObject(json) && typeof json.generated === 'string' && Number.isFinite(Date.parse(json.generated))
    ? json.generated : null;
  return { files, generated };
}

async function fromApi(config, fetchFn, loc) {
  const repo = resolveRepo(config, loc);
  if (!repo) throw new Error('repo not configured');
  const filesDir = config.filesDir || 'files';
  const url = 'https://api.github.com/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.name) +
    '/git/trees/' + encodeURIComponent(repo.branch) + '?recursive=1';
  const json = await fetchJson(url, { fetchFn, cache: 'default', headers: { Accept: 'application/vnd.github+json' } });
  if (!isPlainObject(json) || !Array.isArray(json.tree)) throw new Error('api: wrong shape');
  const items = json.tree
    .filter((n) => isPlainObject(n) && n.type === 'blob' && typeof n.path === 'string' && n.path.startsWith(filesDir + '/'))
    .map((n) => ({ path: n.path, size: n.size }));
  return validateIndex({ files: items }, filesDir);
}

/**
 * Returns { files, source: 'index' | 'api' | 'cache' | 'none', generated, savedAt }.
 * Never throws.
 */
export async function loadFileList({ config, store, fetchFn, loc } = {}) {
  const filesDir = (config && config.filesDir) || 'files';
  const save = (result) => {
    try { if (store) store.set(CACHE_KEY, { files: result.files, generated: result.generated, savedAt: Date.now() }); } catch { /* ignore */ }
  };

  try {
    const json = await fetchJson((config && config.indexPath) || 'files-index.json', { fetchFn });
    const result = validateIndex(json, filesDir);
    save(result);
    return { ...result, source: 'index' };
  } catch (err) {
    console.info('[LNH] files-index.json not usable, trying the GitHub API…');
  }

  try {
    const result = await fromApi(config || {}, fetchFn, loc);
    save(result);
    return { ...result, source: 'api' };
  } catch (err) {
    console.info('[LNH] GitHub API not usable, trying the saved list…');
  }

  try {
    const cached = store ? store.get(CACHE_KEY, null) : null;
    if (cached && Array.isArray(cached.files)) {
      const result = validateIndex({ files: cached.files, generated: cached.generated }, filesDir);
      return { ...result, source: 'cache', savedAt: Number(cached.savedAt) || null };
    }
  } catch { /* ignore */ }

  return { files: [], generated: null, source: 'none' };
}
