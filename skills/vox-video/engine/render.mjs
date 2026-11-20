#!/usr/bin/env node
/* Vox-style video renderer: storyboard.json -> MP4 (H.264 + AAC)
   node render.mjs storyboard.json [--out video.mp4] [--format 9:16] [--res 1080] [--fps 30]
                   [--preview] [--stills auto|1,4.5,9] [--player] [--workers 4] [--no-audio] [--chrome /path]
*/
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { validate } from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, 'runtime', 'index.html');

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
const opt = { workers: Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2) || 1)) };
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx != null && !nx.startsWith('--')) { opt[k] = nx; i++; } else opt[k] = true; }
  else pos.push(a);
}
if (!pos[0] || opt.help) {
  console.log(`usage: node render.mjs storyboard.json [options]
  --out FILE        output mp4 (default: <storyboard>.mp4)
  --format F        16:9 | 9:16 | 1:1 | 4:5 (overrides meta.format)
  --res N           short-side pixels (default 1080; preview 540)
  --fps N           frames per second (default 30)
  --preview         fast low-res draft render
  --stills LIST     export PNG stills instead of video: "auto" (one per scene) or "1,4.5,10"
  --player          write an interactive HTML player next to the output (no render)
  --crf N / --maxrate MBPS   quality (default crf 20, ~12 Mbps at 1080p)
  --workers N       parallel browser workers (default ${opt.workers})
  --no-audio        skip audio
  --voice V         voiceover voice: male | female | indian-male | hindi-female | en-US-AvaNeural … (default auto)
  --no-voice        captions + music only, no speech
  --chrome PATH     Chrome/Chromium executable`);
  process.exit(pos[0] ? 0 : 1);
}
const sbPath = path.resolve(pos[0]);
const baseDir = path.dirname(sbPath);
const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
sb.meta = sb.meta || {}; sb.audio = sb.audio || {};
const log = (...a) => console.log('[vox]', ...a);

const { errors, warnings } = validate(sb, baseDir);
warnings.forEach(w => log('WARN', w));
if (errors.length) { errors.forEach(e => console.error('[vox] ERROR', e)); console.error('[vox] fix the storyboard and re-run (node validate.mjs to check).'); process.exit(1); }

const format = opt.format || sb.meta.format || '16:9';
const short = Number(opt.res || (opt.preview ? 540 : sb.meta.resolution || 1080));
const fps = Number(opt.fps || (opt.preview ? 24 : sb.meta.fps || 30));
const [ar, br] = format.split(':').map(Number);
let W, H; if (ar >= br) { H = short; W = Math.round(short * ar / br / 2) * 2; } else { W = short; H = Math.round(short * br / ar / 2) * 2; }
const outPath = path.resolve(opt.out || sbPath.replace(/\.json$/i, '') + (opt.preview ? '.preview' : '') + '.mp4');
const cacheDir = path.join(baseDir, '.vox-cache'); fs.mkdirSync(cacheDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vox-'));

/* ---------------- helpers ---------------- */
const which = cmd => { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null; };
const FFMPEG = process.env.FFMPEG_PATH || which('ffmpeg'), FFPROBE = process.env.FFPROBE_PATH || which('ffprobe');
if (!FFMPEG) { console.error('[vox] ffmpeg not found. Install it (brew install ffmpeg / winget install ffmpeg / apt install ffmpeg).'); process.exit(1); }
const run = (bin, args) => { const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${(r.stderr || '').slice(-1500)}`); return r.stdout; };
const probeDur = f => { try { return parseFloat(run(FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f])); } catch { return 0; } };
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const IMG = /\.(png|jpe?g|webp|gif|avif|svg|bmp)$/i, VID = /\.(mp4|mov|webm|mkv|m4v|avi)$/i;

/* ---------------- asset resolution ---------------- */
const MEDIA_KEYS = new Set(['media', 'image', 'video', 'src', 'clips', 'images']);
function collectMedia(o, out) {
  if (Array.isArray(o)) o.forEach(x => collectMedia(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (MEDIA_KEYS.has(k)) { if (typeof v === 'string') out.add(v); else if (Array.isArray(v)) v.forEach(x => typeof x === 'string' ? out.add(x) : collectMedia(x, out)); else collectMedia(v, out); }
    else if (typeof v === 'object') collectMedia(v, out);
  }
  return out;
}
async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': 'vox-video-skill/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}
async function stockSearch(provider, q, wantVideo) {
  if (provider === 'search') provider = process.env.PEXELS_API_KEY ? 'pexels' : process.env.PIXABAY_API_KEY ? 'pixabay' : null;
  if (provider === 'pexels' && process.env.PEXELS_API_KEY) {
    const orient = H > W ? 'portrait' : 'landscape';
    const url = wantVideo ? `https://api.pexels.com/videos/search?per_page=5&orientation=${orient}&query=${encodeURIComponent(q)}` : `https://api.pexels.com/v1/search?per_page=5&orientation=${orient}&query=${encodeURIComponent(q)}`;
    const j = await (await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } })).json();
    if (wantVideo) { const v = (j.videos || [])[0]; if (!v) return null; const f = v.video_files.filter(f => f.file_type === 'video/mp4').sort((a, b) => Math.abs(a.height - short) - Math.abs(b.height - short))[0]; return f && { url: f.link, ext: '.mp4', credit: `Pexels / ${v.user && v.user.name}` }; }
    const p = (j.photos || [])[0]; return p && { url: p.src.large2x || p.src.original, ext: '.jpg', credit: `Pexels / ${p.photographer}` };
  }
  if (provider === 'pixabay' && process.env.PIXABAY_API_KEY) {
    const url = wantVideo ? `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&per_page=5` : `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=photo&per_page=5`;
    const j = await (await fetch(url)).json(); const hit = (j.hits || [])[0]; if (!hit) return null;
    if (wantVideo) { const v = hit.videos.medium || hit.videos.small; return v && { url: v.url, ext: '.mp4', credit: `Pixabay / ${hit.user}` }; }
    return { url: hit.largeImageURL, ext: '.jpg', credit: `Pixabay / ${hit.user}` };
  }
  return null;
}
async function resolveAssets() {
  const refs = [...collectMedia(sb.scenes, new Set())];
  const assets = {}; const credits = [];
  for (const ref of refs) {
    let file = null, label = null;
    try {
      const m = ref.match(/^(pexels|pixabay|search)(-video)?:(.+)$/i);
      if (m) {
        label = m[3].trim(); const wantVideo = !!m[2];
        const key = path.join(cacheDir, 'stock-' + hash(ref));
        const cached = ['.jpg', '.mp4'].map(e => key + e).find(f => fs.existsSync(f));
        if (cached) file = cached; else { const hit = await stockSearch(m[1].toLowerCase(), label, wantVideo); if (hit) { file = key + hit.ext; await download(hit.url, file); credits.push(hit.credit); log('stock', label, '->', hit.credit); } else log('no stock API key / result for', JSON.stringify(label), '— using designed placeholder'); }
      } else if (/^https?:\/\//.test(ref)) {
        const ext = (path.extname(new URL(ref).pathname) || '.jpg').slice(0, 6);
        file = path.join(cacheDir, 'dl-' + hash(ref) + ext); if (!fs.existsSync(file)) { log('download', ref); await download(ref, file); }
      } else {
        const p = path.resolve(baseDir, ref); if (fs.existsSync(p)) file = p; else label = path.basename(ref).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ');
      }
    } catch (e) { log('asset failed', ref, e.message); label = label || ref; file = null; }
    if (!file) { assets[ref] = { type: 'missing', label: label || ref }; continue; }
    if (VID.test(file)) {
      const dir = path.join(cacheDir, 'frames-' + hash(file + fps + short)); const maxS = 30;
      if (!fs.existsSync(path.join(dir, '00001.jpg'))) { fs.mkdirSync(dir, { recursive: true }); log('extract frames', path.basename(file)); run(FFMPEG, ['-y', '-v', 'error', '-i', file, '-t', String(maxS), '-vf', `fps=${fps},scale='if(gt(iw,ih),-2,${Math.round(short * 1.2)})':'if(gt(iw,ih),${Math.round(short * 1.2)},-2)'`, '-q:v', '3', path.join(dir, '%05d.jpg')]); }
      const count = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
      assets[ref] = { type: 'video', pattern: pathToFileURL(dir).href + '/%05d.jpg', count, fps };
    } else assets[ref] = { type: 'image', url: pathToFileURL(file).href };
  }
  return { assets, credits };
}

/* ---------------- voiceover / TTS ---------------- */
// Speech is ON by default whenever a scene has `narration`. meta.voice: "none" turns it off.
async function prepareVoice() {
  let voice = sb.meta.voice != null ? sb.meta.voice : (sb.audio.voice != null ? sb.audio.voice : 'auto');
  if (opt.voice) voice = opt.voice;
  if (opt['no-voice'] || sb.audio.voiceover) voice = 'none'; // a single full-length voiceover file replaces TTS
  const rate = sb.meta.voiceRate || sb.audio.voiceRate;
  const todo = sb.scenes.map((s, i) => ({ s, i })).filter(({ s }) => !s.voiceover && s.narration && voice && voice !== 'none' && voice !== false);
  if (todo.length) {
    const { synthesize } = await import('./tts.mjs');
    let made = 0, failed = 0, engineUsed = '';
    // a few at a time to stay polite to the service
    for (let k = 0; k < todo.length; k += 4) {
      await Promise.all(todo.slice(k, k + 4).map(async ({ s, i }) => {
        const v = s.voice || voice;
        const text = s.narration.replace(/==|\*\*|__|\[\[|\]\]|~~|\{\{|\}\}/g, '');
        const out = path.join(cacheDir, `tts-${hash(v + '|' + (rate || '') + '|' + text)}.mp3`);
        if (fs.existsSync(out) && fs.statSync(out).size > 1000) { s.voiceover = out; made++; return; }
        try { const r = await synthesize(text, out, { voice: v, rate }); s.voiceover = r.file; engineUsed = r.engine; made++; }
        catch (e) { failed++; if (failed === 1) log(`voiceover unavailable (${String(e.message).slice(0, 220)}) — rendering with captions + music only`); }
      }));
    }
    if (made) log(`voiceover: ${made}/${todo.length} scenes${engineUsed ? ' via ' + engineUsed : ''}`);
  }
  sb.scenes.forEach(s => {
    if (s.voiceover) {
      const f = path.resolve(baseDir, s.voiceover);
      if (fs.existsSync(f)) { const d = probeDur(f); s._vo = f; s.voStart = s.voStart != null ? s.voStart : 0.25; s.voDur = d; s.duration = Math.max(s.duration || 0, d + s.voStart + 0.45); }
    }
  });
}

/* ---------------- browser ---------------- */
async function launch() {
  let pw;
  try { pw = await import('playwright-core'); } catch { try { pw = await import('playwright'); } catch { console.error('[vox] missing dependency: run "npm install" inside ' + HERE); process.exit(1); } }
  const chromium = pw.chromium || pw.default.chromium;
  const cands = [opt.chrome, process.env.CHROME_PATH];
  try { cands.push(chromium.executablePath()); } catch { }
  cands.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'));
  const exe = cands.find(p => p && fs.existsSync(p));
  if (!exe) { console.error('[vox] No Chrome/Chromium found. Install Google Chrome, or run: npx playwright install chromium   (or pass --chrome PATH)'); process.exit(1); }
  return chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--disable-web-security', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-gpu-vsync', '--hide-scrollbars', '--mute-audio'] });
}
async function openPage(browser, assets) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log('page:', m.text()); });
  page.on('pageerror', e => log('page error:', e.message));
  await page.goto(pathToFileURL(RUNTIME).href);
  const info = await page.evaluate(([sb, o]) => window.VOX.init(sb, o), [sb, { W, H, fps, assets }]);
  await page.evaluate(() => window.VOX.layout());
  return { page, info };
}

/* ---------------- audio ---------------- */
const SR = 48000;
const SFX_DEF = {
  whoosh: [`anoisesrc=d=0.6:c=pink:a=0.9:r=${SR}`, 'highpass=f=250,lowpass=f=4500,afade=t=in:d=0.32:curve=exp,afade=t=out:st=0.3:d=0.3,volume=0.9'],
  'whoosh-soft': [`anoisesrc=d=0.75:c=brown:a=0.9:r=${SR}`, 'highpass=f=120,lowpass=f=1800,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.4,volume=1.4'],
  pop: [`aevalsrc='0.7*sin(2*PI*(380+1600*exp(-t*38))*t)*exp(-t*26)':d=0.18:s=${SR}`, 'volume=0.9'],
  click: [`aevalsrc='0.6*(random(0)*2-1)*exp(-t*350)+0.3*sin(2*PI*2400*t)*exp(-t*120)':d=0.06:s=${SR}`, 'volume=0.8'],
  ding: [`aevalsrc='0.35*sin(2*PI*1318.5*t)*exp(-t*4.5)+0.22*sin(2*PI*1975.5*t)*exp(-t*6)+0.1*sin(2*PI*2637*t)*exp(-t*9)':d=1.3:s=${SR}`, 'volume=0.9'],
  hit: [`aevalsrc='0.9*sin(2*PI*(52+140*exp(-t*28))*t)*exp(-t*8)+0.25*(random(0)*2-1)*exp(-t*45)':d=0.6:s=${SR}`, 'lowpass=f=6000,volume=0.9'],
  boom: [`aevalsrc='1.0*sin(2*PI*(38+110*exp(-t*14))*t)*exp(-t*3.2)+0.2*(random(0)*2-1)*exp(-t*12)':d=1.4:s=${SR}`, 'lowpass=f=3000,volume=0.9'],
  thud: [`aevalsrc='0.8*sin(2*PI*(75+70*exp(-t*25))*t)*exp(-t*14)+0.12*(random(0)*2-1)*exp(-t*60)':d=0.35:s=${SR}`, 'volume=0.9'],
  swish: [`anoisesrc=d=0.3:c=white:a=0.5:r=${SR}`, 'highpass=f=2500,lowpass=f=9000,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.18,volume=0.6'],
  scribble: [`aevalsrc='(random(0)*2-1)*0.35*(0.55+0.45*sin(2*PI*16*t))':d=0.55:s=${SR}`, 'highpass=f=1800,lowpass=f=7000,afade=t=in:d=0.05,afade=t=out:st=0.35:d=0.2,volume=0.5'],
  paper: [`anoisesrc=d=0.5:c=pink:a=0.8:r=${SR}`, 'highpass=f=700,lowpass=f=5000,afade=t=in:d=0.08,afade=t=out:st=0.15:d=0.35,volume=0.8'],
  riser: [`aevalsrc='0.22*sin(2*PI*(180*t+260*t*t))*(t/1.3)':d=1.3:s=${SR}`, 'afade=t=out:st=1.1:d=0.2,volume=0.7'],
  'tick-roll': [`aevalsrc='0.25*sin(2*PI*1800*t)*exp(-mod(t,0.055)*260)*(1-t/1.6)':d=1.6:s=${SR}`, 'volume=0.5'],
  bar: [`aevalsrc='0.22*sin(2*PI*(260+420*t)*t)*exp(-t*5)':d=0.45:s=${SR}`, 'volume=0.6'],
};
function decodeToF32(file, args = []) {
  const out = path.join(tmp, 'pcm-' + hash(file + args.join()) + '.f32');
  if (!fs.existsSync(out)) run(FFMPEG, ['-y', '-v', 'error', ...args, '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', out]);
  const b = fs.readFileSync(out); return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}
function synthSfx(name) {
  const def = SFX_DEF[name]; if (!def) return null;
  const out = path.join(tmp, `sfx-${name}.f32`);
  if (!fs.existsSync(out)) run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', def[0], '-af', def[1], '-ac', '1', '-ar', String(SR), '-f', 'f32le', out]);
  const b = fs.readFileSync(out); return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}
function autoMusic(dur, mood) {
  // gentle lo-fi bed: pad chords + soft kick + shaker, 88 bpm
  const n = Math.ceil(dur * SR), buf = new Float32Array(n);
  const bpm = mood === 'tense' ? 96 : 88, beat = 60 / bpm;
  const prog = mood === 'tense' ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  const bar = beat * 4; let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, bi = Math.floor(t / bar) % prog.length, tb = t % bar;
    const env = Math.min(1, tb / 0.6) * (1 - 0.25 * (tb / bar));
    let s = 0; for (const m of prog[bi]) { const fr = f(m); s += Math.sin(2 * Math.PI * fr * t) * 0.6 + Math.sin(2 * Math.PI * fr * 2.001 * t) * 0.12; }
    s += Math.sin(2 * Math.PI * f(prog[bi][0] - 24) * t) * 0.9; // bass
    s *= 0.06 * env * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t));
    const tk = t % beat, k = (Math.floor(t / beat) % 2 === 0) ? Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-tk * 30)) * tk) * Math.exp(-tk * 9) * 0.32 : 0;
    const th = (t + beat / 2) % (beat); const hat = rnd() * Math.exp(-th * 60) * 0.05;
    lp += (s - lp) * 0.18;
    buf[i] = lp + k + hat;
  }
  const fade = Math.min(n, SR * 1.5); for (let i = 0; i < fade; i++) { buf[i] *= i / fade; buf[n - 1 - i] *= i / fade; }
  return buf;
}
function buildAudio(info) {
  const dur = info.duration, n = Math.ceil((dur + 0.5) * SR);
  const vo = new Float32Array(n), fx = new Float32Array(n), mus = new Float32Array(n);
  const place = (dst, src, t0, g) => { const o = Math.round(t0 * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g; };
  // voiceover: global file or per scene
  let hasVo = false;
  if (sb.audio.voiceover && sb.audio.voiceover !== 'none') { const f = /^https?:/.test(sb.audio.voiceover) ? null : path.resolve(baseDir, sb.audio.voiceover); if (f && fs.existsSync(f)) { place(vo, decodeToF32(f), sb.audio.voiceoverOffset || 0, 1); hasVo = true; } }
  info.scenes.forEach((sc, i) => { const s = sb.scenes[i]; if (s._vo) { place(vo, decodeToF32(s._vo), sc.start + (s.voStart || .25), 1); hasVo = true; } });
  // sfx
  if (sb.meta.sfx !== false) {
    const sfxVol = sb.audio.sfxVolume != null ? sb.audio.sfxVolume : 0.55; const cache = {}; let last = {};
    for (const e of info.events) {
      if (last[e.name] != null && e.t - last[e.name] < 0.09) continue; last[e.name] = e.t;
      let src = cache[e.name]; if (src === undefined) { src = cache[e.name] = (() => { if (SFX_DEF[e.name]) return synthSfx(e.name); const f = path.resolve(baseDir, e.name); return fs.existsSync(f) ? decodeToF32(f) : null; })(); }
      if (src) place(fx, src, e.t, sfxVol * (e.vol || .8));
    }
  }
  // music
  const m = sb.audio.music == null ? 'auto' : sb.audio.music; const mv = sb.audio.musicVolume != null ? sb.audio.musicVolume : 0.35;
  if (m && m !== 'none') {
    let src = null;
    if (m === 'auto' || m === 'auto:tense' || m === 'auto:calm') src = autoMusic(dur + 0.5, m.split(':')[1]);
    else { const f = path.resolve(baseDir, m); if (fs.existsSync(f)) src = decodeToF32(f, ['-stream_loop', '-1', '-t', String(dur + 0.5)]); }
    if (src) { const fadeN = SR * 1.2; for (let i = 0; i < n && i < src.length; i++) { const g = i > n - fadeN ? (n - i) / fadeN : 1; mus[i] = src[i] * g * mv; } }
  }
  // ducking: music follows inverse VO envelope
  const out = new Float32Array(n); let env = 0; const att = 1 - Math.exp(-1 / (SR * 0.03)), rel = 1 - Math.exp(-1 / (SR * 0.35));
  for (let i = 0; i < n; i++) { const a = Math.abs(vo[i]); env += (a > env ? att : rel) * (a - env); const duck = hasVo ? 1 - Math.min(0.7, env * 6) : 1; out[i] = vo[i] + fx[i] + mus[i] * duck; }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0.98 ? 0.98 / peak : 1; if (g !== 1) for (let i = 0; i < n; i++) out[i] *= g;
  const raw = path.join(tmp, 'mix.f32'); fs.writeFileSync(raw, Buffer.from(out.buffer));
  const wav = path.join(tmp, 'mix.wav');
  run(FFMPEG, ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', raw, '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', String(SR), '-ac', '2', wav]);
  return wav;
}

/* ---------------- frame rendering ---------------- */
async function renderSegment(browser, assets, f0, f1, idx, nFrames) {
  const { page } = await openPage(browser, assets);
  const cdp = await page.context().newCDPSession(page);
  const seg = path.join(tmp, `seg-${String(idx).padStart(3, '0')}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', opt.preview ? 'ultrafast' : 'veryfast', '-crf', opt.preview ? '26' : String(opt.crf || 20), '-maxrate', `${Math.round(maxMbps * 1000)}k`, '-bufsize', `${Math.round(maxMbps * 2000)}k`, '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg segment failed ' + c))));
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.VOX.seek(t), f / fps);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: opt.preview ? 80 : 94, captureBeyondViewport: false });
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    progress.done++; if (progress.done % 30 === 0 || progress.done === nFrames) progress.tick();
  }
  ff.stdin.end(); await done; await page.close();
  return seg;
}
const maxMbps = Number(opt.maxrate || 0) || (opt.preview ? 3 : 12 * (W * H) / (1920 * 1080) * (fps / 30));
const progress = { done: 0, t0: Date.now(), total: 1, tick() { const p = this.done / this.total, el = (Date.now() - this.t0) / 1000; process.stdout.write(`\r[vox] frames ${this.done}/${this.total} (${(p * 100).toFixed(0)}%) ~${Math.max(0, el / Math.max(p, .001) - el).toFixed(0)}s left   `); } };

/* ---------------- main ---------------- */
(async () => {
  const T = Date.now();
  log(`${sb.meta.title || path.basename(sbPath)} — ${W}x${H} @${fps}fps, ${sb.scenes.length} scenes`);
  await prepareVoice();
  const { assets, credits } = await resolveAssets();
  const browser = await launch();
  try {
    const { page, info } = await openPage(browser, assets);
    log(`duration ${info.duration.toFixed(2)}s, ${info.events.length} sfx cues`);
    fs.writeFileSync(path.join(cacheDir, 'timeline.json'), JSON.stringify({ W, H, fps, ...info }, null, 1));

    if (opt.player) {
      const p = outPath.replace(/\.mp4$/, '.player.html');
      const rt = path.join(HERE, 'runtime'); const rel = f => pathToFileURL(path.join(rt, f)).href;
      fs.writeFileSync(p, `<!doctype html><html><head><meta charset="utf-8"><title>${sb.meta.title || 'vox player'}</title><link rel="stylesheet" href="${rel('styles.css')}"><script src="${rel('stickers.js')}"></script><script src="${rel('worldmap.js')}"></script><script src="${rel('runtime.js')}"></script>
<style>body{background:#222;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;font-family:sans-serif;color:#eee}#wrap{transform-origin:top center}#bar{display:flex;gap:10px;align-items:center;width:min(960px,96vw)}#bar input{flex:1}</style></head>
<body><div id="bar"><button id="pp">▶︎ play</button><input id="sc" type="range" min="0" max="${info.duration}" step="0.01" value="0"><span id="tm">0.00</span></div><div id="wrap"><div id="stage"></div></div>
<script>const SB=${JSON.stringify(sb)};const A=${JSON.stringify(assets)};(async()=>{const i=VOX.init(SB,{W:${W},H:${H},fps:${fps},assets:A});await VOX.layout();const wrap=document.getElementById('wrap');const k=Math.min((innerWidth-30)/${W},(innerHeight-80)/${H});wrap.style.transform='scale('+k+')';let t=0,pl=false,last=0;const sc=document.getElementById('sc'),tm=document.getElementById('tm');const go=async x=>{t=x;await VOX.seek(t);sc.value=t;tm.textContent=t.toFixed(2)};sc.oninput=()=>go(+sc.value);document.getElementById('pp').onclick=e=>{pl=!pl;e.target.textContent=pl?'❚❚ pause':'▶︎ play';last=performance.now()};const loop=async n=>{if(pl){t+=(n-last)/1000;if(t>i.duration)t=0;await go(t)}last=n;requestAnimationFrame(loop)};requestAnimationFrame(loop);go(0)})();</script></body></html>`);
      log('player written:', p); await browser.close(); return;
    }

    if (opt.stills) {
      const dir = outPath.replace(/\.mp4$/, '') + '-stills'; fs.mkdirSync(dir, { recursive: true });
      const times = opt.stills === true || opt.stills === 'auto' ? info.scenes.flatMap(sc => [sc.start + Math.min(sc.dur * .55, sc.dur - .3)]) : String(opt.stills).split(',').map(Number);
      const files = [];
      for (const [i, t] of times.entries()) { await page.evaluate(t => window.VOX.seek(t), t); const f = path.join(dir, `still-${String(i + 1).padStart(2, '0')}-${t.toFixed(2)}s.png`); await page.screenshot({ path: f }); files.push(f); }
      const cols = Math.min(4, files.length), tw = H > W ? 270 : 480;
      try { const list = path.join(tmp, 'stills.txt'); run(FFMPEG, ['-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(dir, 'still-*.png'), '-vf', `scale=${tw}:-2,tile=${cols}x${Math.ceil(files.length / cols)}:padding=6:color=0x222222`, '-frames:v', '1', path.join(dir, 'contact-sheet.jpg')]); } catch (e) { }
      log(`${files.length} stills -> ${dir}  (contact-sheet.jpg)`); await browser.close(); return;
    }
    await page.close();

    const nFrames = Math.ceil(info.duration * fps); progress.total = nFrames;
    const nW = Math.max(1, Math.min(Number(opt.workers), Math.ceil(nFrames / 60)));
    const per = Math.ceil(nFrames / nW);
    log(`rendering ${nFrames} frames with ${nW} worker(s)`);
    const segs = await Promise.all(Array.from({ length: nW }, (_, i) => renderSegment(browser, assets, i * per, Math.min(nFrames, (i + 1) * per), i, nFrames)));
    process.stdout.write('\n');
    await browser.close();
    const list = path.join(tmp, 'segs.txt'); fs.writeFileSync(list, segs.map(s => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
    const video = path.join(tmp, 'video.mp4'); run(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    if (opt['no-audio'] || sb.meta.audio === false) fs.copyFileSync(video, outPath);
    else { log('mixing audio'); const wav = buildAudio(info); run(FFMPEG, ['-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outPath]); }
    if (credits.length) fs.writeFileSync(outPath.replace(/\.mp4$/, '.credits.txt'), [...new Set(credits)].join('\n'));
    log(`✓ ${outPath}  (${info.duration.toFixed(1)}s, rendered in ${((Date.now() - T) / 1000).toFixed(0)}s)`);
  } catch (e) { console.error('\n[vox] render failed:', e.stack || e.message); try { await browser.close(); } catch { } process.exit(1); }
  finally { if (!opt.keep) fs.rmSync(tmp, { recursive: true, force: true }); }
})();
