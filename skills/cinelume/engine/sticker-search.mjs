#!/usr/bin/env node
// Cinelume sticker finder — "if there's no sticker for it, find one on the internet and animate it".
//
// Order:  1. built-in drawn sticker (vx-*)          — instant, matches the house style
//         2. your sticker pack (stickers/, ~/.cinelume/stickers, $CINELUME_STICKERS) — fuzzy file-name match
//         3. Iconify colour emoji / illustration sets — 3D-style Fluent Emoji, Noto, Twemoji, OpenMoji… (open licences, no key)
//         4. Openverse illustrations & clipart        — openly licensed PNG/SVG (no key)
//         5. Wikimedia Commons drawings & PNGs        — (no key)
//         6. a stock / open photo, background removed — die-cut photo sticker (Pexels/Unsplash/Pixabay keys if set)
// Everything found online is cached, credited in credits.txt, and cut out to a transparent PNG when needed.
//
// CLI:  node sticker-search.mjs "bullock cart" [--source any|emoji|clipart|photo] [--out stickers/] [--n 3]
//       downloads the best match(es) so you can look at them, then use them as pack:<name> or find:<query>.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Cinelume/2.0 (+https://github.com/liuantum/cinelume)';
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const strip = t => String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const getJSON = async (url) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
async function download(url, dest) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return dest; }

// ---------- 1. built-in drawn stickers ----------
export const BUILTIN_ALIASES = {
  'vx-fire': ['fire', 'flame', 'flames', 'hot', 'lit', 'trending'], 'vx-bolt': ['lightning', 'bolt', 'lightning bolt', 'electricity', 'power', 'energy', 'zap'],
  'vx-star': ['star', 'stars'], 'vx-heart': ['heart', 'love heart'], 'vx-rocket': ['rocket', 'launch', 'spaceship rocket'],
  'vx-check': ['check', 'tick', 'check mark', 'checkmark', 'correct'], 'vx-cross': ['cross', 'x mark', 'wrong'], 'vx-arrow': ['arrow'],
  'vx-money': ['money', 'cash', 'dollar', 'dollars', 'money bag'], 'vx-rupee': ['rupee', 'rupees', 'indian rupee', 'inr'],
  'vx-up': ['growth', 'chart up', 'trend up', 'increase', 'stocks up'], 'vx-down': ['decline', 'chart down', 'trend down', 'decrease', 'crash'],
  'vx-globe': ['globe', 'world', 'earth', 'planet earth'], 'vx-chip': ['chip', 'microchip', 'semiconductor', 'processor', 'cpu'],
  'vx-brain': ['brain', 'ai brain'], 'vx-bulb': ['bulb', 'light bulb', 'lightbulb', 'idea'], 'vx-trophy': ['trophy', 'award', 'cup trophy'],
  'vx-target': ['target', 'bullseye', 'goal target'], 'vx-clock': ['clock', 'time', 'alarm clock'], 'vx-lock': ['lock', 'padlock', 'security lock'],
  'vx-india': ['india', 'indian flag', 'india flag', 'flag of india'], 'vx-dish': ['satellite dish', 'dish antenna', 'satellite antenna'],
  'vx-cart': ['bullock cart', 'ox cart', 'bullock', 'bullock-cart'], 'vx-laptop': ['laptop', 'notebook computer', 'computer'],
  'vx-office': ['office', 'office building', 'tech park', 'office tower', 'skyscraper', 'corporate office'], 'vx-news': ['newspaper', 'news paper', 'news'],
  'vx-wow': ['wow', 'surprised face', 'shocked face'], 'vx-mindblown': ['mind blown', 'mindblown', 'exploding head'], 'vx-cool': ['cool', 'sunglasses face'],
  'vx-think': ['thinking', 'thinking face', 'hmm'], 'vx-laugh': ['laugh', 'laughing', 'lol'], 'vx-love': ['heart eyes', 'in love'],
};
const norm = q => String(q).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
export function builtinFor(q) { const n = norm(q); for (const [k, al] of Object.entries(BUILTIN_ALIASES)) if (al.includes(n) || al.includes(n.replace(/s$/, ''))) return k; return null; }

// ---------- 2. sticker packs (fuzzy) ----------
export function packDirs(baseDir) { return [path.join(baseDir || '.', 'stickers'), path.join(process.env.HOME || process.env.USERPROFILE || '', '.cinelume', 'stickers'), process.env.CINELUME_STICKERS || ''].filter(d => d && fs.existsSync(d)); }
const words = q => norm(q).split(/[\s-]+/).filter(w => w.length > 1 && !['a', 'an', 'the', 'of', 'and', 'with', 'old', 'vintage', 'cartoon', 'sticker', 'icon'].includes(w)).map(w => w.replace(/(ies)$/, 'y').replace(/(?<!s)s$/, ''));
const covers = (name, q) => { const nw = new Set(words(name.replace(/[_.]/g, ' '))); const qw = words(q); return qw.length > 0 && qw.every(w => nw.has(w)); };
export function packFind(q, baseDir) {
  for (const d of packDirs(baseDir)) for (const f of fs.readdirSync(d)) if (/\.(png|webp|svg|jpe?g)$/i.test(f) && covers(f.replace(/\.[a-z]+$/i, ''), q)) return path.join(d, f);
  return null;
}

// ---------- 3–6. internet ----------
const ICON_SETS = (process.env.CINELUME_ICON_SETS || 'fluent-emoji,noto,fluent-emoji-flat,twemoji,openmoji,emojione,fxemoji,flat-color-icons,streamline-emojis,logos').split(',');
const SOURCES = {
  // Iconify: 200k+ open-licensed icons; the colour emoji sets look like premium glossy stickers.
  async iconify(q) {
    const sets = /\blogo\b/i.test(q) ? ['logos', ...ICON_SETS] : ICON_SETS.filter(s => s !== 'logos');
    const qq = q.replace(/\blogo\b/ig, '').trim();
    const j = await getJSON(`https://api.iconify.design/search?query=${encodeURIComponent(qq)}&limit=96&prefixes=${sets.join(',')}`);
    const cands = (j.icons || []).map(id => { const [pre, name] = id.split(':'); return { pre, name }; })
      .filter(c => covers(c.name, qq))
      .map(c => ({ ...c, score: (sets.length - sets.indexOf(c.pre)) * 10 - c.name.length * .5 }))
      .sort((a, b) => b.score - a.score);
    return cands.map(c => { const col = (j.collections || {})[c.pre] || {}; const lic = col.license || {};
      return { url: `https://api.iconify.design/${c.pre}/${c.name}.svg?height=512`, ext: '.svg', cut: false, kind: 'emoji',
        credit: `"${c.name}" from ${col.name || c.pre}${col.author && col.author.name ? ' by ' + col.author.name : ''} — ${lic.title || lic.spdx || 'open licence'}${lic.url ? ' (' + lic.url + ')' : ''} — via Iconify` }; });
  },
  async openverse(q) {
    const j = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=30&license_type=commercial,modification&category=illustration,digitized_artwork&extension=png,svg&mature=false`);
    return (j.results || []).filter(r => covers((r.title || '') + ' ' + (r.tags || []).map(t => t.name).join(' '), q) || covers(r.title || '', q))
      .map(r => ({ url: r.url, ext: /svg/i.test(r.filetype || r.url) ? '.svg' : '.png', cut: !/svg/i.test(r.filetype || r.url), kind: 'clipart',
        credit: `"${strip(r.title) || 'Untitled'}" by ${strip(r.creator) || 'unknown'} — ${String(r.license || '').toUpperCase()} ${r.license_version || ''} — ${r.foreign_landing_url || r.url}` }));
  },
  async wikimedia(q) {
    const out = [];
    for (const kind of ['filetype:drawing', 'filemime:image/png']) {
      const j = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q + ' ' + kind)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=900`);
      Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).forEach(p => {
        const ii = (p.imageinfo || [])[0]; if (!ii || !covers(String(p.title || '').replace(/^File:/, ''), q)) return; const m = ii.extmetadata || {};
        const lic = strip(m.LicenseShortName && m.LicenseShortName.value); if (/fair use|non-free/i.test(lic)) return;
        out.push({ url: ii.thumburl || ii.url, ext: '.png', cut: !/svg/.test(ii.mime || ''), kind: 'clipart',
          credit: `${String(p.title || '').replace(/^File:/, '')} — ${strip(m.Artist && m.Artist.value) || 'unknown'} — ${lic} — Wikimedia Commons (${ii.descriptionurl || ''})` });
      });
    }
    return out;
  },
  // Keyless photo fallback for the CLI (render.mjs passes its full Pexels/Unsplash/Pixabay chain instead).
  async openversePhoto(q) {
    const j = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&license_type=commercial,modification&category=photograph&mature=false`);
    return (j.results || []).filter(r => /jpe?g|png|webp/i.test(r.filetype || r.url)).map(r => ({ url: r.url, ext: '.jpg', cut: true, kind: 'photo',
      credit: `"${strip(r.title) || 'Untitled'}" by ${strip(r.creator) || 'unknown'} — ${String(r.license || '').toUpperCase()} ${r.license_version || ''} — ${r.foreign_landing_url || r.url}` }));
  },
};
const ORDER = { any: ['iconify', 'openverse', 'wikimedia', 'photo'], emoji: ['iconify', 'openverse', 'wikimedia', 'photo'], clipart: ['openverse', 'wikimedia', 'iconify', 'photo'], photo: ['photo', 'wikimedia', 'openverse', 'iconify'] };

// Background removal / tidy: keeps existing transparency, else rembg, else flood-fills a plain background.
export function makeCutout(file, out) {
  const py = ['python3', 'python'].find(p => spawnSync(p, ['--version']).status === 0);
  if (!py) return null;
  const r = spawnSync(py, [path.join(HERE, '..', 'scripts', 'cutout.py'), file, out], { encoding: 'utf8' });
  return r.status === 0 && fs.existsSync(out) ? out : null;
}

/**
 * findSticker(query, { source, baseDir, cacheDir, log, photoSearch, n })
 * → { file, credit, origin: 'builtin'|'pack'|'iconify'|'openverse'|'wikimedia'|'photo', builtin? } or null
 * photoSearch(q) → { url, ext, credit } (render.mjs passes its stock chain)
 */
export async function findSticker(query, o = {}) {
  const log = o.log || (() => { }), q = String(query).trim(), source = ORDER[o.source] ? o.source : 'any';
  if (source === 'any' && !o.noBuiltin) { const b = builtinFor(q); if (b) return { builtin: b, origin: 'builtin' }; }
  const pk = packFind(q, o.baseDir); if (pk) return { file: pk, origin: 'pack' };
  const cacheDir = o.cacheDir || path.join(process.env.HOME || '.', '.cinelume', 'cache'); fs.mkdirSync(cacheDir, { recursive: true });
  const key = path.join(cacheDir, 'stk-' + hash(source + '|' + q + '|' + (o.n || 0)));
  const done = ['.svg', '.png'].map(e => key + e).find(f => fs.existsSync(f));
  if (done) return { file: done, credit: fs.existsSync(key + '.credit.txt') ? fs.readFileSync(key + '.credit.txt', 'utf8') : '', origin: 'cache' };
  if (process.env.CINELUME_NO_FREE_SEARCH && source !== 'photo') log('free sticker search disabled (CINELUME_NO_FREE_SEARCH)');
  for (const src of ORDER[source]) {
    let list = [];
    try {
      if (src === 'photo') { const hit = o.photoSearch ? await o.photoSearch(q) : (await SOURCES.openversePhoto(q))[0]; if (hit) list = [{ ...hit, cut: true, kind: 'photo' }]; }
      else if (!process.env.CINELUME_NO_FREE_SEARCH) list = await SOURCES[src](q);
    } catch (e) { log(`sticker search (${src}) failed for "${q}": ${e.message}`); continue; }
    for (const hit of list.slice(o.n || 0, (o.n || 0) + 3)) {
      try {
        const raw = key + '-raw' + hit.ext; await download(hit.url, raw);
        let file = raw;
        if (hit.ext === '.svg') { const svg = fs.readFileSync(raw, 'utf8'); if (!/<svg[\s>]/i.test(svg)) throw new Error('not an SVG'); fs.renameSync(raw, key + '.svg'); file = key + '.svg'; }
        else { const cut = makeCutout(raw, key + '.png'); if (cut) file = cut; else if (hit.kind === 'photo') { log(`cutout unavailable for "${q}" — install rembg (pip install rembg) for photo stickers`); fs.copyFileSync(raw, key + '.png'); file = key + '.png'; } else { fs.copyFileSync(raw, key + '.png'); file = key + '.png'; } }
        fs.writeFileSync(key + '.credit.txt', hit.credit || '');
        log('sticker', JSON.stringify(q), '->', src + ':', hit.credit);
        return { file, credit: hit.credit, origin: src };
      } catch (e) { log(`sticker download failed (${src}): ${e.message}`); }
    }
  }
  return null;
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const flag = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const source = flag('--source', 'any'), outDir = flag('--out', 'stickers'), n = +flag('--n', 1);
  const q = a.join(' ').trim();
  if (!q) { console.log('usage: node sticker-search.mjs "<what>" [--source any|emoji|clipart|photo] [--out stickers/] [--n 3]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const slug = norm(q).replace(/\s+/g, '-');
  for (let i = 0; i < n; i++) {
    const r = await findSticker(q, { source, n: i, noBuiltin: i > 0, baseDir: '/nonexistent', log: (...m) => console.error('[sticker]', ...m) });
    if (!r) { console.log(i ? `no more matches for "${q}"` : `nothing found for "${q}" — draw it with a character prop or use a photo: cutout:<file>`); break; }
    if (r.builtin) { console.log(`built-in sticker: { "type": "${r.builtin}" }`); continue; }
    const dest = path.join(outDir, slug + (i ? '-' + (i + 1) : '') + path.extname(r.file)); fs.copyFileSync(r.file, dest);
    if (r.credit) fs.appendFileSync(path.join(outDir, 'CREDITS.txt'), `${path.basename(dest)}: ${r.credit}\n`);
    console.log(`${dest}   (${r.origin})  →  { "type": "pack:${path.basename(dest).replace(/\.[a-z]+$/, '')}" }`);
  }
}
