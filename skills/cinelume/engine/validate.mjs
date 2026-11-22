#!/usr/bin/env node
// Storyboard validator. Usage: node validate.mjs storyboard.json
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const SCENE_TYPES = {
  title: ['headline'], kinetic: [['lines', 'text']], bignumber: ['value'], bar: [['data', 'bars']], line: [['points', 'data']],
  donut: ['value'], icongrid: [['highlight', 'value']], map: [['highlight', 'countries', 'focus', 'pins', 'arcs']], photo: [], collage: [['media', 'images']],
  document: [['headline', 'body']], quote: [['text', 'quote']], timeline: ['events'], compare: [['left', 'a']], list: ['items'], chapter: ['title'],
  screen: [], broll: [], explain: [['headline', 'title']], flow: [['steps', 'nodes']], outro: [],
  cinematic: [['title', 'headline']], establishing: [['location', 'title']], opening: [['title', 'headline']], narrative: [['lines', 'text']], depth: [['headline', 'title']],
};
export const CAMERAS = ['static', 'drift', 'push-in', 'push-in-slow', 'pull-out', 'crash-zoom', 'zoom-out-reveal', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'dolly-zoom', 'orbit', 'handheld', 'whip-in', 'rack-focus', 'rack-focus-in', 'shake-hit', 'tilt-3d', 'spiral-in', 'dolly-in', 'dolly-out', 'crane-up', 'crane-down', 'truck-left', 'truck-right', 'parallax', 'steadicam', 'slow-push', 'reveal-pull'];
export const TRANSITIONS = ['cut', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'zoom-through', 'zoom-out', 'iris', 'circle-burst', 'paper-slide', 'tear', 'push', 'slide-up', 'flash', 'glitch', 'stack', 'spin', 'wipe-diagonal', 'blinds', 'fade', 'dissolve', 'dip-black', 'dip-white', 'light-leak', 'film-burn', 'lens-blur', 'cross-zoom', 'luma', 'slit'];
export const CINE_THEMES = ['noir', 'film', 'ivory', 'midnight', 'ember', 'slate'];
export const THEMES = [...CINE_THEMES, 'paper', 'dark', 'yellow', 'blueprint', 'red', 'navy', 'mint'];
export const CAPTIONS = ['cinema', 'subtitle', 'karaoke', 'boxed', 'minimal', 'none'];
export const GRADES = ['teal-orange', 'warm', 'cool', 'noir', 'bleach', 'none'];
export const BGS = ['paper', 'texture', 'grid', 'dots', 'lines', 'halftone', 'stripes', 'rays', 'gradient', 'spotlight', 'plain', 'atmos', 'haze', 'black'];
export const FXS = ['none', 'fade', 'pop', 'popBig', 'rise', 'riseBig', 'drop', 'slideL', 'slideR', 'slideU', 'slideD', 'stamp', 'zoom', 'spin', 'blur', 'wipe', 'wipeUp', 'flipX', 'swing', 'typeOn', 'blurIn', 'reveal', 'rise3d', 'settle'];

export function stickerDefs() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(HERE, 'runtime', 'stickers.js'), 'utf8'), ctx);
  return ctx.window.CINE_STICKERS;
}
export function stickerNames() { return Object.keys(stickerDefs()); }

export function validate(sb, baseDir = '.') {
  const errors = [], warnings = [];
  const defs = stickerDefs(); const stickers = new Set(Object.keys(defs));
  const premium = Object.keys(defs).filter(k => !defs[k].legacy);
  if (!sb || typeof sb !== 'object') return { errors: ['storyboard is not an object'], warnings };
  const meta = sb.meta || {};
  if (meta.theme && !THEMES.includes(meta.theme)) errors.push(`meta.theme "${meta.theme}" unknown. Use one of: ${THEMES.join(', ')}`);
  const cineGlobal = CINE_THEMES.includes(meta.theme || 'noir');
  if (typeof meta.captions === 'string' && !CAPTIONS.includes(meta.captions)) errors.push(`meta.captions "${meta.captions}" unknown. Use: ${CAPTIONS.join(', ')}`);
  if (meta.grade && !GRADES.includes(meta.grade)) errors.push(`meta.grade "${meta.grade}" unknown. Use: ${GRADES.join(', ')}`);
  let legacyUsed = new Set();
  if (meta.format && !['16:9', '9:16', '1:1', '4:5'].includes(meta.format)) errors.push(`meta.format "${meta.format}" must be 16:9, 9:16, 1:1 or 4:5`);
  if (!Array.isArray(sb.scenes) || !sb.scenes.length) errors.push('scenes[] is empty');
  (sb.scenes || []).forEach((s0, i) => {
    const s = Object.assign({}, s0.data || {}, s0); const at = `scenes[${i}] (${s.type})`;
    if (!SCENE_TYPES[s.type]) { errors.push(`${at}: unknown type. Use one of: ${Object.keys(SCENE_TYPES).join(', ')}`); return; }
    for (const req of SCENE_TYPES[s.type]) { const alts = Array.isArray(req) ? req : [req]; if (!alts.some(k => s[k] != null)) errors.push(`${at}: missing ${alts.join(' or ')}`); }
    if (s.camera && typeof s.camera === 'string' && !CAMERAS.includes(s.camera)) errors.push(`${at}: camera "${s.camera}" unknown. Use: ${CAMERAS.join(', ')}`);
    if (s.transition && !TRANSITIONS.includes(s.transition)) errors.push(`${at}: transition "${s.transition}" unknown. Use: ${TRANSITIONS.join(', ')}`);
    if (s.theme && !THEMES.includes(s.theme)) errors.push(`${at}: theme "${s.theme}" unknown`);
    if (s.bg && !BGS.includes(s.bg)) warnings.push(`${at}: bg "${s.bg}" unknown, falls back to plain colour`);
    const cine = CINE_THEMES.includes(s.theme || meta.theme || 'noir');
    (s.stickers || []).forEach((st, j) => { const t = typeof st === 'string' ? st : st.type; if (!stickers.has(t)) errors.push(`${at}: stickers[${j}] type "${t}" unknown. Premium set: ${premium.join(', ')}`); else if (cine && defs[t].legacy) legacyUsed.add(t); if (t === 'photo' && !(st.media || st.src)) errors.push(`${at}: stickers[${j}] photo sticker needs media`); if (st.fx && !FXS.includes(st.fx)) errors.push(`${at}: stickers[${j}] fx "${st.fx}" unknown`); });
    for (const k of ['headline', 'text', 'title', 'label', 'caption', 'narration']) {
      const v = s[k]; if (typeof v !== 'string') continue;
      for (const [o, c] of [['==', '=='], ['**', '**'], ['[[', ']]'], ['~~', '~~'], ['{{', '}}']]) { const n1 = v.split(o).length - 1, n2 = v.split(c).length - 1; if (o === c ? n1 % 2 : n1 !== n2) errors.push(`${at}: unbalanced "${o}" markup in ${k}`); }
    }
    if (s.type === 'bar') (s.data || s.bars || []).forEach((d, j) => { if (typeof d.value !== 'number') errors.push(`${at}: data[${j}].value must be a number`); });
    if (s.type === 'line') (s.points || s.data || []).forEach((d, j) => { if (typeof (d.y != null ? d.y : d.value) !== 'number') errors.push(`${at}: points[${j}] needs numeric y`); });
    if (s.type === 'map') (s.pins || []).forEach((p, j) => { if (typeof p.lon !== 'number' || typeof p.lat !== 'number') errors.push(`${at}: pins[${j}] needs numeric lon & lat`); });
    const words = String(s.narration || '').split(/\s+/).filter(Boolean).length;
    if (s.duration && words && !s.voiceover && words / s.duration > 3.3) warnings.push(`${at}: ${words} words in ${s.duration}s is fast (>3.3 w/s). Raise duration or trim narration.`);
    if (s.voiceover && !/^https?:/.test(s.voiceover) && !fs.existsSync(path.resolve(baseDir, s.voiceover))) warnings.push(`${at}: voiceover file not found: ${s.voiceover}`);
    if (s.type === 'kinetic' && (s.lines || []).length > 5) warnings.push(`${at}: more than 5 kinetic lines gets crowded`);
  });
  if (legacyUsed.size) warnings.push(`legacy cartoon stickers used with a cinematic theme: ${[...legacyUsed].join(', ')}. Prefer the premium set (ring, arrow-fine, leader, tag, stat, timestamp, location, pulse, glint, photo, icon-*).`);
  const cineScenes = (sb.scenes || []).filter(s => ['cinematic', 'establishing', 'depth', 'broll', 'photo'].includes(s.type)).length;
  if (cineGlobal && (sb.scenes || []).length >= 6 && cineScenes < 2) warnings.push('few footage scenes: a cinematic story usually needs ≥ 1 real-image scene (cinematic / establishing / depth / broll) every 3–4 scenes.');
  for (const k of ['voiceover', 'music']) { const v = (sb.audio || {})[k]; if (v && !/^auto/.test(v) && v !== 'none' && !/^https?:/.test(v) && !fs.existsSync(path.resolve(baseDir, v))) warnings.push(`audio.${k} not found: ${v}`); }
  return { errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = process.argv[2]; if (!f) { console.log('usage: node validate.mjs storyboard.json'); process.exit(1); }
  let sb; try { sb = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('JSON parse error:', e.message); process.exit(1); }
  const { errors, warnings } = validate(sb, path.dirname(path.resolve(f)));
  warnings.forEach(w => console.log('WARN  ' + w)); errors.forEach(e => console.log('ERROR ' + e));
  console.log(errors.length ? `✗ ${errors.length} error(s)` : `✓ storyboard valid (${sb.scenes.length} scenes${warnings.length ? `, ${warnings.length} warning(s)` : ''})`);
  process.exit(errors.length ? 1 : 0);
}
