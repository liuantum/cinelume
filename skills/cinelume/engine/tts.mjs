#!/usr/bin/env node
/* Built-in neural text-to-speech (Microsoft Edge Read-Aloud voices via the bundled
   `msedge-tts` npm package — installed by `npm install`, no Python, no API key).
   Falls back to scripts/tts.py (gTTS / macOS say / pyttsx3 / espeak) when offline.

   CLI:  node tts.mjs "Hello world" out.mp3 [--voice male|female|indian-male|...|en-US-AndrewNeural] [--rate +6%]
   API:  import { synthesize } from './tts.mjs'; await synthesize(text, outPath, { voice, rate })
*/
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Friendly names -> Edge neural voices
export const VOICE_ALIASES = {
  auto: 'en-US-AndrewNeural', default: 'en-US-AndrewNeural', edge: 'en-US-AndrewNeural',
  male: 'en-US-AndrewNeural', female: 'en-US-AvaNeural', narrator: 'en-US-GuyNeural', news: 'en-US-ChristopherNeural',
  'us-male': 'en-US-AndrewNeural', 'us-female': 'en-US-AvaNeural',
  hype: 'en-US-AndrewNeural', 'hype-female': 'en-US-EmmaNeural', creator: 'en-US-BrianNeural', 'creator-female': 'en-US-AvaNeural', 'indian-creator': 'en-IN-PrabhatNeural', 'indian-creator-female': 'en-IN-NeerjaNeural',
  storyteller: 'en-US-AndrewNeural', 'storyteller-female': 'en-US-EmmaNeural', documentary: 'en-GB-RyanNeural', 'documentary-female': 'en-GB-SoniaNeural', trailer: 'en-US-ChristopherNeural', 'indian-storyteller': 'en-IN-PrabhatNeural',
  'uk-male': 'en-GB-RyanNeural', 'uk-female': 'en-GB-SoniaNeural',
  'indian-male': 'en-IN-PrabhatNeural', 'indian-female': 'en-IN-NeerjaNeural',
  'hindi-male': 'hi-IN-MadhurNeural', 'hindi-female': 'hi-IN-SwaraNeural',
  'telugu-male': 'te-IN-MohanNeural', 'telugu-female': 'te-IN-ShrutiNeural',
  'tamil-male': 'ta-IN-ValluvarNeural', 'tamil-female': 'ta-IN-PallaviNeural',
  'australian-male': 'en-AU-WilliamNeural', 'australian-female': 'en-AU-NatashaNeural',
  'spanish-male': 'es-ES-AlvaroNeural', 'spanish-female': 'es-ES-ElviraNeural',
  'french-male': 'fr-FR-HenriNeural', 'french-female': 'fr-FR-DeniseNeural',
  'german-male': 'de-DE-ConradNeural', 'german-female': 'de-DE-KatjaNeural',
};

export function resolveVoice(spec) {
  let s = String(spec || 'auto').trim();
  if (s.startsWith('edge:')) s = s.slice(5);
  if (VOICE_ALIASES[s.toLowerCase()]) return { engine: 'edge', voice: VOICE_ALIASES[s.toLowerCase()] };
  if (/^[a-z]{2,3}-[A-Z]{2}-\w+Neural$/.test(s)) return { engine: 'edge', voice: s };
  const [eng, arg] = s.split(':');
  if (['gtts', 'say', 'espeak', 'pyttsx3'].includes(eng)) return { engine: eng, voice: arg || '' };
  return { engine: 'edge', voice: VOICE_ALIASES.auto };
}

const xmlEscape = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function edgeTTS(text, out, voice, rate) {
  const mod = await import('msedge-tts');
  const { MsEdgeTTS, OUTPUT_FORMAT } = mod.default && mod.default.MsEdgeTTS ? mod.default : mod;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 60000 });
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(xmlEscape(text), { rate: rate || '+5%' });
      const chunks = [];
      await new Promise((res, rej) => { audioStream.on('data', d => chunks.push(d)); audioStream.on('close', res); audioStream.on('end', res); audioStream.on('error', rej); });
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error('empty audio returned');
      fs.writeFileSync(out, buf);
      try { tts.close(); } catch { }
      return out;
    } catch (e) { lastErr = e; try { tts.close(); } catch { } await new Promise(r => setTimeout(r, 800 * (attempt + 1))); }
  }
  throw lastErr;
}

function pythonTTS(text, out, engine, voice) {
  const py = ['python3', 'python'].find(p => spawnSync(p, ['--version']).status === 0);
  if (!py) throw new Error('python not available for fallback TTS');
  const r = spawnSync(py, [path.join(HERE, '..', 'scripts', 'tts.py'), '--voice', engine === 'auto' ? 'auto' : `${engine}${voice ? ':' + voice : ''}`, '--out', out, '--text', text], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || '').trim().split('\n').pop());
  return out;
}

/** Synthesize `text` to an mp3 at `out`. Tries bundled Edge neural voices, then offline/system engines. */
export async function synthesize(text, out, { voice = 'auto', rate } = {}) {
  const v = resolveVoice(voice);
  const errors = [];
  if (v.engine === 'edge') {
    try { return { file: await edgeTTS(text, out, v.voice, rate), engine: `edge (${v.voice})` }; }
    catch (e) { errors.push(`edge: ${e.message || e}`); }
    try { return { file: pythonTTS(text, out, 'auto', ''), engine: 'system fallback' }; }
    catch (e) { errors.push(`fallback: ${e.message}`); }
  } else {
    try { return { file: pythonTTS(text, out, v.engine, v.voice), engine: v.engine }; }
    catch (e) { errors.push(`${v.engine}: ${e.message}`); }
    try { return { file: await edgeTTS(text, out, VOICE_ALIASES.auto, rate), engine: 'edge' }; }
    catch (e) { errors.push(`edge: ${e.message || e}`); }
  }
  throw new Error(errors.join(' | '));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2); const get = k => { const i = a.indexOf(k); return i >= 0 ? a.splice(i, 2)[1] : undefined; };
  const voice = get('--voice'), rate = get('--rate');
  if (a[0] === '--list') { console.log(Object.entries(VOICE_ALIASES).map(([k, v]) => `${k.padEnd(18)} ${v}`).join('\n')); process.exit(0); }
  if (a.length < 2) { console.log('usage: node tts.mjs "text" out.mp3 [--voice male|female|indian-male|hindi-female|en-US-AvaNeural] [--rate +5%]\n       node tts.mjs --list'); process.exit(1); }
  synthesize(a[0], path.resolve(a[1]), { voice, rate }).then(r => { console.log(`✓ ${r.engine} -> ${r.file}`); process.exit(0); }).catch(e => { console.error('✗ TTS failed:', e.message); process.exit(1); });
}
