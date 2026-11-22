/* Sticker + icon library. viewBox 0 0 100 100. Tokens: C=main color, K=ink, H=highlight, W=white.
   draw:true stickers are line-art and animate by stroke drawing ("hand drawn" reveal). */
(function () {
  const S = {};
  const face = (inner, fill) => `<circle cx="50" cy="50" r="44" fill="${fill || 'H'}" stroke="K" stroke-width="5"/>${inner}`;
  // ---------- hand-drawn annotation marks (draw:true) ----------
  S.arrow = { draw: true, svg: `<path d="M8 78 C 30 70, 55 52, 82 24" fill="none" stroke="C" stroke-width="7" stroke-linecap="round"/><path d="M60 22 L84 21 L80 45" fill="none" stroke="C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` };
  S['arrow-curve'] = { draw: true, svg: `<path d="M10 30 C 20 85, 70 95, 84 52" fill="none" stroke="C" stroke-width="7" stroke-linecap="round"/><path d="M68 60 L85 48 L94 68" fill="none" stroke="C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` };
  S['arrow-straight'] = { draw: true, svg: `<path d="M6 50 L88 50" fill="none" stroke="C" stroke-width="8" stroke-linecap="round"/><path d="M68 30 L90 50 L68 70" fill="none" stroke="C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` };
  S.circle = { draw: true, svg: `<path d="M52 8 C 88 6, 98 40, 92 62 C 84 92, 30 98, 12 72 C -2 50, 14 14, 56 10 C 70 9, 80 14, 86 20" fill="none" stroke="C" stroke-width="5" stroke-linecap="round"/>` };
  S.underline = { draw: true, svg: `<path d="M4 60 C 30 52, 60 66, 96 50 M14 72 C 40 64, 70 72, 90 64" fill="none" stroke="C" stroke-width="6" stroke-linecap="round"/>` };
  S.cross = { draw: true, svg: `<path d="M14 14 L86 86 M86 14 L14 86" fill="none" stroke="C" stroke-width="10" stroke-linecap="round"/>` };
  S.check = { draw: true, svg: `<path d="M12 54 L40 80 L90 18" fill="none" stroke="C" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` };
  S.bracket = { draw: true, svg: `<path d="M30 6 C 12 6, 18 44, 6 50 C 18 56, 12 94, 30 94" fill="none" stroke="C" stroke-width="6" stroke-linecap="round"/>` };
  S.scribble = { draw: true, svg: `<path d="M6 60 C 20 20, 30 90, 44 44 S 66 80, 74 36 S 92 70, 96 40" fill="none" stroke="C" stroke-width="6" stroke-linecap="round"/>` };
  S.sparkle = { svg: `<path d="M50 4 C 54 38, 62 46, 96 50 C 62 54, 54 62, 50 96 C 46 62, 38 54, 4 50 C 38 46, 46 38, 50 4Z" fill="H" stroke="K" stroke-width="4" stroke-linejoin="round"/>` };
  // ---------- badges / shapes ----------
  S.star = { svg: `<path d="M50 5 L62 36 L95 37 L69 57 L79 90 L50 71 L21 90 L31 57 L5 37 L38 36Z" fill="H" stroke="K" stroke-width="4" stroke-linejoin="round"/>` };
  S.burst = { text: true, svg: `<path d="M50 2 L58 20 L76 8 L76 28 L96 26 L84 42 L100 54 L82 62 L92 80 L72 78 L70 98 L56 84 L44 100 L38 80 L18 90 L22 70 L2 64 L18 50 L4 34 L24 32 L22 12 L40 22Z" fill="C" stroke="K" stroke-width="3" stroke-linejoin="round"/>`, txt: 'W' };
  S.badge = { text: true, svg: `<circle cx="50" cy="50" r="46" fill="C" stroke="K" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="none" stroke="W" stroke-width="2" stroke-dasharray="4 4"/>`, txt: 'W' };
  S.label = { text: true, wide: true, svg: `<path d="M2 14 L84 14 L98 50 L84 86 L2 86Z" fill="C" stroke="K" stroke-width="3" stroke-linejoin="round"/><circle cx="14" cy="50" r="5" fill="W"/>`, txt: 'W' };
  S.banner = { text: true, wide: true, svg: `<rect x="2" y="20" width="96" height="60" fill="C" stroke="K" stroke-width="3"/>`, txt: 'W' };
  S.bubble = { text: true, wide: true, svg: `<path d="M8 10 H92 Q98 10 98 16 V64 Q98 70 92 70 H40 L22 92 L26 70 H8 Q2 70 2 64 V16 Q2 10 8 10Z" fill="W" stroke="K" stroke-width="4" stroke-linejoin="round"/>`, txt: 'K' };
  S.note = { text: true, svg: `<path d="M6 6 H94 V78 L78 94 H6Z" fill="H" stroke="rgba(0,0,0,.25)" stroke-width="1"/><path d="M94 78 L78 78 L78 94Z" fill="rgba(0,0,0,.18)"/>`, txt: 'K', font: 'marker' };
  S.tape = { wide: true, svg: `<path d="M2 30 L98 24 L96 74 L4 78Z" fill="rgba(255,236,170,.85)"/>` };
  S.pin = { svg: `<path d="M50 96 C 50 96, 18 58, 18 38 A32 32 0 0 1 82 38 C 82 58, 50 96, 50 96Z" fill="C" stroke="K" stroke-width="4"/><circle cx="50" cy="38" r="12" fill="W" stroke="K" stroke-width="3"/>` };
  S.pushpin = { svg: `<circle cx="50" cy="34" r="22" fill="C" stroke="K" stroke-width="4"/><path d="M50 56 L50 96" stroke="K" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="27" r="6" fill="rgba(255,255,255,.6)"/>` };
  S.exclaim = { svg: `<circle cx="50" cy="50" r="46" fill="C" stroke="K" stroke-width="4"/><path d="M50 20 L50 60" stroke="W" stroke-width="12" stroke-linecap="round"/><circle cx="50" cy="78" r="7" fill="W"/>` };
  S.question = { svg: `<circle cx="50" cy="50" r="46" fill="C" stroke="K" stroke-width="4"/><path d="M34 36 C 34 18, 66 18, 66 36 C 66 50, 50 50, 50 62" fill="none" stroke="W" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="80" r="6.5" fill="W"/>` };
  S.warning = { svg: `<path d="M50 6 L96 90 H4Z" fill="H" stroke="K" stroke-width="5" stroke-linejoin="round"/><path d="M50 36 L50 62" stroke="K" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="76" r="5.5" fill="K"/>` };
  S.heart = { svg: `<path d="M50 90 C 10 62, 4 40, 14 24 C 26 6, 46 14, 50 28 C 54 14, 74 6, 86 24 C 96 40, 90 62, 50 90Z" fill="C" stroke="K" stroke-width="4" stroke-linejoin="round"/>` };
  S.fire = { svg: `<path d="M50 96 C 22 96, 12 72, 20 52 C 26 38, 36 34, 34 14 C 52 22, 60 36, 58 50 C 64 44, 66 38, 64 30 C 80 44, 88 62, 80 78 C 74 90, 64 96, 50 96Z" fill="#FF6A1F" stroke="K" stroke-width="4" stroke-linejoin="round"/><path d="M50 92 C 38 92, 34 80, 40 70 C 44 62, 50 60, 50 50 C 60 58, 64 70, 60 80 C 58 88, 54 92, 50 92Z" fill="H"/>` };
  S.lightning = { svg: `<path d="M58 4 L18 56 H46 L38 96 L82 40 H54Z" fill="H" stroke="K" stroke-width="4" stroke-linejoin="round"/>` };
  S.rocket = { svg: `<path d="M50 4 C 72 20, 76 50, 66 74 H34 C 24 50, 28 20, 50 4Z" fill="W" stroke="K" stroke-width="4"/><circle cx="50" cy="38" r="9" fill="#5BB8F0" stroke="K" stroke-width="3"/><path d="M34 60 L18 80 L34 76Z M66 60 L82 80 L66 76Z" fill="C" stroke="K" stroke-width="3" stroke-linejoin="round"/><path d="M40 76 C 40 88, 50 96, 50 96 C 50 96, 60 88, 60 76Z" fill="#FF6A1F"/>` };
  S.bulb = { svg: `<path d="M50 6 A30 30 0 0 1 68 60 C 64 64, 62 68, 62 74 H38 C 38 68, 36 64, 32 60 A30 30 0 0 1 50 6Z" fill="H" stroke="K" stroke-width="4"/><path d="M38 80 H62 M40 88 H60" stroke="K" stroke-width="5" stroke-linecap="round"/>` };
  S.clock = { svg: `<circle cx="50" cy="50" r="44" fill="W" stroke="K" stroke-width="5"/><path d="M50 22 V50 L68 62" fill="none" stroke="C" stroke-width="6" stroke-linecap="round"/>` };
  S.lock = { svg: `<path d="M30 44 V32 A20 20 0 0 1 70 32 V44" fill="none" stroke="K" stroke-width="8"/><rect x="18" y="44" width="64" height="50" rx="8" fill="H" stroke="K" stroke-width="4"/><circle cx="50" cy="66" r="7" fill="K"/>` };
  S.dollar = { svg: `<circle cx="50" cy="50" r="44" fill="#3DBE6B" stroke="K" stroke-width="4"/><text x="50" y="68" text-anchor="middle" font-family="Anton" font-size="52" fill="W">$</text>` };
  S.chip = { svg: `<rect x="22" y="22" width="56" height="56" rx="6" fill="#2b2b2b" stroke="K" stroke-width="3"/><rect x="34" y="34" width="32" height="32" rx="3" fill="C"/>${[30, 42, 54, 66].map(p => `<path d="M${p} 22 V8 M${p} 78 V92 M22 ${p} H8 M78 ${p} H92" stroke="K" stroke-width="4" stroke-linecap="round"/>`).join('')}` };
  S.robot = { svg: `<rect x="18" y="28" width="64" height="52" rx="12" fill="#cfd8e3" stroke="K" stroke-width="4"/><circle cx="38" cy="52" r="7" fill="C"/><circle cx="62" cy="52" r="7" fill="C"/><path d="M38 68 H62" stroke="K" stroke-width="4" stroke-linecap="round"/><path d="M50 28 V14" stroke="K" stroke-width="4"/><circle cx="50" cy="11" r="5" fill="C" stroke="K" stroke-width="3"/><rect x="8" y="44" width="10" height="20" rx="3" fill="K"/><rect x="82" y="44" width="10" height="20" rx="3" fill="K"/>` };
  S.globe = { svg: `<circle cx="50" cy="50" r="44" fill="#5BB8F0" stroke="K" stroke-width="4"/><path d="M26 30 C 36 26, 42 36, 36 44 C 30 52, 40 60, 34 70 M60 18 C 56 30, 70 34, 76 42 C 82 52, 70 62, 74 76" fill="none" stroke="#3DBE6B" stroke-width="9" stroke-linecap="round"/><ellipse cx="50" cy="50" rx="20" ry="44" fill="none" stroke="K" stroke-width="2" opacity=".35"/>` };
  S['chart-up'] = { svg: `<rect x="6" y="6" width="88" height="88" rx="10" fill="W" stroke="K" stroke-width="4"/><path d="M18 74 L40 52 L54 62 L82 28" fill="none" stroke="#3DBE6B" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 26 H84 V44" fill="none" stroke="#3DBE6B" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` };
  S['chart-down'] = { svg: `<rect x="6" y="6" width="88" height="88" rx="10" fill="W" stroke="K" stroke-width="4"/><path d="M18 26 L40 48 L54 38 L82 72" fill="none" stroke="C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 74 H84 V56" fill="none" stroke="C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` };
  S.magnifier = { svg: `<circle cx="42" cy="42" r="28" fill="rgba(160,215,255,.6)" stroke="K" stroke-width="8"/><path d="M62 62 L90 90" stroke="K" stroke-width="12" stroke-linecap="round"/>` };
  S.cursor = { svg: `<path d="M20 8 L20 80 L38 64 L50 92 L62 86 L50 60 L74 60Z" fill="W" stroke="K" stroke-width="5" stroke-linejoin="round"/>` };
  S.hand = { svg: `<path d="M40 92 C 26 92, 18 80, 18 66 V48 C 18 42, 28 42, 28 48 V56 M28 52 V18 C 28 10, 40 10, 40 18 V48 M40 44 V38 C 40 32, 52 32, 52 38 V48 M52 46 V42 C 52 36, 64 36, 64 42 V50 M64 50 C 64 44, 76 44, 76 50 V68 C 76 82, 66 92, 54 92Z" fill="#F6C9A0" stroke="K" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` };
  S.person = { svg: `<circle cx="50" cy="24" r="16" fill="C"/><path d="M20 96 V66 C 20 48, 32 42, 50 42 C 68 42, 80 48, 80 66 V96Z" fill="C"/>` };
  S.building = { svg: `<rect x="20" y="16" width="60" height="80" fill="#cfd8e3" stroke="K" stroke-width="4"/>${[28, 44, 60].map(y => [30, 46, 62].map(x => `<rect x="${x}" y="${y}" width="8" height="10" fill="#5BB8F0"/>`).join('')).join('')}<rect x="42" y="76" width="16" height="20" fill="K"/>` };
  S.phone = { svg: `<rect x="26" y="4" width="48" height="92" rx="9" fill="K"/><rect x="30" y="12" width="40" height="72" rx="3" fill="#5BB8F0"/><circle cx="50" cy="90" r="3" fill="#666"/>` };
  S.laptop = { svg: `<rect x="14" y="16" width="72" height="50" rx="4" fill="K"/><rect x="19" y="21" width="62" height="40" fill="#5BB8F0"/><path d="M4 72 H96 L90 82 H10Z" fill="#8a8a8a" stroke="K" stroke-width="3"/>` };
  S.brain = { svg: `<path d="M48 14 C 36 6, 18 14, 20 30 C 8 34, 8 54, 18 58 C 12 72, 26 86, 40 80 C 44 90, 48 90, 48 90 Z M52 14 C 64 6, 82 14, 80 30 C 92 34, 92 54, 82 58 C 88 72, 74 86, 60 80 C 56 90, 52 90, 52 90Z" fill="#F7A6B8" stroke="K" stroke-width="4" stroke-linejoin="round"/><path d="M50 14 V90 M30 38 C 38 40, 40 48, 36 54 M70 38 C 62 40, 60 48, 64 54" fill="none" stroke="K" stroke-width="3"/>` };
  S.money = { wide: true, svg: `<rect x="4" y="22" width="92" height="56" rx="6" fill="#7BC88A" stroke="K" stroke-width="4"/><circle cx="50" cy="50" r="14" fill="none" stroke="K" stroke-width="3"/><text x="50" y="58" text-anchor="middle" font-family="Anton" font-size="22" fill="K">$</text>` };
  S.flag = { svg: `<path d="M18 6 V96" stroke="K" stroke-width="6" stroke-linecap="round"/><path d="M20 10 C 40 2, 56 20, 86 10 V52 C 56 62, 40 44, 20 52Z" fill="C" stroke="K" stroke-width="4" stroke-linejoin="round"/>` };
  S.trophy = { svg: `<path d="M28 8 H72 V36 A22 22 0 0 1 28 36Z" fill="H" stroke="K" stroke-width="4"/><path d="M28 16 H12 C 12 34, 22 38, 30 40 M72 16 H88 C 88 34, 78 38, 70 40" fill="none" stroke="K" stroke-width="4"/><path d="M44 58 H56 V74 H44Z" fill="H" stroke="K" stroke-width="3"/><rect x="30" y="74" width="40" height="16" fill="K"/>` };
  // ---------- emoji-style faces ----------
  S['face-smile'] = { svg: face(`<circle cx="35" cy="40" r="6" fill="K"/><circle cx="65" cy="40" r="6" fill="K"/><path d="M28 58 C 36 78, 64 78, 72 58" fill="none" stroke="K" stroke-width="6" stroke-linecap="round"/>`) };
  S['face-shock'] = { svg: face(`<circle cx="35" cy="38" r="8" fill="W" stroke="K" stroke-width="4"/><circle cx="65" cy="38" r="8" fill="W" stroke="K" stroke-width="4"/><circle cx="35" cy="38" r="3" fill="K"/><circle cx="65" cy="38" r="3" fill="K"/><ellipse cx="50" cy="68" rx="10" ry="13" fill="K"/>`) };
  S['face-think'] = { svg: face(`<path d="M28 34 L42 30 M58 30 L72 34" stroke="K" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="44" r="5" fill="K"/><circle cx="64" cy="44" r="5" fill="K"/><path d="M38 66 H64" stroke="K" stroke-width="6" stroke-linecap="round"/>`) };
  S['face-sad'] = { svg: face(`<circle cx="35" cy="42" r="6" fill="K"/><circle cx="65" cy="42" r="6" fill="K"/><path d="M30 72 C 40 58, 60 58, 70 72" fill="none" stroke="K" stroke-width="6" stroke-linecap="round"/><path d="M68 50 C 64 58, 72 62, 72 56Z" fill="#5BB8F0"/>`) };
  S['face-money'] = { svg: face(`<text x="35" y="50" text-anchor="middle" font-family="Anton" font-size="24" fill="#2E9E55">$</text><text x="65" y="50" text-anchor="middle" font-family="Anton" font-size="24" fill="#2E9E55">$</text><path d="M28 60 C 36 80, 64 80, 72 60Z" fill="K"/>`) };
  S['face-fire'] = { svg: face(`<path d="M24 40 L44 40 M56 40 L76 40" stroke="K" stroke-width="8" stroke-linecap="round"/><path d="M34 64 C 42 72, 58 72, 66 64" fill="none" stroke="K" stroke-width="6" stroke-linecap="round"/>`, '#FFB020') };
  S['face-cool'] = { svg: face(`<path d="M16 36 H84 L80 48 C 76 56, 58 56, 54 46 H46 C 42 56, 24 56, 20 48Z" fill="K"/><path d="M34 66 C 44 74, 60 72, 68 62" fill="none" stroke="K" stroke-width="6" stroke-linecap="round"/>`) };
  S['face-mindblown'] = { svg: face(`<circle cx="35" cy="48" r="6" fill="K"/><circle cx="65" cy="48" r="6" fill="K"/><ellipse cx="50" cy="72" rx="8" ry="9" fill="K"/><path d="M30 10 L36 22 M50 2 L50 18 M70 10 L64 22 M18 22 L28 30 M82 22 L72 30" stroke="#FF6A1F" stroke-width="5" stroke-linecap="round"/>`) };


  // Everything above is the classic cartoon set: still renders, but flagged legacy (the validator
  // warns when it is used with a cinematic theme).
  Object.keys(S).forEach(k => { S[k].legacy = true; });

  /* =====================================================================
     PREMIUM SET (Cinelume). Kinds:
       line  — fine hand-set strokes that draw on (no die-cut, no cartoon fill)
       glass — frosted-glass chips with text / value / icon (rendered as HTML)
       glow  — light objects (pulse, glint, flare, pin) with bloom
       photo — a real photo cut into a circle / rounded tile (uses `media`)
     ===================================================================== */
  const L = (d, w) => `<path d="${d}" fill="none" stroke="C" stroke-width="${w || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // ---- fine annotations (draw on)
  S.ring = { kind: 'line', draw: true, svg: L('M58 9 C 86 10, 97 34, 93 56 C 88 84, 52 96, 26 86 C 4 76, 2 42, 22 22 C 36 9, 60 6, 78 14', 2.6) };
  S['arrow-fine'] = { kind: 'line', draw: true, svg: L('M10 82 C 26 58, 50 34, 86 18', 2.6) + L('M70 15 L87 17 L83 34', 2.6) };
  S['arrow-line'] = { kind: 'line', draw: true, wide: true, svg: `<circle cx="5" cy="50" r="3.2" fill="C"/>` + L('M8 50 L94 50', 2.2) + L('M86 42 L95 50 L86 58', 2.2) };
  S['underline-fine'] = { kind: 'line', draw: true, wide: true, svg: L('M3 56 C 30 50, 66 58, 97 48', 2.4) };
  S['bracket-fine'] = { kind: 'line', draw: true, svg: L('M34 6 C 20 6, 22 44, 10 50 C 22 56, 20 94, 34 94', 2.4) };
  S['cross-fine'] = { kind: 'line', draw: true, svg: L('M20 20 L80 80 M80 20 L20 80', 3) };
  S['check-fine'] = { kind: 'line', draw: true, svg: L('M16 54 L40 76 L86 24', 3.4) };
  S.corners = { kind: 'line', draw: true, svg: L('M4 18 L4 4 L14 4 M86 4 L96 4 L96 18 M96 82 L96 96 L86 96 M14 96 L4 96 L4 82', 2.2) };
  S.focus = { kind: 'line', draw: true, svg: L('M8 30 L8 8 L30 8 M70 8 L92 8 L92 30 M92 70 L92 92 L70 92 M30 92 L8 92 L8 70', 2.2) + L('M50 40 L50 60 M40 50 L60 50', 1.6) };
  S.leader = { kind: 'line', draw: true, wide: true, leader: true, svg: `<circle cx="4" cy="86" r="3.4" fill="C"/>` + L('M4 86 L28 30 L98 30', 1.8) };
  S.seal = { kind: 'line', draw: true, text: true, svg: `<circle cx="50" cy="50" r="45" fill="none" stroke="C" stroke-width="1.6"/><circle cx="50" cy="50" r="39" fill="none" stroke="C" stroke-width="0.8" stroke-dasharray="1.5 2.5"/>`, txt: 'C' };
  S.divider = { kind: 'line', draw: true, wide: true, svg: L('M2 50 L44 50 M56 50 L98 50', 1.4) + `<path d="M50 44 L56 50 L50 56 L44 50Z" fill="C"/>` };
  // ---- glass chips (HTML-rendered; `text`, optional `sub`, `icon`, `value`)
  S.tag = { kind: 'glass', wide: true, text: true };
  S.pill = { kind: 'glass', wide: true, text: true };
  S.stat = { kind: 'glass', text: true, stat: true };
  S.timestamp = { kind: 'glass', wide: true, text: true, mono: true };
  S.rec = { kind: 'glass', wide: true, rec: true };
  S.location = { kind: 'glass', wide: true, text: true, icon: 'icon-pin' };
  // ---- light objects
  S.pulse = { kind: 'glow', pulse: true, svg: `<circle cx="50" cy="50" r="9" fill="C"/><circle class="pr" cx="50" cy="50" r="9" fill="none" stroke="C" stroke-width="1.6"/><circle class="pr" cx="50" cy="50" r="9" fill="none" stroke="C" stroke-width="1.2"/>` };
  S['pin-glow'] = { kind: 'glow', svg: `<path d="M50 94 C 50 94, 24 60, 24 40 A26 26 0 0 1 76 40 C 76 60, 50 94, 50 94Z" fill="C"/><circle cx="50" cy="40" r="9" fill="#fff" fill-opacity=".92"/>` };
  S.glint = { kind: 'glow', svg: `<path d="M50 4 C 52 40, 60 48, 96 50 C 60 52, 52 60, 50 96 C 48 60, 40 52, 4 50 C 40 48, 48 40, 50 4Z" fill="#fff"/><circle cx="50" cy="50" r="6" fill="C"/>` };
  S.flare = { kind: 'glow', wide: true, svg: `<defs><radialGradient id="fl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="C" stop-opacity=".9"/><stop offset="1" stop-color="C" stop-opacity="0"/></radialGradient></defs><ellipse cx="50" cy="50" rx="50" ry="4" fill="url(#fl)"/><circle cx="50" cy="50" r="7" fill="url(#fl)"/>` };
  S.orb = { kind: 'glow', svg: `<defs><radialGradient id="ob" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="C" stop-opacity=".55"/><stop offset="1" stop-color="C" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#ob)"/>` };
  // ---- real photo sticker
  S.photo = { kind: 'photo' };

  /* ---- line icons (consistent 3.2px stroke on a 100 grid). Use as stickers (`icon-chip`) or as
          `icon` in flow / compare / tag / location. Rendered inside a glass disc when used as a sticker. */
  const I = (inner) => ({ kind: 'icon', svg: inner });
  const T = 'fill="none" stroke="C" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"';
  S['icon-chip'] = I(`<g ${T}><rect x="28" y="28" width="44" height="44" rx="6"/><rect x="40" y="40" width="20" height="20" rx="2"/><path d="M38 28V16M50 28V16M62 28V16M38 84V72M50 84V72M62 84V72M28 38H16M28 50H16M28 62H16M84 38H72M84 50H72M84 62H72"/></g>`);
  S['icon-globe'] = I(`<g ${T}><circle cx="50" cy="50" r="36"/><ellipse cx="50" cy="50" rx="15" ry="36"/><path d="M14 50H86M20 32H80M20 68H80"/></g>`);
  S['icon-bolt'] = I(`<g ${T}><path d="M56 10L26 56H48L42 90L74 42H52Z"/></g>`);
  S['icon-shield'] = I(`<g ${T}><path d="M50 10L80 22V48C80 70 64 84 50 90C36 84 20 70 20 48V22Z"/><path d="M38 50L47 59L63 41"/></g>`);
  S['icon-trend-up'] = I(`<g ${T}><path d="M12 74L38 48L52 60L86 26"/><path d="M66 26H86V46"/></g>`);
  S['icon-trend-down'] = I(`<g ${T}><path d="M12 26L38 52L52 40L86 74"/><path d="M66 74H86V54"/></g>`);
  S['icon-dollar'] = I(`<g ${T}><circle cx="50" cy="50" r="36"/><path d="M61 37C59 31 55 29 50 29C44 29 39 32 39 38C39 50 61 45 61 59C61 66 56 70 50 70C44 70 39 67 38 61M50 22V78"/></g>`);
  S['icon-lock'] = I(`<g ${T}><rect x="24" y="44" width="52" height="40" rx="7"/><path d="M35 44V34A15 15 0 0 1 65 34V44"/><path d="M50 60V68"/></g>`);
  S['icon-eye'] = I(`<g ${T}><path d="M8 50C22 26 78 26 92 50C78 74 22 74 8 50Z"/><circle cx="50" cy="50" r="12"/></g>`);
  S['icon-clock'] = I(`<g ${T}><circle cx="50" cy="50" r="36"/><path d="M50 28V50L65 59"/></g>`);
  S['icon-cloud'] = I(`<g ${T}><path d="M30 74H72A17 17 0 0 0 70 40A22 22 0 0 0 28 44A15 15 0 0 0 30 74Z"/></g>`);
  S['icon-user'] = I(`<g ${T}><circle cx="50" cy="35" r="15"/><path d="M20 86C22 66 35 58 50 58C65 58 78 66 80 86"/></g>`);
  S['icon-users'] = I(`<g ${T}><circle cx="38" cy="38" r="13"/><path d="M12 84C14 66 25 58 38 58C51 58 62 66 64 84"/><path d="M62 26A13 13 0 0 1 64 51M70 60C80 62 87 70 88 84"/></g>`);
  S['icon-building'] = I(`<g ${T}><rect x="24" y="16" width="52" height="70" rx="2"/><path d="M36 30H44M56 30H64M36 44H44M56 44H64M36 58H44M56 58H64M44 86V72H56V86M14 86H86"/></g>`);
  S['icon-phone'] = I(`<g ${T}><rect x="31" y="10" width="38" height="80" rx="8"/><path d="M44 78H56"/></g>`);
  S['icon-laptop'] = I(`<g ${T}><rect x="20" y="22" width="60" height="42" rx="4"/><path d="M8 76H92L86 64H14Z"/></g>`);
  S['icon-search'] = I(`<g ${T}><circle cx="44" cy="44" r="25"/><path d="M62 62L86 86"/></g>`);
  S['icon-target'] = I(`<g ${T}><circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="7"/></g>`);
  S['icon-rocket'] = I(`<g ${T}><path d="M50 10C67 23 71 46 62 68H38C29 46 33 23 50 10Z"/><circle cx="50" cy="40" r="7"/><path d="M38 58L25 74L38 72M62 58L75 74L62 72M44 77L50 90L56 77"/></g>`);
  S['icon-spark'] = I(`<g ${T}><path d="M50 12C53 38 62 47 88 50C62 53 53 62 50 88C47 62 38 53 12 50C38 47 47 38 50 12Z"/></g>`);
  S['icon-warning'] = I(`<g ${T}><path d="M50 14L88 82H12Z"/><path d="M50 40V58M50 69V70"/></g>`);
  S['icon-check'] = I(`<g ${T}><circle cx="50" cy="50" r="36"/><path d="M35 51L46 62L67 39"/></g>`);
  S['icon-flag'] = I(`<g ${T}><path d="M26 90V12M26 16H76L65 32L76 48H26"/></g>`);
  S['icon-film'] = I(`<g ${T}><rect x="14" y="24" width="72" height="52" rx="5"/><path d="M14 36H86M14 64H86M26 24V36M40 24V36M54 24V36M68 24V36M26 64V76M40 64V76M54 64V76M68 64V76"/></g>`);
  S['icon-brain'] = I(`<g ${T}><path d="M47 18C36 12 22 20 24 32C14 36 14 52 22 56C16 68 28 82 40 76C42 84 47 84 47 84ZM53 18C64 12 78 20 76 32C86 36 86 52 78 56C84 68 72 82 60 76C58 84 53 84 53 84Z"/><path d="M50 18V84"/></g>`);
  S['icon-drop'] = I(`<g ${T}><path d="M50 12C50 12 24 44 24 62A26 26 0 0 0 76 62C76 44 50 12 50 12Z"/></g>`);
  S['icon-server'] = I(`<g ${T}><rect x="18" y="16" width="64" height="20" rx="4"/><rect x="18" y="40" width="64" height="20" rx="4"/><rect x="18" y="64" width="64" height="20" rx="4"/><path d="M30 26H31M30 50H31M30 74H31"/></g>`);
  S['icon-camera'] = I(`<g ${T}><path d="M14 34H30L36 24H64L70 34H86V78H14Z"/><circle cx="50" cy="55" r="14"/></g>`);
  S['icon-mic'] = I(`<g ${T}><rect x="38" y="10" width="24" height="46" rx="12"/><path d="M26 46A24 24 0 0 0 74 46M50 70V88M36 88H64"/></g>`);
  S['icon-pin'] = I(`<g ${T}><path d="M50 90C50 90 24 60 24 40A26 26 0 0 1 76 40C76 60 50 90 50 90Z"/><circle cx="50" cy="40" r="9"/></g>`);
  S['icon-ship'] = I(`<g ${T}><path d="M12 64H88L78 82H22Z"/><path d="M28 64V44H72V64M40 44V30H60V44"/></g>`);
  S['icon-factory'] = I(`<g ${T}><path d="M12 86V44L32 56V44L52 56V44L72 56V18H86V86Z"/><path d="M26 72H34M46 72H54M66 72H74"/></g>`);
  S['icon-heart'] = I(`<g ${T}><path d="M50 84C18 62 12 44 20 30C30 16 46 20 50 34C54 20 70 16 80 30C88 44 82 62 50 84Z"/></g>`);
  S['icon-key'] = I(`<g ${T}><circle cx="32" cy="50" r="16"/><path d="M48 50H88M76 50V64M64 50V60"/></g>`);
  S['icon-cpu'] = S['icon-chip'];

  /* =====================================================================
     VOX SET (vx-*) — modern glossy die-cut stickers for the Vox animation style:
     gradient fills, specular shine, white die-cut rim (added by CSS), pop + bounce + wiggle.
     ===================================================================== */
  const lg = (id, a, b, c2) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${c2 ? `<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c2}"/>` : `<stop offset="1" stop-color="${b}"/>`}</linearGradient>`;
  const rg = (id, a, b, c2) => `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/>${c2 ? `<stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c2}"/>` : `<stop offset="1" stop-color="${b}"/>`}</radialGradient>`;
  const shine = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".42" transform="rotate(${rot || 0} ${cx} ${cy})"/>`;
  const V = (svg, extra) => Object.assign({ kind: 'vox', svg }, extra || {});
  const faceBase = `<defs>${rg('fb', '#FFF1A6', '#FFC21A', '#F39200')}</defs><circle cx="50" cy="52" r="44" fill="url(#fb)" stroke="#D97800" stroke-width="2"/>` + shine(34, 30, 14, 8, -25);
  S['vx-fire'] = V(`<defs>${lg('g', '#FFE45C', '#FF8A00', '#FF2D55')}${lg('h', '#FFF7B0', '#FFC300')}</defs><path d="M50 96 C24 96 12 76 18 56 C22 42 34 36 34 16 C50 24 60 38 58 52 C64 46 67 39 65 30 C82 44 90 62 82 78 C76 90 64 96 50 96Z" fill="url(#g)" stroke="#D0164E" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 92 C38 92 33 80 38 70 C42 62 49 59 50 48 C60 56 65 68 61 78 C59 87 55 92 50 92Z" fill="url(#h)"/>` + shine(32, 60, 4.5, 11, 20));
  S['vx-bolt'] = V(`<defs>${lg('g', '#FFF36B', '#FFC400', '#FF9500')}</defs><path d="M58 4 L18 56 H46 L38 96 L82 40 H54Z" fill="url(#g)" stroke="#D97800" stroke-width="3" stroke-linejoin="round"/>` + shine(40, 34, 4, 12, 35));
  S['vx-star'] = V(`<defs>${lg('g', '#FFF08A', '#FFC21A', '#FF9F00')}</defs><path d="M50 5 L62 36 L95 37 L69 57 L79 90 L50 71 L21 90 L31 57 L5 37 L38 36Z" fill="url(#g)" stroke="#D98200" stroke-width="3" stroke-linejoin="round"/>` + shine(42, 34, 6, 10, -20));
  S['vx-heart'] = V(`<defs>${lg('g', '#FF8FB6', '#FF2E63', '#D90045')}</defs><path d="M50 90 C 10 62, 4 40, 14 24 C 26 6, 46 14, 50 28 C 54 14, 74 6, 86 24 C 96 40, 90 62, 50 90Z" fill="url(#g)" stroke="#B5003A" stroke-width="2.5" stroke-linejoin="round"/>` + shine(28, 30, 8, 12, -35));
  S['vx-rocket'] = V(`<defs>${lg('b', '#FFFFFF', '#C5CFDD')}${rg('w', '#B8F0FF', '#2E86FF')}${lg('f', '#FF6B6B', '#C8102E')}${lg('fl', '#FFF06B', '#FF7A00')}</defs><path d="M40 76 C40 90 50 98 50 98 C50 98 60 90 60 76Z" fill="url(#fl)"/><path d="M34 58 L16 80 L34 76Z M66 58 L84 80 L66 76Z" fill="url(#f)" stroke="#8E0B22" stroke-width="2" stroke-linejoin="round"/><path d="M50 4 C72 20 76 50 66 76 H34 C24 50 28 20 50 4Z" fill="url(#b)" stroke="#7A8799" stroke-width="2.5"/><circle cx="50" cy="38" r="10" fill="url(#w)" stroke="#5B6B80" stroke-width="2.5"/>` + shine(41, 26, 3.5, 12, 15));
  S['vx-check'] = V(`<defs>${lg('g', '#5BF09A', '#14B85E')}</defs><rect x="8" y="8" width="84" height="84" rx="22" fill="url(#g)" stroke="#0B8A45" stroke-width="2.5"/><path d="M27 52 L43 68 L74 34" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` + shine(32, 22, 16, 6, -10));
  S['vx-cross'] = V(`<defs>${lg('g', '#FF7B7B', '#E0193A')}</defs><circle cx="50" cy="50" r="42" fill="url(#g)" stroke="#A8001F" stroke-width="2.5"/><path d="M34 34 L66 66 M66 34 L34 66" stroke="#fff" stroke-width="11" stroke-linecap="round"/>` + shine(34, 28, 12, 6, -30));
  S['vx-arrow'] = V(`<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="C"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".9"/></linearGradient></defs><path d="M8 78 C22 50 44 36 68 34 L66 18 L94 42 L66 66 L68 50 C48 50 30 60 20 86Z" fill="C" stroke="#00000033" stroke-width="2" stroke-linejoin="round"/><path d="M8 78 C22 50 44 36 68 34 L66 18 L94 42 L66 66 L68 50 C48 50 30 60 20 86Z" fill="url(#g)" opacity=".35"/>`);
  S['vx-money'] = V(`<defs>${rg('g', '#FFF3A6', '#FFC628', '#E89B00')}</defs><circle cx="50" cy="50" r="43" fill="url(#g)" stroke="#B87600" stroke-width="3"/><circle cx="50" cy="50" r="33" fill="none" stroke="#D18F00" stroke-width="2.5"/><text x="50" y="66" text-anchor="middle" font-family="Manrope,Inter" font-weight="800" font-size="46" fill="#9A6400">$</text>` + shine(34, 28, 12, 6, -30));
  S['vx-rupee'] = V(`<defs>${rg('g', '#FFF3A6', '#FFC628', '#E89B00')}</defs><circle cx="50" cy="50" r="43" fill="url(#g)" stroke="#B87600" stroke-width="3"/><circle cx="50" cy="50" r="33" fill="none" stroke="#D18F00" stroke-width="2.5"/><text x="50" y="66" text-anchor="middle" font-family="Manrope,Inter" font-weight="800" font-size="44" fill="#9A6400">₹</text>` + shine(34, 28, 12, 6, -30));
  S['vx-up'] = V(`<defs>${lg('g', '#5BF09A', '#11A957')}</defs><rect x="8" y="8" width="84" height="84" rx="22" fill="url(#g)" stroke="#0B8A45" stroke-width="2.5"/><path d="M20 70 L40 50 L52 60 L78 32" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 30 H80 V50" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` + shine(32, 22, 16, 6, -10));
  S['vx-down'] = V(`<defs>${lg('g', '#FF7B7B', '#D8102F')}</defs><rect x="8" y="8" width="84" height="84" rx="22" fill="url(#g)" stroke="#A0001C" stroke-width="2.5"/><path d="M20 30 L40 50 L52 40 L78 68" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 70 H80 V50" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` + shine(32, 22, 16, 6, -10));
  S['vx-globe'] = V(`<defs>${rg('g', '#9EDCFF', '#2F86F0', '#1450B8')}</defs><circle cx="50" cy="50" r="44" fill="url(#g)" stroke="#0E3E91" stroke-width="2.5"/><path d="M22 34 C30 26 42 28 44 38 C46 48 36 50 38 60 C40 70 30 74 24 64 C18 54 16 42 22 34Z M58 18 C70 18 80 28 78 38 C76 46 64 42 62 52 C60 62 70 66 68 76 C66 84 56 86 54 76 C52 66 50 52 54 42 C56 34 50 22 58 18Z" fill="#3DDC84" stroke="#139C55" stroke-width="2"/>` + shine(34, 26, 14, 7, -30));
  S['vx-chip'] = V(`<defs>${lg('g', '#454B58', '#1A1D24')}${rg('k', '#FFFFFF', 'C')}</defs>${[30, 42, 54, 66].map(p => `<path d="M${p} 22 V9 M${p} 78 V91 M22 ${p} H9 M78 ${p} H91" stroke="#E7B84B" stroke-width="5" stroke-linecap="round"/>`).join('')}<rect x="20" y="20" width="60" height="60" rx="9" fill="url(#g)" stroke="#0E1014" stroke-width="2.5"/><rect x="34" y="34" width="32" height="32" rx="5" fill="url(#k)"/>` + shine(36, 28, 12, 4, -10));
  S['vx-brain'] = V(`<defs>${lg('g', '#FFB3D1', '#F25C9A')}</defs><path d="M48 14 C36 6 18 14 20 30 C8 34 8 54 18 58 C12 72 26 86 40 80 C44 90 48 90 48 90 Z M52 14 C64 6 82 14 80 30 C92 34 92 54 82 58 C88 72 74 86 60 80 C56 90 52 90 52 90Z" fill="url(#g)" stroke="#B3336B" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 16 V88 M30 38 C38 40 40 48 36 54 M70 38 C62 40 60 48 64 54 M26 64 C32 62 38 66 38 72 M74 64 C68 62 62 66 62 72" fill="none" stroke="#B3336B" stroke-width="2.5" stroke-linecap="round"/>` + shine(30, 26, 8, 5, -30));
  S['vx-bulb'] = V(`<defs>${rg('g', '#FFFDE0', '#FFE14D', '#FFB300')}</defs><path d="M50 6 A30 30 0 0 1 68 60 C 64 64, 62 68, 62 74 H38 C 38 68, 36 64, 32 60 A30 30 0 0 1 50 6Z" fill="url(#g)" stroke="#D98E00" stroke-width="2.5"/><rect x="37" y="74" width="26" height="16" rx="4" fill="#9AA4B5" stroke="#5C6676" stroke-width="2"/><path d="M38 80 H62 M38 85 H62" stroke="#5C6676" stroke-width="2"/>` + shine(40, 22, 6, 10, -25));
  S['vx-trophy'] = V(`<defs>${lg('g', '#FFF08A', '#FFC21A', '#E08A00')}</defs><path d="M28 16 H12 C 12 34, 22 40, 32 42 M72 16 H88 C 88 34, 78 40, 68 42" fill="none" stroke="#D98200" stroke-width="5"/><path d="M26 8 H74 V36 A24 24 0 0 1 26 36Z" fill="url(#g)" stroke="#B86E00" stroke-width="2.5"/><path d="M44 60 H56 V74 H44Z" fill="url(#g)" stroke="#B86E00" stroke-width="2"/><rect x="28" y="74" width="44" height="16" rx="3" fill="#3A2A1A"/>` + shine(38, 20, 5, 10, -15));
  S['vx-target'] = V(`<circle cx="50" cy="50" r="44" fill="#FF3B4E" stroke="#B5001A" stroke-width="2.5"/><circle cx="50" cy="50" r="32" fill="#fff"/><circle cx="50" cy="50" r="20" fill="#FF3B4E"/><circle cx="50" cy="50" r="8" fill="#fff"/>` + shine(34, 26, 12, 6, -30));
  S['vx-clock'] = V(`<defs>${lg('g', '#FF7B7B', '#D8102F')}</defs><circle cx="24" cy="18" r="10" fill="url(#g)"/><circle cx="76" cy="18" r="10" fill="url(#g)"/><circle cx="50" cy="54" r="40" fill="url(#g)" stroke="#A0001C" stroke-width="2.5"/><circle cx="50" cy="54" r="30" fill="#fff"/><path d="M50 34 V54 L64 62" fill="none" stroke="#1B1B1B" stroke-width="5" stroke-linecap="round"/>` + shine(34, 34, 10, 5, -30));
  S['vx-lock'] = V(`<defs>${lg('g', '#FFE873', '#F0A800')}</defs><path d="M30 46 V32 A20 20 0 0 1 70 32 V46" fill="none" stroke="#9AA4B5" stroke-width="9"/><rect x="18" y="44" width="64" height="48" rx="10" fill="url(#g)" stroke="#B37800" stroke-width="2.5"/><circle cx="50" cy="64" r="7" fill="#6B4A00"/><path d="M50 66 V78" stroke="#6B4A00" stroke-width="5" stroke-linecap="round"/>` + shine(32, 54, 10, 4, -10));
  S['vx-india'] = V(`<rect x="8" y="20" width="84" height="60" rx="6" fill="#fff" stroke="#00000022" stroke-width="1.5"/><path d="M8 26 A6 6 0 0 1 14 20 H86 A6 6 0 0 1 92 26 V40 H8Z" fill="#FF9933"/><path d="M8 60 H92 V74 A6 6 0 0 1 86 80 H14 A6 6 0 0 1 8 74Z" fill="#138808"/><circle cx="50" cy="50" r="8" fill="none" stroke="#000080" stroke-width="1.6"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M50 50 L${(50 + 8 * Math.cos(a)).toFixed(1)} ${(50 + 8 * Math.sin(a)).toFixed(1)}" stroke="#000080" stroke-width="1"/>`; }).join('')}` + shine(30, 28, 18, 3, 0), { wide: false });
  // ---- modern 3D-style faces
  S['vx-wow'] = V(faceBase + `<ellipse cx="35" cy="46" rx="8" ry="10" fill="#fff"/><ellipse cx="65" cy="46" rx="8" ry="10" fill="#fff"/><circle cx="36" cy="48" r="4.5" fill="#3B2200"/><circle cx="64" cy="48" r="4.5" fill="#3B2200"/><path d="M24 30 C30 24 38 24 42 28 M58 28 C62 24 70 24 76 30" fill="none" stroke="#6B3D00" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="50" cy="74" rx="9" ry="11" fill="#5A2A00"/><ellipse cx="50" cy="79" rx="6" ry="4" fill="#FF6B81"/>`);
  S['vx-mindblown'] = V(`<defs>${rg('ex', '#FFF6B0', '#FF8A00', '#FF2D55')}</defs><path d="M20 30 L14 8 L32 22 L40 2 L50 22 L62 0 L66 22 L86 8 L80 30Z" fill="url(#ex)" stroke="#D0164E" stroke-width="2" stroke-linejoin="round"/>` + faceBase.replace('cy="52" r="44"', 'cy="58" r="38"') + `<circle cx="37" cy="58" r="5" fill="#3B2200"/><circle cx="63" cy="58" r="5" fill="#3B2200"/><ellipse cx="50" cy="78" rx="8" ry="8" fill="#5A2A00"/>`);
  S['vx-cool'] = V(faceBase + `<defs>${lg('sg', '#3A3A44', '#0B0B10')}</defs><path d="M14 40 H86 L82 52 C78 62 60 62 56 50 H44 C40 62 22 62 18 52Z" fill="url(#sg)"/><path d="M22 44 L34 44 M60 44 L72 44" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-linecap="round"/><path d="M34 70 C42 78 60 78 68 68" fill="none" stroke="#5A2A00" stroke-width="5" stroke-linecap="round"/>`);
  S['vx-think'] = V(faceBase + `<path d="M26 34 L40 30 M60 26 L74 32" stroke="#6B3D00" stroke-width="3.5" stroke-linecap="round"/><circle cx="36" cy="46" r="5" fill="#3B2200"/><circle cx="64" cy="46" r="5" fill="#3B2200"/><path d="M40 70 H60" stroke="#5A2A00" stroke-width="5" stroke-linecap="round"/><path d="M30 92 C28 80 38 74 46 78 L60 80 C64 81 64 86 60 86 L50 86" fill="#FFCC3D" stroke="#D97800" stroke-width="2.5" stroke-linejoin="round"/>`);
  S['vx-laugh'] = V(faceBase + `<path d="M26 44 C30 36 40 36 44 44 M56 44 C60 36 70 36 74 44" fill="none" stroke="#3B2200" stroke-width="4.5" stroke-linecap="round"/><path d="M26 60 H74 C72 80 60 88 50 88 C40 88 28 80 26 60Z" fill="#5A2A00"/><path d="M30 62 H70 V66 H30Z" fill="#fff"/><ellipse cx="50" cy="80" rx="10" ry="5" fill="#FF6B81"/><path d="M14 46 C8 52 10 60 16 60 C22 60 22 52 14 46Z M86 46 C92 52 90 60 84 60 C78 60 78 52 86 46Z" fill="#6EC8FF"/>`);
  S['vx-love'] = V(faceBase + `<path d="M36 52 C26 44 26 36 31 33 C34 31 36 33 36 36 C36 33 38 31 41 33 C46 36 46 44 36 52Z M64 52 C54 44 54 36 59 33 C62 31 64 33 64 36 C64 33 66 31 69 33 C74 36 74 44 64 52Z" fill="#FF2E63"/><path d="M32 66 C40 78 60 78 68 66" fill="none" stroke="#5A2A00" stroke-width="5" stroke-linecap="round"/>`);
  // ---- text stickers
  S['vx-label'] = V(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect x="2" y="14" width="96" height="72" rx="36" fill="C"/><rect x="2" y="14" width="96" height="72" rx="36" fill="url(#g)"/>`, { wide: true, text: true, txt: 'W' });
  S['vx-burst'] = V(`<defs>${rg('g', '#FFF7A0', '#FFD000', '#FF9A00')}</defs><path d="M50 2 L58 20 L76 8 L76 28 L96 26 L84 42 L100 54 L82 62 L92 80 L72 78 L70 98 L56 84 L44 100 L38 80 L18 90 L22 70 L2 64 L18 50 L4 34 L24 32 L22 12 L40 22Z" fill="url(#g)" stroke="#E07800" stroke-width="2.5" stroke-linejoin="round"/>`, { text: true, txt: 'K' });
  S['vx-bubble'] = V(`<defs>${lg('g', '#FFFFFF', '#E6EAF2')}</defs><path d="M10 10 H90 Q98 10 98 18 V62 Q98 70 90 70 H42 L22 92 L28 70 H10 Q2 70 2 62 V18 Q2 10 10 10Z" fill="url(#g)" stroke="#B9C2D0" stroke-width="2.5" stroke-linejoin="round"/>`, { wide: true, text: true, txt: 'K' });
  S['vx-note'] = V(`<defs>${lg('g', '#FFF59A', '#FFE14A')}</defs><path d="M6 6 H94 V78 L78 94 H6Z" fill="url(#g)"/><path d="M94 78 L78 78 L78 94Z" fill="#E0B800"/><rect x="34" y="0" width="32" height="12" fill="#9BD3FF" opacity=".75" transform="rotate(-4 50 6)"/>`, { text: true, txt: 'K', font: 'marker' });
  S['vx-tape'] = V(`<defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#FFFFFF" opacity=".35"/></pattern></defs><path d="M2 30 L98 24 L96 74 L4 78Z" fill="C" opacity=".8"/><path d="M2 30 L98 24 L96 74 L4 78Z" fill="url(#p)"/>`, { wide: true });
  // hand-drawn marker annotations are the heart of Vox-style motion: not legacy
  ['arrow', 'arrow-curve', 'arrow-straight', 'circle', 'underline', 'cross', 'check', 'bracket', 'scribble'].forEach(k => { if (S[k]) { S[k].legacy = false; S[k].marker = true; } });

  window.CINE_STICKERS = S;
})();
