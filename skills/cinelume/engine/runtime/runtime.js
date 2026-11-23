/* =====================================================================
   CINELUME CINEMATIC MOTION RUNTIME
   Deterministic, frame-accurate explainer-video engine.
   Every pixel is a pure function of time t, so headless capture is exact.
   API:  CINE.init(storyboard, {W,H,fps,assets}) -> {duration, events, scenes}
         CINE.seek(t) -> Promise (resolves when frame is fully painted)
   ===================================================================== */
(function () {
  'use strict';
  const V = (window.CINE = {});

  /* ---------------- math & easing ---------------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, d) => (d <= 0 ? (t >= a ? 1 : 0) : clamp((t - a) / d));
  const E = {
    linear: p => p,
    in: p => p * p * p,
    inQuad: p => p * p,
    out: p => 1 - Math.pow(1 - p, 3),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOutExpo: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    outBackBig: p => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    outElastic: p => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    outBounce: p => { const n = 7.5625, d = 2.75; if (p < 1 / d) return n * p * p; if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75; if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375; return n * (p -= 2.625 / d) * p + 0.984375; },
  };
  V.E = E;
  function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
  const noise1 = (t, seed) => Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 5.3 + seed * 0.7) * 0.2;
  const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixColor = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtNum = (v, dec = 0, sep = true) => { const s = Number(v).toFixed(dec); if (!sep) return s; const [i, d] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); };

  /* ---------------- themes ---------------- */
  const THEMES = {
    paper: { bg: '#EFE7D6', ink: '#171614', accent: '#E5402F', hl: '#FFD21F', card: '#FBF7EE', muted: '#8A8172', land: '#D9CCB0', blue: '#2D6FB7', teal: '#1E9C8F', grain: 'multiply' },
    dark: { bg: '#141414', ink: '#F3EEE4', accent: '#FF5240', hl: '#FFD21F', card: '#202020', muted: '#8F8A82', land: '#2E2E2E', blue: '#4B8FE0', teal: '#27B5A6', grain: 'soft-light' },
    yellow: { bg: '#FFD21F', ink: '#141414', accent: '#E5402F', hl: '#FFFFFF', card: '#FFF6CF', muted: '#6B5A12', land: '#F0BF00', blue: '#1F4E8C', teal: '#0E6F66', grain: 'multiply' },
    blueprint: { bg: '#0F2C4C', ink: '#EAF2FF', accent: '#FFB000', hl: '#FFB000', card: '#163A61', muted: '#8FB0D6', land: '#1E4A78', blue: '#7FC1FF', teal: '#4FE0C8', grain: 'soft-light' },
    red: { bg: '#E5402F', ink: '#FFF6EC', accent: '#141414', hl: '#FFD21F', card: '#F05A49', muted: '#FFD0C8', land: '#C93222', blue: '#141414', teal: '#141414', grain: 'multiply' },
    navy: { bg: '#14213D', ink: '#F6F1E7', accent: '#FCA311', hl: '#FCA311', card: '#1F2E52', muted: '#9AA6BF', land: '#26385F', blue: '#5FA8FF', teal: '#3CCFB4', grain: 'soft-light' },
    mint: { bg: '#DDF2E9', ink: '#10231C', accent: '#E5402F', hl: '#FFD21F', card: '#F4FBF8', muted: '#5D7A6E', land: '#B8DCCB', blue: '#2D6FB7', teal: '#14866F', grain: 'multiply' },
    // ---- cinematic (premium) themes
    noir: { cine: 1, bg: '#0A0B0D', ink: '#F3EFE8', accent: '#D6AE62', hl: '#D6AE62', card: '#15171B', muted: '#7C7F87', land: '#1B1E23', blue: '#7DA9D8', teal: '#63C2B1', grain: 'soft-light', glass: 'rgba(22,24,28,.46)', glassline: 'rgba(255,255,255,.14)', grade: 'teal-orange', glow1: '#D6AE62', glow2: '#3F6E8C' },
    film: { cine: 1, bg: '#0C1315', ink: '#F5EEE4', accent: '#EE9A4D', hl: '#EE9A4D', card: '#152124', muted: '#7D8E90', land: '#18262A', blue: '#5EAACB', teal: '#4FBFAE', grain: 'soft-light', glass: 'rgba(14,26,29,.5)', glassline: 'rgba(255,255,255,.14)', grade: 'teal-orange', glow1: '#EE9A4D', glow2: '#1F7A86' },
    ivory: { cine: 1, light: 1, bg: '#F2EEE6', ink: '#16140F', accent: '#9E2F2B', hl: '#C49A52', card: '#FFFFFF', muted: '#8A8478', land: '#E0D8C8', blue: '#3A5F8A', teal: '#2D7A6E', grain: 'multiply', glass: 'rgba(255,255,255,.62)', glassline: 'rgba(0,0,0,.10)', grade: 'warm', glow1: '#E7C98F', glow2: '#C7B8A0' },
    midnight: { cine: 1, bg: '#060A16', ink: '#EAF0FF', accent: '#7EA8FF', hl: '#A9C4FF', card: '#0F1730', muted: '#6E7998', land: '#111A35', blue: '#7EA8FF', teal: '#5BD6C8', grain: 'soft-light', glass: 'rgba(14,22,46,.5)', glassline: 'rgba(170,196,255,.18)', grade: 'cool', glow1: '#7EA8FF', glow2: '#6B4FD6' },
    ember: { cine: 1, bg: '#110906', ink: '#FBEFE4', accent: '#FF7B3E', hl: '#FFB26B', card: '#1D110B', muted: '#8F7A6B', land: '#24160F', blue: '#E3A35E', teal: '#D9C27A', grain: 'soft-light', glass: 'rgba(32,18,11,.5)', glassline: 'rgba(255,190,140,.18)', grade: 'warm', glow1: '#FF7B3E', glow2: '#B8322A' },
    slate: { cine: 1, bg: '#191C21', ink: '#ECEEF1', accent: '#56D1C4', hl: '#56D1C4', card: '#232830', muted: '#88909B', land: '#262C34', blue: '#76A7E8', teal: '#56D1C4', grain: 'soft-light', glass: 'rgba(30,34,41,.5)', glassline: 'rgba(255,255,255,.13)', grade: 'cool', glow1: '#56D1C4', glow2: '#3A5A8C' },
  };
  // ---- viral (colourful, high-energy shorts) themes — premium layer + vivid colour + punch motion
  Object.assign(THEMES, {
    neon: { cine: 1, viral: 1, bg: '#07060F', ink: '#FFFFFF', accent: '#FF2E88', hl: '#22E4FF', card: '#141129', muted: '#8A86A8', land: '#1A1733', blue: '#7B5CFF', teal: '#22E4FF', grain: 'soft-light', glass: 'rgba(24,18,48,.55)', glassline: 'rgba(255,255,255,.2)', grade: 'vivid', glow1: '#FF2E88', glow2: '#7B5CFF', pal: ['#22E4FF', '#FF2E88', '#B8FF3C', '#FFC83D', '#9B7BFF'] },
    sunset: { cine: 1, viral: 1, bg: '#140713', ink: '#FFF6EE', accent: '#FF6A3D', hl: '#FFC83D', card: '#26101F', muted: '#A08690', land: '#2A1424', blue: '#B44CFF', teal: '#FF3D7F', grain: 'soft-light', glass: 'rgba(40,14,30,.55)', glassline: 'rgba(255,220,200,.22)', grade: 'vivid', glow1: '#FF6A3D', glow2: '#C2308C', pal: ['#FFC83D', '#FF6A3D', '#FF3D7F', '#C77DFF', '#FFE9A8'] },
    electric: { cine: 1, viral: 1, bg: '#050B1A', ink: '#F3F8FF', accent: '#2F7BFF', hl: '#C6FF3D', card: '#0E1830', muted: '#7F8DAA', land: '#0F1C38', blue: '#2F7BFF', teal: '#00E5C7', grain: 'soft-light', glass: 'rgba(10,22,48,.55)', glassline: 'rgba(190,220,255,.22)', grade: 'vivid', glow1: '#2F7BFF', glow2: '#00E5C7', pal: ['#C6FF3D', '#2F7BFF', '#00E5C7', '#FF4D9A', '#FFD23D'] },
    aurora: { cine: 1, viral: 1, bg: '#04100F', ink: '#ECFFFA', accent: '#3DFFB5', hl: '#B08CFF', card: '#0B1E1C', muted: '#7EA39A', land: '#0D2321', blue: '#5CC8FF', teal: '#3DFFB5', grain: 'soft-light', glass: 'rgba(8,30,28,.55)', glassline: 'rgba(200,255,240,.2)', grade: 'vivid', glow1: '#3DFFB5', glow2: '#7B5CFF', pal: ['#3DFFB5', '#B08CFF', '#5CC8FF', '#FFE36E', '#FF7AC6'] },
    candy: { cine: 1, viral: 1, light: 1, bg: '#FFF1F7', ink: '#1B0F2E', accent: '#FF3D8B', hl: '#FFD23D', card: '#FFFFFF', muted: '#8C7A99', land: '#F6DCEA', blue: '#7B5CFF', teal: '#00B8D9', grain: 'multiply', glass: 'rgba(255,255,255,.72)', glassline: 'rgba(40,0,60,.1)', grade: 'none', glow1: '#FF8AC2', glow2: '#8FD3FF', pal: ['#FF3D8B', '#7B5CFF', '#00B8D9', '#FFB020', '#2BD47D'] },
  });
  // ---- archive / Vox-edit documentary themes (paper collage, archival photos, props)
  Object.assign(THEMES, {
    archive: { cine: 1, archive: 1, light: 1, bg: '#D9D1C1', ink: '#17140F', accent: '#C2271E', hl: '#F2C437', card: '#EDE6D8', muted: '#857B6B', land: '#C9BFA9', blue: '#2F5D8C', teal: '#2E7D6E', grain: 'multiply', glass: 'rgba(250,245,235,.78)', glassline: 'rgba(0,0,0,.14)', grade: 'archive', glow1: '#E9C88C', glow2: '#9C8A6A', pal: ['#F2C437', '#C2271E', '#2F5D8C', '#2E7D6E'] },
    newsroom: { cine: 1, archive: 1, bg: '#23201B', ink: '#F1EADC', accent: '#D23A2A', hl: '#F2C437', card: '#2E2A23', muted: '#8F8676', land: '#38332B', blue: '#6E9CCB', teal: '#5BAE9C', grain: 'soft-light', glass: 'rgba(40,36,30,.6)', glassline: 'rgba(255,240,220,.16)', grade: 'archive', glow1: '#E9C88C', glow2: '#6B5A3C', pal: ['#F2C437', '#D23A2A', '#6E9CCB', '#5BAE9C'] },
  });
  const CINE_SCENES = ['cinematic', 'establishing', 'opening', 'narrative', 'depth'];
  V.THEMES = THEMES;

  /* ---------------- DOM helpers ---------------- */
  function h(tag, cls, style, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (html != null) e.innerHTML = html;
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function drawPath(p, k) { if (!p) return; if (p._len == null) { try { p._len = p.getTotalLength() || 1; } catch (e) { p._len = 1; } } p.style.strokeDasharray = p._len + ' ' + (p._len + 1); p.style.strokeDashoffset = p._len * (1 - clamp(k)); }

  /* ---------------- global state ---------------- */
  let G = null; // {W,H,u,fps,sb,scenes,events,duration,assets,theme}
  let pending = [];
  let GID = 0;
  // classic sticker names → modern glossy Vox stickers (so "fire", "face-shock", "burst"… always look current)
  const VX_MAP = { fire: 'vx-fire', lightning: 'vx-bolt', star: 'vx-star', sparkle: 'vx-star', heart: 'vx-heart', rocket: 'vx-rocket', dollar: 'vx-money', money: 'vx-money', 'chart-up': 'vx-up', 'chart-down': 'vx-down', globe: 'vx-globe', chip: 'vx-chip', brain: 'vx-brain', bulb: 'vx-bulb', trophy: 'vx-trophy', clock: 'vx-clock', lock: 'vx-lock', 'face-shock': 'vx-wow', 'face-mindblown': 'vx-mindblown', 'face-cool': 'vx-cool', 'face-think': 'vx-think', 'face-smile': 'vx-laugh', 'face-money': 'vx-money', 'face-fire': 'vx-fire', 'face-sad': 'vx-think', burst: 'vx-burst', badge: 'vx-burst', label: 'vx-label', banner: 'vx-label', bubble: 'vx-bubble', note: 'vx-note', tape: 'vx-tape', exclaim: 'vx-wow', warning: 'vx-bolt', flag: 'vx-india', target: 'vx-target' };

  /* ---------------- stickers ---------------- */
  function stickerSVG(type, color, th) {
    const S = window.CINE_STICKERS || {};
    if (th.cine && th.vox && S[VX_MAP[type]]) type = VX_MAP[type];
    else if (th.cine && !(th.vox && S[type] && S[type].marker) && S['icon-' + type] && (!S[type] || S[type].legacy)) type = 'icon-' + type;
    const def = S[type] || (th.cine ? S['icon-spark'] : S.star);
    const C = color || th.accent;
    const svg = def.svg.replace(/"C"/g, `"${C}"`).replace(/"K"/g, `"${th.ink === '#F3EEE4' || th.ink === '#EAF2FF' || th.ink === '#F6F1E7' || th.ink === '#FFF6EC' ? '#141414' : th.ink}"`).replace(/"H"/g, `"${th.hl}"`).replace(/"W"/g, '"#FFFFFF"');
    const vb = def.wide ? '0 0 100 100' : '0 0 100 100';
    return { html: `<svg viewBox="${vb}" preserveAspectRatio="${def.wide && (!def.kind || def.kind === 'vox') ? 'none' : 'xMidYMid meet'}">${((gid) => (svg || '').replace(/id="(\w+)"/g, (m, a) => `id="${a}_${gid}"`).replace(/url\(#(\w+)\)/g, (m, a) => `url(#${a}_${gid})`))(++GID)}</svg>`, def };
  }

  /* ---------------- element animation presets ---------------- */
  // returns partial transform state for in-progress k (0..1)
  const FX = {
    none: k => ({ op: k > 0 ? 1 : 0 }),
    fade: k => ({ op: E.out(k) }),
    pop: k => ({ s: E.outBack(k), op: clamp(k * 4) }),
    popBig: k => ({ s: E.outBackBig(k), op: clamp(k * 4) }),
    rise: (k, u) => ({ ty: (1 - E.out(k)) * 6 * u, op: E.out(k) }),
    riseBig: (k, u) => ({ ty: (1 - E.outExpo(k)) * 30 * u, op: clamp(k * 3) }),
    drop: (k, u) => ({ ty: -(1 - E.outBounce(k)) * 40 * u, op: clamp(k * 5) }),
    slideL: (k, u) => ({ tx: -(1 - E.outExpo(k)) * 60 * u, op: clamp(k * 3) }),
    slideR: (k, u) => ({ tx: (1 - E.outExpo(k)) * 60 * u, op: clamp(k * 3) }),
    slideU: (k, u) => ({ ty: (1 - E.outExpo(k)) * 60 * u, op: clamp(k * 3) }),
    slideD: (k, u) => ({ ty: -(1 - E.outExpo(k)) * 60 * u, op: clamp(k * 3) }),
    stamp: k => ({ s: lerp(2.4, 1, E.outExpo(k)), r: -8 * (1 - k), op: clamp(k * 5) }),
    zoom: k => ({ s: lerp(0.4, 1, E.outExpo(k)), op: clamp(k * 3) }),
    spin: k => ({ s: E.outBack(k), r: lerp(-200, 0, E.out(k)), op: clamp(k * 4) }),
    blur: k => ({ blur: (1 - E.out(k)) * 2.4, op: E.out(k), s: lerp(1.08, 1, E.out(k)) }),
    wipe: k => ({ clip: `inset(0 ${(1 - E.inOut(k)) * 100}% 0 0)` }),
    wipeUp: k => ({ clip: `inset(${(1 - E.inOut(k)) * 100}% 0 0 0)` }),
    flipX: k => ({ ry: lerp(90, 0, E.outBack(k)), op: clamp(k * 4) }),
    swing: k => ({ r: lerp(-30, 0, E.outElastic(k)), op: clamp(k * 5), s: lerp(.8, 1, E.out(k)) }),
    typeOn: k => ({ op: 1, type: k }),
    punch: k => ({ s: lerp(1.32, 1, E.outExpo(k)), op: clamp(k * 6), blur: (1 - E.outExpo(k)) * 1.8 }),
    riseFast: (k, u) => ({ ty: (1 - E.outExpo(k)) * 5 * u, op: clamp(k * 4) }),
    blurIn: (k, u) => ({ blur: (1 - E.out(k)) * 4, op: E.out(k), ty: (1 - E.outExpo(k)) * 2.5 * u }),
    reveal: k => ({ clip: `inset(0 ${(1 - E.inOutExpo(k)) * 100}% 0 0)`, blur: (1 - k) * 1.5, op: clamp(k * 3) }),
    rise3d: (k, u) => ({ ty: (1 - E.outExpo(k)) * 8 * u, op: E.out(k), blur: (1 - E.out(k)) * 2.2 }),
    settle: k => ({ s: lerp(1.12, 1, E.outExpo(k)), op: E.out(k), blur: (1 - E.out(k)) * 3 }),
  };
  V.FX = FX;

  class Item {
    constructor(el, o, scene) {
      this.el = el; this.o = Object.assign({ at: 0, fx: 'rise', dur: 0.55, idle: null, rot: 0, scale: 1, center: false, seed: Math.random() * 10 }, o || {});
      this.scene = scene;
      if (scene && scene.vox) { /* Vox motion: keep pop / bounce / stamp / wiggle exactly as authored */ }
      else if (scene && scene.viral && !this.o.keep) {
        const o2 = this.o, VMAP = { drop: 'punch', popBig: 'punch', pop: 'punch', stamp: 'punch', spin: 'punch', swing: 'punch', zoom: 'punch', flipX: 'punch', rise: 'riseFast', riseBig: 'riseFast', blur: 'blurIn' };
        if (VMAP[o2.fx]) o2.fx = VMAP[o2.fx];
        if (['wiggle', 'bob', 'float'].includes(o2.idle)) o2.idle = 'drift';
        if (Math.abs(o2.rot) <= 8) o2.rot = 0;
        if (o2.fx === 'punch' || o2.fx === 'riseFast') o2.dur = Math.min(Math.max(o2.dur, .32), .45);
      } else if (scene && scene.cine && !this.o.keep) {
        const o2 = this.o, FXMAP = { drop: 'settle', popBig: 'blurIn', pop: 'blurIn', stamp: 'blurIn', spin: 'blurIn', swing: 'blurIn', riseBig: 'rise3d', rise: 'blurIn', flipX: 'blurIn', zoom: 'settle' };
        if (FXMAP[o2.fx]) o2.fx = FXMAP[o2.fx];
        if (['wiggle', 'bob', 'pulse', 'breathe', 'float'].includes(o2.idle)) o2.idle = 'drift';
        if (Math.abs(o2.rot) <= 8) o2.rot = 0;
        if (o2.fx === 'blurIn' || o2.fx === 'rise3d' || o2.fx === 'settle') o2.dur = Math.max(o2.dur, .8);
      }
      if (this.o.fx === 'typeOn') { this.fullText = el.textContent; }
    }
    update(t) {
      const o = this.o, u = G.u;
      const k = prog(t, o.at, o.dur);
      const f = (FX[o.fx] || FX.rise)(k, u);
      let tx = f.tx || 0, ty = f.ty || 0, s = (f.s == null ? 1 : f.s) * o.scale, r = (f.r || 0) + o.rot, op = f.op == null ? 1 : f.op;
      if (o.out != null) { const ko = prog(t, o.out, 0.35); op *= 1 - ko; s *= lerp(1, 0.85, E.in(ko)); }
      if (o.idle && k > 0) {
        const it = t - o.at;
        if (o.idle === 'wiggle') r += Math.sin(it * 2.4 + o.seed) * 3.2;
        if (o.idle === 'float') ty += Math.sin(it * 1.5 + o.seed) * 0.9 * u;
        if (o.idle === 'breathe') s *= 1 + Math.sin(it * 2.2 + o.seed) * 0.025;
        if (o.idle === 'pulse') s *= 1 + Math.max(0, Math.sin(it * 4 + o.seed)) * 0.06;
        if (o.idle === 'spin') r += it * 25;
        if (o.idle === 'drift') { ty += Math.sin(it * .9 + o.seed) * 0.35 * u; tx += Math.cos(it * .7 + o.seed) * 0.25 * u; }
        if (o.idle === 'bob') { ty += Math.sin(it * 2 + o.seed) * 0.6 * u; r += Math.sin(it * 1.3 + o.seed) * 1.5; }
        if (o.idle === 'bounce') { ty -= Math.abs(Math.sin(it * 3.2 + o.seed)) * 1.4 * u; s *= 1 + Math.max(0, -Math.cos(it * 6.4 + o.seed * 2)) * .02; }
        if (o.idle === 'shake') { tx += Math.sin(it * 38 + o.seed) * .28 * u; r += Math.sin(it * 31 + o.seed) * 1.6; }
        if (o.idle === 'sway') r += Math.sin(it * 1.4 + o.seed) * 6;
        if (o.idle === 'roll') { ty += Math.abs(Math.sin(it * 9 + o.seed)) * -.22 * u; r += Math.sin(it * 4.5 + o.seed) * .9; }
      }
      // sticker paths: keyframes of offsets (in % of the frame) from the sticker's resting position
      if (o.path && o.path.length) {
        const P = o.path; let dx = P[0].dx, dy = P[0].dy, moving = false;
        for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if (t >= b.t) { dx = b.dx; dy = b.dy; continue; } if (t > a.t) { const kk = (E[b.ease] || E.inOut)((t - a.t) / Math.max(.01, b.t - a.t)); dx = lerp(a.dx, b.dx, kk); dy = lerp(a.dy, b.dy, kk); moving = true; } break; }
        tx += dx * G.W / 100; ty += dy * G.H / 100;
        if (moving && o.rollWhileMoving) { ty -= Math.abs(Math.sin(t * 10 + o.seed)) * .3 * u; r += Math.sin(t * 5 + o.seed) * 1.2; }
        if (t < P[0].t && o.fx === 'none') op = 0;
      }
      const pre = o.center ? 'translate(-50%,-50%) ' : '';
      this.el.style.transform = `${pre}translate(${tx}px,${ty}px) rotate(${r}deg) scale(${s})${f.ry ? ` perspective(800px) rotateY(${f.ry}deg)` : ''}`;
      this.el.style.opacity = op;
      if (f.clip !== undefined) this.el.style.clipPath = f.clip;
      this.el.style.filter = f.blur ? `blur(${f.blur * u * 0.2}px)` : (this.baseFilter || '');
      if (f.type != null && this.fullText != null) this.el.textContent = this.fullText.slice(0, Math.round(this.fullText.length * f.type));
      if (this.draws) this.draws.forEach(d => drawPath(d, prog(t, o.at + (o.drawDelay || 0), o.drawDur || 0.6)));
    }
  }

  /* ---------------- rich text ---------------- */
  // ==highlight==  **accent**  __underline__  [[circle]]  ~~strike~~  {{box}}
  const MARK_RE = /(==[^=]+==|\*\*[^*]+\*\*|__[^_]+__|\[\[[^\]]+\]\]|~~[^~]+~~|\{\{[^}]+\}\})/g;
  function richInto(el, text) {
    const marks = [], words = [];
    String(text || '').split('\n').forEach((line, li) => {
      if (li > 0) el.appendChild(document.createElement('br'));
      line.split(MARK_RE).forEach(seg => {
        if (!seg) return;
        let kind = null, inner = seg;
        if (/^==.*==$/.test(seg)) { kind = 'hl'; inner = seg.slice(2, -2); }
        else if (/^\*\*.*\*\*$/.test(seg)) { kind = 'ac'; inner = seg.slice(2, -2); }
        else if (/^__.*__$/.test(seg)) { kind = 'ul'; inner = seg.slice(2, -2); }
        else if (/^\[\[.*\]\]$/.test(seg)) { kind = 'ci'; inner = seg.slice(2, -2); }
        else if (/^~~.*~~$/.test(seg)) { kind = 'st'; inner = seg.slice(2, -2); }
        else if (/^\{\{.*\}\}$/.test(seg)) { kind = 'bx'; inner = seg.slice(2, -2); }
        const host = kind ? h('span', 'm-' + kind) : el;
        if (kind) { el.appendChild(host); marks.push({ kind, el: host }); }
        inner.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) host.appendChild(document.createTextNode(' '));
          else { const w = h('span', 'w', null, esc(tok)); host.appendChild(w); words.push(w); }
        });
      });
    });
    return { marks, words };
  }
  function markSVG(m) {
    // called after layout: build hand-drawn svg sized to the span
    if (!['ul', 'ci', 'st', 'bx'].includes(m.kind)) return;
    const w = m.el.offsetWidth, hh = m.el.offsetHeight, fs = parseFloat(getComputedStyle(m.el).fontSize);
    const pad = fs * 0.35, W2 = w + pad * 2, H2 = hh + pad * 2;
    const svg = sv('svg', { class: 'm-svg', width: W2, height: H2, viewBox: `0 0 ${W2} ${H2}` });
    svg.style.left = -pad + 'px'; svg.style.top = -pad + 'px';
    const col = m.el.dataset.color || 'var(--accent)';
    const isCine = !!m.el.closest('.cine') && !m.el.closest('.archive'), isViral = !!m.el.closest('.viral') || !!m.el.closest('.archive');
    if (m.el.closest('.archive') && !m.el.dataset.color) m.el.dataset.color = 'var(--accent)'; const sw = isViral ? Math.max(3, fs * .055) : isCine ? Math.max(1.5, fs * 0.03) : Math.max(3, fs * 0.075);
    let d;
    const x0 = pad, x1 = pad + w, y0 = pad, y1 = pad + hh;
    if (m.kind === 'ul') d = `M${x0 - fs * .05} ${y1 - hh * .02} C ${x0 + w * .3} ${y1 - hh * .1}, ${x0 + w * .6} ${y1 + hh * .08}, ${x1 + fs * .08} ${y1 - hh * .06}`;
    if (m.kind === 'st') d = `M${x0 - fs * .05} ${y0 + hh * .58} C ${x0 + w * .35} ${y0 + hh * .5}, ${x0 + w * .7} ${y0 + hh * .56}, ${x1 + fs * .05} ${y0 + hh * .46}`;
    if (m.kind === 'bx') d = `M${x0 - fs * .1} ${y0 + fs * .02} L${x1 + fs * .12} ${y0 - fs * .04} L${x1 + fs * .08} ${y1 + fs * .04} L${x0 - fs * .06} ${y1 + fs * .02} Z`;
    if (m.kind === 'ci') { const cx = pad + w / 2, cy = pad + hh / 2, rx = w / 2 + fs * .32, ry = hh / 2 + fs * .12; d = `M${cx + rx * .15} ${cy - ry} C ${cx + rx * 1.1} ${cy - ry * 1.05}, ${cx + rx * 1.08} ${cy + ry * 1.05}, ${cx} ${cy + ry} C ${cx - rx * 1.1} ${cy + ry * .95}, ${cx - rx * 1.05} ${cy - ry * 1.1}, ${cx + rx * .35} ${cy - ry * 1.02}`; }
    const p = sv('path', { d, fill: 'none', stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    m.el.appendChild(svg); m.path = p;
  }
  function animateMark(m, k) {
    if (m.kind === 'hl' && m.el.closest('.archive')) m.el.style.backgroundSize = `${E.outExpo(k) * 100}% 100%`;
    else if (m.kind === 'hl' && m.el.closest('.viral')) m.el.style.backgroundSize = `${E.outExpo(k) * 100}% 88%`;
    else if (m.kind === 'hl') m.el.style.backgroundSize = m.el.closest('.cine') ? `0% 0%, ${E.inOut(k) * 100}% 7%` : `${E.inOut(k) * 100}% 62%`;
    else if (m.kind === 'ac') m.el.style.color = k > 0 ? '' : 'inherit';
    else if (m.path) drawPath(m.path, E.inOut(k));
  }

  /* ---------------- fit text ---------------- */
  function fitText(el, maxW, maxH, minPx) {
    if (maxW) el.style.maxWidth = maxW + 'px';
    let fs = parseFloat(getComputedStyle(el).fontSize); minPx = minPx || 10;
    let guard = 80;
    const over = () => el.scrollWidth > el.clientWidth + 1 || (maxH && el.scrollHeight > maxH + 1);
    while (guard-- > 0 && fs > minPx && over()) { fs *= 0.95; el.style.fontSize = fs + 'px'; }
  }

  /* ---------------- media (images, video frames, placeholders) ---------------- */
  const PH_ICONS = ['chip', 'globe', 'building', 'robot', 'chart-up', 'bulb', 'rocket', 'laptop', 'phone', 'money', 'brain', 'lightning'];
  function guessIcon(label) {
    const l = (label || '').toLowerCase();
    const map = [['chip', /chip|semi|gpu|processor|nvidia|silicon/], ['robot', /robot|ai|model|agent|bot|llm/], ['globe', /world|global|country|earth|map/], ['building', /company|office|factory|hq|bank|city/], ['money', /money|cash|dollar|price|cost|fund|invest|revenue/], ['chart-up', /growth|market|stock|rise|chart|data/], ['phone', /phone|app|mobile|social/], ['laptop', /computer|laptop|code|software|web/], ['brain', /brain|think|mind|research|science/], ['rocket', /launch|startup|space|rocket/], ['lightning', /power|energy|electric|fast/], ['bulb', /idea|innovation/]];
    for (const [k, re] of map) if (re.test(l)) return k;
    return PH_ICONS[Math.abs([...l].reduce((a, c) => a + c.charCodeAt(0), 0)) % PH_ICONS.length];
  }
  function media(src, c, opts) {
    opts = opts || {};
    const box = h('div', 'img');
    box.style.position = 'relative'; box.style.overflow = 'hidden';
    const a = src && G.assets[src];
    const th = c.th;
    if (a && (a.type === 'image' || a.type === 'video')) {
      const img = h('img');
      img.src = a.type === 'image' ? a.url : a.pattern.replace('%05d', '00001');
      if (opts.fit === 'contain') img.style.objectFit = 'contain';
      box.appendChild(img);
      box._img = img; box._asset = a;
    } else if (th.cine) {
      const label = (a && a.label) || opts.label || (typeof src === 'string' ? src.replace(/^(pexels|pixabay|unsplash|openverse|wikimedia|search)(-video)?:/, '') : '') || '';
      const r = rng([...label].reduce((x, ch) => x + ch.charCodeAt(0), 0) + 11);
      const ph = h('div', 'ph-cine');
      const g1 = th.glow1 || th.accent, g2 = th.glow2 || th.blue;
      ph.style.background = th.light ? `radial-gradient(ellipse at ${30 + r() * 40}% ${25 + r() * 30}%, #fff, ${th.land} 70%)` : `radial-gradient(ellipse at ${25 + r() * 50}% ${20 + r() * 40}%, ${mixColor(th.card, g2, .35)} 0%, ${th.bg} 62%, #000 100%)`;
      const beams = [];
      for (let i = 0; i < 3; i++) { const b = h('div', 'beam'); const w = 8 + r() * 14; Object.assign(b.style, { left: (10 + r() * 70) + '%', width: w + '%', background: `linear-gradient(180deg, ${g1}${th.light ? '33' : '2a'}, transparent 80%)`, transform: `rotate(${-18 + r() * 36}deg)` }); ph.appendChild(b); beams.push(b); }
      const boks = [];
      for (let i = 0; i < 9; i++) { const d = h('div', 'bokeh'); const sz = G.u * (2 + r() * 9); Object.assign(d.style, { width: sz + 'px', height: sz + 'px', left: r() * 100 + '%', top: (30 + r() * 65) + '%', background: `radial-gradient(circle, ${r() > .5 ? g1 : g2}${th.light ? '55' : '66'} 0%, transparent 70%)` }); d._v = (r() - .5) * 2; ph.appendChild(d); boks.push(d); }
      ph.appendChild(h('div', 'fill', { background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.45))' }));
      if (label && G.sb.meta && G.sb.meta.placeholderLabels !== false) ph.appendChild(h('div', 'phcap', null, esc(label)));
      box.appendChild(ph); box._ph = ph; box._beams = beams; box._boks = boks;
    } else {
      const label = (a && a.label) || opts.label || (typeof src === 'string' ? src.replace(/^(pexels|pixabay|search):/, '') : '') || 'b-roll';
      const ph = h('div', 'ph');
      const r = rng(label.length * 13 + 7);
      const cols = [th.blue, th.teal, th.accent, '#8E5CC4', '#F28C28', '#2E9E55'];
      const c1 = cols[Math.floor(r() * cols.length)], c2 = cols[Math.floor(r() * cols.length)];
      ph.style.background = `linear-gradient(${Math.floor(r() * 360)}deg, ${c1}, ${c2})`;
      ph.innerHTML = `<div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.22) 28%,transparent 31%);background-size:${G.u * 1.6}px ${G.u * 1.6}px"></div>
        <div style="position:absolute;inset:-20%;background:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 ${G.u * 2}px,transparent ${G.u * 2}px ${G.u * 4}px)"></div>
        <div class="phicon-wrap" style="position:relative;width:34%;aspect-ratio:1">${stickerSVG(opts.icon || guessIcon(label), null, th).html}</div>
        <div class="phlabel">${esc(label)}</div>`;
      box.appendChild(ph); box._ph = ph;
    }
    box._kb = opts.kenburns !== false;
    box._seed = Math.random() * 10;
    c.medias.push(box);
    return box;
  }
  function updateMedia(box, lt, dur) {
    const p = clamp(lt / Math.max(dur, 0.1));
    const target = box._img || box._ph && box._ph.querySelector('.phicon-wrap');
    if (box._kb && box._img) {
      const s = lerp(1.04, 1.16, E.inOut(p)), dx = Math.sin(box._seed) * 3 * p, dy = Math.cos(box._seed) * 2 * p;
      box._img.style.transform = `scale(${s}) translate(${dx}%,${dy}%)`;
    } else if (box._boks) {
      box._ph.style.transform = `scale(${lerp(1.02, 1.12, E.inOut(p))})`;
      box._boks.forEach((d, i) => { d.style.transform = `translate(${Math.sin(lt * .4 + i) * G.u * 1.5 * d._v}px, ${-lt * G.u * .8 * (1 + i % 3 * .3)}px)`; d.style.opacity = .55 + .45 * Math.sin(lt * .8 + i * 1.7); });
      box._beams.forEach((b, i) => { b.style.opacity = .55 + .45 * Math.sin(lt * .5 + i * 2.1); });
    } else if (box._ph && target) {
      target.style.transform = `translateY(${Math.sin(lt * 1.6 + box._seed) * G.u * .6}px) rotate(${Math.sin(lt * 1.1 + box._seed) * 4}deg) scale(${1 + .06 * p})`;
    }
    if (box._asset && box._asset.type === 'video') {
      const a = box._asset; const fi = Math.min(a.count, 1 + Math.floor(Math.max(0, lt) * a.fps) % a.count);
      const url = a.pattern.replace('%05d', String(fi).padStart(5, '0'));
      if (box._img._cur !== url) { box._img._cur = url; box._img.src = url; pending.push(box._img.decode().catch(() => { })); }
    }
  }

  /* ---------------- backgrounds ---------------- */
  let PAPER_URL = null;
  function paperTexture() {
    if (PAPER_URL) return PAPER_URL;
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
    const r = rng(42); x.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(90,70,40,${r() * .07})`; x.lineWidth = r() * 1.2; x.beginPath(); const a = r() * 512, b = r() * 512, L = 4 + r() * 22, ang = r() * Math.PI; x.moveTo(a, b); x.lineTo(a + Math.cos(ang) * L, b + Math.sin(ang) * L); x.stroke(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(120,90,50,${r() * .05})`; x.beginPath(); x.arc(r() * 512, r() * 512, r() * 30, 0, 7); x.fill(); }
    PAPER_URL = cv.toDataURL(); return PAPER_URL;
  }
  function buildBg(kind, c) {
    const b = h('div', 'fill'); const th = c.th, u = G.u;
    b.style.background = th.bg;
    const k = kind || 'paper';
    if (k === 'paper' || k === 'texture') { b.style.backgroundImage = `url(${paperTexture()})`; b.style.backgroundSize = '512px 512px'; }
    else if (k === 'grid') b.style.backgroundImage = `linear-gradient(${th.muted}33 1px,transparent 1px),linear-gradient(90deg,${th.muted}33 1px,transparent 1px)`, b.style.backgroundSize = `${u * 6}px ${u * 6}px`;
    else if (k === 'dots') b.style.backgroundImage = `radial-gradient(${th.muted}55 ${u * .22}px,transparent ${u * .26}px)`, b.style.backgroundSize = `${u * 3.2}px ${u * 3.2}px`;
    else if (k === 'lines') b.style.backgroundImage = `repeating-linear-gradient(0deg,${th.muted}2a 0 1px,transparent 1px ${u * 4.2}px)`;
    else if (k === 'halftone') b.style.backgroundImage = `radial-gradient(${th.ink}22 30%,transparent 33%)`, b.style.backgroundSize = `${u * 1.2}px ${u * 1.2}px`;
    else if (k === 'stripes') b.style.backgroundImage = `repeating-linear-gradient(-45deg,${th.ink}0d 0 ${u * 3}px,transparent ${u * 3}px ${u * 6}px)`;
    else if (k === 'rays') { const r = h('div', 'abs'); Object.assign(r.style, { left: '-50%', top: '-50%', width: '200%', height: '200%', background: `repeating-conic-gradient(from 0deg, ${th.ink}10 0deg 9deg, transparent 9deg 18deg)` }); b.appendChild(r); c.onUpdate(lt => { r.style.transform = `rotate(${lt * 4}deg)`; }); }
    else if (k === 'gradient') b.style.background = `radial-gradient(circle at 30% 20%, ${th.card}, ${th.bg} 70%)`;
    else if (k === 'spotlight') b.style.background = `radial-gradient(ellipse at 50% 45%, ${th.card} 0%, ${th.bg} 65%)`;
    else if (k === 'black') b.style.background = '#000';
    else if (k === 'paper-grid' || k === 'paper-dark') {
      b.style.backgroundColor = th.bg;
      b.style.backgroundImage = `url(${paperTexture()}), linear-gradient(${th.ink}14 1px, transparent 1px), linear-gradient(90deg, ${th.ink}14 1px, transparent 1px), radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.25), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(80,50,20,.18), transparent 55%)`;
      b.style.backgroundSize = `512px 512px, ${u * 4.2}px ${u * 4.2}px, ${u * 4.2}px ${u * 4.2}px, 100% 100%, 100% 100%`;
    }
    else if (k === 'atmos' || k === 'haze') {
      const g1 = th.glow1 || th.accent, g2 = th.glow2 || th.blue, al = th.viral ? (th.light ? '55' : '50') : th.light ? '40' : (k === 'haze' ? '30' : '22');
      b.style.background = th.light ? `radial-gradient(ellipse at 50% 30%, #fff 0%, ${th.bg} 70%)` : `radial-gradient(ellipse at 50% 40%, ${mixColor(th.bg, th.card, .9)} 0%, ${th.bg} 60%, ${mixColor(th.bg, '#000000', .6)} 100%)`;
      const blobs = (th.viral ? [[g1, 18, 22, 80], [g2, 82, 72, 95], [th.pal[0], 70, 12, 60], [th.pal[2] || g1, 25, 85, 70]] : [[g1, 20, 25, 70], [g2, 78, 70, 85], [g1, 60, 10, 55]]).map(([col, x, y, sz]) => { const d = h('div', 'abs', { left: x + '%', top: y + '%', width: sz * u + 'px', height: sz * u + 'px', marginLeft: -sz * u / 2 + 'px', marginTop: -sz * u / 2 + 'px', borderRadius: '50%', background: `radial-gradient(circle, ${col}${al} 0%, transparent 65%)` }); b.appendChild(d); return d; });
      const dust = h('div', 'fill', { backgroundImage: `radial-gradient(rgba(255,255,255,${th.light ? 0 : .10}) ${u * .08}px, transparent ${u * .14}px)`, backgroundSize: `${u * 7}px ${u * 9}px`, opacity: .6 }); b.appendChild(dust);
      c.onUpdate(lt => { blobs.forEach((d, i) => { d.style.transform = `translate(${Math.sin(lt * .25 + i * 2) * u * 6}px, ${Math.cos(lt * .2 + i) * u * 4}px) scale(${1 + .08 * Math.sin(lt * .3 + i)})`; }); dust.style.backgroundPosition = `${lt * u * .6}px ${-lt * u * 1.2}px`; });
    }
    return b;
  }

  /* ---------------- camera ---------------- */
  // returns {x,y (fraction of W/H content offset), z (zoom), r (deg), tilt, bgBlur, fgZ, bgZ}
  function cameraFn(spec, dur) {
    const D = Math.max(dur, 0.1);
    const P = t => E.inOut(clamp(t / D));
    const L = t => clamp(t / D);
    const base = { x: 0, y: 0, z: 1, r: 0, tilt: 0, bgBlur: 0, shake: 0 };
    const mk = f => t => Object.assign({}, base, f(t));
    if (spec && typeof spec === 'object') {
      const a = Object.assign({ x: 0, y: 0, zoom: 1, rot: 0, tilt: 0 }, spec.from || {}), b = Object.assign({}, a, spec.to || {});
      const ez = E[spec.ease || 'inOut'] || E.inOut;
      return mk(t => { const p = ez(clamp(t / D)); return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: lerp(a.zoom, b.zoom, p), r: lerp(a.rot, b.rot, p), tilt: lerp(a.tilt, b.tilt, p), shake: spec.shake || 0 }; });
    }
    switch (spec || 'drift') {
      case 'static': return mk(() => ({}));
      case 'drift': return mk(t => ({ z: lerp(1.02, 1.08, L(t)), x: lerp(-.006, .006, L(t)), y: lerp(.004, -.004, L(t)) }));
      case 'push-in': return mk(t => ({ z: lerp(1, 1.16, P(t)) }));
      case 'push-in-slow': return mk(t => ({ z: lerp(1, 1.07, L(t)) }));
      case 'pull-out': return mk(t => ({ z: lerp(1.2, 1, P(t)) }));
      case 'crash-zoom': return mk(t => ({ z: lerp(1.0, 1.32, E.outExpo(clamp(t / 0.45))) + .02 * L(t), shake: t < .6 ? (1 - t / .6) * 1.2 : 0 }));
      case 'zoom-out-reveal': return mk(t => ({ z: lerp(2.4, 1, E.outExpo(clamp(t / Math.min(1.6, D * .6)))) }));
      case 'pan-left': return mk(t => ({ x: lerp(-.05, .05, P(t)), z: 1.12 }));
      case 'pan-right': return mk(t => ({ x: lerp(.05, -.05, P(t)), z: 1.12 }));
      case 'tilt-up': return mk(t => ({ y: lerp(-.05, .05, P(t)), z: 1.12 }));
      case 'tilt-down': return mk(t => ({ y: lerp(.05, -.05, P(t)), z: 1.12 }));
      case 'dolly-zoom': return mk(t => ({ fgZ: lerp(1, 1.18, P(t)), bgZ: lerp(1.3, 1.0, P(t)) }));
      case 'orbit': return mk(t => ({ r: lerp(-2.5, 2.5, P(t)), z: 1.1, x: lerp(.03, -.03, P(t)) }));
      case 'handheld': return mk(t => ({ z: 1.06, shake: .5 }));
      case 'whip-in': return mk(t => ({ x: lerp(.35, 0, E.outExpo(clamp(t / .5))), z: lerp(1, 1.06, L(t)) }));
      case 'rack-focus': return mk(t => ({ bgBlur: lerp(0, 1, E.inOut(clamp((t - D * .3) / (D * .3)))), z: lerp(1, 1.06, L(t)) }));
      case 'rack-focus-in': return mk(t => ({ bgBlur: lerp(1, 0, E.inOut(clamp((t - .2) / (D * .4)))), z: lerp(1.04, 1.08, L(t)) }));
      case 'shake-hit': return mk(t => ({ z: 1.04, shake: t < .8 ? (1 - t / .8) * 2.2 : 0 }));
      case 'tilt-3d': return mk(t => ({ tilt: lerp(18, 4, E.outExpo(clamp(t / 1.4))), z: lerp(1.08, 1.14, L(t)), r: lerp(-3, -1, L(t)) }));
      case 'punch-in': return mk(t => ({ z: lerp(1.2, 1.03, E.outExpo(clamp(t / .5))) + .03 * L(t), shake: t < .4 ? (1 - t / .4) * .9 : 0 }));
      case 'zoom-pulse': return mk(t => ({ z: 1.04 + .02 * L(t) }));
      case 'dolly-in': return mk(t => ({ z: lerp(1.0, 1.12, E.inOut(L(t))), y: lerp(.004, -.004, L(t)) }));
      case 'dolly-out': return mk(t => ({ z: lerp(1.14, 1.0, E.inOut(L(t))) }));
      case 'crane-up': return mk(t => ({ y: lerp(.045, -.03, E.inOut(L(t))), z: lerp(1.1, 1.14, L(t)), tilt: lerp(-3, 0, L(t)) }));
      case 'crane-down': return mk(t => ({ y: lerp(-.045, .03, E.inOut(L(t))), z: lerp(1.14, 1.1, L(t)), tilt: lerp(3, 0, L(t)) }));
      case 'truck-left': return mk(t => ({ x: lerp(-.04, .04, E.inOut(L(t))), z: 1.1 }));
      case 'truck-right': return mk(t => ({ x: lerp(.04, -.04, E.inOut(L(t))), z: 1.1 }));
      case 'parallax': return mk(t => ({ x: lerp(.05, -.05, E.inOut(L(t))), z: 1.1, fgZ: lerp(1, 1.06, L(t)) }));
      case 'steadicam': return mk(t => ({ z: lerp(1.05, 1.09, L(t)), x: noise1(t * .35, 3) * .006, y: noise1(t * .3, 7) * .005, r: noise1(t * .25, 11) * .35 }));
      case 'slow-push': return mk(t => ({ z: lerp(1, 1.06, L(t)) }));
      case 'reveal-pull': return mk(t => ({ z: lerp(1.35, 1.02, E.outExpo(clamp(t / Math.min(2.4, D * .8)))), bgBlur: lerp(.6, 0, clamp(t / 1.2)) }));
      case 'spiral-in': return mk(t => ({ z: lerp(1.6, 1.02, E.outExpo(clamp(t / 1.2))), r: lerp(-10, 0, E.outExpo(clamp(t / 1.2))) }));
      default: return mk(t => ({ z: lerp(1.02, 1.08, L(t)) }));
    }
  }

  /* ---------------- transitions ---------------- */
  const TRANS_DUR = { cut: 0, 'whip-left': .5, 'whip-right': .5, 'whip-up': .5, 'whip-down': .5, 'zoom-through': .6, iris: .7, 'paper-slide': .7, tear: .7, push: .6, flash: .4, glitch: .45, stack: .7, spin: .7, 'wipe-diagonal': .6, 'circle-burst': .7, fade: .6, 'blinds': .7, 'zoom-out': .6, 'slide-up': .6, dissolve: .9, 'dip-black': 1.0, 'dip-white': .8, 'light-leak': 1.0, 'film-burn': 1.1, 'lens-blur': .8, 'cross-zoom': .7, luma: .9, slit: .8 };
  function applyTransition(name, p, A, B) {
    const W = G.W, H = G.H, u = G.u;
    const e = E.inOutExpo(p), eo = E.outExpo(p);
    B.style.zIndex = 2; A.style.zIndex = 1;
    const blurAmt = Math.sin(p * Math.PI) * u * 2.2;
    switch (name) {
      case 'whip-left': case 'whip-right': case 'whip-up': case 'whip-down': {
        const dir = { 'whip-left': [-1, 0], 'whip-right': [1, 0], 'whip-up': [0, -1], 'whip-down': [0, 1] }[name];
        A.style.transform = `translate(${dir[0] * e * W}px,${dir[1] * e * H}px)`;
        B.style.transform = `translate(${-dir[0] * (1 - e) * W}px,${-dir[1] * (1 - e) * H}px)`;
        const f = `url(#mb${dir[0] ? 'x' : 'y'})`; setMB(dir[0] ? 'x' : 'y', blurAmt * 3.5);
        A.style.filter = f; B.style.filter = f; break;
      }
      case 'push': A.style.transform = `translateX(${-e * W}px)`; B.style.transform = `translateX(${(1 - e) * W}px)`; break;
      case 'slide-up': A.style.transform = `translateY(${-e * H * .3}px) scale(${1 - e * .1})`; A.style.filter = `brightness(${1 - e * .4})`; B.style.transform = `translateY(${(1 - e) * H}px)`; break;
      case 'zoom-through': A.style.transform = `scale(${1 + E.in(p) * 3})`; A.style.opacity = 1 - clamp(p * 1.6 - .4); B.style.transform = `scale(${lerp(.6, 1, eo)})`; B.style.opacity = clamp(p * 2 - .3); B.style.filter = `blur(${(1 - eo) * u}px)`; break;
      case 'zoom-out': A.style.transform = `scale(${1 - e * .5})`; A.style.opacity = 1 - e; B.style.transform = `scale(${lerp(1.6, 1, eo)})`; B.style.opacity = clamp(p * 2); break;
      case 'iris': case 'circle-burst': B.style.clipPath = `circle(${E.inOut(p) * 120}% at 50% 50%)`; if (name === 'circle-burst') A.style.transform = `scale(${1 + p * .15})`; break;
      case 'paper-slide': { const r = lerp(-9, 0, eo); B.style.transform = `translateY(${(1 - eo) * H * 1.05}px) rotate(${r}deg)`; B.style.boxShadow = `0 ${-u * 2}px ${u * 6}px rgba(0,0,0,${.45 * (1 - p)})`; A.style.filter = `brightness(${1 - p * .35})`; break; }
      case 'stack': { B.style.transform = `translateY(${-(1 - E.outBounce(p)) * H}px)`; A.style.transform = `scale(${1 - p * .08})`; A.style.filter = `brightness(${1 - p * .4})`; break; }
      case 'tear': {
        const x = lerp(-15, 115, E.inOut(p)); const pts = [];
        for (let i = 0; i <= 20; i++) { const y = i * 5; pts.push(`${x + (i % 2 ? 2.2 : -2.2) + Math.sin(i * 1.7) * 1.4}% ${y}%`); }
        B.style.clipPath = `polygon(0% 0%, ${pts.join(',')}, 0% 100%)`; break;
      }
      case 'wipe-diagonal': { const x = lerp(-60, 160, E.inOut(p)); B.style.clipPath = `polygon(0 0, ${x}% 0, ${x - 40}% 100%, 0 100%)`; break; }
      case 'blinds': { const n = 7, pts = []; for (let i = 0; i < n; i++) { const y0 = i / n * 100, y1 = (i + E.inOut(clamp(p * 1.4 - i * .05))) / n * 100; pts.push(`inset(${y0}% 0 ${100 - y1}% 0)`); } B.style.clipPath = ''; B.style.webkitMaskImage = `linear-gradient(to bottom, ${Array.from({ length: n }, (_, i) => { const a = i / n * 100, kk = E.inOut(clamp(p * 1.4 - i * .05)), b = a + kk * 100 / n; return `#000 ${a}%, #000 ${b}%, transparent ${b}%, transparent ${(i + 1) / n * 100}%`; }).join(',')})`; break; }
      case 'flash': B.style.opacity = p > .5 ? 1 : 0; G.flash = Math.sin(p * Math.PI); break;
      case 'glitch': { const j = (p < .9) ? (Math.sin(p * 90) * u * 3) : 0; B.style.opacity = p > .35 ? 1 : (Math.sin(p * 120) > 0 ? 1 : 0); B.style.transform = `translateX(${j}px)`; B.style.filter = p < .8 ? `hue-rotate(${Math.sin(p * 50) * 90}deg) saturate(2)` : ''; A.style.transform = `translateX(${-j}px)`; break; }
      case 'spin': A.style.transform = `rotate(${e * 90}deg) scale(${1 - e})`; A.style.opacity = 1 - e; B.style.transform = `rotate(${(1 - e) * -90}deg) scale(${e})`; break;
      case 'dissolve': B.style.opacity = E.inOut(p); A.style.transform = `scale(${1 + p * .03})`; B.style.transform = `scale(${1.03 - eo * .03})`; break;
      case 'dip-black': case 'dip-white': { const col = name === 'dip-black' ? 0 : 1; if (p < .5) { A.style.filter = col ? `brightness(${1 + p * 4})` : `brightness(${1 - E.inOut(p * 2)})`; B.style.opacity = 0; } else { B.style.opacity = 1; B.style.filter = col ? `brightness(${1 + (1 - p) * 4})` : `brightness(${E.inOut((p - .5) * 2)})`; } break; }
      case 'light-leak': B.style.opacity = E.inOut(clamp((p - .2) / .6)); G.leakBoost = Math.max(G.leakBoost, Math.sin(p * Math.PI) * .85); A.style.filter = `brightness(${1 + Math.sin(p * Math.PI) * .25})`; break;
      case 'film-burn': { const r = E.inOut(p) * 160; B.style.webkitMaskImage = `radial-gradient(circle at 78% 32%, #000 ${r - 18}%, transparent ${r}%)`; G.burn = Math.max(G.burn, Math.sin(p * Math.PI)); G.burnR = r; break; }
      case 'lens-blur': A.style.filter = `blur(${E.in(clamp(p * 1.6)) * u * 3}px)`; B.style.opacity = E.inOut(clamp((p - .3) / .5)); B.style.filter = `blur(${(1 - E.out(clamp((p - .3) / .7))) * u * 3}px)`; break;
      case 'cross-zoom': A.style.transform = `scale(${1 + E.in(p) * .35})`; A.style.filter = `blur(${Math.sin(p * Math.PI) * u * 1.6}px)`; B.style.opacity = E.inOut(clamp((p - .35) / .4)); B.style.transform = `scale(${lerp(.88, 1, eo)})`; B.style.filter = `blur(${(1 - eo) * u * 1.6}px)`; break;
      case 'luma': { const x = lerp(-30, 130, E.inOut(p)); B.style.webkitMaskImage = `linear-gradient(100deg, #000 ${x - 30}%, transparent ${x}%)`; break; }
      case 'slit': { const k2 = E.inOutExpo(p); B.style.clipPath = `inset(${(1 - k2) * 50}% 0 ${(1 - k2) * 50}% 0)`; A.style.filter = `brightness(${1 - p * .6})`; break; }
      case 'fade': default: B.style.opacity = E.inOut(p);
    }
  }
  function setMB(axis, amt) { const f = document.getElementById('mbf' + axis); if (f) f.setAttribute('stdDeviation', axis === 'x' ? `${amt} 0` : `0 ${amt}`); }

  /* ---------------- scene context ---------------- */
  function makeCtx(s, idx) {
    const th = Object.assign({}, THEMES[s.theme || G.themeName] || THEMES.paper, s.colors || {});
    th.vox = (s.motion || G.motion) === 'vox';
    const wrap = h('div', 'scene');
    for (const k in th) wrap.style.setProperty('--' + k, th[k]);
    wrap.style.setProperty('--u', G.u + 'px');
    const cam = h('div', 'cam'); wrap.appendChild(cam);
    const layers = {};
    [['bg', .35], ['mid', 1], ['fg', 1.3]].forEach(([n, d]) => { const l = h('div', 'layer'); l.dataset.depth = d; cam.appendChild(l); layers[n] = l; });
    layers.bg.style.inset = '-12%';
    const ovl = h('div', 'ovl'); wrap.appendChild(ovl); // non-camera overlay (lower thirds, source)
    if (th.cine) wrap.classList.add('cine');
    if (th.viral) wrap.classList.add('viral');
    if (th.vox) wrap.classList.add('vox');
    if (th.archive) wrap.classList.add('archive');
    const c = {
      cine: !!th.cine, viral: !!th.viral, vox: !!th.vox, archive: !!th.archive, dl: th.archive ? 'archive' : th.viral ? 'vivid' : th.cine ? 'cine' : 'color', dlDuo: th.cine ? 'cine' : 'duotone',
      s, idx, th, wrap, cam, layers, ovl, items: [], marks: [], updates: [], post: [], medias: [], events: [],
      W: G.W, H: G.H, u: G.u, portrait: G.H > G.W, square: G.H === G.W,
      dur: s.duration,
      add(el, layer, o) { (layers[layer || 'mid'] || layers.mid).appendChild(el); if (o) c.items.push(new Item(el, o, c)); return el; },
      item(el, o) { const it = new Item(el, o, c); c.items.push(it); return it; },
      onUpdate(f) { c.updates.push(f); },
      postLayout(f) { c.post.push(f); },
      sfx(name, at, vol) { if (th.archive && ARCHIVE_SFX[name]) { name = ARCHIVE_SFX[name]; } else if (th.viral && VIRAL_SFX[name]) { name = VIRAL_SFX[name]; } else if (th.cine && CINE_SFX[name]) { name = CINE_SFX[name]; vol = (vol || .8) * .8; } c.events.push({ name, at, vol }); },
      text(el, text, o) {
        o = Object.assign({ at: .2, stagger: .06, fx: 'rise', markGap: .35 }, o || {});
        const { marks, words } = richInto(el, text);
        words.forEach((w, i) => c.items.push(new Item(w, { at: o.at + i * o.stagger, fx: o.fx, dur: o.dur || .5 }, c)));
        let mt = o.markAt != null ? o.markAt : o.at + words.length * o.stagger + .25;
        marks.forEach(m => { m.at = mt; m.dur = m.kind === 'hl' ? .45 : .55; mt += o.markGap; c.marks.push(m); if (m.kind !== 'ac') c.sfx(m.kind === 'hl' ? 'swish' : 'scribble', m.at, .5); });
        c.post.push(() => marks.forEach(markSVG));
        return { end: o.at + words.length * o.stagger + .5, markEnd: mt, words, marks };
      },
      sticker(st) { return addSticker(c, st); },
      media(src, o) { return media(src, c, o); },
      safe: null,
    };
    // safe area (in px) — leaves room for captions at bottom
    const capRoom = G.captions ? (c.portrait ? .2 : .14) : .06;
    c.safe = c.portrait ? { l: G.W * .08, r: G.W * .92, t: G.H * .11, b: G.H * (1 - capRoom) } : { l: G.W * .07, r: G.W * .93, t: G.H * .1, b: G.H * (1 - capRoom) };
    { const lbs = s.letterbox != null ? s.letterbox : (G.lbGlobal != null ? G.lbGlobal : (th.cine && CINE_SCENES.includes(s.type))); c.lbWant = lbs && G.lbH > 0 ? 1 : 0;
      if (c.lbWant) { c.safe.t = Math.max(c.safe.t, G.lbH + G.u * 3); c.safe.b = G.H - G.lbH - G.u * 3; } }
    { const cf = cameraFn(s.camera, s.duration || 4); let zm = 1; for (let i = 0; i <= 40; i++) { const v = cf((s.duration || 4) * i / 40); zm = Math.max(zm, v.z * (v.fgZ || 1) + Math.abs(v.x) * 2 + Math.abs(v.y) * 2); }
      zm = Math.min(zm, 1.4); if (zm > 1.02) { const cx = (c.safe.l + c.safe.r) / 2, cy = (c.safe.t + c.safe.b) / 2, hw = (c.safe.r - c.safe.l) / 2 / zm, hh = (c.safe.b - c.safe.t) / 2 / Math.max(1, zm * .92); c.safe.l = cx - hw; c.safe.r = cx + hw; c.safe.t = Math.min(c.safe.t, cy - hh) === c.safe.t ? cy - hh : c.safe.t; c.safe.b = cy + hh; } c.zmax = zm; }
    c.safe.w = c.safe.r - c.safe.l; c.safe.h = c.safe.b - c.safe.t; c.safe.cx = (c.safe.l + c.safe.r) / 2; c.safe.cy = (c.safe.t + c.safe.b) / 2;
    c.box = (style) => { const b = h('div', 'abs'); Object.assign(b.style, { left: c.safe.l + 'px', top: c.safe.t + 'px', width: c.safe.w + 'px', height: c.safe.h + 'px' }, style || {}); return b; };
    return c;
  }

  function addSticker(c, st) {
    if (typeof st === 'string') st = { type: st };
    if (st.type === 'character') return addCharacter(c, st, c.s.actions);
    if (st.type === 'image' || st.type === 'cutout') return addImageSticker(c, st);
    const u = G.u;
    if (c.cine && VX_MAP[st.type] && (c.vox || !(window.CINE_STICKERS || {})['icon-' + st.type])) st = Object.assign({}, st, { type: VX_MAP[st.type] });
    const S = (window.CINE_STICKERS || {})[st.type] || {};
    if (S.kind && S.kind !== 'vox') return addPremiumSticker(c, st, S);
    if (c.cine && !c.vox && st.rot == null) st = Object.assign({}, st, { rot: 0 });
    const size = (st.size || (S.wide ? 22 : 12)) * u;
    const el = h('div', 'stk' + (st.outline === false || S.draw ? '' : ' cutout'));
    const w = size * (S.wide ? (st.aspect || 2.4) : 1), hh = size;
    Object.assign(el.style, { width: w + 'px', height: hh + 'px', left: `calc(${st.x != null ? st.x : 80}% - ${w / 2}px)`, top: `calc(${st.y != null ? st.y : 25}% - ${hh / 2}px)`, zIndex: 20 });
    const { html } = stickerSVG(st.type, st.color, c.th);
    el.innerHTML = html;
    if (st.text) { const tx = h('div', 'stxt' + (S.font === 'marker' ? ' marker' : ''), { fontSize: (st.textSize || (S.wide ? .34 : .22)) * hh + 'px', color: st.textColor || (S.txt === 'K' ? '#141414' : '#fff'), padding: S.wide ? '0 12%' : '14%' }, esc(st.text)); if (S.font === 'marker') tx.style.fontFamily = 'Marker'; el.appendChild(tx); }
    c.add(el, st.layer || 'fg');
    const it = c.item(el, { at: st.at != null ? st.at : .8, fx: st.fx || (S.draw ? 'none' : 'popBig'), dur: st.dur || .5, rot: st.rot != null ? st.rot : (S.draw ? 0 : ((idHash(st.type + st.x) % 17) - 8)), idle: st.idle !== undefined ? st.idle : (S.draw ? null : 'wiggle'), out: st.out });
    if (st.flip && el.firstElementChild) el.firstElementChild.style.transform = 'scaleX(-1)';
    if (S.draw) { it.draws = [...el.querySelectorAll('path')]; it.o.drawDur = st.dur || .6; c.sfx('scribble', it.o.at, .5); }
    else if (stickerMotion(it, st, st.x != null ? st.x : 80, st.y != null ? st.y : 25)) { c.sfx('pop', it.o.at, .7); if (c.vox || !c.cine) popBurst(c, st.x != null ? st.x : 80, st.y != null ? st.y : 25, size, it.o.at, st.layer || 'fg'); }
    return el;
  }
  const ARCHIVE_SFX = { tap: 'paper', air: 'whoosh-soft', bubble: 'pop', impact: 'thud', 'impact-soft': 'thud', pen: 'scribble', swell: 'riser', 'whoosh-deep': 'whoosh', chime: 'ding' };
  const VIRAL_SFX = { pop: 'bubble', tap: 'bubble', hit: 'drop', impact: 'drop', thud: 'impact-soft', scribble: 'pen', swish: 'swoosh', air: 'swoosh', ding: 'chime', boom: 'drop', braam: 'drop', paper: 'swoosh', bar: 'bubble', 'tick-roll': 'tick-soft', click: 'snap', whoosh: 'swoosh', 'whoosh-soft': 'swoosh', 'whoosh-deep': 'swoosh', riser: 'riser', swell: 'riser' };
  const CINE_SFX = { pop: 'tap', hit: 'impact', thud: 'impact-soft', scribble: 'pen', swish: 'air', ding: 'chime', boom: 'braam', paper: 'air', bar: 'tap', 'tick-roll': 'tick-soft', click: 'tap', whoosh: 'whoosh-deep', 'whoosh-soft': 'air', riser: 'swell' };
  // scale a 0..100 viewBox svg fragment to w x hh pixels (keeps dots round, strokes even)
  function scaleSVG(svg, sx, sy, sw) {
    return svg.replace(/ d="([^"]+)"/g, (m, d) => { let i = 0; return ` d="${d.replace(/-?\d*\.?\d+/g, n => (i++ % 2 ? +n * sy : +n * sx).toFixed(2))}"`; })
      .replace(/ cx="([\d.]+)"/g, (m, v) => ` cx="${(+v * sx).toFixed(2)}"`).replace(/ cy="([\d.]+)"/g, (m, v) => ` cy="${(+v * sy).toFixed(2)}"`)
      .replace(/ r="([\d.]+)"/g, (m, v) => ` r="${(+v * Math.min(sx, sy)).toFixed(2)}"`).replace(/stroke-width="([\d.]+)"/g, (m, v) => `stroke-width="${(+v * sw).toFixed(2)}"`);
  }
  const tc = t => { const f = Math.floor((t % 1) * 24), ss = Math.floor(t) % 60, mm = Math.floor(t / 60) % 60; return `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(f).padStart(2, '0')}`; };
  /* =====================================================================
     CHARACTERS — original Vox-style cut-out paper people that act out the story.
     { type:'character', role, x, y, size, enter, pose, talk, flip, head, name, actions:[…] }
     roles: engineer founder founder-f worker scientist student farmer official doctor person person-f
     actions: walk(to,dur) wave point(dir) cheer think shock jump say(text,dur) face(mood) exit(to)
     ===================================================================== */
  const SKINS = { light: '#F1C7A5', fair: '#E0A97E', medium: '#C68642', tan: '#A66A3F', brown: '#8D5524', deep: '#5C3A21' };
  const ROLES = {
    engineer: { outfit: '#3B5BDB', style: 'hoodie', pants: '#2B2F3A', hair: 'short', prop: 'laptop' },
    founder: { outfit: '#1F2937', style: 'blazer', pants: '#1F2937', hair: 'short', prop: 'phone' },
    'founder-f': { outfit: '#7C3AED', style: 'blazer', pants: '#2B2F3A', hair: 'long', prop: 'phone' },
    worker: { outfit: '#4B5563', style: 'vest', pants: '#334155', hair: 'hardhat', prop: null },
    scientist: { outfit: '#F8FAFC', style: 'labcoat', pants: '#334155', hair: 'short', glasses: true, prop: 'clipboard' },
    doctor: { outfit: '#F8FAFC', style: 'labcoat', pants: '#0E7490', hair: 'bun', prop: 'clipboard' },
    student: { outfit: '#10B981', style: 'tee', pants: '#1E3A8A', hair: 'curly', prop: 'backpack' },
    farmer: { outfit: '#B45309', style: 'shirt', pants: '#57534E', hair: 'strawhat', beard: true, prop: null },
    official: { outfit: '#111827', style: 'suit', pants: '#111827', hair: 'short', prop: null, glasses: true },
    person: { outfit: '#EF4444', style: 'tee', pants: '#1F2937', hair: 'short', prop: null },
    'person-f': { outfit: '#F59E0B', style: 'tee', pants: '#1F2937', hair: 'ponytail', prop: null },
  };
  function charSVG(o) {
    const sk = SKINS[o.skin] || o.skin || SKINS.medium, hc = o.hairColor || '#1B120C', oc = o.outfit, pc = o.pants, shoe = o.shoes || '#141414';
    const dark = 'rgba(0,0,0,.12)';
    let torso = `<path d="M58 302 L63 192 Q100 172 137 192 L142 302 Z" fill="${oc}"/>`;
    if (o.style === 'hoodie') torso += `<path d="M78 182 Q100 206 122 182" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="5"/><path d="M92 196 L90 226 M108 196 L110 226" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M74 262 H126 V290 H74Z" fill="rgba(0,0,0,.14)" rx="6"/>`;
    if (o.style === 'blazer' || o.style === 'suit') torso += `<path d="M86 180 L100 230 L114 180 Z" fill="#F8FAFC"/><path d="M84 182 L98 240 L74 300 L63 300 L66 196Z M116 182 L102 240 L126 300 L137 300 L134 196Z" fill="rgba(0,0,0,.18)"/>` + (o.style === 'suit' ? `<path d="M100 188 L94 200 L100 252 L106 200Z" fill="#C2271E"/>` : '');
    if (o.style === 'labcoat') torso += `<path d="M86 180 L100 214 L114 180 Z" fill="#60A5FA"/><path d="M100 214 V300" stroke="rgba(0,0,0,.18)" stroke-width="3"/><path d="M84 182 L98 230 L80 300 M116 182 L102 230 L120 300" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="3"/><rect x="112" y="232" width="16" height="18" rx="2" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2"/>`;
    if (o.style === 'vest') torso += `<path d="M70 196 L96 186 L96 300 L62 300Z M130 196 L104 186 L104 300 L138 300Z" fill="#FF7A1A"/><path d="M64 248 H96 M104 248 H136 M63 270 H96 M104 270 H137" stroke="#E5E7EB" stroke-width="6"/>`;
    if (o.style === 'shirt') torso += `<path d="M86 180 L100 200 L114 180" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="4"/><path d="M100 200 V300" stroke="rgba(0,0,0,.18)" stroke-width="2"/><circle cx="100" cy="226" r="2.5" fill="rgba(0,0,0,.3)"/><circle cx="100" cy="256" r="2.5" fill="rgba(0,0,0,.3)"/>`;
    if (o.style === 'tee') torso += `<path d="M84 182 Q100 198 116 182" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="4"/>`;
    torso += `<path d="M120 190 L137 192 L142 302 L118 302Z" fill="${dark}"/>`;
    const backpack = o.prop === 'backpack' ? `<rect x="40" y="200" width="30" height="80" rx="10" fill="#F59E0B"/><rect x="130" y="200" width="30" height="80" rx="10" fill="#F59E0B"/>` : '';
    const leg = (id, x) => `<g id="${id}"><rect x="${x}" y="296" width="25" height="100" rx="10" fill="${pc}"/><path d="M${x - 4} 412 Q${x - 4} 392 ${x + 12} 390 Q${x + 30} 390 ${x + 32} 412Z" fill="${shoe}"/></g>`;
    const arm = (id, sx, hx, side) => {
      let prop = '';
      if (side === 'R' && o.prop === 'laptop') prop = `<g transform="translate(${hx - 30} 268)"><rect x="0" y="0" width="58" height="38" rx="4" fill="#9CA3AF" stroke="#374151" stroke-width="3"/><rect x="5" y="5" width="48" height="28" rx="2" fill="#60A5FA"/><rect x="-6" y="36" width="70" height="7" rx="3" fill="#6B7280"/></g>`;
      if (side === 'R' && o.prop === 'phone') prop = `<rect x="${hx - 2}" y="270" width="16" height="28" rx="3" fill="#111827" stroke="#9CA3AF" stroke-width="2"/>`;
      if (side === 'R' && o.prop === 'clipboard') prop = `<g transform="translate(${hx - 30} 262)"><rect width="36" height="46" rx="3" fill="#B45309"/><rect x="4" y="6" width="28" height="36" fill="#FFF"/><path d="M8 16H28M8 24H28M8 32H22" stroke="#9CA3AF" stroke-width="2"/></g>`;
      if (side === 'R' && o.prop === 'briefcase') prop = `<g transform="translate(${hx - 22} 292)"><rect width="44" height="32" rx="4" fill="#78350F"/><path d="M14 0 V-6 H30 V0" fill="none" stroke="#78350F" stroke-width="4"/></g>`;
      if (side === 'R' && o.prop === 'megaphone') prop = `<g transform="translate(${hx - 4} 270)"><path d="M0 8 L40 -8 L40 40 L0 24Z" fill="#E5E7EB" stroke="#374151" stroke-width="3"/><rect x="-10" y="6" width="12" height="20" fill="#C2271E"/></g>`;
      if (side === 'R' && o.prop === 'sign') prop = `<g transform="translate(${hx - 4} 140)"><rect x="-3" y="40" width="7" height="140" fill="#92400E"/><rect x="-44" y="0" width="96" height="58" rx="3" fill="#FFF7E0" stroke="#92400E" stroke-width="3"/><text x="4" y="36" text-anchor="middle" font-family="Manrope,Inter" font-weight="800" font-size="18" fill="#C2271E">${esc(String(o.propText || '').slice(0, 12))}</text></g>`;
      if (side === 'R' && o.prop === 'coffee') prop = `<g transform="translate(${hx - 8} 274)"><path d="M0 0 H20 L17 26 H3Z" fill="#FFF" stroke="#78350F" stroke-width="2"/><rect y="8" width="20" height="8" fill="#B45309"/></g>`;
      return `<g id="${id}"><path d="M${sx} 196 Q${(sx + hx) / 2 + (side === 'L' ? -6 : 6)} 244 ${hx} 286" fill="none" stroke="${oc === '#F8FAFC' ? '#E5E7EB' : oc}" stroke-width="24" stroke-linecap="round"/><circle cx="${hx}" cy="290" r="12" fill="${sk}"/>${prop}</g>`;
    };
    let hair = '', hairBack = '';
    const H = o.hair;
    const topShort = `<path d="M40 104 Q38 40 100 36 Q162 40 160 104 Q154 70 100 64 Q46 70 40 104Z" fill="${hc}"/>`;
    if (H === 'short') hair = topShort;
    if (H === 'long') { hairBack = `<path d="M38 100 Q34 40 100 34 Q166 40 162 100 L166 190 Q140 196 128 170 L72 170 Q60 196 34 190Z" fill="${hc}"/>`; hair = `<path d="M40 104 Q42 46 100 40 Q150 44 160 96 Q120 60 70 74 Q52 84 40 104Z" fill="${hc}"/>`; }
    if (H === 'bun') hair = topShort + `<circle cx="100" cy="32" r="20" fill="${hc}"/>`;
    if (H === 'ponytail') { hairBack = `<path d="M150 70 Q190 90 176 160 Q166 120 146 100Z" fill="${hc}"/>`; hair = topShort; }
    if (H === 'curly') hair = [[48, 82], [62, 58], [84, 44], [108, 42], [132, 50], [150, 72], [156, 96], [44, 102]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="${hc}"/>`).join('');
    if (H === 'bald') hair = `<path d="M40 112 Q40 96 46 90 M160 112 Q160 96 154 90" stroke="${hc}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    if (H === 'hardhat') hair = topShort + `<path d="M34 92 Q36 26 100 24 Q164 26 166 92Z" fill="#FACC15" stroke="#CA8A04" stroke-width="3"/><rect x="24" y="86" width="152" height="12" rx="6" fill="#EAB308"/><rect x="94" y="26" width="12" height="62" fill="#CA8A04" opacity=".6"/>`;
    if (H === 'strawhat') hair = topShort + `<ellipse cx="100" cy="76" rx="92" ry="18" fill="#E7C27D" stroke="#B48A3C" stroke-width="3"/><path d="M50 74 Q54 22 100 20 Q146 22 150 74Z" fill="#E7C27D" stroke="#B48A3C" stroke-width="3"/><rect x="50" y="62" width="100" height="10" fill="#B45309"/>`;
    if (H === 'cap') hair = topShort + `<path d="M40 86 Q42 30 100 28 Q158 30 160 86Z" fill="${o.capColor || '#C2271E'}"/><path d="M100 80 Q150 74 186 92 Q150 96 100 92Z" fill="${o.capColor || '#C2271E'}"/>`;
    const glasses = o.glasses ? `<g fill="none" stroke="#111827" stroke-width="4"><circle cx="78" cy="110" r="15"/><circle cx="122" cy="110" r="15"/><path d="M93 110 H107 M63 106 L44 100 M137 106 L156 100"/></g>` : '';
    const beard = o.beard ? `<path d="M52 128 Q56 176 100 180 Q144 176 148 128 Q132 150 100 150 Q68 150 52 128Z" fill="${hc}"/>` : '';
    const head = o.headUrl ? `<image href="${o.headUrl}" x="30" y="18" width="140" height="160" preserveAspectRatio="xMidYMax meet"/>`
      : `<g id="face">${hairBack}<circle cx="40" cy="114" r="13" fill="${sk}"/><circle cx="160" cy="114" r="13" fill="${sk}"/><ellipse cx="100" cy="108" rx="62" ry="66" fill="${sk}"/><path d="M130 60 Q166 90 158 140 Q150 170 120 172 Q150 130 130 60Z" fill="rgba(0,0,0,.08)"/>${beard}<circle cx="68" cy="132" r="9" fill="#F87171" opacity=".35"/><circle cx="132" cy="132" r="9" fill="#F87171" opacity=".35"/>
        <g id="eyes"><ellipse cx="78" cy="110" rx="7" ry="9" fill="#21140C"/><ellipse cx="122" cy="110" rx="7" ry="9" fill="#21140C"/><circle cx="80" cy="107" r="2.4" fill="#fff"/><circle cx="124" cy="107" r="2.4" fill="#fff"/></g>
        <path id="browL" d="M64 88 Q78 82 90 88" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/><path id="browR" d="M110 88 Q122 82 136 88" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/>
        <path id="m-smile" d="M84 140 Q100 154 116 140" fill="none" stroke="#5A2A1A" stroke-width="5" stroke-linecap="round"/>
        <path id="m-open" d="M84 138 Q100 166 116 138Z" fill="#5A1E14" style="display:none"/>
        <ellipse id="m-o" cx="100" cy="146" rx="9" ry="12" fill="#5A1E14" style="display:none"/>
        <path id="m-flat" d="M88 145 H112" stroke="#5A2A1A" stroke-width="5" stroke-linecap="round" style="display:none"/>
        <path id="m-sad" d="M86 150 Q100 138 114 150" fill="none" stroke="#5A2A1A" stroke-width="5" stroke-linecap="round" style="display:none"/>
        ${hair}${glasses}</g>`;
    return `<svg viewBox="-30 -10 260 430" style="width:100%;height:100%;overflow:visible">${backpack}${leg('legL', 72)}${leg('legR', 103)}${arm('armL', 64, 50, 'L')}${torso}${arm('armR', 136, 150, 'R')}<rect x="90" y="160" width="20" height="26" fill="${sk}"/><g id="head">${head}</g></svg>`;
  }
  function addCharacter(c, spec, sceneActions) {
    const u = G.u, P = c.portrait;
    const base = Object.assign({}, ROLES[spec.role] || ROLES.person, spec);
    if (spec.head) { const a = G.assets[spec.head]; if (a && a.type === 'image') base.headUrl = a.url; }
    const hPx = c.H * (spec.size || (P ? 30 : 46)) / 100, wPx = hPx * 260 / 430;
    const el = h('div', 'abs cutout', { width: wPx + 'px', height: hPx + 'px', left: 0, top: 0, zIndex: 18, transformOrigin: '50% 100%' });
    el.innerHTML = charSVG(base);
    const q = id => el.querySelector('#' + id);
    const parts = { legL: q('legL'), legR: q('legR'), armL: q('armL'), armR: q('armR'), head: q('head'), eyes: q('eyes'), browL: q('browL'), browR: q('browR') };
    const mouths = ['smile', 'open', 'o', 'flat', 'sad'].reduce((m, k) => (m[k] = q('m-' + k), m), {});
    const shadow = h('div', 'abs', { width: wPx * .7 + 'px', height: wPx * .1 + 'px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,.35), transparent 70%)', zIndex: 17 });
    const layer = spec.layer || 'fg';
    c.add(shadow, layer); c.add(el, layer);
    let bubble = null;
    const at0 = spec.at != null ? spec.at : .2;
    const x0 = spec.x != null ? spec.x : 50, yb = spec.y != null ? spec.y : (P ? 74 : 92);
    const enter = spec.enter || (c.vox ? 'pop' : 'rise');
    const fromX = spec.from === 'right' ? 115 : -15;
    const acts = [].concat(spec.actions || [], (sceneActions || []).filter(a => a.who && a.who === spec.id)).map(a => Object.assign({ dur: a.do === 'walk' || a.do === 'exit' ? 1.2 : a.do === 'say' ? 2.4 : 1.2 }, a)).sort((a, b) => a.at - b.at);
    if (enter === 'walk') acts.unshift({ at: at0, do: 'walk', from: fromX, to: x0, dur: 1.2 });
    const say = acts.filter(a => a.do === 'say');
    say.forEach(a => {
      const b = h('div', 'abs', { background: '#fff', color: '#141414', fontFamily: 'Manrope, Inter, sans-serif', fontWeight: 800, fontSize: u * (P ? 3 : 2.4) + 'px', lineHeight: 1.2, padding: `${u * .9}px ${u * 1.4}px`, borderRadius: u * 2 + 'px', maxWidth: (P ? c.W * .6 : c.W * .3) + 'px', boxShadow: '0 6px 18px rgba(0,0,0,.3)', zIndex: 30, opacity: 0, textAlign: 'center' }, esc(a.text || ''));
      const tail = h('div', 'abs', { left: '50%', bottom: -u * 1.2 + 'px', width: 0, height: 0, borderLeft: `${u}px solid transparent`, borderRight: `${u}px solid transparent`, borderTop: `${u * 1.4}px solid #fff`, transform: 'translateX(-50%)' });
      b.appendChild(tail); c.add(b, 'fg'); a._b = b; c.sfx('pop', a.at, .4);
    });
    const vs = c.s.voStart != null ? c.s.voStart : .2, ve = c.s.voDur ? vs + c.s.voDur : c.dur - .3;
    const seed = idHash(spec.id || spec.role || 'p') % 97;
    if (enter === 'pop') { c.sfx('pop', at0, .6); popBurst(c, x0, yb - (hPx / c.H * 100) * .5, wPx, at0, layer); }
    c.onUpdate(lt => {
      // position from walk actions
      let x = x0, walking = false, op = lt >= at0 ? 1 : 0, sc = 1, dy = 0, shake = 0;
      if (enter === 'walk' && lt < at0) x = fromX;
      for (const a of acts) {
        if (a.do === 'walk' || a.do === 'exit') {
          const from = a.from != null ? a.from : x, to = a.do === 'exit' ? (a.to === 'left' ? -20 : a.to === 'right' ? 120 : (a.to != null ? a.to : 120)) : a.to;
          if (lt >= a.at + a.dur) x = to; else if (lt >= a.at) { x = lerp(from, to, E.inOut((lt - a.at) / a.dur)); walking = true; }
        }
      }
      if (enter === 'pop') { const k = prog(lt, at0, .5); sc = k <= 0 ? 0 : E.outBack(k) ; }
      if (enter === 'rise') { const k = E.outExpo(prog(lt, at0, .7)); dy += (1 - k) * c.H * .15; op = clamp(k * 3); }
      if (enter === 'drop') { const k = prog(lt, at0, .6); dy += k < 1 ? -(1 - E.outBack(k)) * c.H * .3 : 0; op = k > 0 ? 1 : 0; }
      const act = n => acts.find(a => a.do === n && lt >= a.at && lt < a.at + a.dur);
      // limbs
      const t = lt * 9;
      let aL = 10 + Math.sin(lt * 1.6 + seed) * 3, aR = -10 - Math.sin(lt * 1.6 + seed) * 3, lL = 0, lR = 0, hRot = Math.sin(lt * 1.1 + seed) * 2, brow = 0, mouth = spec.mood === 'sad' ? 'sad' : spec.mood === 'neutral' ? 'flat' : 'smile';
      if (walking) { lL = Math.sin(t) * 24; lR = -Math.sin(t) * 24; aL = 10 - Math.sin(t) * 22; aR = -10 - Math.sin(t) * 22; dy -= Math.abs(Math.sin(t)) * hPx * .02; }
      const pose = spec.pose;
      if (pose === 'wave' || act('wave')) { aR = -150 + Math.sin(lt * 12) * 18; }
      if (pose === 'point' || act('point')) { const a = act('point'); aR = (a && a.dir === 'up') ? -165 : -95; }
      if (pose === 'cheer' || act('cheer')) { aL = 128 + Math.sin(lt * 10) * 10; aR = -128 - Math.sin(lt * 10) * 10; dy -= Math.abs(Math.sin(lt * 7)) * hPx * .05; mouth = 'open'; }
      if (pose === 'think' || act('think')) { aR = -138; hRot = 7; brow = 1; mouth = 'flat'; }
      const sh = act('shock') || (pose === 'shock' ? { at: at0, dur: 99 } : null);
      if (sh) { const k = lt - sh.at; dy -= Math.max(0, Math.sin(Math.min(k, .5) * Math.PI / .5)) * hPx * .1; shake = Math.sin(lt * 60) * u * .4 * Math.exp(-k * 2); aL = 60; aR = -60; brow = -1; mouth = 'o'; }
      const jp = act('jump'); if (jp) dy -= Math.sin(clamp((lt - jp.at) / .6) * Math.PI) * hPx * .18;
      const fc = acts.filter(a => a.do === 'face' && lt >= a.at).pop(); if (fc && !sh) mouth = fc.mood === 'sad' ? 'sad' : fc.mood === 'angry' ? 'flat' : fc.mood === 'shock' ? 'o' : fc.mood === 'happy' ? 'smile' : mouth; if (fc && fc.mood === 'angry') brow = -2;
      // talking: lip flap during say actions, or during the scene narration when talk:true
      const talking = say.some(a => lt >= a.at && lt < a.at + a.dur) || (spec.talk && lt >= vs && lt < ve);
      if (talking && mouth !== 'o') mouth = noise1(lt * 9, seed) > 0 ? 'open' : 'smile';
      const flip = spec.flip ? -1 : 1;
      if (parts.legL) parts.legL.setAttribute('transform', `rotate(${lL} 84 300)`);
      if (parts.legR) parts.legR.setAttribute('transform', `rotate(${lR} 116 300)`);
      if (parts.armL) parts.armL.setAttribute('transform', `rotate(${aL} 64 196)`);
      if (parts.armR) parts.armR.setAttribute('transform', `rotate(${aR} 136 196)`);
      if (parts.head) parts.head.setAttribute('transform', `rotate(${hRot} 100 168)`);
      if (parts.eyes) { const bl = ((lt + seed * .13) % 3.4) < .12; parts.eyes.setAttribute('transform', `translate(0 110) scale(1 ${bl ? .12 : sh ? 1.25 : 1}) translate(0 -110)`); }
      if (parts.browL) { parts.browL.setAttribute('transform', `translate(0 ${brow === -1 ? -8 : 0}) rotate(${brow === -2 ? 14 : brow === 1 ? -8 : 0} 78 86)`); parts.browR.setAttribute('transform', `translate(0 ${brow === -1 || brow === 1 ? -8 : 0}) rotate(${brow === -2 ? -14 : 0} 122 86)`); }
      for (const k in mouths) if (mouths[k]) mouths[k].style.display = k === mouth ? '' : 'none';
      const px = x / 100 * c.W - wPx / 2 + shake, py = yb / 100 * c.H - hPx + dy;
      const breath = 1 + Math.sin(lt * 2.2 + seed) * .006;
      el.style.transform = `translate(${px}px, ${py}px) scale(${flip * sc}, ${sc * breath})`;
      el.style.opacity = op;
      shadow.style.transform = `translate(${x / 100 * c.W - wPx * .35}px, ${yb / 100 * c.H - wPx * .05}px) scale(${sc * (1 + dy / hPx * .6)})`; shadow.style.opacity = op * .8;
      say.forEach(a => { const k = prog(lt, a.at, .25), out = prog(lt, a.at + a.dur - .2, .2); const b = a._b; b.style.opacity = k * (1 - out); b.style.left = clamp(x / 100 * c.W - b.offsetWidth / 2, c.W * .03, c.W * .97 - b.offsetWidth) + 'px'; b.style.top = (yb / 100 * c.H - hPx - b.offsetHeight - u * 1.6 + dy) + 'px'; b.style.transform = `scale(${lerp(.6, 1, E.outBack(k))})`; });
    });
    if (spec.name) { const nm = h('div', 'abs', { left: x0 + '%', top: yb + 1.5 + '%', transform: 'translateX(-50%)', background: c.th.accent, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: u * 2 + 'px', padding: `${u * .3}px ${u * 1}px`, borderRadius: u * .6 + 'px', whiteSpace: 'nowrap', zIndex: 19 }, esc(spec.name)); c.add(nm, layer); c.item(nm, { at: at0 + .4, fx: 'pop', keep: true, center: false }); }
    return el;
  }
  // a real photo (or your own PNG) as a die-cut sticker; "cutout:…" removes the background first
  function addImageSticker(c, st) {
    const u = G.u, a = G.assets[st.media || st.src];
    // nothing found (offline / no match): say it with a glossy label sticker instead of an empty box
    if ((!a || a.type === 'missing') && /^(sticker|pack):/i.test(st.media || '')) {
      const txt = st.label || st.query || (a && a.label) || String(st.media).replace(/^[a-z]+:(?:(?:emoji|clipart|photo|any):)?/i, '');
      return addSticker(c, Object.assign({}, st, { type: 'vx-label', text: txt, media: null, size: Math.max(6, (st.size || 16) * .45) }));
    }
    const hh = (st.size || 16) * u;
    const el = h('div', 'stk cutout', { left: (st.x != null ? st.x : 50) + '%', top: (st.y != null ? st.y : 40) + '%', height: hh + 'px', zIndex: 20 });
    if (a && a.type === 'image') { const im = h('img', st.look ? 'look-' + st.look : null, { height: '100%', width: 'auto', display: 'block', transform: st.flip ? 'scaleX(-1)' : '' }); im.src = a.url; el.appendChild(im); }
    else { el.style.width = hh + 'px'; el.appendChild(Object.assign(c.media(st.media || st.src, {}), { style: 'position:absolute;inset:0' })); }
    c.add(el, st.layer || 'fg');
    const it = c.item(el, { at: st.at != null ? st.at : .6, fx: st.fx || (c.vox || !c.cine ? 'popBig' : 'blurIn'), rot: st.rot != null ? st.rot : (idHash(String(st.media)) % 9) - 4, idle: st.idle !== undefined ? st.idle : (c.vox ? 'wiggle' : 'drift'), out: st.out, center: true, keep: true });
    const pops = stickerMotion(it, st, st.x != null ? st.x : 50, st.y != null ? st.y : 40);
    if (pops) { c.sfx('pop', it.o.at, .6); if (c.vox || !c.cine) popBurst(c, st.x != null ? st.x : 50, st.y != null ? st.y : 40, hh, it.o.at, st.layer || 'fg'); }
    return el;
  }

  // Sticker motion: "from" (drive/slide in from off-screen), "moves" / "to" (travel), "exit" (leave), "flip"
  function stickerMotion(it, st, x, y) {
    const o = it.o, at = o.at, edge = (side, px, py) => side === 'left' ? [-(px + 40), 0] : side === 'right' ? [100 - px + 40, 0] : side === 'top' ? [0, -(py + 40)] : side === 'bottom' ? [0, 100 - py + 40] : [0, 0];
    const P = [];
    if (st.from) { const [dx, dy] = edge(st.from, x, y); const d = st.travel || 1.2; P.push({ t: at, dx, dy }, { t: at + d, dx: 0, dy: 0, ease: 'out' }); o.fx = 'none'; o.arrive = at + d; }
    else P.push({ t: at, dx: 0, dy: 0 });
    const moves = (st.moves || (st.to ? [st.to] : [])).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
    moves.forEach(m => { const prev = P[P.length - 1]; const t0 = Math.max(m.at != null ? m.at : prev.t + .2, prev.t); P.push({ t: t0, dx: prev.dx, dy: prev.dy }, { t: t0 + (m.dur || 1), dx: (m.x != null ? m.x : x + prev.dx) - x, dy: (m.y != null ? m.y : y + prev.dy) - y, ease: m.ease || 'inOut' }); });
    if (st.exit) { const prev = P[P.length - 1]; const t0 = Math.max(st.exitAt != null ? st.exitAt : prev.t + 1.5, prev.t); const [ex, ey] = edge(typeof st.exit === 'string' ? st.exit : 'right', x + prev.dx, y + prev.dy); P.push({ t: t0, dx: prev.dx, dy: prev.dy }, { t: t0 + (st.travel || 1.1), dx: prev.dx + ex, dy: prev.dy + ey, ease: 'inQuad' }); }
    if (P.length > 1) { o.path = P; o.rollWhileMoving = st.roll !== false; it.scene.sfx(st.from ? 'whoosh-soft' : 'swish', at, .4); }
    return !st.from;
  }

  // Vox "pop": confetti dashes + dots radiate from a sticker as it lands
  function popBurst(c, x, y, size, at, layer) {
    const u = G.u, pal = c.th.pal || [c.th.accent, c.th.hl, c.th.blue || '#2D6FB7', c.th.teal || '#1E9C8F'];
    const wrap = h('div', 'abs', { left: x + '%', top: y + '%', width: 0, height: 0, zIndex: 19, pointerEvents: 'none' });
    const n = 9, rr = rng(Math.round(x * 31 + y * 17 + at * 7)), parts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rr() * .4, dash = i % 3 !== 0;
      const p = h('div', 'abs', { left: 0, top: 0, width: (dash ? size * .16 : size * .07) + 'px', height: (dash ? u * .55 : size * .07) + 'px', borderRadius: u + 'px', background: pal[i % pal.length], transformOrigin: '0 50%', opacity: 0 });
      wrap.appendChild(p); parts.push({ p, ang, dist: size * (.62 + rr() * .3), dash });
    }
    c.add(wrap, layer || 'fg');
    c.onUpdate(lt => { const k = prog(lt, at + .06, .5); parts.forEach(q => { if (k <= 0 || k >= 1) { q.p.style.opacity = 0; return; } const d = q.dist * E.outExpo(k); q.p.style.opacity = 1 - E.in(k); q.p.style.transform = `translate(${Math.cos(q.ang) * d}px, ${Math.sin(q.ang) * d}px) rotate(${q.dash ? q.ang * 180 / Math.PI : 0}deg) scale(${1 - k * .5})`; }); });
  }
  function addPremiumSticker(c, st, S) {
    S = S || (window.CINE_STICKERS || {})[st.type] || {};
    const u = G.u, th = c.th, col = st.color || th.accent;
    const x = st.x != null ? st.x : 80, y = st.y != null ? st.y : 25;
    const el = h('div', 'stk'); el.style.setProperty('--gc', col); el.style.zIndex = 20;
    let fx = st.fx || (c.vox ? 'popBig' : 'blurIn'), idle = st.idle !== undefined ? st.idle : (c.vox ? 'wiggle' : 'drift'), snd = c.vox ? 'pop' : 'tap', center = true, draws = null, dur = st.dur || (c.vox ? .5 : .8);
    const place = (w, hh) => Object.assign(el.style, { left: x + '%', top: y + '%' }, w != null ? { width: w + 'px' } : {}, hh != null ? { height: hh + 'px' } : {});
    if (S.kind === 'glass') {
      el.classList.add('glass');
      const hh = (st.size || (c.portrait ? 6 : 5.4)) * u;
      const parts = [];
      if (S.rec) parts.push(`<span class="recdot" style="width:${hh * .24}px;height:${hh * .24}px;border-radius:50%;background:#FF3B30;box-shadow:0 0 ${u}px #FF3B30;display:inline-block"></span><span class="gtxt" style="letter-spacing:.16em">REC</span><span class="gmono tcx" style="opacity:.8"></span>`);
      const icon = st.icon || S.icon;
      if (icon) parts.push(stickerSVG(String(icon).startsWith('icon-') ? icon : 'icon-' + icon, col, th).html);
      if (S.stat) {
        el.style.flexDirection = 'column'; el.style.alignItems = st.align === 'left' ? 'flex-start' : 'center'; el.style.gap = u * .4 + 'px';
        el.style.padding = `${hh * .32}px ${hh * .5}px`; el.style.borderRadius = u * 1.4 + 'px';
        parts.push(`<div class="gtxt" style="font-size:${hh * .78}px;line-height:1;color:${st.color ? col : 'var(--ink)'}">${esc(st.value != null ? st.value : st.text || '')}</div>`);
        if (st.sub || (st.value != null && st.text)) parts.push(`<div class="gsub" style="font-size:${hh * .2}px">${esc(st.sub || st.text)}</div>`);
        place();
      } else {
        el.style.height = hh + 'px'; el.style.padding = `0 ${hh * .46}px`; el.style.borderRadius = hh / 2 + 'px'; el.style.fontSize = hh * .36 + 'px';
        if (st.text) parts.push(`<span class="${S.mono ? 'gmono' : 'gtxt'}">${esc(st.text)}</span>`);
        if (st.sub) parts.push(`<span class="gsub" style="font-size:.66em">${esc(st.sub)}</span>`);
        place(null, hh);
      }
      el.innerHTML = parts.join('');
      if (S.rec) { const tcx = el.querySelector('.tcx'), dot = el.querySelector('.recdot'); c.onUpdate(lt => { tcx.textContent = tc(lt + (st.offset || 0)); dot.style.opacity = Math.floor(lt * 1.6) % 2 ? .25 : 1; }); }
    } else if (S.kind === 'icon') {
      el.classList.add('glass'); const sz = (st.size || 9) * u; place(sz, sz); el.style.borderRadius = '50%';
      el.innerHTML = stickerSVG(st.type, col, th).html; el.firstChild.style.height = '56%';
    } else if (S.kind === 'photo') {
      el.classList.add('photo-stk'); const sz = (st.size || 18) * u; const asp = st.aspect || 1; place(sz * asp, sz);
      el.style.borderRadius = st.shape === 'rounded' ? u * 1.6 + 'px' : st.shape === 'square' ? '0' : '50%';
      const holder = h('div', 'fill look-' + (st.look || c.dl)); const m = c.media(st.media || st.src, { label: st.label }); Object.assign(m.style, { position: 'absolute', inset: 0 }); holder.appendChild(m); el.appendChild(holder);
      c.onUpdate(lt => updateMedia(m, lt, c.dur)); fx = st.fx || (c.vox ? 'popBig' : 'settle'); snd = c.vox ? 'pop' : 'impact-soft';
      if (st.label) addPremiumSticker(c, { type: 'tag', text: st.label, x, y: y + (st.size || 18) * u / c.H * 100 * .62, size: 4.2, at: (st.at != null ? st.at : .8) + .35 });
    } else if (S.kind === 'glow') {
      el.classList.add('glow'); const sz = (st.size || (S.wide ? 30 : 8)) * u; const w = S.wide ? sz : sz, hh = S.wide ? sz / (st.aspect || 6) : sz; place(w, hh);
      el.innerHTML = stickerSVG(st.type, col, th).html; el.firstChild.setAttribute('preserveAspectRatio', 'none'); fx = st.fx || 'fade'; snd = 'shimmer';
      if (S.pulse) { const rings = [...el.querySelectorAll('.pr')]; idle = st.idle || null; c.onUpdate(lt => rings.forEach((r, i) => { const ph = ((lt * .7 + i * .5) % 1); r.setAttribute('r', 9 + ph * 40); r.setAttribute('stroke-opacity', (1 - ph) * .9); })); }
    } else if (S.kind === 'line') {
      const sz = (st.size || (S.wide ? 24 : 14)) * u, w = S.wide ? sz : sz * (st.aspect || 1), hh = S.wide ? sz / (st.aspect || (S.leader ? 2.6 : 5)) : sz; place(w, hh);
      const svg = scaleSVG(S.svg, w / 100, hh / 100, Math.min(sz / 100, u * (st.weight || .13)));
      el.innerHTML = `<svg viewBox="0 0 ${w} ${hh}" style="width:100%;height:100%;overflow:visible">${svg.replace(/"C"/g, `"${col}"`)}</svg>`;
      fx = st.fx || 'none'; idle = st.idle || null; draws = [...el.querySelectorAll('path,circle:not([fill="C"])')].filter(p => p.tagName === 'path'); snd = 'pen'; dur = st.dur || (S.leader ? .9 : .7);
      if (S.text && st.text) { const t = h('div', 'ltxt film-title', { inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: (st.textSize ? st.textSize * u : sz * .2) + 'px', color: col, textShadow: 'none', letterSpacing: '.12em' }, esc(st.text)); el.appendChild(t); c.item(t, { at: (st.at != null ? st.at : .8) + .3, fx: 'blurIn', keep: true }); }
      if (S.leader && st.text) { const t = h('div', 'ltxt', { left: '30%', bottom: '74%', fontSize: (st.textSize || 3) * u + 'px' }); t.innerHTML = esc(st.text) + (st.sub ? `<div class="tracked" style="font-size:.5em;opacity:.7;margin-top:.3em">${esc(st.sub)}</div>` : ''); el.appendChild(t); c.item(t, { at: (st.at != null ? st.at : .8) + .55, fx: 'blurIn', keep: true }); }
    }
    c.add(el, st.layer || 'fg');
    const it = c.item(el, { at: st.at != null ? st.at : .8, fx, dur, rot: st.rot || 0, idle, out: st.out, center, keep: true, scale: st.scale || 1 });
    if (draws) { it.draws = draws; it.o.drawDur = dur; it.o.dur = .01; }
    else if (stickerMotion(it, st, x, y) && c.vox && S.kind !== 'glow' && S.kind !== 'line') popBurst(c, x, y, (st.size || 8) * u, it.o.at, st.layer || 'fg');
    c.sfx(snd, it.o.at, snd === 'pen' ? .35 : .5);
    return el;
  }
  const idHash = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0;

  /* =====================================================================
     SCENE LIBRARY
     ===================================================================== */
  const SC = {};
  V.SCENES = SC;

  // ---- TITLE: kicker + giant headline + sub, optional background media
  SC.title = (s, c) => {
    const u = c.u;
    if (s.media) { const m = c.media(s.media, { label: s.mediaLabel }); Object.assign(m.style, { position: 'absolute', inset: 0 }); const holder = h('div', 'fill look-' + (s.look || c.dlDuo)); holder.appendChild(m); holder.style.opacity = .35; c.add(holder, 'bg'); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: s.align === 'center' || c.portrait ? 'center' : 'flex-start', textAlign: s.align === 'center' || c.portrait ? 'center' : 'left', gap: u * 2.2 + 'px' });
    if (s.kicker) { const k = h('div', 'kicker', { display: 'flex', alignItems: 'center', gap: u + 'px' }); k.innerHTML = `<span style="display:inline-block;width:${u * 4}px;height:${u * .7}px;background:var(--accent)"></span><span>${esc(s.kicker)}</span>`; box.appendChild(k); c.item(k, { at: .1, fx: 'wipe', dur: .6 }); }
    const hl = h('div', 'headline', { fontSize: (s.size || (c.portrait ? 13 : 11.5)) * u + 'px', maxWidth: '100%' });
    box.appendChild(hl);
    const r = c.text(hl, s.headline || s.text || '', { at: .3, stagger: .07, fx: s.fx || 'riseBig' });
    if (s.sub) { const sb = h('div', 'body', { fontSize: (c.portrait ? 3.6 : 3.2) * u + 'px', opacity: .85, maxWidth: c.portrait ? '100%' : '70%' }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: r.end, fx: 'rise' }); }
    c.add(box);
    c.postLayout(() => fitText(hl, c.safe.w, c.safe.h * .7));
  };

  // ---- KINETIC: lines of big kinetic type, each line punches in
  SC.kinetic = (s, c) => {
    const u = c.u; const lines = s.lines || [s.text || ''];
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 1.2 + 'px' });
    const per = Math.max(.6, (c.dur - .8) / lines.length);
    const fxs = ['stamp', 'riseBig', 'popBig', 'slideL', 'slideR', 'zoom'];
    lines.forEach((ln, i) => {
      const d = h('div', s.font === 'sans' ? 'sans-x' : 'headline', { fontSize: (s.size || (c.portrait ? 12 : 10)) * u + 'px', width: '100%' });
      box.appendChild(d);
      c.text(d, ln, { at: .15 + i * per, stagger: .09, fx: s.fx || fxs[i % fxs.length], markAt: .15 + i * per + .5 });
      c.sfx('hit', .15 + i * per, .5);
      if (s.dimPrevious !== false && i < lines.length - 1) c.onUpdate(lt => { d.style.opacity = lt > .15 + (i + 1) * per ? .28 : 1; });
      c.postLayout(() => fitText(d, c.safe.w, c.safe.h / lines.length));
    });
    c.add(box);
  };

  // ---- BIG NUMBER: counter with prefix/suffix + label
  SC.bignumber = (s, c) => {
    const u = c.u;
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 1.5 + 'px' });
    if (s.kicker) { const k = h('div', 'kicker', null, esc(s.kicker)); box.appendChild(k); c.item(k, { at: .1, fx: 'fade' }); }
    const num = h('div', 'headline num', { fontSize: (s.size || (c.portrait ? 26 : 24)) * u * (c.cine ? .82 : 1) + 'px', color: s.color || 'var(--ink)', lineHeight: .95, whiteSpace: 'nowrap' });
    const numWrap = h('span', c.archive ? null : 'm-hl', { backgroundSize: '0% 62%' }); numWrap.appendChild(num); num.style.display = 'inline-block';
    box.appendChild(numWrap);
    const from = s.from || 0, to = Number(s.value != null ? s.value : 100), dec = s.decimals != null ? s.decimals : (String(to).includes('.') ? String(to).split('.')[1].length : 0);
    const cStart = .3, cDur = Math.min(s.countDur || 1.8, c.dur * .5);
    c.item(num, { at: .15, fx: 'zoom', dur: .5 });
    c.onUpdate(lt => { const p = E.outExpo(prog(lt, cStart, cDur)); num.textContent = (s.prefix || '') + fmtNum(lerp(from, to, p), dec, s.separator !== false) + (s.suffix || ''); numWrap.style.backgroundSize = c.cine ? `0% 0%, ${E.inOut(prog(lt, cStart + cDur, .6)) * 100}% 3%` : `${E.inOut(prog(lt, cStart + cDur, .45)) * 100}% 40%`; });
    c.sfx('tick-roll', cStart, .4); c.sfx('ding', cStart + cDur, .8);
    if (s.label) { const l = h('div', 'sans-x', { fontSize: (c.portrait ? 5 : 4.4) * u + 'px', maxWidth: '92%' }); box.appendChild(l); c.text(l, s.label, { at: cStart + .4, stagger: .05 }); }
    if (s.sub) { const sb = h('div', 'body', { fontSize: 2.8 * u + 'px', opacity: .75, maxWidth: '80%' }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: cStart + cDur, fx: 'rise' }); }
    c.add(box);
    c.postLayout(() => { num.textContent = (s.prefix || '') + fmtNum(to, dec, s.separator !== false) + (s.suffix || ''); num.style.display = 'block'; fitText(num, c.safe.w * .96, c.safe.h * .55); num.style.display = 'inline-block'; });
  };

  // ---- BAR CHART (horizontal, animated, counting)
  SC.bar = (s, c) => {
    const u = c.u; const data = s.data || s.bars || [];
    const box = c.box({ display: 'flex', flexDirection: 'column', gap: u * 2 + 'px' });
    if (s.title) { const t = h('div', 'sans-x', { fontSize: (c.portrait ? 6 : 5) * u + 'px' }); box.appendChild(t); c.text(t, s.title, { at: .1, stagger: .05 }); }
    if (s.subtitle) { const t = h('div', 'kicker', { opacity: .75 }, esc(s.subtitle)); box.appendChild(t); c.item(t, { at: .3, fx: 'fade' }); }
    const rows = h('div', null, { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * 1.6 + 'px' });
    box.appendChild(rows);
    const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
    const rowH = Math.min(9 * u, (c.safe.h * .7 - data.length * u * 1.6) / Math.max(1, data.length));
    const labelW = c.portrait ? 0 : Math.min(26 * u, c.safe.w * .28);
    const pal = [c.th.accent, c.th.blue, c.th.teal, '#8E5CC4', '#F28C28', '#2E9E55'];
    data.forEach((d, i) => {
      const at = .5 + i * (s.stagger || .22);
      const row = h('div', c.portrait ? null : 'bar-row', c.portrait ? { display: 'flex', flexDirection: 'column', gap: u * .6 + 'px' } : { height: rowH + 'px' });
      const lab = h('div', 'bar-label', { width: c.portrait ? 'auto' : labelW + 'px', fontSize: Math.min(rowH * .42, 3.6 * u) + 'px', textAlign: c.portrait ? 'left' : 'right' }, esc(d.label));
      const track = h('div', 'bar-track', { height: (c.portrait ? rowH * .62 : rowH) + 'px', flex: c.portrait ? 'none' : 1 });
      const col = d.color || (s.highlight != null ? (d.label === s.highlight || i === s.highlight ? c.th.accent : c.th.muted) : (d.highlight ? c.th.accent : pal[i % pal.length]));
      const fill = h('div', 'bar-fill', { background: col, width: '0%' });
      fill.style.backgroundImage = 'linear-gradient(180deg,rgba(255,255,255,.18),rgba(0,0,0,.08))';
      const val = h('div', 'bar-val', { fontSize: Math.min(rowH * .55, 4.6 * u) + 'px', left: '0%' });
      track.appendChild(fill); track.appendChild(val); row.appendChild(lab); row.appendChild(track); rows.appendChild(row);
      c.item(lab, { at: at - .15, fx: 'slideL' });
      const frac = Math.abs(d.value) / max * (c.portrait ? .78 : .82);
      const dec = s.decimals != null ? s.decimals : (String(d.value).includes('.') ? 1 : 0);
      c.onUpdate(lt => { const p = E.outExpo(prog(lt, at, 1.1)); fill.style.width = frac * p * 100 + '%'; val.style.left = `calc(${frac * p * 100}% + ${u * 1.2}px)`; val.textContent = (s.prefix || '') + fmtNum(d.value * p, dec) + (s.suffix || ''); val.style.opacity = p > 0 ? 1 : 0; });
      c.sfx('bar', at, .35);
    });
    if (s.source) addSource(c, s.source);
    c.add(box);
  };

  // ---- LINE CHART (draws on, moving dot, annotations)
  SC.line = (s, c) => {
    const u = c.u; const pts = s.points || s.data || [];
    const box = c.box({ display: 'flex', flexDirection: 'column', gap: u * 1.5 + 'px' });
    if (s.title) { const t = h('div', 'sans-x', { fontSize: (c.portrait ? 6 : 5) * u + 'px' }); box.appendChild(t); c.text(t, s.title, { at: .1, stagger: .05 }); }
    const area = h('div', null, { flex: 1, position: 'relative' }); box.appendChild(area); c.add(box);
    c.postLayout(() => {
      const Wc = area.offsetWidth, Hc = area.offsetHeight, padL = u * 2, padB = u * 5, padT = u * 4, padR = u * 10;
      const svg = sv('svg', { width: Wc, height: Hc, style: 'position:absolute;inset:0;overflow:visible' }); area.appendChild(svg);
      const ys = pts.map(p => p.y != null ? p.y : p.value), ymin = s.min != null ? s.min : Math.min(0, ...ys), ymax = s.max != null ? s.max : Math.max(...ys) * 1.1;
      const X = i => padL + (Wc - padL - padR) * (pts.length < 2 ? 0 : i / (pts.length - 1));
      const Y = v => Hc - padB - (Hc - padB - padT) * ((v - ymin) / (ymax - ymin || 1));
      for (let g = 0; g <= 3; g++) { const yv = ymin + (ymax - ymin) * g / 3; sv('line', { x1: padL, x2: Wc - padR, y1: Y(yv), y2: Y(yv), stroke: c.th.muted, 'stroke-opacity': .35, 'stroke-dasharray': '4 6' }, svg); const tl = sv('text', { x: padL, y: Y(yv) - u * .7, fill: c.th.ink, 'fill-opacity': .6, 'font-family': 'Mono', 'font-size': u * 2.3 }, svg); tl.textContent = (s.prefix || '') + fmtNum(yv, 0) + (s.suffix || ''); }
      let d = ''; pts.forEach((p, i) => { d += (i ? ' L' : 'M') + X(i) + ' ' + Y(ys[i]); });
      const areaP = sv('path', { d: d + ` L${X(pts.length - 1)} ${Hc - padB} L${X(0)} ${Hc - padB} Z`, fill: s.color || c.th.accent, 'fill-opacity': .14 }, svg);
      const line = sv('path', { d, fill: 'none', stroke: s.color || c.th.accent, 'stroke-width': u * .9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      pts.forEach((p, i) => { if (p.label || p.x != null) { if (pts.length > 8 && i % Math.ceil(pts.length / 6) && i !== pts.length - 1) return; const tx = sv('text', { x: X(i), y: Hc - padB + u * 3.4, fill: c.th.ink, 'font-family': 'Mono', 'font-size': u * 2, 'text-anchor': 'middle' }, svg); tx.textContent = p.label != null ? p.label : p.x; } });
      const dot = h('div', 'abs', { width: u * 2.6 + 'px', height: u * 2.6 + 'px', borderRadius: '50%', background: s.color || c.th.accent, border: `${u * .5}px solid ${c.th.bg}`, transform: 'translate(-50%,-50%)', boxShadow: '0 2px 8px rgba(0,0,0,.3)' });
      const vl = h('div', 'abs headline num', { fontSize: u * 4.2 + 'px', whiteSpace: 'nowrap', transform: 'translate(-50%,-140%)' });
      area.appendChild(dot); area.appendChild(vl);
      const dStart = .5, dDur = Math.max(1.2, c.dur * .55);
      const len = line.getTotalLength();
      const anns = (s.annotations || []).map(a => {
        const i = a.index != null ? a.index : pts.findIndex(p => p.x == a.x || p.label == a.x);
        const ax = X(Math.max(0, i)), ay = Y(ys[Math.max(0, i)]);
        const vline = sv('line', { x1: ax, x2: ax, y1: ay, y2: Hc - padB, stroke: c.th.ink, 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: 0 }, svg);
        const note = h('div', 'abs marker', { left: ax + 'px', top: Math.max(0, ay - u * 13) + 'px', background: c.cine ? 'var(--glass)' : c.th.hl, color: c.cine ? 'var(--ink)' : '#141414', border: c.cine ? '1px solid var(--glassline)' : 'none', borderRadius: c.cine ? u + 'px' : 0, padding: `${u * .8}px ${u * 1.4}px`, fontSize: u * 2.6 + 'px', transformOrigin: '0 100%', boxShadow: '0 4px 10px rgba(0,0,0,.2)', maxWidth: u * 30 + 'px' }, esc(a.text));
        area.appendChild(note);
        const at = dStart + dDur * (pts.length < 2 ? 0 : i / (pts.length - 1));
        c.items.push(new Item(note, { at: at + .1, fx: 'popBig', rot: -3, idle: 'float' }, c)); c.sfx('pop', at + .1, .6);
        return { vline, at };
      });
      c.onUpdate(lt => {
        const p = E.inOut(prog(lt, dStart, dDur));
        drawPath(line, p); line._len = len;
        areaP.style.opacity = p;
        const pt = line.getPointAtLength(len * p);
        dot.style.left = pt.x + 'px'; dot.style.top = pt.y + 'px'; vl.style.left = pt.x + 'px'; vl.style.top = pt.y + 'px';
        const idx = (pts.length - 1) * p, i0 = Math.floor(idx), i1 = Math.min(pts.length - 1, i0 + 1), vv = lerp(ys[i0] || 0, ys[i1] || 0, idx - i0);
        vl.textContent = (s.prefix || '') + fmtNum(vv, s.decimals || 0) + (s.suffix || '');
        dot.style.opacity = vl.style.opacity = p > 0 ? 1 : 0;
        anns.forEach(a => a.vline.setAttribute('opacity', lt > a.at ? .6 : 0));
      });
      c.sfx('riser', dStart, .4);
    });
    if (s.source) addSource(c, s.source);
  };

  // ---- DONUT / PERCENT RING
  SC.donut = (s, c) => {
    const u = c.u; const v = clamp((s.value || 0) / 100);
    const box = c.box({ display: 'flex', flexDirection: c.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: u * 5 + 'px' });
    const size = Math.min(c.safe.h * (c.portrait ? .5 : .8), c.safe.w * (c.portrait ? .8 : .45));
    const ring = h('div', null, { width: size + 'px', height: size + 'px', position: 'relative', flex: 'none' });
    const R = 40, svg = `<svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="50" cy="50" r="${R}" fill="none" stroke="${c.th.muted}" stroke-opacity=".25" stroke-width="16"/><circle class="arc" cx="50" cy="50" r="${R}" fill="none" stroke="${s.color || c.th.accent}" stroke-width="16" stroke-linecap="butt" stroke-dasharray="${2 * Math.PI * R}" stroke-dashoffset="${2 * Math.PI * R}"/></svg>`;
    ring.innerHTML = svg;
    const mid = h('div', 'headline num', { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .24 + 'px' });
    ring.appendChild(mid); box.appendChild(ring);
    c.item(ring, { at: .1, fx: 'zoom', dur: .6 });
    const txt = h('div', null, { display: 'flex', flexDirection: 'column', gap: u * 1.4 + 'px', textAlign: c.portrait ? 'center' : 'left', maxWidth: c.portrait ? '100%' : '50%' });
    if (s.title) { const t = h('div', 'sans-x', { fontSize: (c.portrait ? 6 : 5.4) * u + 'px' }); txt.appendChild(t); c.text(t, s.title, { at: .5 }); }
    if (s.label) { const t = h('div', 'body', { fontSize: 3 * u + 'px', opacity: .8 }, esc(s.label)); txt.appendChild(t); c.item(t, { at: 1.2 }); }
    box.appendChild(txt);
    const arc = ring.querySelector('.arc'), C = 2 * Math.PI * R;
    c.onUpdate(lt => { const p = E.outExpo(prog(lt, .4, 1.6)); arc.setAttribute('stroke-dashoffset', C * (1 - v * p)); mid.textContent = fmtNum(s.value * p, s.decimals || 0) + '%'; });
    c.sfx('riser', .4, .35); c.sfx('ding', 2.0, .7);
    if (s.source) addSource(c, s.source);
    c.add(box);
  };

  // ---- ICON GRID ("1 in 4 people")
  SC.icongrid = (s, c) => {
    const u = c.u; const total = s.total || 100, hi = s.highlight || s.value || 10;
    const box = c.box({ display: 'flex', flexDirection: c.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: u * 4 + 'px' });
    const cols = s.columns || (total <= 10 ? Math.ceil(total / 2) : 10);
    const rows = Math.ceil(total / cols);
    const gw = c.portrait ? c.safe.w : c.safe.w * .55, gh = c.portrait ? c.safe.h * .55 : c.safe.h * .9;
    const cell = Math.min(gw / cols, gh / rows);
    const grid = h('div', null, { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: cell + 'px', flex: 'none' });
    const icons = [];
    for (let i = 0; i < total; i++) { const d = h('div', null, { width: cell + 'px', height: cell + 'px', padding: cell * .08 + 'px' }); d.innerHTML = stickerSVG(s.icon || 'person', c.th.muted, c.th).html; d.firstChild.style.width = '100%'; d.firstChild.style.height = '100%'; grid.appendChild(d); icons.push(d); c.item(d, { at: .1 + i * (1.0 / total), fx: 'pop', dur: .35 }); }
    box.appendChild(grid);
    const txt = h('div', null, { display: 'flex', flexDirection: 'column', gap: u * 1.2 + 'px', textAlign: c.portrait ? 'center' : 'left' });
    if (s.title) { const t = h('div', 'headline', { fontSize: (c.portrait ? 9 : 8) * u + 'px', color: 'var(--accent)' }); txt.appendChild(t); c.text(t, s.title, { at: 1.4, fx: 'stamp' }); }
    if (s.label) { const t = h('div', 'sans-x', { fontSize: (c.portrait ? 4.6 : 4) * u + 'px' }); txt.appendChild(t); c.text(t, s.label, { at: 1.8, stagger: .04 }); }
    box.appendChild(txt);
    const hiAt = 1.3;
    c.onUpdate(lt => { icons.forEach((d, i) => { const on = i < hi && lt > hiAt + i * (0.9 / hi); const p = d.querySelector('path'); const ci = d.querySelector('circle'); const col = on ? (s.color || c.th.accent) : c.th.muted; if (p) p.setAttribute('fill', col); if (ci) ci.setAttribute('fill', col); d.style.opacity = on ? 1 : .55; }); });
    c.sfx('riser', hiAt, .4);
    if (s.source) addSource(c, s.source);
    c.add(box);
  };

  // ---- MAP: world map with camera flight, highlighted countries, pins, arcs
  const COUNTRY_ALIAS = { usa: 'United States of America', us: 'United States of America', 'united states': 'United States of America', america: 'United States of America', uk: 'United Kingdom', britain: 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom', uae: 'United Arab Emirates', 'south sudan': 'S. Sudan', drc: 'Dem. Rep. Congo', 'democratic republic of the congo': 'Dem. Rep. Congo', 'czech republic': 'Czechia', 'ivory coast': "Côte d'Ivoire", 'north macedonia': 'Macedonia', 'bosnia': 'Bosnia and Herz.', 'bosnia and herzegovina': 'Bosnia and Herz.', 'dominican republic': 'Dominican Rep.', 'central african republic': 'Central African Rep.', korea: 'South Korea', 'republic of korea': 'South Korea', burma: 'Myanmar', 'equatorial guinea': 'Eq. Guinea', 'western sahara': 'W. Sahara' };
  // tighter bounds for countries with far-flung territories [lon0, lat0, lon1, lat1]
  const BOUNDS_OVERRIDE = { 'United States of America': [-125, 24, -66, 50], France: [-5, 41, 9.6, 51.2], Russia: [27, 41, 180, 78], Norway: [4, 57.8, 31.5, 71.3], Netherlands: [3.3, 50.7, 7.3, 53.6], 'New Zealand': [166, -47.5, 179, -34], Chile: [-76, -56, -66, -17], Denmark: [8, 54.5, 13, 57.8], Spain: [-9.5, 35.8, 4.4, 43.9], Portugal: [-9.6, 36.9, -6.1, 42.2], Ecuador: [-81.1, -5, -75.2, 1.5], 'United Kingdom': [-8.2, 49.9, 1.8, 58.7], Japan: [129.5, 31, 145.8, 45.6], Canada: [-141, 41.7, -52.6, 70] };
  const LL = (lon, lat) => [(lon + 180) / 360 * 2000, (90 - lat) / 180 * 1000];
  function findCountry(name) {
    const W = window.CINE_WORLD; if (!W || !name) return null;
    const n = String(name).toLowerCase().trim(); const nn = (COUNTRY_ALIAS[n] || name).toLowerCase();
    return W.countries.find(c => c.n.toLowerCase() === nn) || W.countries.find(c => c.n.toLowerCase().startsWith(nn)) || null;
  }
  function countryBounds(cn) { const o = BOUNDS_OVERRIDE[cn.n]; if (o) { const a = LL(o[0], o[3]), b = LL(o[2], o[1]); return [a[0], a[1], b[0], b[1]]; } return cn.b; }
  SC.map = (s, c) => {
    const u = c.u, Wd = window.CINE_WORLD; const W = c.W, H = c.H;
    if (!Wd) { SC.title({ headline: 'Map data missing', kicker: 'error' }, c); return; }
    const svg = sv('svg', { width: W, height: H, style: 'position:absolute;inset:0' });
    const g = sv('g', {}, svg);
    // ocean graticule
    const grat = sv('g', { stroke: c.th.muted, 'stroke-opacity': .35, fill: 'none' }, g);
    for (let lon = -180; lon <= 180; lon += 15) sv('path', { d: `M${LL(lon, 85)[0]} ${LL(lon, 85)[1]} L${LL(lon, -85)[0]} ${LL(lon, -85)[1]}`, 'stroke-dasharray': '2 4' }, grat);
    for (let lat = -75; lat <= 75; lat += 15) sv('path', { d: `M0 ${LL(0, lat)[1]} L2000 ${LL(0, lat)[1]}`, 'stroke-dasharray': '2 4' }, grat);
    const land = sv('g', { stroke: c.th.bg, 'stroke-linejoin': 'round' }, g);
    const hiList = (s.highlight || s.countries || []).map((x, i) => typeof x === 'string' ? { name: x } : x);
    const focusNames = s.focus ? (Array.isArray(s.focus) ? s.focus : (typeof s.focus === 'string' ? [s.focus] : [])) : hiList.map(x => x.name);
    const pal = [c.th.accent, c.th.blue, c.th.teal, '#8E5CC4', '#F28C28', '#2E9E55'];
    const paths = {};
    Wd.countries.forEach(cn => { const p = sv('path', { d: cn.d, fill: c.th.land }, land); paths[cn.n] = p; });
    c.add(svg, 'mid');
    const labelLayer = h('div', 'fill'); c.add(labelLayer, 'mid');
    // views
    const viewFromBounds = (bs, padMul) => { const x0 = Math.min(...bs.map(b => b[0])), y0 = Math.min(...bs.map(b => b[1])), x1 = Math.max(...bs.map(b => b[2])), y1 = Math.max(...bs.map(b => b[3])); const bw = (x1 - x0) * (padMul || 1.7), bh = (y1 - y0) * (padMul || 1.7); return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(bw, bh * W / H, 50) }; };
    const viewFromSpec = sp => {
      if (!sp) return null;
      if (sp.lon != null) { const [x, y] = LL(sp.lon, sp.lat); return { cx: x, cy: y, w: 2000 / (sp.zoom || 4) }; }
      const names = Array.isArray(sp) ? sp : [sp];
      const cs = names.map(findCountry).filter(Boolean); if (!cs.length) return null;
      return viewFromBounds(cs.map(countryBounds));
    };
    const world = { cx: 1000, cy: 470, w: 2000 };
    let target = (s.focus && typeof s.focus === 'object' && !Array.isArray(s.focus)) ? viewFromSpec(s.focus) : viewFromSpec(focusNames.length ? focusNames : null);
    const pinsSpec = s.pins || [];
    if (!target && pinsSpec.length) { const bs = pinsSpec.map(p => { const [x, y] = LL(p.lon, p.lat); return [x - 30, y - 30, x + 30, y + 30]; }); target = viewFromBounds(bs, 1.4); }
    target = target || world;
    const start = s.from ? (viewFromSpec(s.from) || world) : { cx: lerp(world.cx, target.cx, .5), cy: lerp(world.cy, target.cy, .5), w: Math.max(world.w, target.w * 3) };
    const stops = [{ t: 0, v: start }, { t: .35, v: start }, { t: .35 + Math.min(2.2, c.dur * .45), v: target }];
    (s.steps || []).forEach(st => { const v = viewFromSpec(st.focus || st); if (v) { const last = stops[stops.length - 1]; stops.push({ t: Math.max(last.t, (st.at || last.t + .5)), v: last.v }); stops.push({ t: (st.at || last.t + .5) + (st.dur || 1.6), v, label: st.label }); } });
    const zoomEnd = stops[2].t;
    const viewAt = lt => {
      let a = stops[0], b = stops[0];
      for (let i = 1; i < stops.length; i++) { if (lt >= stops[i - 1].t) { a = stops[i - 1]; b = stops[i]; } }
      const p = E.inOut(prog(lt, a.t, b.t - a.t));
      const lw = Math.exp(lerp(Math.log(a.v.w), Math.log(b.v.w), p));
      return { cx: lerp(a.v.cx, b.v.cx, p), cy: lerp(a.v.cy, b.v.cy, p), w: lw };
    };
    let k = 1, ox = 0, oy = 0;
    const toScreen = (x, y) => [x * k + ox, y * k + oy];
    // highlights
    const hiItems = hiList.map((hc, i) => { const cn = findCountry(hc.name); if (!cn) return null; const col = hc.color || pal[i % pal.length]; const at = hc.at != null ? hc.at : zoomEnd - .3 + i * .25; c.sfx('pop', at, .45); return { cn, col, at, label: hc.label != null ? hc.label : (s.labels === false ? null : cn.n.replace('United States of America', 'United States')), el: null }; }).filter(Boolean);
    hiItems.forEach(hi => {
      if (hi.label) {
        const lab = h('div', 'abs', { transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', fontFamily: c.cine ? 'Manrope' : 'Anton', fontWeight: c.cine ? 600 : 400, letterSpacing: c.cine ? '.32em' : 0, textTransform: 'uppercase', fontSize: u * (c.cine ? 1.9 : 2.8) + 'px', background: c.cine ? 'none' : c.th.ink, color: c.cine ? c.th.ink : c.th.bg, textShadow: c.cine ? '0 2px 10px rgba(0,0,0,.8)' : 'none', padding: `${u * .3}px ${u * 1}px`, zIndex: 5 }, esc(hi.label));
        labelLayer.appendChild(lab); hi.el = lab; c.item(lab, { at: hi.at + .25, fx: 'pop', center: true });
      }
    });
    const pinEls = pinsSpec.map((p, i) => {
      const el = h('div', 'abs', { width: u * 5 + 'px', height: u * 5 + 'px', zIndex: 6 }); el.innerHTML = stickerSVG(c.cine ? 'pin-glow' : 'pin', p.color || c.th.accent, c.th).html; if (c.cine) el.firstChild.style.filter = `drop-shadow(0 0 ${u * .8}px ${p.color || c.th.accent})`; labelLayer.appendChild(el);
      const lab = p.label ? h('div', c.cine ? 'abs' : 'abs marker', c.cine ? { fontFamily: 'Manrope', fontWeight: 700, fontSize: u * 2 + 'px', whiteSpace: 'nowrap', background: 'var(--glass)', border: '1px solid var(--glassline)', backdropFilter: 'blur(12px)', borderRadius: u * 3 + 'px', color: 'var(--ink)', padding: `${u * .5}px ${u * 1.3}px`, zIndex: 7 } : { fontSize: u * 2.6 + 'px', whiteSpace: 'nowrap', background: c.th.hl, color: '#141414', padding: `${u * .2}px ${u * .8}px`, zIndex: 7 }, esc(p.label)) : null;
      if (lab) labelLayer.appendChild(lab);
      const at = p.at != null ? p.at : zoomEnd + .2 + i * .3; c.sfx('pop', at, .6);
      const it = new Item(el, { at, fx: 'drop', dur: .6 }, c); c.items.push(it);
      if (lab) c.items.push(new Item(lab, { at: at + .2, fx: 'pop' }, c));
      const [mx, my] = LL(p.lon, p.lat); return { el, lab, mx, my };
    });
    const arcs = (s.arcs || []).map((a, i) => {
      const [x0, y0] = LL(a.from[0], a.from[1]), [x1, y1] = LL(a.to[0], a.to[1]); const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - Math.hypot(x1 - x0, y1 - y0) * .3;
      const path = sv('path', { d: `M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}`, fill: 'none', stroke: a.color || c.th.accent, 'stroke-linecap': 'round' }, g);
      const dot = h('div', 'abs', { width: u * 1.8 + 'px', height: u * 1.8 + 'px', borderRadius: '50%', background: a.color || c.th.accent, border: `${u * .35}px solid #fff`, transform: 'translate(-50%,-50%)', zIndex: 6 });
      labelLayer.appendChild(dot);
      const at = a.at != null ? a.at : zoomEnd + .3 + i * .4; c.sfx('whoosh-soft', at, .35);
      return { path, dot, at };
    });
    c.onUpdate(lt => {
      const v = viewAt(lt); const vh = v.w * H / W;
      k = W / v.w; ox = W / 2 - v.cx * k; oy = H / 2 - v.cy * k;
      g.setAttribute('transform', `translate(${ox},${oy}) scale(${k})`);
      land.setAttribute('stroke-width', 1.1 / k);
      grat.setAttribute('stroke-width', 1 / k);
      hiItems.forEach(hi => { const p = E.out(prog(lt, hi.at, .5)); paths[hi.cn.n].setAttribute('fill', mixColor(c.th.land, hi.col, p)); if (hi.el) { const [sx, sy] = toScreen(hi.cn.c[0], hi.cn.c[1]); const hw = (hi.el.offsetWidth || 0) / 2 + u * 4; hi.el.style.left = clamp(sx, hw, W - hw) + 'px'; hi.el.style.top = clamp(sy, u * 4, H - u * 4) + 'px'; } });
      pinEls.forEach(p => { const [sx, sy] = toScreen(p.mx, p.my); p.el.style.left = sx - u * 2.5 + 'px'; p.el.style.top = sy - u * 5 + 'px'; if (p.lab) { p.lab.style.left = sx + u * 2.4 + 'px'; p.lab.style.top = sy - u * 5.2 + 'px'; } });
      arcs.forEach(a => { a.path.setAttribute('stroke-width', u * .55 / k); const pp = E.inOut(prog(lt, a.at, 1.4)); drawPath(a.path, pp); const L = a.path._len; const pt = a.path.getPointAtLength(L * pp); const [sx, sy] = toScreen(pt.x, pt.y); a.dot.style.left = sx + 'px'; a.dot.style.top = sy + 'px'; a.dot.style.opacity = pp > 0 && pp < 1 ? 1 : (pp >= 1 ? 1 : 0); });
    });
    if (s.title) { const t = h('div', 'abs', { left: c.safe.l + 'px', top: c.safe.t + 'px', maxWidth: c.safe.w + 'px' }); const tt = h('div', 'headline', { fontSize: (c.portrait ? 7 : 6) * u + 'px', background: c.th.bg, padding: `${u * .4}px ${u * 1.2}px`, display: 'inline-block', boxShadow: '0 6px 0 rgba(0,0,0,.08)' }); t.appendChild(tt); c.text(tt, s.title, { at: .2, fx: 'rise' }); c.ovl.appendChild(t); }
    c.sfx('whoosh-soft', .35, .5);
    if (s.source) addSource(c, s.source);
  };

  // ---- PHOTO: framed photo / cutout with ken burns, caption + annotations
  SC.photo = (s, c) => {
    const u = c.u; const style = s.frame || 'polaroid'; // polaroid | cutout | full | circle
    if (style === 'full') {
      const holder = h('div', 'fill look-' + (s.look || c.dl)); const m = c.media(s.media || s.image || s.video, { label: s.label || s.caption }); m.style.position = 'absolute'; m.style.inset = 0; holder.appendChild(m); c.add(holder, 'bg');
      c.layers.bg.style.inset = '-4%';
      c.onUpdate(lt => updateMedia(m, lt, c.dur));
    } else {
      const fw = c.portrait ? c.safe.w * .9 : Math.min(c.safe.w * .6, c.safe.h * 1.25), fh = style === 'circle' ? fw : fw * (s.aspect ? 1 / s.aspect : (c.portrait ? 1.05 : .68));
      const fr = h('div', style === 'circle' ? 'photo' : 'photo', { width: fw + 'px', height: fh + 'px', left: (c.portrait ? c.W / 2 : (s.align === 'left' ? c.safe.l + fw / 2 : c.safe.cx + (s.caption ? c.safe.w * .12 : 0))) - fw / 2 + 'px', top: (c.portrait ? c.safe.t + c.safe.h * .42 : c.safe.cy) - fh / 2 + 'px', borderRadius: style === 'circle' ? '50%' : '0' });
      const look = h('div', 'img look-' + (s.look || c.dl), { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: style === 'circle' ? '50%' : '0' });
      const m = c.media(s.media || s.image || s.video, { label: s.label || s.caption }); Object.assign(m.style, { position: 'absolute', inset: 0 }); look.appendChild(m); fr.appendChild(look);
      if (style === 'cutout') { fr.style.padding = '0'; fr.classList.add('cutout'); fr.style.background = 'transparent'; fr.style.boxShadow = 'none'; }
      if (style === 'polaroid') { const tp = h('div', 'tape', { left: '50%', top: -u * 1.6 + 'px', transform: 'translateX(-50%) rotate(-4deg)' }); fr.appendChild(tp); }
      c.add(fr, 'mid'); c.item(fr, { at: .05, fx: s.fx || 'drop', rot: s.rot != null ? s.rot : -2.5, dur: .7, idle: 'bob' });
      c.sfx('thud', .35, .5);
      c.onUpdate(lt => updateMedia(m, lt, c.dur));
    }
    if (s.caption) {
      const cap = h('div', 'abs', c.portrait ? { left: c.safe.l + 'px', width: c.safe.w + 'px', top: c.safe.t + c.safe.h * .82 + 'px', textAlign: 'center' } : { left: c.safe.l + 'px', width: c.safe.w * .34 + 'px', top: c.safe.cy + 'px', transform: 'translateY(-50%)' });
      const t = h('div', s.frame === 'full' ? 'headline' : 'sans-x', { fontSize: (s.frame === 'full' ? 8 : 5.2) * u + 'px', color: s.frame === 'full' ? '#fff' : 'var(--ink)', textShadow: s.frame === 'full' ? '0 4px 18px rgba(0,0,0,.5)' : 'none' });
      cap.appendChild(t); c.text(t, s.caption, { at: .7, stagger: .05 }); c.add(cap, 'fg');
      c.postLayout(() => fitText(t, c.portrait ? c.safe.w : c.safe.w * .34, c.safe.h * .4));
    }
    if (s.lowerThird) addLowerThird(c, s.lowerThird);
    if (s.source) addSource(c, s.source);
  };

  // ---- COLLAGE: scattered sticker-photos with parallax
  SC.collage = (s, c) => {
    const u = c.u; const list = s.media || s.images || [];
    const n = Math.max(1, list.length); const r = rng(n * 7 + 3);
    const cols = c.portrait ? 2 : Math.min(3, n), rows = Math.ceil(n / cols);
    const cw = c.safe.w / cols, ch = c.safe.h / rows;
    list.forEach((src, i) => {
      const it = typeof src === 'string' ? { src } : src;
      const col = i % cols, row = Math.floor(i / cols);
      const fw = Math.min(cw, ch * 1.3) * .88, fh = fw * .75;
      const cx = c.safe.l + cw * (col + .5) + (r() - .5) * cw * .12, cy = c.safe.t + ch * (row + .5) + (r() - .5) * ch * .12;
      const fr = h('div', 'photo', { width: fw + 'px', height: fh + 'px', left: cx - fw / 2 + 'px', top: cy - fh / 2 + 'px', padding: u * .7 + 'px' });
      const look = h('div', 'img look-' + (s.look || it.look || c.dl), { width: '100%', height: '100%' });
      const m = c.media(it.src || it.media, { label: it.label }); Object.assign(m.style, { position: 'absolute', inset: 0 }); look.appendChild(m); fr.appendChild(look);
      if (it.label) { const lb = h('div', 'abs marker', { left: '50%', bottom: -u * 2 + 'px', transform: c.cine ? 'translateX(-50%)' : 'translateX(-50%) rotate(-2deg)', background: c.cine ? 'var(--glass)' : c.th.hl, color: c.cine ? 'var(--ink)' : '#141414', borderRadius: c.cine ? u * 3 + 'px' : 0, fontFamily: c.cine ? 'Manrope' : '', fontWeight: c.cine ? 600 : '', backdropFilter: c.cine ? 'blur(12px)' : '', padding: `${u * .3}px ${u * 1}px`, fontSize: u * 2.4 + 'px', whiteSpace: 'nowrap' }, esc(it.label)); fr.appendChild(lb); }
      if (r() > .5) fr.appendChild(h('div', 'tape', { left: '6%', top: -u * 1.2 + 'px', transform: 'rotate(-28deg)', width: u * 9 + 'px' }));
      c.add(fr, i % 2 ? 'fg' : 'mid'); const at = .1 + i * (s.stagger || .35);
      c.item(fr, { at, fx: ['drop', 'slideL', 'slideR', 'pop'][i % 4], rot: (r() - .5) * 12, idle: 'bob', dur: .6 }); c.sfx('thud', at + .2, .4);
      c.onUpdate(lt => updateMedia(m, lt, c.dur));
    });
    if (s.title) { const t = h('div', 'abs headline', { left: '50%', top: c.portrait ? c.H * .06 + 'px' : c.H * .05 + 'px', transform: 'translateX(-50%)', fontSize: 6 * u + 'px', background: c.th.ink, color: c.th.bg, padding: `${u * .3}px ${u * 1.4}px`, whiteSpace: 'nowrap', zIndex: 30 }); c.ovl.appendChild(t); c.text(t, s.title, { at: .2 }); }
  };

  // ---- DOCUMENT: newspaper / report clipping with highlighted lines
  SC.document = (s, c) => {
    const u = c.u;
    const dw = c.portrait ? c.W * .86 : Math.min(c.W * .56, c.H * 1.1);
    const doc = h('div', 'abs', { width: dw + 'px', left: (c.W - dw) / 2 + 'px', top: c.portrait ? c.H * .14 + 'px' : c.H * .1 + 'px', background: '#FBF8F1', color: '#1a1a1a', padding: `${u * 4}px ${u * 4.5}px`, boxShadow: '0 20px 50px rgba(0,0,0,.35)', backgroundImage: `url(${paperTexture()})` });
    if (s.outlet) { const o = h('div', 'serif', { fontSize: u * 5 + 'px', borderBottom: '3px double #1a1a1a', paddingBottom: u + 'px', marginBottom: u * 1.5 + 'px', textAlign: 'center', fontStyle: 'normal' }, esc(s.outlet)); doc.appendChild(o); }
    if (s.date) doc.appendChild(h('div', 'mono', { fontSize: u * 1.8 + 'px', opacity: .65, marginBottom: u + 'px', letterSpacing: '.1em', textTransform: 'uppercase' }, esc(s.date)));
    if (s.headline) { const hd = h('div', null, { fontFamily: 'Inter', fontWeight: 900, fontSize: u * (c.portrait ? 5.4 : 4.6) + 'px', lineHeight: 1.08, marginBottom: u * 2 + 'px', letterSpacing: '-.02em' }); { const rr = richInto(hd, s.headline); rr.marks.forEach(m => { m.at = 1.0; m.dur = .5; c.marks.push(m); }); c.post.push(() => rr.marks.forEach(markSVG)); } doc.appendChild(hd); }
    const lines = s.body || s.lines || [];
    let mt = 1.4;
    lines.forEach(ln => {
      const p = h('div', 'body', { fontFamily: 'Inter', fontWeight: 400, fontSize: u * 2.5 + 'px', lineHeight: 1.55, marginBottom: u * .8 + 'px', color: '#333' });
      const { marks } = richInto(p, ln); marks.forEach(m => { m.at = mt; m.dur = .6; mt += .55; c.marks.push(m); c.sfx('swish', m.at, .5); }); c.post.push(() => marks.forEach(markSVG));
      doc.appendChild(p);
    });
    if (!lines.length) for (let i = 0; i < 6; i++) doc.appendChild(h('div', null, { height: u * 1.2 + 'px', background: '#1a1a1a18', marginBottom: u * 1.3 + 'px', width: (70 + (i * 37) % 30) + '%' }));
    c.add(doc, 'mid'); c.item(doc, { at: 0, fx: 'slideU', rot: s.rot != null ? s.rot : -1.6, dur: .8 }); c.sfx('paper', .1, .6);
    if (s.stamp) { addSticker(c, { type: 'banner', text: s.stamp, x: 72, y: c.portrait ? 20 : 22, size: 7, rot: -12, at: mt + .2, fx: 'stamp', color: c.th.accent }); c.sfx('hit', mt + .2, .7); }
    c.postLayout(() => { const avail = c.H * (c.portrait ? .66 : .8); if (doc.offsetHeight > avail) doc.style.transformOrigin = 'top center', doc._scale = avail / doc.offsetHeight; });
    c.onUpdate(() => { if (doc._scale) doc.style.zoom = doc._scale; });
    if (s.source) addSource(c, s.source);
  };

  // ---- QUOTE
  SC.quote = (s, c) => {
    const u = c.u;
    const box = c.box({ display: 'flex', flexDirection: c.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: u * 4 + 'px' });
    if (s.media) { const sz = c.portrait ? c.safe.w * .42 : c.safe.h * .55; const fr = h('div', 'photo', { position: 'relative', width: sz + 'px', height: sz + 'px', borderRadius: '50%', flex: 'none', padding: u * .8 + 'px' }); const lk = h('div', 'img look-' + (s.look || c.dlDuo), { width: '100%', height: '100%', borderRadius: '50%' }); const m = c.media(s.media, { label: s.author }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk); box.appendChild(fr); c.item(fr, { at: .05, fx: 'pop', dur: .6 }); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
    const col = h('div', null, { display: 'flex', flexDirection: 'column', gap: u * 2 + 'px', flex: 1, textAlign: c.portrait ? 'center' : 'left' });
    const qm = h('div', 'serif', { fontSize: u * 16 + 'px', color: 'var(--accent)', lineHeight: .6, height: u * 7 + 'px' }, '&ldquo;'); col.appendChild(qm); c.item(qm, { at: .1, fx: 'popBig' });
    const q = h('div', 'serif', { fontSize: (s.size || (c.portrait ? 6.4 : 5.6)) * u + 'px', lineHeight: 1.18 }); col.appendChild(q);
    const r = c.text(q, s.text || s.quote || '', { at: .35, stagger: .045, fx: 'blur' });
    if (s.author) { const a = h('div', 'kicker', null, `— ${esc(s.author)}${s.role ? `<span style="opacity:.6">, ${esc(s.role)}</span>` : ''}`); col.appendChild(a); c.item(a, { at: r.end, fx: 'wipe', dur: .6 }); }
    box.appendChild(col); c.add(box);
    c.postLayout(() => fitText(q, c.portrait ? c.safe.w : c.safe.w * .7, c.safe.h * .6));
    if (s.source) addSource(c, s.source);
  };

  // ---- TIMELINE: horizontal track, camera follows events
  SC.timeline = (s, c) => {
    const u = c.u; const ev = s.events || [];
    const spacing = c.portrait ? c.W * .62 : c.W * .34;
    const track = h('div', 'abs', { left: 0, top: 0, height: c.H + 'px', width: (ev.length + 1) * spacing + c.W + 'px' });
    const axisY = c.H * (c.portrait ? .48 : .55);
    const axis = h('div', 'abs', { left: c.W / 2 - spacing * .5 + 'px', top: axisY + 'px', height: u * .7 + 'px', background: c.th.ink, width: 0 });
    track.appendChild(axis);
    const per = Math.max(.9, (c.dur - 1) / Math.max(1, ev.length));
    ev.forEach((e, i) => {
      const x = c.W / 2 + i * spacing, at = .4 + i * per, up = i % 2 === 0;
      const dot = h('div', 'abs', { left: x - u * 1.6 + 'px', top: axisY - u * 1.25 + 'px', width: u * 3.2 + 'px', height: u * 3.2 + 'px', borderRadius: '50%', background: e.color || c.th.accent, border: `${u * .6}px solid ${c.th.bg}`, boxShadow: `0 0 0 ${u * .35}px ${c.th.ink}` });
      track.appendChild(dot); c.item(dot, { at, fx: 'popBig', dur: .45 }); c.sfx('pop', at, .5);
      const card = h('div', 'abs', { left: x - spacing * .42 + 'px', width: spacing * .84 + 'px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u + 'px' });
      if (up) card.style.bottom = c.H - axisY + u * 4 + 'px'; else card.style.top = axisY + u * 4 + 'px';
      const dt = h('div', 'headline', { fontSize: u * (c.portrait ? 9 : 7) + 'px', color: e.color || 'var(--accent)' }, esc(e.date || e.year || '')); card.appendChild(dt);
      if (e.media) { const fr = h('div', 'photo', { position: 'relative', width: spacing * .6 + 'px', height: spacing * .38 + 'px', padding: u * .5 + 'px' }); const lk = h('div', 'img look-' + (e.look || c.dl), { width: '100%', height: '100%' }); const m = c.media(e.media, { label: e.label }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk); card.appendChild(fr); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
      const lb = h('div', 'sans-x', { fontSize: u * (c.portrait ? 4.4 : 3.4) + 'px' }); card.appendChild(lb); richInto(lb, e.label || '');
      if (e.text) card.appendChild(h('div', 'body', { fontSize: u * 2.4 + 'px', opacity: .8 }, esc(e.text)));
      track.appendChild(card); c.item(card, { at: at + .1, fx: up ? 'slideU' : 'slideD', dur: .6 });
    });
    c.add(track, 'mid');
    if (s.title) { const t = h('div', 'abs headline', { left: c.safe.l + 'px', top: c.safe.t * .8 + 'px', fontSize: u * 5.6 + 'px' }); c.ovl.appendChild(t); c.text(t, s.title, { at: .1 }); }
    c.onUpdate(lt => {
      // camera follows: ease between events
      let pos = 0; for (let i = 0; i < ev.length; i++) { const at = .4 + i * per; pos = i === 0 ? 0 : lerp(pos, i, E.inOut(prog(lt, at - .45, .6))); }
      track.style.transform = `translateX(${-pos * spacing}px)`;
      const ax = E.inOut(prog(lt, .2, ev.length * per)) * (ev.length) * spacing;
      axis.style.width = ax + spacing * .5 + 'px';
    });
    c.sfx('whoosh-soft', .2, .4);
  };

  // ---- COMPARE: A vs B
  SC.compare = (s, c) => {
    const u = c.u; const L = s.left || s.a || {}, R = s.right || s.b || {};
    const box = c.box({ display: 'flex', flexDirection: c.portrait ? 'column' : 'row', gap: u * 3 + 'px', alignItems: 'stretch' });
    [L, R].forEach((side, i) => {
      const col = side.color || (i ? c.th.blue : c.th.accent);
      const p = h('div', 'card', { flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 1.4 + 'px', padding: u * 3 + 'px', textAlign: 'center', borderTop: c.cine ? `2px solid ${col}` : `${u * 1.2}px solid ${col}` });
      if (side.media) { const fr = h('div', 'img look-' + (side.look || c.dl), { width: '70%', aspectRatio: '16/10', position: 'relative', borderRadius: u + 'px', flex: 'none' }); const m = c.media(side.media, { label: side.title }); Object.assign(m.style, { position: 'absolute', inset: 0 }); fr.appendChild(m); p.appendChild(fr); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
      else if (side.icon) { const ic = h('div', null, { width: u * (c.portrait ? 10 : 14) + 'px', height: u * (c.portrait ? 10 : 14) + 'px' }); ic.innerHTML = stickerSVG(side.icon, col, c.th).html; p.appendChild(ic); }
      const t = h('div', 'headline', { fontSize: u * (c.portrait ? 6 : 5.4) + 'px' }, esc(side.title || '')); p.appendChild(t);
      if (side.value != null) { const v = h('div', 'headline num', { fontSize: u * (c.portrait ? 10 : 11) * (c.cine ? .8 : 1) + 'px', color: col, lineHeight: 1 }); p.appendChild(v); const dec = String(side.value).includes('.') ? 1 : 0; const at = .7 + i * .3; c.onUpdate(lt => { v.textContent = (side.prefix || '') + fmtNum(side.value * E.outExpo(prog(lt, at, 1.2)), dec) + (side.suffix || ''); }); c.sfx('ding', at + 1.2, .4); }
      if (side.label) p.appendChild(h('div', 'body', { fontSize: u * 2.6 + 'px', opacity: .8 }, esc(side.label)));
      (side.points || []).forEach((pt, j) => { const d = h('div', 'body', { fontSize: u * 2.4 + 'px' }, `<span style="color:${col}">●</span> ${esc(pt)}`); p.appendChild(d); c.item(d, { at: 1.2 + i * .3 + j * .2, fx: 'rise' }); });
      box.appendChild(p); c.item(p, { at: .1 + i * .25, fx: i ? 'slideR' : 'slideL', dur: .7 });
    });
    c.add(box);
    if (c.cine) addPremiumSticker(c, { type: 'seal', text: s.vs || 'VS', x: 50, y: c.portrait ? (c.safe.cy / c.H * 100) : 50, size: c.portrait ? 11 : 12, at: .6, textSize: 3.4 });
    else addSticker(c, { type: 'burst', text: s.vs || 'VS', x: 50, y: c.portrait ? (c.safe.cy / c.H * 100) : 50, size: c.portrait ? 12 : 13, at: .6, color: c.th.hl, textColor: '#141414', fx: 'stamp' });
    if (s.title) { const t = h('div', 'abs headline', { left: '50%', top: c.safe.t * .35 + 'px', transform: 'translateX(-50%)', fontSize: u * 4.6 + 'px', whiteSpace: 'nowrap' }); c.ovl.appendChild(t); c.text(t, s.title, { at: .05 }); }
    if (s.source) addSource(c, s.source);
  };

  // ---- LIST: numbered points
  SC.list = (s, c) => {
    const u = c.u; const items = s.items || [];
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * 2.2 + 'px' });
    if (s.title) { const t = h('div', 'headline', { fontSize: (c.portrait ? 8 : 7) * u + 'px', marginBottom: u + 'px' }); box.appendChild(t); c.text(t, s.title, { at: .1 }); }
    const per = Math.max(.5, (c.dur - 1.2) / Math.max(1, items.length));
    items.forEach((it, i) => {
      const at = .7 + i * per;
      const row = h('div', null, { display: 'flex', alignItems: 'center', gap: u * 2 + 'px' });
      const num = h('div', 'headline', { flex: 'none', width: u * 7 + 'px', height: u * 7 + 'px', borderRadius: '50%', background: s.style === 'check' || c.cine ? 'transparent' : c.th.accent, color: c.cine ? 'var(--accent)' : '#fff', border: c.cine && s.style !== 'check' ? '1px solid var(--accent)' : 'none', fontFamily: c.cine ? 'Manrope' : 'Anton', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: u * 3.8 + 'px', position: 'relative' });
      if (s.style === 'check') { num.innerHTML = stickerSVG(c.cine ? 'check-fine' : 'check', c.cine ? c.th.accent : c.th.teal, c.th).html; const it2 = c.item(num, { at, fx: 'none' }); it2.draws = [...num.querySelectorAll('path')]; it2.o.drawDur = .4; }
      else { num.textContent = i + 1; c.item(num, { at, fx: 'popBig' }); }
      const tx = h('div', 'sans-x', { fontSize: (c.portrait ? 5 : 4.4) * u + 'px', flex: 1 });
      row.appendChild(num); row.appendChild(tx); box.appendChild(row);
      c.text(tx, typeof it === 'string' ? it : it.text, { at: at + .1, stagger: .04, fx: 'rise' });
      c.sfx('pop', at, .5);
      if (s.dimPrevious) c.onUpdate(lt => { row.style.opacity = lt > at + per ? .45 : 1; });
    });
    c.add(box);
  };

  // ---- CHAPTER card
  SC.chapter = (s, c) => {
    const u = c.u;
    if (c.cine) {
      if (s.media) { fullMedia(c, s.media, { look: s.look }); scrim(c, 'full', .9); }
      const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 2 + 'px' });
      const n = h('div', 'tracked', { fontSize: (c.portrait ? 2.4 : 2) * u + 'px', color: 'var(--accent)' }, esc((s.label || 'Chapter') + (s.number != null ? ' ' + String(s.number).padStart(2, '0') : ''))); box.appendChild(n); c.item(n, { at: .2, fx: 'blurIn', dur: 1 });
      const rule = h('div', null, { height: '1px', width: 0, background: 'var(--accent)' }); box.appendChild(rule); c.onUpdate(lt => { rule.style.width = E.inOut(prog(lt, .4, 1.1)) * u * 14 + 'px'; });
      const t = h('div', 'headline', { fontSize: u * (c.portrait ? 10 : 9) + 'px', color: s.media ? '#fff' : 'var(--ink)' }); box.appendChild(t); c.text(t, s.title || '', { at: .6, fx: 'blurIn', stagger: .08, dur: 1 });
      if (s.sub) { const sb = h('div', 'serif', { fontSize: u * 3.2 + 'px', opacity: .8 }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: 1.3, fx: 'blurIn' }); }
      c.add(box); c.sfx('impact', .55, .5);
      c.postLayout(() => fitText(t, c.safe.w, c.H * .3));
      return;
    }
    const strip = h('div', 'abs', { left: '-10%', width: '120%', top: c.H * .5 - c.H * .16 + 'px', height: c.H * .32 + 'px', background: 'var(--hl)', transformOrigin: '0 50%' });
    c.add(strip, 'bg'); c.item(strip, { at: 0, fx: 'wipe', dur: .6, rot: -3 });
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' });
    const n = h('div', 'headline', { fontSize: u * (c.portrait ? 24 : 26) + 'px', color: 'transparent', WebkitTextStroke: `${u * .5}px var(--ink)`, lineHeight: .9 }, esc(s.number != null ? String(s.number).padStart(2, '0') : '')); box.appendChild(n); c.item(n, { at: .2, fx: 'zoom', dur: .7 });
    const t = h('div', 'headline', { fontSize: u * (c.portrait ? 10 : 9) + 'px', marginTop: u * 1 + 'px', color: '#141414' }); box.appendChild(t); c.text(t, s.title || '', { at: .5, fx: 'stamp', stagger: .08 });
    c.add(box); c.sfx('hit', .5, .8);
    c.postLayout(() => fitText(t, c.safe.w, c.H * .3));
  };

  // ---- SCREEN: browser / phone mockup with content + cursor click
  SC.screen = (s, c) => {
    const u = c.u; const dev = s.device || (c.portrait ? 'phone' : 'browser');
    let fw, fh;
    if (dev === 'phone') { fh = c.safe.h * .92; fw = fh * .5; } else { fw = c.portrait ? c.safe.w : c.safe.w * .82; fh = Math.min(c.safe.h * .92, fw * .62); }
    const fr = h('div', 'abs', { width: fw + 'px', height: fh + 'px', left: (c.W - fw) / 2 + 'px', top: c.safe.cy - fh / 2 + 'px', background: dev === 'phone' ? '#111' : '#fff', borderRadius: dev === 'phone' ? fw * .12 + 'px' : u * 1.2 + 'px', boxShadow: '0 30px 80px rgba(0,0,0,.4)', padding: dev === 'phone' ? fw * .04 + 'px' : 0, overflow: 'hidden' });
    if (dev === 'browser') { const bar = h('div', null, { height: u * 4.4 + 'px', background: '#ECE9E3', display: 'flex', alignItems: 'center', gap: u * .8 + 'px', padding: `0 ${u * 1.6}px` }); bar.innerHTML = ['#FF5F57', '#FEBC2E', '#28C840'].map(cl => `<span style="width:${u * 1.3}px;height:${u * 1.3}px;border-radius:50%;background:${cl};display:inline-block"></span>`).join('') + `<span class="mono" style="margin-left:${u * 2}px;flex:1;background:#fff;border-radius:${u}px;padding:${u * .5}px ${u * 1.4}px;font-size:${u * 1.7}px;color:#555;white-space:nowrap;overflow:hidden">${esc(s.url || 'https://example.com')}</span>`; fr.appendChild(bar); }
    const content = h('div', null, { position: 'relative', height: dev === 'browser' ? `calc(100% - ${u * 4.4}px)` : '100%', borderRadius: dev === 'phone' ? fw * .09 + 'px' : 0, overflow: 'hidden', background: '#fff', color: '#141414' });
    if (s.media) { const m = c.media(s.media, { label: s.label || s.headline, kenburns: false }); Object.assign(m.style, { position: 'absolute', inset: 0 }); content.appendChild(m); c.onUpdate(lt => { updateMedia(m, lt, c.dur); if (m._img) m._img.style.transform = `translateY(${-E.inOut(prog(lt, 1, c.dur - 1.5)) * (s.scroll || 0)}%)`; }); }
    else { const inner = h('div', null, { padding: u * 4 + 'px', display: 'flex', flexDirection: 'column', gap: u * 2 + 'px' }); if (s.kicker) inner.appendChild(h('div', 'kicker', { color: c.th.accent }, esc(s.kicker))); const hd = h('div', null, { fontFamily: 'Inter', fontWeight: 900, fontSize: u * (dev === 'phone' ? 4.6 : 5) + 'px', lineHeight: 1.1, letterSpacing: '-.02em' }); inner.appendChild(hd); const r = richInto(hd, s.headline || ''); r.marks.forEach((m, i) => { m.at = 1.2 + i * .4; m.dur = .5; c.marks.push(m); }); c.post.push(() => r.marks.forEach(markSVG)); (s.body || []).forEach(b => inner.appendChild(h('div', 'body', { fontWeight: 400, fontSize: u * 2.4 + 'px', color: '#444' }, esc(b)))); content.appendChild(inner); }
    fr.appendChild(content);
    c.add(fr, 'mid'); c.item(fr, { at: 0, fx: 'riseBig', dur: .8 }); c.sfx('whoosh-soft', .05, .4);
    if (s.click) {
      const cur = h('div', 'abs', { width: u * 6 + 'px', height: u * 6 + 'px', zIndex: 30 }); cur.innerHTML = stickerSVG('cursor', null, c.th).html; c.add(cur, 'fg');
      const ring = h('div', 'abs', { width: u * 6 + 'px', height: u * 6 + 'px', borderRadius: '50%', border: `${u * .5}px solid ${c.th.accent}`, transform: 'translate(-50%,-50%)', zIndex: 29, opacity: 0 }); c.add(ring, 'fg');
      const tx = c.W * (s.click.x != null ? s.click.x : 60) / 100, ty = c.H * (s.click.y != null ? s.click.y : 50) / 100, at = s.click.at || 1.6;
      c.onUpdate(lt => { const p = E.inOut(prog(lt, at - 1, 1)); cur.style.left = lerp(c.W * .9, tx, p) + 'px'; cur.style.top = lerp(c.H * .95, ty, p) + 'px'; const k = prog(lt, at, .5); ring.style.left = tx + 'px'; ring.style.top = ty + 'px'; ring.style.opacity = k > 0 && k < 1 ? 1 - k : 0; ring.style.transform = `translate(-50%,-50%) scale(${.3 + k * 1.8})`; cur.style.transform = `scale(${k > 0 && k < .3 ? .85 : 1})`; });
      c.sfx('click', at, .7);
    }
    if (s.caption) { const cp = h('div', 'abs marker', { left: c.safe.l + 'px', top: c.safe.t * .55 + 'px', fontSize: u * 3.6 + 'px', background: c.th.hl, color: '#141414', padding: `${u * .3}px ${u * 1.2}px`, zIndex: 31 }, esc(s.caption)); c.add(cp, 'fg'); c.item(cp, { at: .8, fx: 'popBig', rot: -3, idle: 'float' }); }
    if (s.source) addSource(c, s.source);
  };

  // ---- BROLL: full-bleed footage montage + lower third
  SC.broll = (s, c) => {
    const u = c.u; const list = [].concat(s.media || s.clips || s.image || s.video || ['b-roll']);
    const per = c.dur / list.length;
    const holders = list.map((src, i) => {
      const it = typeof src === 'string' ? { src } : src;
      const hd = h('div', 'fill look-' + (s.look || it.look || c.dl)); const m = c.media(it.src, { label: it.label || s.label }); m.style.position = 'absolute'; m.style.inset = 0; hd.appendChild(m); c.add(hd, 'bg');
      c.onUpdate(lt => { const lt2 = lt - i * per; const on = lt2 >= -.25 && (i === list.length - 1 || lt2 < per); hd.style.display = on ? 'block' : 'none'; if (on) { updateMedia(m, Math.max(0, lt2), per); const p = prog(lt2, -.25, .3); hd.style.clipPath = i === 0 ? '' : `inset(0 0 0 ${(1 - E.outExpo(p)) * 100}%)`; } });
      if (i > 0) c.sfx('whoosh-soft', i * per - .2, .4);
      return hd;
    });
    c.layers.bg.style.inset = '-4%';
    const shade = h('div', 'fill', { background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.55))' }); c.add(shade, 'bg');
    if (s.text) { const t = h('div', 'abs headline', { left: c.safe.l + 'px', width: c.safe.w + 'px', bottom: (c.H - c.safe.b) + u * 4 + 'px', color: '#fff', fontSize: u * (c.portrait ? 9 : 7.5) + 'px', textShadow: '0 4px 24px rgba(0,0,0,.6)', textAlign: c.portrait ? 'center' : 'left' }); c.ovl.appendChild(t); c.text(t, s.text, { at: .4, fx: 'riseBig' }); c.postLayout(() => fitText(t, c.safe.w, c.safe.h * .5)); }
    if (s.lowerThird) { const el = addLowerThird(c, s.lowerThird); if (s.text) { el.style.bottom = ''; el.style.top = c.safe.t + 'px'; } }
    if (s.source) addSource(c, s.source, '#fff');
  };

  // ---- EXPLAIN: text + media side by side
  SC.explain = (s, c) => {
    const u = c.u;
    const box = c.box({ display: 'flex', flexDirection: c.portrait ? 'column' : (s.mediaSide === 'left' ? 'row-reverse' : 'row'), alignItems: 'center', gap: u * 4 + 'px' });
    const tx = h('div', null, { flex: 1.1, display: 'flex', flexDirection: 'column', gap: u * 1.8 + 'px', textAlign: c.portrait ? 'center' : 'left', alignItems: c.portrait ? 'center' : 'flex-start' });
    if (s.kicker) { const k = h('div', 'kicker', { color: 'var(--accent)' }, esc(s.kicker)); tx.appendChild(k); c.item(k, { at: .1, fx: 'wipe' }); }
    const hd = h('div', 'sans-x', { fontSize: u * (c.portrait ? 7 : 7.2) + 'px' }); tx.appendChild(hd); const r = c.text(hd, s.headline || s.title || '', { at: .25, stagger: .05 });
    if (s.body) { const b = h('div', 'body', { fontSize: u * (c.portrait ? 3.4 : 2.9) + 'px', opacity: .85, fontWeight: 400 }); tx.appendChild(b); c.text(b, s.body, { at: r.end, stagger: .02, fx: 'fade' }); }
    (s.bullets || []).forEach((bl, i) => { const d = h('div', 'body', { fontSize: u * 3 + 'px', display: 'flex', gap: u + 'px', alignItems: 'baseline' }, `<span style="color:var(--accent);font-family:Anton">→</span><span>${esc(bl)}</span>`); tx.appendChild(d); c.item(d, { at: r.end + .3 + i * .35, fx: 'slideL' }); c.sfx('pop', r.end + .3 + i * .35, .3); });
    box.appendChild(tx);
    const mw = c.portrait ? c.safe.w * .9 : c.safe.w * .42, mh = c.portrait ? c.safe.h * .42 : mw * .8;
    const fr = h('div', 'photo', { position: 'relative', width: mw + 'px', height: mh + 'px', flex: 'none' });
    const lk = h('div', 'img look-' + (s.look || c.dl), { width: '100%', height: '100%' });
    const m = c.media(s.media, { label: s.mediaLabel || s.headline, icon: s.icon }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk);
    fr.appendChild(h('div', 'tape', { right: -u * 2 + 'px', top: u * .5 + 'px', transform: 'rotate(38deg)' }));
    box.appendChild(fr); c.item(fr, { at: .15, fx: 'drop', rot: 2.5, idle: 'bob', dur: .7 }); c.sfx('thud', .45, .4);
    c.onUpdate(lt => updateMedia(m, lt, c.dur));
    c.add(box);
    c.postLayout(() => fitText(hd, c.portrait ? c.safe.w : c.safe.w * .5, c.safe.h * (c.portrait ? .25 : .45)));
    if (s.source) addSource(c, s.source);
  };

  // ---- FLOW: process diagram with drawn arrows
  SC.flow = (s, c) => {
    const u = c.u; const nodes = s.steps || s.nodes || [];
    const vertical = c.portrait;
    const box = c.box({ display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-evenly' });
    const per = Math.max(.6, (c.dur - 1) / Math.max(1, nodes.length));
    const n = nodes.length || 1;
    const nodeSize = vertical ? Math.min(c.safe.h / n * .55, u * 16) : Math.min(c.safe.w / n * .5, u * 20);
    nodes.forEach((nd, i) => {
      const it = typeof nd === 'string' ? { label: nd } : nd; const at = .3 + i * per;
      const col = h('div', null, { display: 'flex', flexDirection: vertical ? 'row' : 'column', alignItems: 'center', gap: u * 1.4 + 'px', width: vertical ? '100%' : 'auto' });
      const ic = h('div', 'card', { width: nodeSize + 'px', height: nodeSize + 'px', padding: nodeSize * .16 + 'px', flex: 'none', border: c.cine ? '1px solid var(--glassline)' : `${u * .4}px solid var(--ink)` }); ic.innerHTML = stickerSVG(it.icon || guessIcon(it.label), it.color, c.th).html;
      col.appendChild(ic);
      const lb = h('div', 'sans-x', { fontSize: u * (vertical ? 4.4 : 3.2) + 'px', textAlign: vertical ? 'left' : 'center', maxWidth: vertical ? '100%' : nodeSize * 1.5 + 'px' }, esc(it.label || '')); col.appendChild(lb);
      box.appendChild(col); c.item(ic, { at, fx: 'popBig', idle: 'breathe' }); c.item(lb, { at: at + .15, fx: 'rise' }); c.sfx('pop', at, .5);
      if (i < nodes.length - 1) { const ar = h('div', null, { width: vertical ? u * 6 + 'px' : u * 8 + 'px', height: vertical ? u * 6 + 'px' : u * 6 + 'px', flex: 'none', transform: vertical ? 'rotate(90deg)' : '', alignSelf: vertical ? 'flex-start' : 'center', marginLeft: vertical ? nodeSize / 2 - u * 3 + 'px' : 0 }); ar.innerHTML = stickerSVG('arrow-straight', c.th.accent, c.th).html; box.appendChild(ar); const a = c.item(ar.firstChild, { at: at + per * .6, fx: 'none' }); a.draws = [...ar.querySelectorAll('path')]; a.o.drawDur = .4; c.sfx('swish', at + per * .6, .3); }
    });
    if (s.title) { const t = h('div', 'abs headline', { left: c.safe.l + 'px', top: c.safe.t * .6 + 'px', fontSize: u * 5.4 + 'px', maxWidth: c.safe.w + 'px' }); c.ovl.appendChild(t); c.text(t, s.title, { at: .05 }); }
    c.add(box);
  };

  // ---- OUTRO / CTA
  SC.outro = (s, c) => {
    const u = c.u;
    if (c.cine) {
      if (s.media) { const hd = fullMedia(c, s.media, { look: s.look }); hd.style.opacity = .45; scrim(c, 'center'); }
      const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 2.6 + 'px' });
      if (s.kicker) { const k = h('div', 'tracked', { fontSize: u * 1.9 + 'px', color: 'var(--accent)' }, esc(s.kicker)); box.appendChild(k); c.item(k, { at: .15, fx: 'blurIn' }); }
      const hd = h('div', 'headline', { fontSize: u * (c.portrait ? 10 : 8.4) + 'px', color: s.media ? '#fff' : 'var(--ink)' }); box.appendChild(hd); const r = c.text(hd, s.headline || 'Thanks for watching', { at: .3, fx: 'blurIn', stagger: .08 });
      if (s.cta && c.viral) { const pal = c.th.pal; const b = h('div', null, { padding: `${u * 1.6}px ${u * 4.4}px`, borderRadius: u * 10 + 'px', fontFamily: 'Manrope', fontWeight: 800, fontSize: u * 3.6 + 'px', color: '#fff', background: `linear-gradient(90deg, ${c.th.accent}, ${pal[0]})`, boxShadow: `0 ${u}px ${u * 4}px ${c.th.accent}66`, textShadow: '0 1px 2px rgba(0,0,0,.25)' }, esc(s.cta)); box.appendChild(b); c.item(b, { at: r.end + .1, fx: 'punch', keep: true, idle: 'pulse' }); c.sfx('drop', r.end + .1, .5);
        const ar = h('div', null, { width: u * 7 + 'px', height: u * 7 + 'px' }); ar.innerHTML = stickerSVG('icon-trend-up', pal[0], c.th).html; box.appendChild(ar); c.item(ar, { at: r.end + .4, fx: 'punch', keep: true }); c.onUpdate(lt => { ar.style.marginTop = Math.abs(Math.sin(lt * 4)) * -u * 1.2 + 'px'; }); }
      else if (s.cta) { const b = h('div', 'card', { padding: `${u * 1.3}px ${u * 3.8}px`, borderRadius: u * 10 + 'px', fontFamily: 'Manrope', fontWeight: 800, fontSize: u * 2.9 + 'px', letterSpacing: '.02em', color: 'var(--ink)', display: 'flex', gap: u + 'px', alignItems: 'center' }, `<span style="width:${u * 1.1}px;height:${u * 1.1}px;border-radius:50%;background:var(--accent);box-shadow:0 0 ${u * 1.4}px var(--accent);display:inline-block"></span>${esc(s.cta)}`); box.appendChild(b); c.item(b, { at: r.end + .1, fx: 'blurIn' }); c.sfx('chime', r.end + .1, .5); }
      if (s.handle) { const hn = h('div', 'tracked', { fontSize: u * 1.9 + 'px', opacity: .7 }, esc(s.handle)); box.appendChild(hn); c.item(hn, { at: r.end + .5, fx: 'fade' }); }
      c.add(box);
      flareSweep(c, .5, 2.2).y = c.H * .5;
      if (c.vox && !c.archive && s.stickers === undefined) [['vx-star', 16, 24, 9], ['vx-heart', 84, 30, 9], ['vx-fire', 18, 70, 10], ['vx-laugh', 82, 68, 11]].forEach(([t, x, y, sz], i) => addSticker(c, { type: t, x, y: c.portrait ? Math.min(y, 70) : y, size: sz, at: .7 + i * .18 }));
      c.postLayout(() => fitText(hd, c.safe.w, c.safe.h * .45));
      return;
    }
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 3 + 'px' });
    const hd = h('div', 'headline', { fontSize: u * (c.portrait ? 11 : 9) + 'px' }); box.appendChild(hd); const r = c.text(hd, s.headline || 'Thanks for watching', { at: .2, fx: 'riseBig' });
    if (s.cta) { const b = h('div', 'headline', { background: 'var(--accent)', color: '#fff', padding: `${u * 1.2}px ${u * 4}px`, borderRadius: u * 10 + 'px', fontSize: u * 4.4 + 'px', boxShadow: `0 ${u * .8}px 0 rgba(0,0,0,.25)` }, esc(s.cta)); box.appendChild(b); c.item(b, { at: r.end, fx: 'popBig', idle: 'pulse' }); c.sfx('ding', r.end, .7); }
    if (s.handle) { const hn = h('div', 'kicker', { fontSize: u * 3 + 'px' }, esc(s.handle)); box.appendChild(hn); c.item(hn, { at: r.end + .3, fx: 'fade' }); }
    c.add(box);
    if (s.stickers === undefined) { [['star', 15, 22], ['sparkle', 85, 30], ['heart', 18, 78], ['face-smile', 84, 74]].forEach(([t, x, y], i) => addSticker(c, { type: t, x, y, size: 9, at: .6 + i * .15 })); }
    c.postLayout(() => fitText(hd, c.safe.w, c.safe.h * .5));
  };

  // ---- shared bits
  function addSource(c, text, color) {
    const sEl = h('div', 'src', { left: c.safe.l + 'px', bottom: (G.captions ? (c.H - c.safe.b) * .25 : c.H * .03) + 'px', color: color || 'var(--ink)' }, 'Source: ' + esc(text));
    if (G.captions && c.portrait) sEl.style.bottom = c.H * .035 + 'px';
    c.ovl.appendChild(sEl); c.item(sEl, { at: .6, fx: 'fade' });
  }
  function addLowerThird(c, lt) {
    const u = c.u; const el = h('div', 'lt', { left: c.safe.l + 'px', bottom: (c.H - c.safe.b) + u * 2 + 'px' });
    el.innerHTML = `<div class="t">${esc(lt.title || lt)}</div>${lt.sub ? `<div class="s">${esc(lt.sub)}</div>` : ''}`;
    c.ovl.appendChild(el); c.item(el, { at: lt.at || .5, fx: 'wipe', dur: .6 }); c.sfx('swish', lt.at || .5, .4); return el;
  }


  /* =====================================================================
     CINEMATIC SCENES (Cinelume)
     ===================================================================== */
  function fullMedia(c, src, o) {
    o = o || {};
    const holder = h('div', 'fill look-' + (o.look || c.dl));
    const m = c.media(src, { label: o.label }); m.style.position = 'absolute'; m.style.inset = 0;
    holder.appendChild(m); c.add(holder, o.layer || 'bg');
    if ((o.layer || 'bg') === 'bg') c.layers.bg.style.inset = '-6%';
    c.onUpdate(lt => updateMedia(m, lt, c.dur));
    return holder;
  }
  function scrim(c, kind, strength) {
    const k = strength == null ? 1 : strength;
    const bgs = {
      left: `linear-gradient(90deg, rgba(0,0,0,${.82 * k}) 0%, rgba(0,0,0,${.4 * k}) 42%, rgba(0,0,0,0) 72%), linear-gradient(180deg, rgba(0,0,0,${.3 * k}), rgba(0,0,0,0) 30%)`,
      center: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${.6 * k}) 0%, rgba(0,0,0,${.28 * k}) 75%)`,
      bottom: `linear-gradient(180deg, rgba(0,0,0,${.38 * k}) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 42%, rgba(0,0,0,${.86 * k}) 100%)`,
      full: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${.72 * k}) 0%, rgba(0,0,0,${.58 * k}) 100%)`,
    };
    const d = h('div', 'fill', { background: bgs[kind] || bgs.bottom }); c.add(d, 'bg'); return d;
  }
  function flareSweep(c, at, dur) {
    const u = c.u, fw = c.W * .8;
    const streak = h('div', 'flare', { left: 0, top: 0, width: fw + 'px', height: u * 1.1 + 'px', background: `radial-gradient(ellipse at center, rgba(255,255,255,.95) 0%, ${c.th.accent}bb 14%, ${c.th.accent}00 68%)`, filter: `blur(${u * .2}px)`, opacity: 0, zIndex: 25 });
    const core = h('div', 'flare', { left: 0, top: 0, width: u * 7 + 'px', height: u * 7 + 'px', borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,.95) 0%, ${c.th.accent}66 30%, transparent 70%)`, opacity: 0, zIndex: 25 });
    c.ovl.appendChild(streak); c.ovl.appendChild(core);
    const st = { y: c.H * .5 }; dur = dur || 1.8;
    c.onUpdate(lt => { const p = prog(lt, at, dur); const x = lerp(-.1, 1.1, E.inOut(p)) * c.W; const op = Math.sin(p * Math.PI) * .9; streak.style.transform = `translate(${x - fw / 2}px, ${st.y - u * .55}px)`; core.style.transform = `translate(${x - u * 3.5}px, ${st.y - u * 3.5}px) scale(${.7 + op * .5})`; streak.style.opacity = core.style.opacity = op; });
    c.sfx('shimmer', at, .45);
    return st;
  }
  const yOf = (c, el, box, f) => c.safe.t + (box ? el.offsetTop : 0) + el.offsetHeight * (f == null ? .55 : f);

  // ---- STORY: the Vox-edit documentary shot — archival photo or cut-out on paper, with props
  //      frame: full | print | cutout | tv | clipboard ; extras: year, name, tag, text (+spot), magnifier
  SC.story = (s, c) => {
    const u = c.u, frame = s.frame || (s.media ? 'print' : 'none'), src = s.media || s.image || s.video;
    const P = c.portrait;
    let mediaBox = null, hold = null;
    if (src && frame === 'full') { hold = fullMedia(c, src, { look: s.look }); const vg = h('div', 'fill', { background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,.65) 100%)' }); c.add(vg, 'bg'); mediaBox = hold; }
    else if (src && frame === 'cutout') {
      const a = G.assets[src]; const ch = c.H * (s.size || (P ? .62 : .82)) / 100 * 100;
      const cw = ch * (s.aspect || .8); const el = h('div', 'abs', { left: `calc(${s.x != null ? s.x : 50}% - ${cw / 2}px)`, bottom: (s.y != null ? s.y : 0) + '%', height: ch + 'px', width: cw + 'px' });
      if (a && a.type === 'image') { const im = h('img', 'look-' + (s.look || c.dl), { width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom', filter: (s.look === 'color' ? '' : 'grayscale(1) contrast(1.2) brightness(1.02) ') + `drop-shadow(0 ${u * 1.2}px ${u * 2.4}px rgba(0,0,0,.45))` }); im.src = a.url; el.appendChild(im); }
      else el.appendChild(Object.assign(c.media(src, { label: s.mediaLabel }), { style: 'position:absolute;inset:0' }));
      c.add(el, 'mid'); c.item(el, { at: .05, fx: s.fx || 'riseBig', dur: .7, keep: true }); c.sfx('paper', .05, .5); mediaBox = el;
    } else if (src && (frame === 'print' || frame === 'polaroid')) {
      const fw = P ? c.W * .78 : Math.min(c.W * .5, c.H * .95), fh = fw * (s.aspect ? 1 / s.aspect : (P ? 1.15 : .7));
      const fr = h('div', 'abs', { width: fw + 'px', height: fh + 'px', left: (c.W - fw) / 2 + (s.x ? (s.x - 50) / 100 * c.W : 0) + 'px', top: (P ? c.H * .2 : (c.H - fh) / 2) + 'px', background: '#F4EFE4', padding: u * (frame === 'polaroid' ? 1.4 : .9) + 'px', paddingBottom: u * (frame === 'polaroid' ? 7 : .9) + 'px', boxShadow: `0 ${u * 1.4}px ${u * 3.4}px rgba(0,0,0,.4)` });
      const lk = h('div', 'img look-' + (s.look || c.dl), { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' });
      const m = c.media(src, { label: s.mediaLabel }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk);
      [[-4, 8, -28], [96, 6, 32]].forEach(([l, t2, r]) => fr.appendChild(h('div', 'tape', { left: l + '%', top: -u * 1.2 + 'px', transform: `rotate(${r}deg)`, width: u * 8 + 'px', display: 'block' })));
      c.add(fr, 'mid'); c.item(fr, { at: .05, fx: s.fx || 'drop', rot: s.rot != null ? s.rot : -2, dur: .7, keep: true }); c.sfx('thud', .3, .5); c.onUpdate(lt => updateMedia(m, lt, c.dur)); mediaBox = fr;
    } else if (frame === 'tv') {
      const tw = P ? c.W * .86 : Math.min(c.W * .56, c.H * 1.0), th2 = tw * .78;
      const tv = h('div', 'abs', { width: tw + 'px', height: th2 + 'px', left: (c.W - tw) / 2 + 'px', top: (P ? c.H * .24 : (c.H - th2) / 2) + 'px', borderRadius: u * 2.4 + 'px', background: 'linear-gradient(160deg, #6B4A2E, #3B2716 60%, #2A1B0F)', boxShadow: `0 ${u * 2}px ${u * 5}px rgba(0,0,0,.55), inset 0 ${u * .4}px ${u * .6}px rgba(255,220,170,.25)`, padding: u * 2.4 + 'px', paddingRight: tw * .24 + 'px' });
      const scr = h('div', null, { position: 'relative', width: '100%', height: '100%', borderRadius: u * 3.5 + 'px', overflow: 'hidden', background: '#111', boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,.9)` });
      if (src) { const lk = h('div', 'img look-' + (s.look || c.dl), { position: 'absolute', inset: 0 }); const m = c.media(src, { label: s.mediaLabel }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); scr.appendChild(lk); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
      const scan = h('div', 'fill', { backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 4px)`, mixBlendMode: 'multiply' }); scr.appendChild(scan);
      const glare = h('div', 'fill', { background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.22), transparent 55%)' }); scr.appendChild(glare);
      tv.appendChild(scr);
      const panel = h('div', 'abs', { right: tw * .04 + 'px', top: '12%', width: tw * .15 + 'px', bottom: '12%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 2 + 'px' });
      for (let i = 0; i < 2; i++) panel.appendChild(h('div', null, { width: tw * .1 + 'px', height: tw * .1 + 'px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #E8DCC8, #8E7F6A 60%, #4A3F31)', boxShadow: '0 3px 6px rgba(0,0,0,.5)' }));
      panel.appendChild(h('div', null, { flex: 1, width: '80%', backgroundImage: 'repeating-linear-gradient(0deg, #1C130B 0 3px, #4A3420 3px 7px)', borderRadius: u * .6 + 'px' }));
      tv.appendChild(panel);
      c.add(tv, 'mid'); c.item(tv, { at: .05, fx: s.fx || 'riseBig', dur: .7, keep: true }); c.sfx('thud', .3, .5);
      c.onUpdate(lt => { scr.style.filter = `brightness(${1 + .06 * Math.sin(lt * 37)}) contrast(1.1)`; scan.style.backgroundPosition = `0 ${lt * 40}px`; }); mediaBox = tv;
    } else if (frame === 'clipboard') {
      const bw = P ? c.W * .74 : Math.min(c.W * .4, c.H * .7), bh = bw * 1.35;
      const bd = h('div', 'abs', { width: bw + 'px', height: bh + 'px', left: (c.W - bw) / 2 + 'px', top: (P ? c.H * .16 : (c.H - bh) / 2 + u * 2) + 'px', borderRadius: u * 1.4 + 'px', background: 'linear-gradient(160deg, #B8865A, #8C5E36)', boxShadow: `0 ${u * 2}px ${u * 4}px rgba(0,0,0,.45)`, padding: `${bw * .14}px ${bw * .07}px ${bw * .07}px` });
      const clip = h('div', 'abs', { left: '50%', top: -bw * .03 + 'px', width: bw * .36 + 'px', height: bw * .14 + 'px', transform: 'translateX(-50%)', borderRadius: u + 'px', background: 'linear-gradient(180deg, #E5E7EB, #9CA3AF 60%, #6B7280)', boxShadow: '0 3px 6px rgba(0,0,0,.4)', zIndex: 3 });
      const sheet = h('div', null, { position: 'relative', width: '100%', height: '100%', background: '#F6F1E6', backgroundImage: `url(${paperTexture()})`, boxShadow: '0 2px 4px rgba(0,0,0,.2)', padding: u * 1.6 + 'px', display: 'flex', flexDirection: 'column', gap: u + 'px', color: '#1d1a15' });
      if (src) { const ph = h('div', 'img look-' + (s.look || c.dl), { position: 'relative', width: '100%', height: '55%', overflow: 'hidden' }); const m = c.media(src, { label: s.mediaLabel }); Object.assign(m.style, { position: 'absolute', inset: 0 }); ph.appendChild(m); sheet.appendChild(ph); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
      if (s.note) { const nt = h('div', 'mono', { fontSize: u * (P ? 2.4 : 1.9) + 'px', lineHeight: 1.45 }); sheet.appendChild(nt); nt.textContent = s.note; c.item(nt, { at: .6, fx: 'typeOn', dur: Math.min(2.2, s.note.length * .03), keep: true }); for (let i = 0; i < s.note.length; i += 3) c.sfx('key', .6 + Math.min(2.2, s.note.length * .03) * i / s.note.length, .2); }
      for (let i = 0; i < 5; i++) sheet.appendChild(h('div', null, { height: u * .9 + 'px', background: '#1d1a1522', width: (60 + (i * 29) % 35) + '%' }));
      bd.appendChild(sheet); bd.appendChild(clip);
      c.add(bd, 'mid'); c.item(bd, { at: .05, fx: s.fx || 'slideU', rot: s.rot != null ? s.rot : -3, dur: .7, keep: true }); c.sfx('paper', .1, .6); mediaBox = bd;
    }
    // magnifying glass sweeping across the shot
    if (s.magnifier && src) {
      const R = (P ? c.W * .3 : c.H * .3), lens = h('div', 'abs', { width: R * 2 + 'px', height: R * 2 + 'px', borderRadius: '50%', overflow: 'hidden', border: `${u * 1.1}px solid #2B2B2B`, boxShadow: `0 0 0 ${u * .3}px #8B8B8B, 0 ${u * 1.6}px ${u * 3}px rgba(0,0,0,.5)`, zIndex: 25 });
      const zoomImg = h('div', 'look-' + (s.look || c.dl), { position: 'absolute', width: c.W * 2 + 'px', height: c.H * 2 + 'px' });
      const a = G.assets[src]; if (a && (a.type === 'image' || a.type === 'video')) { const im = h('img', null, { width: '100%', height: '100%', objectFit: 'cover' }); im.src = a.type === 'image' ? a.url : a.pattern.replace('%05d', '00001'); zoomImg.appendChild(im); }
      lens.appendChild(zoomImg); lens.appendChild(h('div', 'fill', { background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 45%)' }));
      const handle = h('div', 'abs', { width: R * .28 + 'px', height: R * 1.1 + 'px', borderRadius: u + 'px', background: 'linear-gradient(90deg, #1E1E1E, #4A4A4A, #1E1E1E)', zIndex: 24, transformOrigin: '50% 0' });
      c.ovl.appendChild(handle); c.ovl.appendChild(lens);
      const path0 = s.magnifier.path || (P ? [[.3, .45], [.66, .55], [.45, .62]] : [[.3, .6], [.62, .66], [.45, .64]]);
      c.onUpdate(lt => { const p = E.inOut(prog(lt, .4, Math.max(1, c.dur - .8))); const seg = p * (path0.length - 1), i0 = Math.min(path0.length - 2, Math.floor(seg)), f = seg - i0; const x = lerp(path0[i0][0], path0[i0 + 1][0], E.inOut(f)) * c.W, y = lerp(path0[i0][1], path0[i0 + 1][1], E.inOut(f)) * c.H; lens.style.left = x - R + 'px'; lens.style.top = y - R + 'px'; zoomImg.style.left = -(x * 2 - R) + 'px'; zoomImg.style.top = -(y * 2 - R) + 'px'; handle.style.left = x + R * .55 + 'px'; handle.style.top = y + R * .55 + 'px'; handle.style.transform = 'rotate(-45deg)'; const k = prog(lt, .2, .5); lens.style.opacity = handle.style.opacity = k; });
      c.sfx('whoosh-soft', .4, .3);
    }
    // [ in 1985 ] bracketed year
    if (s.year) {
      const yb = h('div', 'abs', { left: '50%', top: (P ? 13 : 16) + '%', display: 'flex', alignItems: 'center', gap: u * 1 + 'px', zIndex: 26 });
      const txt = h('div', null, { fontFamily: 'Serif, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: u * (P ? 7 : 6) + 'px', color: frame === 'full' ? '#F4EFE4' : 'var(--ink)', padding: `0 ${u * 1.4}px`, position: 'relative' }, esc(s.year));
      yb.appendChild(txt); c.ovl.appendChild(yb);
      c.postLayout(() => { const w = txt.offsetWidth, hh = txt.offsetHeight; const svgEl = sv('svg', { width: w, height: hh, style: 'position:absolute;left:0;top:0;overflow:visible' }); const col = 'var(--accent)'; const sw = Math.max(2, u * .35), bw = u * 1.2; const L = sv('path', { d: `M${bw} 0 L0 0 L0 ${hh} L${bw} ${hh}`, fill: 'none', stroke: col, 'stroke-width': sw }, svgEl); const Rp = sv('path', { d: `M${w - bw} 0 L${w} 0 L${w} ${hh} L${w - bw} ${hh}`, fill: 'none', stroke: col, 'stroke-width': sw }, svgEl); txt.appendChild(svgEl); c.onUpdate(lt => { drawPath(L, prog(lt, .2, .5)); drawPath(Rp, prog(lt, .2, .5)); }); });
      c.item(yb, { at: .25, fx: 'blurIn', dur: .7, keep: true, center: true }); c.sfx('scribble', .2, .4);
    }
    // italic serif name label (on the photo)
    if (s.name) { const nm = h('div', 'abs', { left: '50%', top: (P ? 54 : 72) + '%', fontFamily: 'Serif, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: u * (P ? 6 : 5) + 'px', color: '#F4EFE4', textShadow: '0 2px 14px rgba(0,0,0,.7)', whiteSpace: 'nowrap', zIndex: 26 }, esc(s.name)); c.ovl.appendChild(nm); c.item(nm, { at: .6, fx: 'blurIn', dur: .8, keep: true, center: true }); }
    // red tag box with yellow serif words
    if (s.tag) { const tg = h('div', 'abs', { left: '50%', top: (P ? 64 : 73) + '%', background: 'var(--accent)', color: 'var(--hl)', fontFamily: 'Serif, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: u * (P ? 4.6 : 3.8) + 'px', padding: `${u * .3}px ${u * 1.4}px`, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.35)', zIndex: 27 }, esc(s.tag)); c.ovl.appendChild(tg); c.item(tg, { at: s.tagAt || 1.0, fx: 'stamp', dur: .45, keep: true, center: true }); c.sfx('hit', s.tagAt || 1.0, .45); }
    // big words, optionally on a colour spot ("nothing unusual.")
    if (s.text) {
      const box = c.box(s.magnifier ? { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'center', paddingTop: c.H * .04 + 'px' } : { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' });
      const wrapT = h('div', null, { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' });
      const spotOn = s.spot !== false && (s.spot || !src), sz = (P ? c.W * .8 : c.H * .7);
      if (spotOn) { const sp = h('div', 'abs', { width: sz + 'px', height: sz + 'px', left: '50%', top: '50%', marginLeft: -sz / 2 + 'px', marginTop: -sz / 2 + 'px', borderRadius: '50%', background: typeof s.spot === 'string' ? s.spot : '#8E5B3B', opacity: .92, boxShadow: 'inset 0 0 40px rgba(0,0,0,.25)' }); wrapT.appendChild(sp); c.item(sp, { at: .05, fx: 'zoom', dur: .6, keep: true }); }
      const tx = h('div', 'headline', { position: 'relative', fontSize: u * (s.size || (P ? 10 : 8.5)) + 'px', color: s.spot || !src ? '#141210' : '#fff', textShadow: s.spot || !src ? 'none' : '0 3px 18px rgba(0,0,0,.6)', maxWidth: (spotOn ? sz * .78 : P ? c.W * .82 : c.W * .7) + 'px' });
      wrapT.appendChild(tx); box.appendChild(wrapT); c.add(box, 'fg');
      c.text(tx, s.text, { at: .3, stagger: .1, fx: 'riseBig' });
      if (s.magnifier && !s.size) tx.style.fontSize = u * (P ? 8 : 6) + 'px';
      c.postLayout(() => fitText(tx, spotOn ? sz * .78 : P ? c.W * .82 : c.W * .7, spotOn ? sz * .6 : c.H * .3));
    }
    if (s.source) addSource(c, s.source, frame === 'full' ? '#fff' : null);
  };

  // ---- HOOK: the first 1–3 seconds of a short — giant punchy words over a vivid shot
  SC.hook = (s, c) => {
    const u = c.u; const lines = s.lines || [s.text || s.headline || ''];
    if (s.media) { fullMedia(c, s.media, { look: s.look }); scrim(c, 'full', s.scrim != null ? s.scrim : .75); }
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 1 + 'px' });
    if (s.kicker) { const k = h('div', 'kicker', null, esc(s.kicker)); box.appendChild(k); c.item(k, { at: .05, fx: 'punch', keep: true, dur: .35 }); }
    const per = Math.max(.35, Math.min(.9, (c.dur - .6) / lines.length));
    const pal = c.th.pal || [c.th.accent, c.th.hl];
    lines.forEach((ln, i) => {
      const d = h('div', 'headline', { fontSize: (s.size || (c.portrait ? 11.5 : 10)) * u + 'px', width: '100%', color: i === lines.length - 1 && s.colorLast !== false ? pal[0] : (s.media ? '#fff' : 'var(--ink)'), textShadow: s.media || !c.th.light ? `0 ${u * .5}px ${u * 3}px rgba(0,0,0,.55)` : 'none', textTransform: s.upper === false ? 'none' : 'uppercase' });
      box.appendChild(d);
      c.text(d, ln, { at: .1 + i * per, stagger: .05, fx: 'punch', markAt: .1 + i * per + .3 });
      c.sfx(i ? 'snap' : 'drop', .1 + i * per, i ? .5 : .8);
      c.postLayout(() => fitText(d, c.safe.w, c.safe.h / lines.length * .9));
    });
    c.add(box, 'fg');
    if (s.source) addSource(c, s.source, s.media ? '#fff' : null);
  };

  // ---- CINEMATIC: full-bleed real footage/photo, graded, with an elegant film title
  SC.cinematic = (s, c) => {
    const u = c.u;
    const holder = fullMedia(c, s.media || s.image || s.video || 'search:' + (s.query || s.title || s.headline || 'cinematic landscape'), { look: s.look, label: s.mediaLabel || s.query });
    const align = s.align || (c.portrait ? 'bottom' : 'bottom-left');
    scrim(c, align === 'center' ? 'center' : align === 'left' ? 'left' : 'bottom', s.scrim);
    const intro = s.intro || 'fade';
    c.onUpdate(lt => {
      if (intro === 'slit') { const k = E.inOutExpo(prog(lt, 0, 1.3)); holder.style.clipPath = `inset(${(1 - k) * 50}% 0 ${(1 - k) * 50}% 0)`; }
      else if (intro === 'blur') { const k = E.out(prog(lt, 0, 1.8)); holder.style.filter = `blur(${(1 - k) * u * 2.5}px) brightness(${.6 + .4 * k})`; }
      else if (intro === 'fade') holder.style.opacity = E.inOut(prog(lt, 0, 1.1));
    });
    const centered = align === 'center' || align === 'bottom';
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: align === 'center' ? 'center' : align === 'left' ? 'center' : 'flex-end', alignItems: centered ? 'center' : 'flex-start', textAlign: centered ? 'center' : 'left', gap: u * 1.6 + 'px' });
    if (s.kicker) { const k = h('div', 'kicker', { color: '#fff', display: 'flex', alignItems: 'center', gap: u * 1.4 + 'px' }); k.innerHTML = `<span style="display:inline-block;width:${u * 5}px;height:1px;background:var(--accent)"></span><span>${esc(s.kicker)}</span>${centered ? `<span style="display:inline-block;width:${u * 5}px;height:1px;background:var(--accent)"></span>` : ''}`; box.appendChild(k); c.item(k, { at: .5, fx: 'reveal', dur: 1 }); }
    const title = h('div', s.font === 'film' ? 'film-title' : 'headline', { fontSize: (s.size || (c.portrait ? 10.5 : (s.font === 'film' ? 6.8 : 9.5))) * u + 'px', color: '#fff', textShadow: '0 4px 40px rgba(0,0,0,.55)', maxWidth: centered || c.portrait ? '100%' : '74%' });
    box.appendChild(title);
    const r = c.text(title, s.title || s.headline || '', { at: .8, stagger: .09, fx: 'blurIn', dur: 1 });
    if (s.sub) { const sb = h('div', 'body', { fontSize: (c.portrait ? 3.3 : 2.6) * u + 'px', color: 'rgba(255,255,255,.82)', maxWidth: centered || c.portrait ? '100%' : '52%' }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: r.end + .1, fx: 'blurIn', dur: 1 }); }
    c.add(box, 'fg');
    const fl = s.flare === false ? null : flareSweep(c, .65, 2);
    c.postLayout(() => { fitText(title, centered || c.portrait ? c.safe.w : c.safe.w * .74, c.safe.h * .55); if (fl) fl.y = yOf(c, title, box); });
    c.sfx('swell', 0, .35);
    if (s.lowerThird) addLowerThird(c, s.lowerThird);
    if (s.source) addSource(c, s.source, '#fff');
  };

  // ---- ESTABLISHING: place + time stamp typed over footage (documentary opener)
  SC.establishing = (s, c) => {
    const u = c.u;
    const holder = fullMedia(c, s.media || s.image || s.video || 'search:' + (s.query || (s.location || 'city') + ' aerial'), { look: s.look, label: s.query || s.location });
    c.onUpdate(lt => { holder.style.opacity = E.inOut(prog(lt, 0, 1.2)); });
    scrim(c, 'bottom', s.scrim);
    const centered = c.portrait || s.align === 'center';
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: s.align === 'center' ? 'center' : 'flex-end', alignItems: centered ? 'center' : 'flex-start', textAlign: centered ? 'center' : 'left', gap: u * 1.1 + 'px' });
    const line = h('div', null, { width: u * 10 + 'px', height: '1px', background: 'var(--accent)' }); box.appendChild(line); c.item(line, { at: .5, fx: 'wipe', dur: .9, keep: true });
    const locTxt = String(s.location || s.title || '').toUpperCase();
    const loc = h('div', 'film-title', { fontSize: (s.size || (c.portrait ? 6.2 : 5.4)) * u + 'px', color: '#fff', textShadow: '0 3px 30px rgba(0,0,0,.6)' }, esc(locTxt)); box.appendChild(loc);
    const tAt = .8, tDur = Math.min(1.6, locTxt.length * .055); c.item(loc, { at: tAt, fx: 'typeOn', dur: tDur, keep: true });
    for (let i = 0; i < locTxt.length; i += 2) if (locTxt[i] !== ' ') c.sfx('key', tAt + tDur * i / Math.max(1, locTxt.length), .22);
    const meta2 = [s.time, s.date].filter(Boolean).join('   ·   ');
    if (meta2) { const tm = h('div', 'tracked', { fontSize: (c.portrait ? 2.3 : 1.9) * u + 'px', color: 'rgba(255,255,255,.78)' }, esc(meta2)); box.appendChild(tm); c.item(tm, { at: tAt + tDur + .2, fx: 'typeOn', dur: .8, keep: true }); }
    if (s.coords) { const co = h('div', 'mono', { fontSize: 1.6 * u + 'px', color: 'rgba(255,255,255,.5)', letterSpacing: '.12em' }, esc(s.coords)); box.appendChild(co); c.item(co, { at: tAt + tDur + .6, fx: 'fade', keep: true }); }
    c.add(box, 'fg');
    if (s.viewfinder) { const top = c.lbWant ? G.lbH : 0, vh = (c.H - top * 2) * .9; addPremiumSticker(c, { type: 'corners', x: 50, y: 50, size: vh / u, aspect: (c.W * .95) / vh, at: .3, color: 'rgba(255,255,255,.7)', weight: .09 }); addPremiumSticker(c, { type: 'rec', x: c.portrait ? 50 : 86, y: c.lbWant ? (G.lbH / c.H * 100 + 7) : 9, at: .4, size: 4.2 }); }
    if (s.lowerThird) addLowerThird(c, s.lowerThird);
    if (s.source) addSource(c, s.source, '#fff');
  };

  // ---- OPENING: film title card ("LIUANTUM PRESENTS" → tracked title → tagline)
  SC.opening = (s, c) => {
    const u = c.u;
    if (s.media) { const hd = fullMedia(c, s.media, { look: s.look }); c.onUpdate(lt => { hd.style.opacity = (s.dim != null ? s.dim : .5) * E.inOut(prog(lt, 0, 2)); }); scrim(c, 'center'); }
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 2.2 + 'px' });
    let t0 = .35;
    if (s.presenter) { const pr = h('div', 'tracked', { fontSize: (c.portrait ? 2.2 : 1.8) * u + 'px', color: 'var(--ink)', opacity: .75 }, esc(s.presenter)); box.appendChild(pr); c.item(pr, { at: t0, fx: 'blurIn', dur: 1.4, keep: true }); t0 += 1.1; }
    const title = h('div', 'film-title', { fontSize: (s.size || (c.portrait ? 8.6 : 8.2)) * u + 'px', color: 'var(--ink)', maxWidth: '100%' }, esc(s.title || s.headline || ''));
    box.appendChild(title);
    const ta = t0;
    c.onUpdate(lt => { const p = E.outExpo(prog(lt, ta, 3.2)); title.style.letterSpacing = lerp(.5, .16, p) + 'em'; title.style.opacity = E.out(prog(lt, ta, 1.6)); title.style.filter = `blur(${(1 - E.out(prog(lt, ta, 1.4))) * u * .7}px)`; });
    const rule = h('div', null, { height: '1px', width: 0, background: 'var(--accent)', opacity: .9 }); box.appendChild(rule);
    c.onUpdate(lt => { rule.style.width = E.inOut(prog(lt, ta + .9, 1.4)) * u * 22 + 'px'; });
    if (s.sub || s.tagline) { const sb = h('div', 'serif', { fontSize: (c.portrait ? 4.2 : 3.4) * u + 'px', color: 'var(--ink)', opacity: .85 }, esc(s.sub || s.tagline)); box.appendChild(sb); c.item(sb, { at: ta + 1.5, fx: 'blurIn', dur: 1.2, keep: true }); }
    c.add(box, 'mid');
    const fl = flareSweep(c, ta + .2, 2.4);
    c.postLayout(() => { fitText(title, c.safe.w, c.safe.h * .45); fl.y = c.safe.t + title.offsetTop + title.offsetHeight * .52; });
    c.sfx('swell', Math.max(0, ta - 1.1), .5); c.sfx('braam', ta, .7);
  };

  // ---- NARRATIVE: documentary intertitles — serif lines surface one by one over dim footage
  SC.narrative = (s, c) => {
    const u = c.u; const lines = s.lines || [s.text || ''];
    const onMedia = !!s.media;
    if (onMedia) { fullMedia(c, s.media, { look: s.look }); scrim(c, 'full', s.scrim != null ? s.scrim : 1); }
    const left = s.align === 'left' && !c.portrait;
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: left ? 'flex-start' : 'center', textAlign: left ? 'left' : 'center', gap: u * 2 + 'px' });
    const per = Math.max(1, (c.dur - .8) / lines.length);
    lines.forEach((ln, i) => {
      const d = h('div', s.italic ? 'serif' : 'headline', { fontSize: (s.size || (c.portrait ? 6.6 : 5.6)) * u + 'px', color: onMedia ? '#fff' : 'var(--ink)', lineHeight: 1.12, maxWidth: left ? '70%' : '100%', textShadow: onMedia ? '0 2px 24px rgba(0,0,0,.7)' : 'none' });
      box.appendChild(d);
      c.text(d, ln, { at: .3 + i * per, stagger: .06, fx: 'blurIn', dur: .9, markAt: .3 + i * per + .9 });
      if (s.dimPrevious !== false && i < lines.length - 1) c.onUpdate(lt => { d.style.opacity = lt > .3 + (i + 1) * per ? .32 : 1; });
      c.postLayout(() => fitText(d, left ? c.safe.w * .7 : c.safe.w, c.safe.h / lines.length));
      c.sfx('air', .3 + i * per, .35);
    });
    c.add(box, 'mid');
    if (s.source) addSource(c, s.source, onMedia ? '#fff' : null);
  };

  // ---- DEPTH: 2.5D parallax — background plate, text in the middle, optional foreground cut-out
  SC.depth = (s, c) => {
    const u = c.u;
    fullMedia(c, s.media || s.image || 'search:' + (s.query || s.headline || 'mountains fog'), { look: s.look, label: s.query });
    scrim(c, c.portrait ? 'bottom' : 'left', s.scrim != null ? s.scrim : .8);
    const left = !c.portrait && s.align !== 'center';
    const box = c.box({ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: left ? 'flex-start' : 'center', textAlign: left ? 'left' : 'center', gap: u * 1.6 + 'px' });
    if (s.kicker) { const k = h('div', 'kicker', { color: 'var(--accent)' }, esc(s.kicker)); box.appendChild(k); c.item(k, { at: .3, fx: 'reveal', dur: .9 }); }
    const hd = h('div', s.font === 'sans' ? 'sans-x' : 'headline', { fontSize: (s.size || (c.portrait ? 9.5 : 8.6)) * u + 'px', color: '#fff', maxWidth: left ? '62%' : '100%', textShadow: '0 4px 30px rgba(0,0,0,.5)' }); box.appendChild(hd);
    const r = c.text(hd, s.headline || s.title || '', { at: .5, stagger: .08, fx: 'blurIn' });
    if (s.sub) { const sb = h('div', 'body', { fontSize: (c.portrait ? 3.3 : 2.6) * u + 'px', color: 'rgba(255,255,255,.82)', maxWidth: left ? '48%' : '100%' }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: r.end, fx: 'blurIn' }); }
    c.add(box, 'mid');
    if (s.foreground) {
      const fgs = typeof s.foreground === 'string' ? { media: s.foreground } : s.foreground;
      const fh = (fgs.size || 62) / 100 * c.H;
      const fgEl = h('div', 'abs', { left: (fgs.x != null ? fgs.x : 72) + '%', bottom: (fgs.y != null ? fgs.y : -4) + '%', height: fh + 'px', width: fh * (fgs.aspect || 1) + 'px', transform: 'translateX(-50%)' });
      const a = G.assets[fgs.media];
      if (a && a.type === 'image') { const im = h('img', null, { width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }); im.src = a.url; fgEl.appendChild(im); }
      c.add(fgEl, 'fg'); c.item(fgEl, { at: .1, fx: 'settle', dur: 1.2, keep: true });
    }
    // floating particles in front of everything sell the depth
    const dust = []; const rr = rng(c.idx * 17 + 5);
    for (let i = 0; i < (s.particles != null ? s.particles : 18); i++) { const sz = u * (.25 + rr() * (i % 5 === 0 ? 2.2 : .7)); const d = h('div', 'abs', { left: rr() * 100 + '%', top: rr() * 100 + '%', width: sz + 'px', height: sz + 'px', borderRadius: '50%', background: `radial-gradient(circle, rgba(255,240,220,${.35 + rr() * .4}), transparent 70%)`, filter: i % 5 === 0 ? `blur(${u * .4}px)` : '' }); d._v = .3 + rr(); c.add(d, 'fg'); dust.push(d); }
    c.onUpdate(lt => dust.forEach((d, i) => { d.style.transform = `translate(${Math.sin(lt * .3 + i) * u * 2}px, ${-lt * u * 1.4 * d._v}px)`; }));
    if (s.source) addSource(c, s.source, '#fff');
  };

  /* =====================================================================
     DEFAULT DURATIONS
     ===================================================================== */
  const DEF_DUR = { title: 4, kinetic: 4, bignumber: 4.5, bar: 6, line: 6.5, donut: 5, icongrid: 5.5, map: 6.5, photo: 5, collage: 5.5, document: 6, quote: 5.5, timeline: 7, compare: 6, list: 6, chapter: 2.8, screen: 5.5, broll: 4.5, explain: 6, flow: 6, outro: 4, story: 4.5, hook: 2.4, cinematic: 5.5, establishing: 5, opening: 5.5, narrative: 6, depth: 5.5 };
  const SCENE_CAM = { story: 'push-in-slow', hook: 'punch-in', cinematic: 'dolly-in', establishing: 'truck-right', opening: 'slow-push', narrative: 'steadicam', depth: 'parallax' };
  const words = s => String(s || '').replace(/[=*_\[\]{}~]/g, '').split(/\s+/).filter(Boolean).length;

  /* =====================================================================
     INIT / SEEK
     ===================================================================== */
  V.init = function (sb, opt) {
    const W = opt.W, H = opt.H, u = Math.min(W, H) / 100;
    G = { W, H, u, fps: opt.fps || 30, sb, assets: opt.assets || {}, themeName: (sb.meta && sb.meta.theme) || 'noir', captions: (sb.meta && sb.meta.captions) !== false && (sb.meta && sb.meta.captions) !== 'none', capStyle: null, flash: 0, leakBoost: 0, burn: 0 };
    const M = sb.meta || {};
    G.cine = !!(THEMES[G.themeName] || {}).cine; G.viral = !!(THEMES[G.themeName] || {}).viral;
    G.archive = !!(THEMES[G.themeName] || {}).archive;
    G.motion = M.motion || (G.viral || G.archive ? 'vox' : G.cine ? 'cinematic' : 'vox');
    G.bpm = M.bpm || null; G.beat = G.bpm ? 60 / G.bpm : 0; G.beatPulse = G.bpm && (M.beatPulse != null ? M.beatPulse : (G.viral ? .022 : 0));
    G.capStyle = typeof M.captions === 'string' && M.captions !== 'none' ? M.captions : G.archive ? 'voxedit' : G.viral ? 'viral' : (G.cine ? (H > W ? 'cinema' : 'subtitle') : (H > W ? 'karaoke' : 'boxed'));
    const lbRatio = typeof M.letterbox === 'number' ? M.letterbox : 2.39;
    G.lbH = W > H && !((G.viral || G.archive) && M.letterbox == null) ? Math.max(0, Math.round((H - W / lbRatio) / 2)) : 0;
    G.lbGlobal = M.letterbox == null ? null : !!M.letterbox;
    const stage = document.getElementById('stage');
    stage.innerHTML = ''; Object.assign(stage.style, { width: W + 'px', height: H + 'px' });
    stage.style.setProperty('--u', u + 'px');
    const T0 = THEMES[G.themeName] || THEMES.paper; for (const k in T0) stage.style.setProperty('--' + k, T0[k]);
    // motion-blur filters
    const fsvg = sv('svg', { width: 0, height: 0, style: 'position:absolute' }); const defs = sv('defs', {}, fsvg);
    ['x', 'y'].forEach(a => { const f = sv('filter', { id: 'mb' + a, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs); const gb = sv('feGaussianBlur', { id: 'mbf' + a, stdDeviation: '0 0' }, f); });
    ['0', '1'].forEach(a => { const f = sv('filter', { id: 'cmb' + a, x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs); sv('feGaussianBlur', { id: 'cmbf' + a, stdDeviation: '0 0' }, f); });
    stage.appendChild(fsvg);
    // scenes
    const scenes = []; let t = 0; const events = [];
    const list = (sb.scenes || []);
    const autoTrans = G.archive ? ['paper-slide', 'whip-left', 'zoom-through', 'tear', 'push', 'whip-up', 'stack', 'cross-zoom', 'whip-right', 'tear'] : G.viral ? ['whip-left', 'zoom-through', 'cross-zoom', 'whip-up', 'slit', 'light-leak', 'whip-right', 'flash', 'push', 'glitch'] : G.cine ? ['cross-zoom', 'dissolve', 'luma', 'light-leak', 'whip-left', 'lens-blur', 'dip-black', 'slit', 'cross-zoom', 'film-burn'] : ['whip-left', 'paper-slide', 'zoom-through', 'whip-up', 'iris', 'tear', 'push', 'stack', 'whip-right', 'wipe-diagonal'];
    const transSfx = (n, cine) => { const CT = { dissolve: 'air', luma: 'air', 'dip-black': 'swell', 'dip-white': 'swell', 'light-leak': 'shimmer', 'film-burn': 'shimmer', 'lens-blur': 'whoosh-deep', 'cross-zoom': 'whoosh-deep', slit: 'whoosh-deep' }; if (CT[n]) return CT[n]; const base = n.startsWith('whip') || n === 'push' ? 'whoosh' : n === 'flash' || n === 'glitch' ? 'hit' : n === 'paper-slide' || n === 'tear' || n === 'stack' ? 'paper' : 'whoosh-soft'; return cine && CINE_SFX[base] ? CINE_SFX[base] : base; };
    list.forEach((s0, i) => {
      const s = Object.assign({}, s0.data || {}, s0);
      if (!SC[s.type]) { console.warn('unknown scene type', s.type); s.type = 'title'; s.headline = s.headline || s.text || s.type; }
      if (!s.camera && SCENE_CAM[s.type]) s.camera = SCENE_CAM[s.type];
      const nw = words(s.narration);
      s.duration = s.duration || Math.max(DEF_DUR[s.type] || 4.5, nw / 2.6 + 1.0);
      const c = makeCtx(s, i);
      c.wrap.appendChild(c.ovl);
      c.layers.bg.appendChild(buildBg(s.bg || (sb.meta && sb.meta.bg) || (c.th.archive ? 'paper-grid' : c.th.cine ? 'atmos' : 'paper'), c));
      SC[s.type](s, c);
      (s.cast || []).forEach(ch => addCharacter(c, ch, s.actions));
      (s.stickers || []).forEach(st => addSticker(c, st));
      if (s.lowerThird && !['photo', 'broll'].includes(s.type)) addLowerThird(c, s.lowerThird);
      stage.appendChild(c.wrap);
      const tr = s.transition || (i === 0 ? null : null);
      const next = list[i + 1];
      let trName = s.transition || (sb.meta && sb.meta.transition) || autoTrans[i % autoTrans.length];
      if (!next) trName = 'cut';
      const td = TRANS_DUR[trName] != null ? TRANS_DUR[trName] : .6;
      const sc = { s, c, start: t, dur: s.duration, trName, td, cam: cameraFn(s.camera, s.duration), seed: i * 3.7 + 1 };
      scenes.push(sc);
      c.events.forEach(e => events.push({ t: t + e.at, name: e.name, vol: e.vol }));
      // beat sync: make the next scene start exactly on a beat of the generated music
      if (G.beat && next && M.beatSync !== false) { const end = t + s.duration - td; const snapped = Math.ceil(end / G.beat - .001) * G.beat; s.duration += snapped - end; sc.dur = c.dur = s.duration; sc.cam = cameraFn(s.camera, s.duration); }
      if (trName !== 'cut' && next) { let tn = transSfx(trName, c.cine && !c.archive); if (c.viral && VIRAL_SFX[tn]) tn = VIRAL_SFX[tn]; events.push({ t: t + s.duration - td * .6, name: tn, vol: .8 }); }
      if (s.camera === 'crash-zoom' || s.camera === 'shake-hit') events.push({ t: t + .05, name: c.cine ? 'braam' : 'boom', vol: .7 });
      (s.sfx || []).forEach(e => events.push({ t: t + (e.at || 0), name: e.type || e.name, vol: e.vol || .8 }));
      t += s.duration - (next ? td : 0);
    });
    G.scenes = scenes; G.duration = t; G.events = events.sort((a, b) => a.t - b.t);
    // overlay
    const grain = h('div'); grain.id = 'grain'; stage.appendChild(grain);
    G.grainUrls = [0, 1, 2, 3].map(i => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const id = x.createImageData(256, 256); const r = rng(i * 11 + 5); for (let p = 0; p < id.data.length; p += 4) { const v = 128 + (r() - .5) * 255; id.data[p] = id.data[p + 1] = id.data[p + 2] = v; id.data[p + 3] = 255; } x.putImageData(id, 0, 0); return cv.toDataURL(); });
    G.grainEl = grain; G.grainOn = (sb.meta && sb.meta.grain) !== false;
    if ((sb.meta && sb.meta.vignette) !== false) { const vg = h('div'); vg.id = 'vignette'; if (G.cine) vg.style.background = 'radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,.5) 100%)'; stage.appendChild(vg); }
    // cinematic overlays: grade, light leaks, film burn, letterbox bars
    const GRADES = { archive: 'radial-gradient(ellipse at 50% 45%, rgba(255,235,200,.10) 0%, rgba(60,40,20,.28) 100%)', vivid: 'linear-gradient(170deg, rgba(120,60,255,.16) 0%, rgba(0,0,0,0) 50%, rgba(255,60,140,.14) 100%)', 'teal-orange': 'linear-gradient(170deg, rgba(0,95,115,.26) 0%, rgba(0,0,0,0) 50%, rgba(255,140,60,.18) 100%)', warm: 'linear-gradient(170deg, rgba(255,190,120,.16), rgba(255,120,60,.10))', cool: 'linear-gradient(170deg, rgba(70,120,220,.18), rgba(20,40,90,.10))', noir: 'linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.18))', bleach: 'linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.1))' };
    G.gradeName = M.grade != null ? M.grade : (THEMES[G.themeName] || {}).grade;
    if (G.gradeName && G.gradeName !== 'none' && GRADES[G.gradeName]) { const gr = h('div', null, { background: GRADES[G.gradeName], mixBlendMode: 'soft-light' }); gr.id = 'grade'; stage.appendChild(gr); stage.style.filter = G.gradeName === 'archive' ? 'sepia(.16) contrast(1.06) saturate(.86)' : G.gradeName === 'vivid' ? 'saturate(1.12) contrast(1.05)' : G.gradeName === 'noir' ? 'grayscale(.15) contrast(1.06)' : 'contrast(1.04) saturate(1.04)'; }
    G.leakBase = M.lightLeaks === false ? 0 : (typeof M.lightLeaks === 'number' ? M.lightLeaks : (G.cine ? .14 : 0));
    { const lk = h('div'); lk.id = 'leak'; stage.appendChild(lk); G.leakEl = lk; const bn = h('div'); bn.id = 'burn'; stage.appendChild(bn); G.burnEl = bn; }
    G.lbEls = [h('div', 'lbar', { top: 0, height: 0 }), h('div', 'lbar', { bottom: 0, height: 0 })]; G.lbEls.forEach(e => stage.appendChild(e));
    const fl = h('div'); fl.id = 'flash'; stage.appendChild(fl); G.flashEl = fl;
    const cap = h('div', 'cap-' + G.capStyle); cap.id = 'captions'; G.capBase = H > W ? H * .1 : H * .055; cap.style.bottom = G.capBase + 'px';
    if (G.capStyle === 'viral') { G.capBase = H > W ? H * .24 : H * .12; cap.style.bottom = G.capBase + 'px'; }
    if (G.capStyle === 'voxedit') { G.capBase = H > W ? H * .3 : H * .16; cap.style.bottom = G.capBase + 'px'; }
    cap.style.fontSize = (G.capStyle === 'voxedit' ? (H > W ? u * 7.2 : u * 5.4) : G.capStyle === 'viral' ? (H > W ? u * 8.2 : u * 5.6) : G.capStyle === 'subtitle' ? (H > W ? u * 4.2 : u * 3.1) : G.capStyle === 'cinema' ? (H > W ? u * 5.4 : u * 3.8) : (H > W ? u * 6 : u * 4.2)) + 'px'; if (G.capStyle === 'subtitle') cap.style.setProperty('--capw', '72%'); stage.appendChild(cap); G.capEl = cap;
    if (sb.meta && sb.meta.handle) { const wm = h('div', G.cine ? 'tracked' : null, { top: (G.cine && G.lbH && W > H ? u * 1.8 : u * 3) + 'px', right: u * 3.5 + 'px', fontFamily: G.cine ? 'Manrope' : '', fontSize: (G.cine ? u * 1.5 : u * 2.2) + 'px', color: G.cine ? 'rgba(255,255,255,.7)' : 'var(--ink)', mixBlendMode: G.cine ? 'difference' : '' }, esc(sb.meta.handle)); wm.id = 'wm'; stage.appendChild(wm); }
    if (M.progress || (G.viral && M.progress !== false)) { const pr = h('div'); pr.id = 'progress'; if (G.viral) { const pal = THEMES[G.themeName].pal; Object.assign(pr.style, { top: 0, bottom: 'auto', height: u * .55 + 'px', background: `linear-gradient(90deg, ${pal.join(',')})`, boxShadow: `0 0 ${u}px ${pal[0]}` }); } stage.appendChild(pr); G.progEl = pr; }
    // captions model
    G.capChunks = [];
    if (G.captions) scenes.forEach(sc => {
      if (sc.s.captions === false || (sc.s.type === 'hook' && sc.s.captions == null)) return;
      const raw = String(sc.s.narration || ''); let inBox = false; const boxed = [];
      const ws = raw.split(/\s+/).filter(Boolean).map(w => { const open = w.startsWith('==') || w.startsWith('**'); if (open) inBox = true; const b = inBox; if (/(==|\*\*)[^\w]*$/.test(w)) inBox = false; boxed.push(b); return w.replace(/==|\*\*|__|\[\[|\]\]|~~|\{\{|\}\}/g, ''); }).filter(Boolean);
      if (!ws.length) return;
      const vs = sc.start + (sc.s.voStart != null ? sc.s.voStart : .15), ve = sc.start + (sc.s.voDur ? sc.s.voStart + sc.s.voDur : sc.dur - .25);
      const weights = ws.map(w => w.length + 2), tot = weights.reduce((a, b) => a + b, 0);
      let acc = vs; const timed = ws.map((w, i) => { const d = (ve - vs) * weights[i] / tot; const o = { w, t0: acc, t1: acc + d, box: boxed[i] }; acc += d; return o; });
      const per = G.capStyle === 'voxedit' ? 3 : G.capStyle === 'viral' ? (H > W ? 3 : 5) : G.capStyle === 'subtitle' ? (H > W ? 7 : 11) : G.capStyle === 'cinema' ? (H > W ? 5 : 7) : (H > W ? 4 : 7);
      for (let i = 0; i < timed.length; i += per) { const chunk = timed.slice(i, i + per); G.capChunks.push({ t0: chunk[0].t0, t1: chunk[chunk.length - 1].t1, words: chunk }); }
    });
    return { duration: G.duration, events: G.events, scenes: scenes.map(sc => ({ start: sc.start, dur: sc.dur, type: sc.s.type, voiceover: sc.s.voiceover || null, voStart: sc.s.voStart != null ? sc.s.voStart : .15 })) };
  };

  V.layout = async function () {
    await document.fonts.ready;
    // run post-layout with every scene visible
    G.scenes.forEach(sc => { sc.c.wrap.style.display = 'block'; sc.c.wrap.style.visibility = 'hidden'; });
    G.scenes.forEach(sc => sc.c.post.forEach(f => { try { f(); } catch (e) { console.error(e); } }));
    G.scenes.forEach(sc => { sc.c.wrap.style.visibility = ''; sc.c.wrap.style.display = 'none'; });
    const imgs = [...document.images]; await Promise.all(imgs.map(i => i.decode ? i.decode().catch(() => { }) : null));
    return true;
  };

  function applyCamera(sc, lt, slot) {
    const W = G.W, H = G.H, u = G.u;
    const cv = sc.cam(lt), pv = sc.cam(lt - 1 / G.fps);
    const sh = cv.shake || 0;
    const sx = sh ? noise1(lt * 9, sc.seed) * sh * u * .9 : 0, sy = sh ? noise1(lt * 9, sc.seed + 4) * sh * u * .9 : 0, sr = sh ? noise1(lt * 7, sc.seed + 9) * sh * .4 : 0;
    const L = sc.c.layers;
    for (const name of ['bg', 'mid', 'fg']) {
      const d = parseFloat(L[name].dataset.depth);
      let z = 1 + (cv.z - 1) * d;
      if (G.beatPulse) { const tg = sc.start + lt, ph = tg % G.beat, bi = Math.round((tg - ph) / G.beat); z *= 1 + G.beatPulse * (bi % 2 ? .45 : 1) * Math.exp(-ph * 10) * (name === 'bg' ? .6 : 1); }
      if (name === 'fg' && cv.fgZ) z *= cv.fgZ; if (name === 'mid' && cv.fgZ) z *= cv.fgZ; if (name === 'bg' && cv.bgZ) z *= cv.bgZ;
      L[name].style.transform = `translate(${-cv.x * W * d + sx}px,${-cv.y * H * d + sy}px) rotate(${cv.r * d + sr}deg) scale(${z})`;
      if (name === 'bg') L[name].style.filter = cv.bgBlur ? `blur(${cv.bgBlur * u * .9}px)` : '';
    }
    sc.c.cam.style.transform = cv.tilt ? `perspective(${W * 1.4}px) rotateX(${cv.tilt}deg)` : '';
    // motion blur from camera velocity
    const vx = Math.abs((cv.x - pv.x) * W) + Math.abs(cv.z - pv.z) * W * .5, vy = Math.abs((cv.y - pv.y) * H);
    const f = document.getElementById('cmbf' + slot);
    if (vx + vy > 2.5) { f.setAttribute('stdDeviation', `${Math.min(vx * .5, u * 4)} ${Math.min(vy * .5, u * 4)}`); sc.c.cam.style.filter = `url(#cmb${slot})`; }
    else sc.c.cam.style.filter = '';
  }

  function renderScene(sc, lt) {
    const c = sc.c;
    c.updates.forEach(f => f(lt));
    c.items.forEach(it => it.update(lt));
    c.marks.forEach(m => animateMark(m, prog(lt, m.at, m.dur)));
  }

  V.seek = async function (t) {
    pending = [];
    G.flash = 0; G.leakBoost = 0; G.burn = 0;
    const active = [];
    G.scenes.forEach((sc, i) => {
      const on = t >= sc.start && t < sc.start + sc.dur || (i === G.scenes.length - 1 && t >= sc.start);
      const w = sc.c.wrap;
      w.style.transform = ''; w.style.clipPath = ''; w.style.opacity = 1; w.style.filter = ''; w.style.zIndex = ''; w.style.boxShadow = ''; w.style.webkitMaskImage = '';
      w.style.display = on ? 'block' : 'none';
      if (on) active.push(i);
    });
    active.forEach((i, k) => { const sc = G.scenes[i]; const lt = t - sc.start; renderScene(sc, lt); applyCamera(sc, lt, k % 2); });
    if (active.length === 2) { const A = G.scenes[active[0]], B = G.scenes[active[1]]; const p = clamp((t - B.start) / A.td); applyTransition(A.trName, p, A.c.wrap, B.c.wrap); }
    // overlays
    if (G.grainOn) { const fi = Math.floor(t * 12) % 4; G.grainEl.style.backgroundImage = `url(${G.grainUrls[fi]})`; G.grainEl.style.backgroundPosition = `${(fi * 73) % 256}px ${(fi * 151) % 256}px`; const th = G.scenes[active[active.length - 1]] ? G.scenes[active[active.length - 1]].c.th : THEMES.paper; G.grainEl.style.mixBlendMode = th.grain; G.grainEl.style.opacity = th.grain === 'multiply' ? .085 : .07; }
    G.flashEl.style.opacity = G.flash;
    // letterbox: bars ease in/out with the scenes that want them
    if (G.lbH > 0) {
      let amt = 0;
      if (active.length === 2) { const A = G.scenes[active[0]], B = G.scenes[active[1]]; amt = lerp(A.c.lbWant, B.c.lbWant, E.inOut(clamp((t - B.start) / A.td))); }
      else if (active.length) { const sc = G.scenes[active[0]]; amt = sc.c.lbWant; if (active[0] === 0) amt *= E.inOut(prog(t, 0, 1.4)); }
      const hb = G.lbH * amt; G.lbEls[0].style.height = G.lbEls[1].style.height = hb + 'px';
      if (G.capEl) G.capEl.style.bottom = lerp(G.capBase, Math.max(G.H * .018, G.lbH * .2), amt) + 'px';
    }
    // light leaks + film burn
    const thA = G.scenes[active[active.length - 1]] ? G.scenes[active[active.length - 1]].c.th : THEMES.noir;
    const lo = Math.min(.95, G.leakBase * (thA.cine ? (.55 + .45 * noise1(t * .35, 2)) : 0) + G.leakBoost);
    if (lo > .005) { const x1 = 18 + 30 * noise1(t * .12, 1), y1 = 20 + 25 * noise1(t * .1, 5), x2 = 82 + 14 * noise1(t * .09, 9); G.leakEl.style.background = `radial-gradient(ellipse at ${x1}% ${y1}%, ${(thA.glow1 || '#FF9A4D')}cc 0%, transparent 46%), radial-gradient(ellipse at ${x2}% 85%, #FF5A3Aaa 0%, transparent 40%), radial-gradient(ellipse at 100% 0%, #FFD9A0aa 0%, transparent 35%)`; }
    G.leakEl.style.opacity = lo > .005 ? lo : 0;
    if (G.burn > .005) { const r = G.burnR || 50; G.burnEl.style.background = `radial-gradient(circle at 78% 32%, transparent ${r - 26}%, #FF6A00cc ${r - 15}%, #FFE2A8 ${r - 9}%, #FF3D00aa ${r - 4}%, transparent ${r + 2}%)`; G.burnEl.style.opacity = G.burn; } else G.burnEl.style.opacity = 0;
    if (G.progEl) G.progEl.style.width = (t / G.duration * 100) + '%';
    if (G.captions) {
      const ch = G.capChunks.find(c => t >= c.t0 - .05 && t <= c.t1 + .25);
      if (ch !== G._lastChunk) { G._lastChunk = ch; const ci = G.capChunks.indexOf(ch); G.capEl.innerHTML = ch ? `<div class="cap${G.capStyle === 'voxedit' && ci % 3 === 2 ? ' alt' : ''}">${ch.words.map((w, i) => `<span class="cw${w.box ? ' box' : ''}" data-i="${i}">${esc(w.w)}</span>`).join(' ')}</div>` : ''; }
      if (ch) { const scA = G.scenes[active[active.length - 1]]; const top = scA && (scA.s.captionsAt === 'top' || (scA.s.captionsAt == null && (scA.s.cast || []).length && G.capStyle !== 'subtitle'));
        if (top) { G.capEl.style.top = (G.H > G.W ? G.H * .12 : G.H * .08) + 'px'; G.capEl.style.bottom = 'auto'; } else { G.capEl.style.top = 'auto'; if (!G.lbH) G.capEl.style.bottom = G.capBase + 'px'; }
        const spans = G.capEl.querySelectorAll('.cw'); ch.words.forEach((w, i) => { if (!spans[i]) return; spans[i].classList.toggle('on', t >= w.t0 && t < w.t1); spans[i].classList.toggle('done', t >= w.t1); }); const capDiv = G.capEl.firstChild;
        if (G.capStyle === 'voxedit') {
          ch.words.forEach((w, i) => { const sp = spans[i]; if (!sp) return; const k = prog(t, w.t0 - .04, .22); sp.style.opacity = k > 0 ? 1 : 0; sp.style.transform = `translateY(${(1 - E.outExpo(k)) * G.u * 1.6}px) scale(${lerp(1.18, 1, E.outExpo(k))})`; sp.style.filter = k < 1 ? `blur(${(1 - k) * G.u * .25}px)` : ''; });
          capDiv.style.opacity = 1; capDiv.style.transform = '';
        } else if (G.capStyle === 'viral') {
          const pal = (THEMES[G.themeName] || {}).pal || ['#FFD21F']; const ci = G.capChunks.indexOf(ch); capDiv.style.setProperty('--capc', pal[ci % pal.length]);
          ch.words.forEach((w, i) => { const sp = spans[i]; if (!sp) return; const k = prog(t, w.t0 - .03, .16); sp.style.opacity = k > 0 ? 1 : 0; const on = t >= w.t0 && t < w.t1; sp.style.transform = `scale(${lerp(1.45, on ? 1.14 : 1, E.outBack(k))}) rotate(${on ? -2 : 0}deg)`; });
          capDiv.style.opacity = 1; capDiv.style.transform = '';
        } else if (G.capStyle === 'cinema' || G.capStyle === 'subtitle') { const k = E.out(prog(t, ch.t0 - .08, .3)); capDiv.style.transform = `translateY(${(1 - k) * G.u * .8}px)`; capDiv.style.opacity = k; capDiv.style.filter = k < 1 ? `blur(${(1 - k) * G.u * .3}px)` : ''; if (G.capStyle === 'subtitle') capDiv.style.maxWidth = '72%'; }
        else { const k = prog(t, ch.t0 - .05, .18); capDiv.style.transform = `translateY(${(1 - E.outBack(k)) * G.u * 2}px) scale(${lerp(.92, 1, E.outBack(k))})`; capDiv.style.opacity = k; } }
    }
    if (pending.length) await Promise.all(pending);
    return true;
  };
  V.info = () => ({ duration: G.duration, events: G.events });
})();
