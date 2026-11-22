#!/usr/bin/env python3
"""Studio-quality offline narration with Kokoro-82M (Apache-2.0) via kokoro-onnx.
usage: kokoro_tts.py "text" out.wav [voice] [speed]
First run downloads the model (~120 MB) to $CINELUME_KOKORO_DIR or ~/.cache/cinelume/kokoro.
Needs: pip install kokoro-onnx soundfile
Voices: am_michael am_fenrir am_puck am_adam (US male) · af_heart af_bella af_nicole af_sarah (US female) ·
        bm_george bm_fable bm_lewis (UK male) · bf_emma bf_isabella (UK female) · hm_omega hf_alpha (Hindi)"""
import os, sys, urllib.request
try:
    import soundfile as sf
    from kokoro_onnx import Kokoro
except ImportError:
    sys.exit('kokoro-onnx not installed: pip install kokoro-onnx soundfile')
BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
d = os.environ.get('CINELUME_KOKORO_DIR') or os.path.join(os.path.expanduser('~'), '.cache', 'cinelume', 'kokoro')
os.makedirs(d, exist_ok=True)
files = {'kokoro.onnx': 'kokoro-v1.0.int8.onnx', 'voices.bin': 'voices-v1.0.bin'}
for local, remote in files.items():
    p = os.path.join(d, local)
    if not os.path.exists(p) or os.path.getsize(p) < 1_000_000:
        print(f'downloading {remote} -> {p}', file=sys.stderr)
        urllib.request.urlretrieve(BASE + remote, p + '.part'); os.replace(p + '.part', p)
text, out = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else 'am_michael'
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
lang = {'a': 'en-us', 'b': 'en-gb', 'h': 'hi', 'e': 'es', 'f': 'fr-fr', 'i': 'it', 'p': 'pt-br', 'j': 'ja', 'z': 'cmn'}.get(voice[0], 'en-us')
k = Kokoro(os.path.join(d, 'kokoro.onnx'), os.path.join(d, 'voices.bin'))
samples, sr = k.create(text, voice=voice, speed=speed, lang=lang)
sf.write(out, samples, sr, format='WAV')
