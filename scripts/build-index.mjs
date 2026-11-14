#!/usr/bin/env node
// Builds files-index.json: the list of everything inside /files that the site shows.
// Run by the GitHub Action on every push (see .github/workflows/index.yml).
// You can also run it yourself:   node scripts/build-index.mjs
//
// For each file it records: path, name, size (bytes), type, and date.
// "date" is the date of the last commit that added or changed the file (so a replaced
// file counts as new again). Outside git it falls back to the file's modified time.
// No dependencies. File contents are never read.

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES_DIR = 'files';
const OUT = join(ROOT, 'files-index.json');

const KINDS = {
  pdf: ['pdf'],
  slides: ['ppt', 'pptx', 'pps', 'ppsx', 'odp', 'key'],
  word: ['doc', 'docx', 'odt', 'rtf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'],
  audio: ['mp3', 'm4a', 'ogg', 'wav', 'aac', 'opus', 'oga'],
};
function kindOf(name) {
  const ext = extname(name).slice(1).toLowerCase();
  for (const [kind, exts] of Object.entries(KINDS)) if (exts.includes(ext)) return kind;
  return 'other';
}

function walk(dirAbs, dirRel, out) {
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;            // .gitkeep and other hidden files
    const abs = join(dirAbs, entry.name);
    const rel = posix.join(dirRel, entry.name);
    if (entry.isDirectory()) walk(abs, rel, out);
    else if (entry.isFile()) out.push({ abs, rel, name: entry.name });
  }
}

function gitDate(rel) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out && Number.isFinite(Date.parse(out))) return new Date(out).toISOString();
  } catch { /* not a git repo, or git missing */ }
  return null;
}

const found = [];
const filesAbs = join(ROOT, FILES_DIR);
if (existsSync(filesAbs)) walk(filesAbs, FILES_DIR, found);

const files = found
  .map(({ abs, rel, name }) => {
    const st = statSync(abs);
    return { path: rel, name, size: st.size, type: kindOf(name), date: gitDate(rel) || new Date(st.mtimeMs).toISOString() };
  })
  .sort((a, b) => a.path.localeCompare(b.path, 'en'));

// Only rewrite the file when the list really changed (so the bot does not commit for nothing).
let previous = null;
try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch { previous = null; }
const same = previous && Array.isArray(previous.files) && JSON.stringify(previous.files) === JSON.stringify(files);

if (same) {
  console.log(`files-index.json is already up to date (${files.length} files).`);
} else {
  const index = { generated: new Date().toISOString(), count: files.length, files };
  writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`files-index.json written: ${files.length} files.`);
}
