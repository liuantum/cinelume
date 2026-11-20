#!/usr/bin/env python3
"""Text-to-speech for vox-video scenes. Tries several engines, writes an mp3.

usage: tts.py --text "..." --out file.mp3 [--voice auto|edge[:VoiceName]|gtts[:lang]|say[:Voice]|espeak[:voice]|pyttsx3]

  edge    -> pip install edge-tts   (free, natural neural voices; needs internet)
  gtts    -> pip install gTTS       (Google Translate voice; needs internet)
  say     -> macOS built-in
  espeak  -> apt/brew install espeak-ng (offline, robotic)
  pyttsx3 -> pip install pyttsx3   (offline, uses OS voices)
"""
import argparse, asyncio, os, shutil, subprocess, sys, tempfile

def to_mp3(src, out):
    if src.lower().endswith('.mp3'):
        shutil.move(src, out); return
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-ar', '48000', '-b:a', '192k', out], check=True)
    os.remove(src)

def edge(text, out, voice):
    import edge_tts  # noqa
    v = voice or 'en-US-AndrewNeural'
    async def go():
        await edge_tts.Communicate(text, v, rate='+6%').save(out)
    asyncio.run(go())

def gtts(text, out, lang):
    from gtts import gTTS
    gTTS(text, lang=lang or 'en').save(out)

def say(text, out, voice):
    if not shutil.which('say'): raise RuntimeError('say not available')
    tmp = tempfile.mktemp(suffix='.aiff')
    subprocess.run(['say'] + (['-v', voice] if voice else []) + ['-o', tmp, text], check=True)
    to_mp3(tmp, out)

def espeak(text, out, voice):
    exe = shutil.which('espeak-ng') or shutil.which('espeak')
    if not exe: raise RuntimeError('espeak not installed')
    tmp = tempfile.mktemp(suffix='.wav')
    subprocess.run([exe, '-s', '165'] + (['-v', voice] if voice else []) + ['-w', tmp, text], check=True)
    to_mp3(tmp, out)

def pyttsx(text, out, _):
    import pyttsx3
    tmp = tempfile.mktemp(suffix='.wav')
    e = pyttsx3.init(); e.save_to_file(text, tmp); e.runAndWait()
    to_mp3(tmp, out)

ENGINES = {'edge': edge, 'gtts': gtts, 'say': say, 'espeak': espeak, 'pyttsx3': pyttsx}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--text', required=True); ap.add_argument('--out', required=True); ap.add_argument('--voice', default='auto')
    a = ap.parse_args()
    name, _, arg = a.voice.partition(':')
    order = [name] if name in ENGINES else ['edge', 'gtts', 'say', 'pyttsx3', 'espeak']
    errs = []
    for n in order:
        try:
            ENGINES[n](a.text, a.out, arg or None)
            if os.path.exists(a.out) and os.path.getsize(a.out) > 0:
                print(f'tts: {n} -> {a.out}'); return 0
        except Exception as e:  # try next engine
            errs.append(f'{n}: {e}')
    sys.stderr.write('no TTS engine worked (' + '; '.join(errs) + '). Install one: pip install edge-tts\n')
    return 1

if __name__ == '__main__':
    sys.exit(main())
