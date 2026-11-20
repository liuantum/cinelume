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
};
export const CAMERAS = ['static', 'drift', 'push-in', 'push-in-slow', 'pull-out', 'crash-zoom', 'zoom-out-reveal', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'dolly-zoom', 'orbit', 'handheld', 'whip-in', 'rack-focus', 'rack-focus-in', 'shake-hit', 'tilt-3d', 'spiral-in'];
export const TRANSITIONS = ['cut', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'zoom-through', 'zoom-out', 'iris', 'circle-burst', 'paper-slide', 'tear', 'push', 'slide-up', 'flash', 'glitch', 'stack', 'spin', 'wipe-diagonal', 'blinds', 'fade'];
export const THEMES = ['paper', 'dark', 'yellow', 'blueprint', 'red', 'navy', 'mint'];
export const BGS = ['paper', 'texture', 'grid', 'dots', 'lines', 'halftone', 'stripes', 'rays', 'gradient', 'spotlight', 'plain'];
export const FXS = ['none', 'fade', 'pop', 'popBig', 'rise', 'riseBig', 'drop', 'slideL', 'slideR', 'slideU', 'slideD', 'stamp', 'zoom', 'spin', 'blur', 'wipe', 'wipeUp', 'flipX', 'swing', 'typeOn'];

export function stickerNames() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(HERE, 'runtime', 'stickers.js'), 'utf8'), ctx);
  return Object.keys(ctx.window.VOX_STICKERS);
}

export function validate(sb, baseDir = '.') {
  const errors = [], warnings = [];
  const stickers = new Set(stickerNames());
  if (!sb || typeof sb !== 'object') return { errors: ['storyboard is not an object'], warnings };
  const meta = sb.meta || {};
  if (meta.theme && !THEMES.includes(meta.theme)) errors.push(`meta.theme "${meta.theme}" unknown. Use one of: ${THEMES.join(', ')}`);
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
    (s.stickers || []).forEach((st, j) => { const t = typeof st === 'string' ? st : st.type; if (!stickers.has(t)) errors.push(`${at}: stickers[${j}] type "${t}" unknown. Available: ${[...stickers].join(', ')}`); if (st.fx && !FXS.includes(st.fx)) errors.push(`${at}: stickers[${j}] fx "${st.fx}" unknown`); });
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
