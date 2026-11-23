---
name: cinelume
description: Turns a single prompt into a premium video (MP4) — either a colourful, high-energy viral short (Instagram Reels / YouTube Shorts / TikTok) with bold animated captions, beat-synced music and an energetic narrator, or a cinematic story video that feels like a documentary or film — real photos and footage, film grading, letterboxing, light leaks, elegant serif titles, glass UI, fine-line annotations, a generated cinematic score and built-in neural narration. Use when the user asks for a cinematic or premium video, a documentary-style short, a story-driven explainer, an Instagram/YouTube/TikTok reel or short, a "Vox style" or "Johnny Harris style" video, a motion-graphics news recap, or an animated data story from a topic, script or article.
---

# Cinelume — cinematic story-video generator

One prompt in, a finished film out. You direct: research, write a story, plan shots, write a **storyboard JSON**.
The bundled engine renders it frame-by-frame in headless Chrome (deterministic, so what you preview is what ships),
pulls real photos and footage, grades them, and mixes narration, a cinematic score and sound design with ffmpeg.

`SKILL_DIR` = the folder containing this file (e.g. `~/.claude/skills/cinelume`, `.agents/skills/cinelume`).

## 0. One-time setup (check, don't assume)

```bash
node -v            # >= 18
ffmpeg -version    # ffmpeg + ffprobe on PATH
cd "$SKILL_DIR/engine" && [ -d node_modules ] || npm install
```
Chrome/Chromium/Edge is auto-detected (else `npx playwright install chromium`). Narration is built in (neural voices,
needs internet while rendering). **Realistic images:** `search:` works with no key (Openverse + Wikimedia Commons);
for the best stock photos/footage ask the user to set any of `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY`
(all free). Without any results the engine draws an atmospheric light-and-bokeh plate, never a cartoon.

## 0.5 Pick the mode

| Mode | When | Themes | Feel |
|---|---|---|---|
| **Vox edit (documentary collage)** | "Vox style", "Vox edit", "documentary edit", history / science / "the story of…" reels, explainers that should feel like a mini documentary | `archive` (paper, default for this mode) · `newsroom` (dark desk) | grid-paper world, archival black-and-white photos and cut-outs, props (old TV, clipboard, taped prints, magnifying glass), `[in 1985]` year brackets, italic name labels, red boxes with yellow serif words, colour spots, hand-drawn red underlines/circles, big caption words timed to the voice, tense documentary score |
| **Viral short** | Reels / Shorts / TikTok, "viral", "engaging", "colourful", growth content, daily news reels, any 9:16 under 60 s unless they ask for calm/cinematic | `neon` (default) · `sunset` · `electric` · `aurora` · `candy` (bright/light) | vivid graded footage, giant word-by-word coloured captions, gradient numbers, punch-in motion, camera pulsing on the kick, cuts on the beat, 140-bpm trap / 118-bpm pop music, energetic voice, top progress bar |
| **Cinematic story** | documentaries, 16:9 explainers, "film", "cinematic", "premium", calm or serious topics | `noir` · `film` · `midnight` · `ember` · `slate` · `ivory` | letterboxed graded film, serif titles, glass annotations, cinematic score, storyteller voice |

### Vox-edit playbook (`theme: "archive"`)
Build almost every shot with the `story` scene — it is the collage camera:
- `frame: "full"` archival photo full-screen (+ `year: "in 1974"`, `name: "Elizabeth Loftus"`), `frame: "print"` a taped photo print,
  `frame: "cutout"` with `"media": "cutout:<photo>"` (background removed automatically, e.g. a person), `frame: "tv"` footage on an
  old CRT, `frame: "clipboard"` with a typed `note`, `magnifier: true` to sweep a lens over the shot.
- `text` + `spot` for big statement words on a colour circle ("nothing **unusual.**"); `tag` for a red box label ("disturbing question").
- Mark the key word in narration with `==word==` — the caption shows it as a red box with yellow serif; `__word__` in text = red underline,
  `[[word]]` = red marker circle. Add hand-drawn `circle` / `arrow-curve` stickers in red (`"color": "#C2271E"`) to point at details.
- Cut every 2–4 s; one idea per shot; mix full photos, props and paper text shots. Real archival / stock photos look best (`search:`),
  and people work best as `cutout:` images.

### Tell the story with characters & stickers (any style, best in Vox edit)
- Give the story a **cast**: 1–3 recurring characters (`references/stickers.md` → Characters). Keep the same `id`, `role`, `skin`
  and colours across scenes so viewers recognise them.
- Every 2–3 scenes, act a beat out instead of stating it: the character `walk`s in, `say`s the key line in a bubble
  (or `talk: true` to lip-sync the narration), reacts (`shock`, `cheer`, `think`), points at a prop sticker.
- Props: `vx-*` stickers (dish, cart, laptop, office, rocket, rupee, flag…), real photo stickers (`"type": "image"`,
  `"media": "cutout:search:…"`), or the user's own pack (`pack:<name>`). Real public figures: use `head: "cutout:<photo>"`
  only with photos the user supplies or that are openly licensed; never private individuals.
- Leave ~40% of the frame for the cast (feet line `y` 94–98, `size` 35–45 in 9:16, 55–60 in 16:9); captions move to the top.

### Viral short playbook (retention first)
- **Second 0–2: `hook` scene.** 2–5 giant words that open a loop: a bold claim, a number, "You're doing X wrong", "Nobody talks about…".
  Put the hook over the most striking real shot (`search-video:`). The hook's own text replaces captions (no duplication).
- **A payoff every 2–4 s.** Scenes are short (≤ 20 narration words, usually 6–14). Alternate: real shot → number → real shot → list.
- **Use colour with meaning:** `**word**` = gradient word, `==word==` = coloured highlight block (1 per scene).
- **Numbers**: `bignumber` (gradient count-up). **Steps**: `list` (max 3). **People/products**: `depth` / `cinematic` with `align: "center"`.
- **End with a loop or a reason to follow**: `outro` with a short `cta` ("Follow for Part 2", "Save this"), and a last line that
  connects back to the hook so the replay feels seamless.
- Narration: second person, present tense, punchy (8–12 words per sentence max), one idea per line, ~2.8–3 words/s.
- Voice: `hype` (energetic US male, default) · `hype-female` · `creator` / `creator-female` (relaxed) · `indian-creator` /
  `indian-creator-female` · Hindi/Telugu/Tamil voices for regional audiences. The engine runs every voice through a
  broadcast chain (EQ, de-ess, compression, limiter) so it sounds like a good mic.
- Music: `auto:viral` (trap, default) · `auto:upbeat` (pop) · `auto:phonk` · `auto:hype` (150 bpm). Scenes are snapped so every
  cut lands on a beat, and the camera pulses on the kick (`meta.beatPulse: 0` to turn off).

## 1. Brief (decide, don't ask, unless truly ambiguous)

| Decide | Default | Signals |
|---|---|---|
| Format | `16:9` | reel / short / TikTok / story / vertical → `9:16`; square → `1:1`; `4:5` |
| Length | reel 30–60 s (6–9 scenes) · film 90–180 s (12–20 scenes) | explicit time wins |
| Theme | viral shorts → `neon`; cinematic → `noir` | bright/fun/lifestyle → `candy`; motivation/money → `sunset`; tech/AI → `electric` or `neon`; health/nature/calm-but-colourful → `aurora` travel/nature/human → `film`; space/AI/night → `midnight`; energy/war/industry → `ember`; finance/science → `slate`; culture/luxury/essay → `ivory`. Only use classic themes (`paper` etc.) if the user asks for the flat "classic" look |
| Captions | viral themes → `viral`; cinematic → `cinema` (9:16) / `subtitle` (16:9) | "no captions" → `"none"` |
| Voice | viral → `hype`; cinematic → `storyteller` (warm US male). If `kokoro-onnx` is installed (`pip install kokoro-onnx soundfile`) or the user wants offline / the most natural voice, use the Kokoro studio voices: `studio-female` (best overall), `studio-male`, `studio-hype`, `studio-deep`, `studio-uk-male`, `studio-uk-female`, `studio-hindi-*`, or `kokoro:<voice>` | female → `storyteller-female`; British → `documentary` / `documentary-female`; trailer → `trailer`; Indian English → `indian-storyteller`; Hindi/Telugu/Tamil etc. (`node engine/tts.mjs --list`); silent → `none` |
| Music | viral → `auto:viral`; cinematic → `auto:cinematic` | tense → `auto:suspense`; uplifting → `auto:hopeful`; big → `auto:epic`; calm → `auto:ambient` |
| Handle | none | any @handle → `meta.handle` |

## 2. Research, then write a story (not a slideshow)

- Research with web search when you can; collect **real numbers with sources** (`source` field). If unverified, drop it
  or set `"source": "Illustrative"`. Never fabricate quotes, never fake a real outlet's article.
- Structure (details: `references/shot-planning.md`): **Cold open** (a place, a moment — no explanation) →
  **The question** → **World** → **Rising** (how it works + evidence) → **The turn** (slow down) → **Resolution**.
- Write narration to be *heard*: short sentences, present tense, concrete sensory nouns, ~2.4 words/s.
  One idea per scene. Leave room to breathe.

## 3. Shot-plan

| Beat is… | Scene `type` | Must-have |
|---|---|---|
| The first 1–2 s of a short | `hook` | `lines[]` (2–3 short lines, last one coloured) + `media` |
| Film opener / title card | `opening` | `title` (+`presenter`, `tagline`, `media`) |
| A place + time ("Hsinchu, 04:12 AM") | `establishing` | `location`, `media` (+`time`, `coords`, `viewfinder`) |
| A big statement over a real shot | `cinematic` | `title`, `media` (+`kicker`, `sub`, `intro: slit|blur|fade`) |
| A reflective line / the question / the turn | `narrative` | `lines[]` (+`media`) |
| A thing with depth: object, landscape, machine | `depth` | `headline`, `media` (+`foreground` cut-out, `leader` sticker) |
| One striking number | `bignumber` | `value`, `label`, `source` |
| Change over time / ranking / share | `line` / `bar` / `donut` / `icongrid` | data + `source` |
| Geography, routes | `map` | `highlight[]`/`focus`, `pins[]`, `arcs[]` |
| History | `timeline` | `events[]` |
| A vs B · steps · process | `compare` · `list` · `flow` | |
| Real footage montage | `broll` | `media[]` |
| Act break | `chapter` | `title` (+`number`, `media`) |
| News report / study | `document` · `screen` · `quote` | |
| Ending | `outro` | `headline`, `cta`, `handle` |

Directing rules:
1. **Cut back to real imagery every 3–4 scenes** (`cinematic`, `establishing`, `depth`, `broll`, `photo`). Use
   `search-video:` for the 2–3 most important shots.
2. **Write media queries like a cinematographer**: subject + light + angle + mood — `"search:container ship aerial sunset"`,
   `"search-video:rain on city street night neon"`. Avoid queries that would return identifiable private people.
3. **Camera**: the cinematic scenes have good defaults (`dolly-in`, `truck-right`, `parallax`, `steadicam`). For others:
   `slow-push` for emphasis, `crane-up/down` for landscapes, `truck-left/right` for maps & photos, `reveal-pull` for reveals.
   Avoid `crash-zoom`/`shake-hit`/`handheld` unless the moment is genuinely violent or urgent.
4. **Transitions**: `dissolve`/`cross-zoom` (default flow), `luma` (place/time change), `light-leak` (beauty, memory),
   `dip-black` (act breaks, before the turn), `lens-blur` (into a detail), `slit` (reveals), `film-burn` (era change, ending).
   Leave unset and the engine rotates tasteful ones.
5. **Annotate like a title designer, not a cartoonist** — 0–2 stickers per scene from the premium set
   (`references/stickers.md`): `leader` to name an object, `ring` around a detail, `location`/`timestamp`/`stat`/`tag` glass
   chips, `pulse` on a place, `glint` on a highlight, `photo` for an inset. **Never** emoji faces, bursts, notes or tape.
6. **Text markup**: `**word**` = italic accent colour, `==word==` = fine gold underline, `[[word]]` = hairline circle.
   One mark per scene, on the word that carries the meaning.
7. Put a `chapter` (with `"transition": "dip-black"` into it) every 4–6 scenes in videos over 90 s.

## 4. Media values
`media` / `image` / `video` / sticker `media` accept: a **local file** the user gave you (path relative to the storyboard;
videos play frame-synced) · an **https URL** you may use · `search:<query>` (best photo across Pexels → Unsplash → Pixabay →
Openverse → Wikimedia) · `search-video:<query>` (real footage; falls back to a photo) · provider-specific `pexels:`, `unsplash:`,
`openverse:`, `wikimedia:` … · add `#2` to take the second-best result. `look`: `cine` (default) `noir` `warm` `cool` `bleach`.
Credits and licences are written to `<video>.credits.txt` — mention it when you deliver.

## 5. Write → validate → look → render

```bash
cd "$SKILL_DIR/engine"
node validate.mjs /abs/path/project/storyboard.json                 # fix every ERROR; read the WARNs
node render.mjs  /abs/path/project/storyboard.json --stills auto     # one PNG per scene + contact-sheet.jpg
```
**Open `contact-sheet.jpg` and look at it** (and any doubtful still) before the final render: text legible against the
image (else change `align`, raise `scrim`, or pick `#2` result), nothing under captions, stickers on the right spot, the
images actually match the story (if a search result is wrong, rewrite the query). Fix and re-run stills until it's clean.

```bash
node render.mjs /abs/path/project/storyboard.json --out /abs/path/project/film.mp4
# fast draft: --preview · vertical: --format 9:16 · 4K: --res 2160 · 60 fps: --fps 60 · scrub live: --player
```
Keep each storyboard in its own folder (the engine caches media in `.cinelume-cache/`). Speed ≈ 5–15 frames/s.

## 6. Deliver
Send the MP4 (and the storyboard JSON so it can be tweaked). In one or two lines: what was assumed (format, length, voice,
theme, any illustrative numbers) and one next step (e.g. "add a PEXELS_API_KEY for real footage", "swap in your own clips").

## Storyboard skeleton

```json
{
  "meta": { "title": "…", "format": "16:9", "theme": "noir", "handle": "@you", "voice": "storyteller" },
  "audio": { "music": "auto:cinematic" },
  "scenes": [
    { "type": "opening", "presenter": "Liuantum presents", "title": "The Silicon Island",
      "tagline": "how one island came to power the world", "media": "search:taiwan coast fog dawn",
      "transition": "dip-black", "narration": "Every phone you have ever owned begins in one place." },
    { "type": "establishing", "location": "Hsinchu, Taiwan", "time": "04:12 AM",
      "media": "search-video:semiconductor factory night aerial", "viewfinder": true,
      "narration": "At four in the morning, the lights here never go out." },
    { "type": "depth", "kicker": "The machine", "headline": "Each one is the size of a bus.",
      "media": "search:lithography machine cleanroom",
      "stickers": [{ "type": "leader", "text": "EUV scanner", "sub": "Veldhoven, NL", "x": 74, "y": 40, "size": 22, "at": 1.8 }],
      "narration": "The machines that print them are the size of a bus." }
  ]
}
```
Every field: `references/storyboard-schema.md` · look & themes: `references/style-bible.md` ·
cameras/transitions: `references/camera-and-transitions.md` · stickers: `references/stickers.md`.
Examples: `examples/viral-short.json` (9:16 viral short) · `examples/silicon-island.json` (16:9 short film) · `examples/ai-reel-cinematic.json` (9:16 reel) ·
`examples/classic/` (the old flat style, only if asked).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Atmospheric placeholders instead of photos | no network or no results: set `PEXELS_API_KEY` / `UNSPLASH_ACCESS_KEY`, broaden the query, or give local files |
| Wrong / weak image | rewrite the query (subject + light + angle), or append `#2` / `#3` |
| Title hard to read | `align: "left"` or `"center"`, `scrim: 1.3`, or a darker `look` (`noir`) |
| `No Chrome/Chromium found` | `npx playwright install chromium` or `--chrome "/path/to/chrome"` |
| `missing dependency` | `cd engine && npm install` |
| No voice | needs internet; check the `[cinelume] voiceover:` log line, or supply `voiceover` files |
| Letterbox not wanted | `"meta": { "letterbox": false }` (or per scene) |
| Want silence | `"audio": {"music": "none"}`, `"meta": {"sfx": false}` |
