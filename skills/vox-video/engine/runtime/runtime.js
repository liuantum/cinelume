/* =====================================================================
   VOX-STYLE MOTION RUNTIME
   Deterministic, frame-accurate explainer-video engine.
   Every pixel is a pure function of time t, so headless capture is exact.
   API:  VOX.init(storyboard, {W,H,fps,assets}) -> {duration, events, scenes}
         VOX.seek(t) -> Promise (resolves when frame is fully painted)
   ===================================================================== */
(function () {
  'use strict';
  const V = (window.VOX = {});

  /* ---------------- math & easing ---------------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, d) => (d <= 0 ? (t >= a ? 1 : 0) : clamp((t - a) / d));
  const E = {
    linear: p => p,
    in: p => p * p * p,
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
  };
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

  /* ---------------- stickers ---------------- */
  function stickerSVG(type, color, th) {
    const S = window.VOX_STICKERS || {};
    const def = S[type] || S.star;
    const C = color || th.accent;
    const svg = def.svg.replace(/"C"/g, `"${C}"`).replace(/"K"/g, `"${th.ink === '#F3EEE4' || th.ink === '#EAF2FF' || th.ink === '#F6F1E7' || th.ink === '#FFF6EC' ? '#141414' : th.ink}"`).replace(/"H"/g, `"${th.hl}"`).replace(/"W"/g, '"#FFFFFF"');
    const vb = def.wide ? '0 0 100 100' : '0 0 100 100';
    return { html: `<svg viewBox="${vb}" preserveAspectRatio="${def.wide ? 'none' : 'xMidYMid meet'}">${svg}</svg>`, def };
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
  };
  V.FX = FX;

  class Item {
    constructor(el, o, scene) {
      this.el = el; this.o = Object.assign({ at: 0, fx: 'rise', dur: 0.55, idle: null, rot: 0, scale: 1, center: false, seed: Math.random() * 10 }, o || {});
      this.scene = scene;
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
        if (o.idle === 'bob') { ty += Math.sin(it * 2 + o.seed) * 0.6 * u; r += Math.sin(it * 1.3 + o.seed) * 1.5; }
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
    const sw = Math.max(3, fs * 0.075);
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
    if (m.kind === 'hl') m.el.style.backgroundSize = `${E.inOut(k) * 100}% 62%`;
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
      case 'spiral-in': return mk(t => ({ z: lerp(1.6, 1.02, E.outExpo(clamp(t / 1.2))), r: lerp(-10, 0, E.outExpo(clamp(t / 1.2))) }));
      default: return mk(t => ({ z: lerp(1.02, 1.08, L(t)) }));
    }
  }

  /* ---------------- transitions ---------------- */
  const TRANS_DUR = { cut: 0, 'whip-left': .5, 'whip-right': .5, 'whip-up': .5, 'whip-down': .5, 'zoom-through': .6, iris: .7, 'paper-slide': .7, tear: .7, push: .6, flash: .4, glitch: .45, stack: .7, spin: .7, 'wipe-diagonal': .6, 'circle-burst': .7, fade: .6, 'blinds': .7, 'zoom-out': .6, 'slide-up': .6 };
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
      case 'fade': default: B.style.opacity = E.inOut(p);
    }
  }
  function setMB(axis, amt) { const f = document.getElementById('mbf' + axis); if (f) f.setAttribute('stdDeviation', axis === 'x' ? `${amt} 0` : `0 ${amt}`); }

  /* ---------------- scene context ---------------- */
  function makeCtx(s, idx) {
    const th = Object.assign({}, THEMES[s.theme || G.themeName] || THEMES.paper, s.colors || {});
    const wrap = h('div', 'scene');
    for (const k in th) wrap.style.setProperty('--' + k, th[k]);
    wrap.style.setProperty('--u', G.u + 'px');
    const cam = h('div', 'cam'); wrap.appendChild(cam);
    const layers = {};
    [['bg', .35], ['mid', 1], ['fg', 1.3]].forEach(([n, d]) => { const l = h('div', 'layer'); l.dataset.depth = d; cam.appendChild(l); layers[n] = l; });
    layers.bg.style.inset = '-12%';
    const ovl = h('div', 'ovl'); wrap.appendChild(ovl); // non-camera overlay (lower thirds, source)
    const c = {
      s, idx, th, wrap, cam, layers, ovl, items: [], marks: [], updates: [], post: [], medias: [], events: [],
      W: G.W, H: G.H, u: G.u, portrait: G.H > G.W, square: G.H === G.W,
      dur: s.duration,
      add(el, layer, o) { (layers[layer || 'mid'] || layers.mid).appendChild(el); if (o) c.items.push(new Item(el, o, c)); return el; },
      item(el, o) { const it = new Item(el, o, c); c.items.push(it); return it; },
      onUpdate(f) { c.updates.push(f); },
      postLayout(f) { c.post.push(f); },
      sfx(name, at, vol) { c.events.push({ name, at, vol }); },
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
    { const cf = cameraFn(s.camera, s.duration || 4); let zm = 1; for (let i = 0; i <= 40; i++) { const v = cf((s.duration || 4) * i / 40); zm = Math.max(zm, v.z * (v.fgZ || 1) + Math.abs(v.x) * 2 + Math.abs(v.y) * 2); }
      zm = Math.min(zm, 1.4); if (zm > 1.02) { const cx = (c.safe.l + c.safe.r) / 2, cy = (c.safe.t + c.safe.b) / 2, hw = (c.safe.r - c.safe.l) / 2 / zm, hh = (c.safe.b - c.safe.t) / 2 / Math.max(1, zm * .92); c.safe.l = cx - hw; c.safe.r = cx + hw; c.safe.t = Math.min(c.safe.t, cy - hh) === c.safe.t ? cy - hh : c.safe.t; c.safe.b = cy + hh; } c.zmax = zm; }
    c.safe.w = c.safe.r - c.safe.l; c.safe.h = c.safe.b - c.safe.t; c.safe.cx = (c.safe.l + c.safe.r) / 2; c.safe.cy = (c.safe.t + c.safe.b) / 2;
    c.box = (style) => { const b = h('div', 'abs'); Object.assign(b.style, { left: c.safe.l + 'px', top: c.safe.t + 'px', width: c.safe.w + 'px', height: c.safe.h + 'px' }, style || {}); return b; };
    return c;
  }

  function addSticker(c, st) {
    if (typeof st === 'string') st = { type: st };
    const u = G.u;
    const S = (window.VOX_STICKERS || {})[st.type] || {};
    const size = (st.size || (S.wide ? 22 : 12)) * u;
    const el = h('div', 'stk' + (st.outline === false || S.draw ? '' : ' cutout'));
    const w = size * (S.wide ? (st.aspect || 2.4) : 1), hh = size;
    Object.assign(el.style, { width: w + 'px', height: hh + 'px', left: `calc(${st.x != null ? st.x : 80}% - ${w / 2}px)`, top: `calc(${st.y != null ? st.y : 25}% - ${hh / 2}px)`, zIndex: 20 });
    const { html } = stickerSVG(st.type, st.color, c.th);
    el.innerHTML = html;
    if (st.text) { const tx = h('div', 'stxt' + (S.font === 'marker' ? ' marker' : ''), { fontSize: (st.textSize || (S.wide ? .34 : .22)) * hh + 'px', color: st.textColor || (S.txt === 'K' ? '#141414' : '#fff'), padding: S.wide ? '0 12%' : '14%' }, esc(st.text)); if (S.font === 'marker') tx.style.fontFamily = 'Marker'; el.appendChild(tx); }
    c.add(el, st.layer || 'fg');
    const it = c.item(el, { at: st.at != null ? st.at : .8, fx: st.fx || (S.draw ? 'none' : 'popBig'), dur: st.dur || .5, rot: st.rot != null ? st.rot : (S.draw ? 0 : ((idHash(st.type + st.x) % 17) - 8)), idle: st.idle !== undefined ? st.idle : (S.draw ? null : 'wiggle'), out: st.out });
    if (S.draw) { it.draws = [...el.querySelectorAll('path')]; it.o.drawDur = st.dur || .6; c.sfx('scribble', it.o.at, .5); }
    else c.sfx('pop', it.o.at, .7);
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
    if (s.media) { const m = c.media(s.media, { label: s.mediaLabel }); Object.assign(m.style, { position: 'absolute', inset: 0 }); const holder = h('div', 'fill look-' + (s.look || 'duotone')); holder.appendChild(m); holder.style.opacity = .35; c.add(holder, 'bg'); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
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
    const num = h('div', 'headline', { fontSize: (s.size || (c.portrait ? 26 : 24)) * u + 'px', color: s.color || 'var(--ink)', lineHeight: .95, whiteSpace: 'nowrap' });
    const numWrap = h('span', 'm-hl', { backgroundSize: '0% 62%' }); numWrap.appendChild(num); num.style.display = 'inline-block';
    box.appendChild(numWrap);
    const from = s.from || 0, to = Number(s.value != null ? s.value : 100), dec = s.decimals != null ? s.decimals : (String(to).includes('.') ? String(to).split('.')[1].length : 0);
    const cStart = .3, cDur = Math.min(s.countDur || 1.8, c.dur * .5);
    c.item(num, { at: .15, fx: 'zoom', dur: .5 });
    c.onUpdate(lt => { const p = E.outExpo(prog(lt, cStart, cDur)); num.textContent = (s.prefix || '') + fmtNum(lerp(from, to, p), dec, s.separator !== false) + (s.suffix || ''); numWrap.style.backgroundSize = `${E.inOut(prog(lt, cStart + cDur, .45)) * 100}% 40%`; });
    c.sfx('tick-roll', cStart, .4); c.sfx('ding', cStart + cDur, .8);
    if (s.label) { const l = h('div', 'sans-x', { fontSize: (c.portrait ? 5 : 4.4) * u + 'px', maxWidth: '92%' }); box.appendChild(l); c.text(l, s.label, { at: cStart + .4, stagger: .05 }); }
    if (s.sub) { const sb = h('div', 'body', { fontSize: 2.8 * u + 'px', opacity: .75, maxWidth: '80%' }, esc(s.sub)); box.appendChild(sb); c.item(sb, { at: cStart + cDur, fx: 'rise' }); }
    c.add(box);
    c.postLayout(() => fitText(num, c.safe.w, c.safe.h * .55));
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
      const vl = h('div', 'abs headline', { fontSize: u * 4.2 + 'px', whiteSpace: 'nowrap', transform: 'translate(-50%,-140%)' });
      area.appendChild(dot); area.appendChild(vl);
      const dStart = .5, dDur = Math.max(1.2, c.dur * .55);
      const len = line.getTotalLength();
      const anns = (s.annotations || []).map(a => {
        const i = a.index != null ? a.index : pts.findIndex(p => p.x == a.x || p.label == a.x);
        const ax = X(Math.max(0, i)), ay = Y(ys[Math.max(0, i)]);
        const vline = sv('line', { x1: ax, x2: ax, y1: ay, y2: Hc - padB, stroke: c.th.ink, 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: 0 }, svg);
        const note = h('div', 'abs marker', { left: ax + 'px', top: Math.max(0, ay - u * 13) + 'px', background: c.th.hl, color: '#141414', padding: `${u * .8}px ${u * 1.4}px`, fontSize: u * 2.6 + 'px', transformOrigin: '0 100%', boxShadow: '0 4px 10px rgba(0,0,0,.2)', maxWidth: u * 30 + 'px' }, esc(a.text));
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
    const mid = h('div', 'headline', { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .24 + 'px' });
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
    const W = window.VOX_WORLD; if (!W || !name) return null;
    const n = String(name).toLowerCase().trim(); const nn = (COUNTRY_ALIAS[n] || name).toLowerCase();
    return W.countries.find(c => c.n.toLowerCase() === nn) || W.countries.find(c => c.n.toLowerCase().startsWith(nn)) || null;
  }
  function countryBounds(cn) { const o = BOUNDS_OVERRIDE[cn.n]; if (o) { const a = LL(o[0], o[3]), b = LL(o[2], o[1]); return [a[0], a[1], b[0], b[1]]; } return cn.b; }
  SC.map = (s, c) => {
    const u = c.u, Wd = window.VOX_WORLD; const W = c.W, H = c.H;
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
        const lab = h('div', 'abs', { transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', fontFamily: 'Anton', textTransform: 'uppercase', fontSize: u * 2.8 + 'px', background: c.th.ink, color: c.th.bg, padding: `${u * .3}px ${u * 1}px`, zIndex: 5 }, esc(hi.label));
        labelLayer.appendChild(lab); hi.el = lab; c.item(lab, { at: hi.at + .25, fx: 'pop', center: true });
      }
    });
    const pinEls = pinsSpec.map((p, i) => {
      const el = h('div', 'abs', { width: u * 5 + 'px', height: u * 5 + 'px', zIndex: 6 }); el.innerHTML = stickerSVG('pin', p.color || c.th.accent, c.th).html; labelLayer.appendChild(el);
      const lab = p.label ? h('div', 'abs marker', { fontSize: u * 2.6 + 'px', whiteSpace: 'nowrap', background: c.th.hl, color: '#141414', padding: `${u * .2}px ${u * .8}px`, zIndex: 7 }, esc(p.label)) : null;
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
      const holder = h('div', 'fill look-' + (s.look || 'color')); const m = c.media(s.media || s.image || s.video, { label: s.label || s.caption }); m.style.position = 'absolute'; m.style.inset = 0; holder.appendChild(m); c.add(holder, 'bg');
      c.layers.bg.style.inset = '-4%';
      c.onUpdate(lt => updateMedia(m, lt, c.dur));
    } else {
      const fw = c.portrait ? c.safe.w * .9 : Math.min(c.safe.w * .6, c.safe.h * 1.25), fh = style === 'circle' ? fw : fw * (s.aspect ? 1 / s.aspect : (c.portrait ? 1.05 : .68));
      const fr = h('div', style === 'circle' ? 'photo' : 'photo', { width: fw + 'px', height: fh + 'px', left: (c.portrait ? c.W / 2 : (s.align === 'left' ? c.safe.l + fw / 2 : c.safe.cx + (s.caption ? c.safe.w * .12 : 0))) - fw / 2 + 'px', top: (c.portrait ? c.safe.t + c.safe.h * .42 : c.safe.cy) - fh / 2 + 'px', borderRadius: style === 'circle' ? '50%' : '0' });
      const look = h('div', 'img look-' + (s.look || 'color'), { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: style === 'circle' ? '50%' : '0' });
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
      const look = h('div', 'img look-' + (s.look || it.look || 'color'), { width: '100%', height: '100%' });
      const m = c.media(it.src || it.media, { label: it.label }); Object.assign(m.style, { position: 'absolute', inset: 0 }); look.appendChild(m); fr.appendChild(look);
      if (it.label) { const lb = h('div', 'abs marker', { left: '50%', bottom: -u * 2 + 'px', transform: 'translateX(-50%) rotate(-2deg)', background: c.th.hl, color: '#141414', padding: `${u * .3}px ${u * 1}px`, fontSize: u * 2.4 + 'px', whiteSpace: 'nowrap' }, esc(it.label)); fr.appendChild(lb); }
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
    if (s.media) { const sz = c.portrait ? c.safe.w * .42 : c.safe.h * .55; const fr = h('div', 'photo', { position: 'relative', width: sz + 'px', height: sz + 'px', borderRadius: '50%', flex: 'none', padding: u * .8 + 'px' }); const lk = h('div', 'img look-' + (s.look || 'duotone'), { width: '100%', height: '100%', borderRadius: '50%' }); const m = c.media(s.media, { label: s.author }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk); box.appendChild(fr); c.item(fr, { at: .05, fx: 'pop', dur: .6 }); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
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
      if (e.media) { const fr = h('div', 'photo', { position: 'relative', width: spacing * .6 + 'px', height: spacing * .38 + 'px', padding: u * .5 + 'px' }); const lk = h('div', 'img look-' + (e.look || 'color'), { width: '100%', height: '100%' }); const m = c.media(e.media, { label: e.label }); Object.assign(m.style, { position: 'absolute', inset: 0 }); lk.appendChild(m); fr.appendChild(lk); card.appendChild(fr); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
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
      const p = h('div', 'card', { flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 1.4 + 'px', padding: u * 3 + 'px', textAlign: 'center', borderTop: `${u * 1.2}px solid ${col}` });
      if (side.media) { const fr = h('div', 'img look-' + (side.look || 'color'), { width: '70%', aspectRatio: '16/10', position: 'relative', borderRadius: u + 'px', flex: 'none' }); const m = c.media(side.media, { label: side.title }); Object.assign(m.style, { position: 'absolute', inset: 0 }); fr.appendChild(m); p.appendChild(fr); c.onUpdate(lt => updateMedia(m, lt, c.dur)); }
      else if (side.icon) { const ic = h('div', null, { width: u * (c.portrait ? 10 : 14) + 'px', height: u * (c.portrait ? 10 : 14) + 'px' }); ic.innerHTML = stickerSVG(side.icon, col, c.th).html; p.appendChild(ic); }
      const t = h('div', 'headline', { fontSize: u * (c.portrait ? 6 : 5.4) + 'px' }, esc(side.title || '')); p.appendChild(t);
      if (side.value != null) { const v = h('div', 'headline', { fontSize: u * (c.portrait ? 10 : 11) + 'px', color: col, lineHeight: 1 }); p.appendChild(v); const dec = String(side.value).includes('.') ? 1 : 0; const at = .7 + i * .3; c.onUpdate(lt => { v.textContent = (side.prefix || '') + fmtNum(side.value * E.outExpo(prog(lt, at, 1.2)), dec) + (side.suffix || ''); }); c.sfx('ding', at + 1.2, .4); }
      if (side.label) p.appendChild(h('div', 'body', { fontSize: u * 2.6 + 'px', opacity: .8 }, esc(side.label)));
      (side.points || []).forEach((pt, j) => { const d = h('div', 'body', { fontSize: u * 2.4 + 'px' }, `<span style="color:${col}">●</span> ${esc(pt)}`); p.appendChild(d); c.item(d, { at: 1.2 + i * .3 + j * .2, fx: 'rise' }); });
      box.appendChild(p); c.item(p, { at: .1 + i * .25, fx: i ? 'slideR' : 'slideL', dur: .7 });
    });
    c.add(box);
    addSticker(c, { type: 'burst', text: s.vs || 'VS', x: 50, y: c.portrait ? (c.safe.cy / c.H * 100) : 50, size: c.portrait ? 12 : 13, at: .6, color: c.th.hl, textColor: '#141414', fx: 'stamp' });
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
      const num = h('div', 'headline', { flex: 'none', width: u * 7 + 'px', height: u * 7 + 'px', borderRadius: '50%', background: s.style === 'check' ? 'transparent' : c.th.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: u * 3.8 + 'px', position: 'relative' });
      if (s.style === 'check') { num.innerHTML = stickerSVG('check', c.th.teal, c.th).html; const it2 = c.item(num, { at, fx: 'none' }); it2.draws = [...num.querySelectorAll('path')]; it2.o.drawDur = .4; }
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
      const hd = h('div', 'fill look-' + (s.look || it.look || 'color')); const m = c.media(it.src, { label: it.label || s.label }); m.style.position = 'absolute'; m.style.inset = 0; hd.appendChild(m); c.add(hd, 'bg');
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
    const lk = h('div', 'img look-' + (s.look || 'color'), { width: '100%', height: '100%' });
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
      const ic = h('div', 'card', { width: nodeSize + 'px', height: nodeSize + 'px', padding: nodeSize * .16 + 'px', flex: 'none', border: `${u * .4}px solid var(--ink)` }); ic.innerHTML = stickerSVG(it.icon || guessIcon(it.label), it.color, c.th).html;
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
     DEFAULT DURATIONS
     ===================================================================== */
  const DEF_DUR = { title: 4, kinetic: 4, bignumber: 4.5, bar: 6, line: 6.5, donut: 5, icongrid: 5.5, map: 6.5, photo: 5, collage: 5.5, document: 6, quote: 5.5, timeline: 7, compare: 6, list: 6, chapter: 2.8, screen: 5.5, broll: 4.5, explain: 6, flow: 6, outro: 4 };
  const words = s => String(s || '').replace(/[=*_\[\]{}~]/g, '').split(/\s+/).filter(Boolean).length;

  /* =====================================================================
     INIT / SEEK
     ===================================================================== */
  V.init = function (sb, opt) {
    const W = opt.W, H = opt.H, u = Math.min(W, H) / 100;
    G = { W, H, u, fps: opt.fps || 30, sb, assets: opt.assets || {}, themeName: (sb.meta && sb.meta.theme) || 'paper', captions: (sb.meta && sb.meta.captions) !== false && (sb.meta && sb.meta.captions) !== 'none', capStyle: (sb.meta && typeof sb.meta.captions === 'string') ? sb.meta.captions : (H > W ? 'karaoke' : 'boxed'), flash: 0 };
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
    const autoTrans = ['whip-left', 'paper-slide', 'zoom-through', 'whip-up', 'iris', 'tear', 'push', 'stack', 'whip-right', 'wipe-diagonal'];
    list.forEach((s0, i) => {
      const s = Object.assign({}, s0.data || {}, s0);
      if (!SC[s.type]) { console.warn('unknown scene type', s.type); s.type = 'title'; s.headline = s.headline || s.text || s.type; }
      const nw = words(s.narration);
      s.duration = s.duration || Math.max(DEF_DUR[s.type] || 4.5, nw / 2.6 + 1.0);
      const c = makeCtx(s, i);
      c.wrap.appendChild(c.ovl);
      c.layers.bg.appendChild(buildBg(s.bg || (sb.meta && sb.meta.bg) || 'paper', c));
      SC[s.type](s, c);
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
      if (trName !== 'cut' && next) events.push({ t: t + s.duration - td * .6, name: trName.startsWith('whip') || trName === 'push' ? 'whoosh' : trName === 'flash' || trName === 'glitch' ? 'hit' : trName === 'paper-slide' || trName === 'tear' || trName === 'stack' ? 'paper' : 'whoosh-soft', vol: .8 });
      if (s.camera === 'crash-zoom' || s.camera === 'shake-hit') events.push({ t: t + .05, name: 'boom', vol: .7 });
      (s.sfx || []).forEach(e => events.push({ t: t + (e.at || 0), name: e.type || e.name, vol: e.vol || .8 }));
      t += s.duration - (next ? td : 0);
    });
    G.scenes = scenes; G.duration = t; G.events = events.sort((a, b) => a.t - b.t);
    // overlay
    const grain = h('div'); grain.id = 'grain'; stage.appendChild(grain);
    G.grainUrls = [0, 1, 2, 3].map(i => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const id = x.createImageData(256, 256); const r = rng(i * 11 + 5); for (let p = 0; p < id.data.length; p += 4) { const v = 128 + (r() - .5) * 255; id.data[p] = id.data[p + 1] = id.data[p + 2] = v; id.data[p + 3] = 255; } x.putImageData(id, 0, 0); return cv.toDataURL(); });
    G.grainEl = grain; G.grainOn = (sb.meta && sb.meta.grain) !== false;
    if ((sb.meta && sb.meta.vignette) !== false) { const vg = h('div'); vg.id = 'vignette'; stage.appendChild(vg); }
    const fl = h('div'); fl.id = 'flash'; stage.appendChild(fl); G.flashEl = fl;
    const cap = h('div', 'cap-' + G.capStyle); cap.id = 'captions'; cap.style.bottom = (H > W ? H * .1 : H * .055) + 'px'; cap.style.fontSize = (H > W ? u * 6 : u * 4.2) + 'px'; stage.appendChild(cap); G.capEl = cap;
    if (sb.meta && sb.meta.handle) { const wm = h('div', null, { top: u * 3 + 'px', right: u * 3.5 + 'px', fontSize: u * 2.2 + 'px', color: 'var(--ink)' }, esc(sb.meta.handle)); wm.id = 'wm'; stage.appendChild(wm); }
    if (sb.meta && sb.meta.progress) { const pr = h('div'); pr.id = 'progress'; stage.appendChild(pr); G.progEl = pr; }
    // captions model
    G.capChunks = [];
    if (G.captions) scenes.forEach(sc => {
      const txt = String(sc.s.narration || '').replace(/==|\*\*|__|\[\[|\]\]|~~|\{\{|\}\}/g, '');
      const ws = txt.split(/\s+/).filter(Boolean); if (!ws.length) return;
      const vs = sc.start + (sc.s.voStart != null ? sc.s.voStart : .15), ve = sc.start + (sc.s.voDur ? sc.s.voStart + sc.s.voDur : sc.dur - .25);
      const weights = ws.map(w => w.length + 2), tot = weights.reduce((a, b) => a + b, 0);
      let acc = vs; const timed = ws.map((w, i) => { const d = (ve - vs) * weights[i] / tot; const o = { w, t0: acc, t1: acc + d }; acc += d; return o; });
      const per = H > W ? 4 : 7;
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
    G.flash = 0;
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
    if (G.progEl) G.progEl.style.width = (t / G.duration * 100) + '%';
    if (G.captions) {
      const ch = G.capChunks.find(c => t >= c.t0 - .05 && t <= c.t1 + .25);
      if (ch !== G._lastChunk) { G._lastChunk = ch; G.capEl.innerHTML = ch ? `<div class="cap">${ch.words.map((w, i) => `<span class="cw" data-i="${i}">${esc(w.w)}</span>`).join(' ')}</div>` : ''; }
      if (ch) { const spans = G.capEl.querySelectorAll('.cw'); ch.words.forEach((w, i) => spans[i] && spans[i].classList.toggle('on', t >= w.t0 && t < w.t1)); const capDiv = G.capEl.firstChild; const k = prog(t, ch.t0 - .05, .18); capDiv.style.transform = `translateY(${(1 - E.outBack(k)) * G.u * 2}px) scale(${lerp(.92, 1, E.outBack(k))})`; capDiv.style.opacity = k; }
    }
    if (pending.length) await Promise.all(pending);
    return true;
  };
  V.info = () => ({ duration: G.duration, events: G.events });
})();
