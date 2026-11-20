---
name: vox-video
description: Turns a single prompt into a finished Vox-style explainer video (MP4) with motion graphics, camera moves, b-roll, maps, animated charts, hand-drawn highlights, stickers, kinetic captions, sound effects and music. Use when the user asks for an explainer video, a YouTube/Instagram/TikTok short or reel, "Vox style" or "Johnny Harris style" animation, a motion-graphics news recap, or an animated data story from a topic, script or article.
---

# Vox-Style Video Generator

One prompt in, a polished MP4 out. You write the script and a **storyboard JSON**; the bundled
engine renders it frame by frame in headless Chrome and muxes synthesized SFX, music and
optional voiceover with ffmpeg. Every frame is deterministic, so what you preview is what ships.

`SKILL_DIR` below means the folder containing this file
(e.g. `~/.claude/skills/vox-video`, `.agents/skills/vox-video`, or `~/.gemini/config/skills/vox-video`).

## 0. One-time setup (check, don't assume)

```bash
node -v            # need >= 18
ffmpeg -version    # need ffmpeg + ffprobe on PATH
cd "$SKILL_DIR/engine" && [ -d node_modules ] || npm install
```
Chrome/Chromium/Edge is auto-detected. If none is found: `npx playwright install chromium`.
Optional: `pip install edge-tts` (free neural voiceover), `PEXELS_API_KEY` or `PIXABAY_API_KEY`
env vars (real stock b-roll). Without them the engine draws designed placeholder art, never a blank.

## 1. Read the prompt → decide the brief (no questions unless truly ambiguous)

| Decide | Default | Signals |
|---|---|---|
| Format | `16:9` | "reel", "short", "TikTok", "story", "vertical" → `9:16`; "square"/"feed" → `1:1`; "4:5" |
| Length | short: 30–60 s (7–10 scenes) · explainer: 90–180 s (12–20 scenes) | explicit seconds/minutes win |
| Theme | `paper` (classic Vox cream) | "dark/night" → `dark`; tech/engineering → `blueprint`; bold/brand → `yellow`/`red`/`navy`; health/green → `mint` |
| Captions | `karaoke` for 9:16, `boxed` for 16:9 | "no captions" → `"none"`; `"minimal"` also available |
| Voice | none (captions + music carry it) | "voiceover", "narrate", "voice" → `meta.voice: "edge:en-US-AndrewNeural"` (or `auto`) |
| Handle/brand | none | any @handle or channel name → `meta.handle` |

## 2. Research, then write the script

- If you have web search, research the topic and **collect real numbers with sources**. Put the
  source in each data scene's `source` field. If you cannot verify a figure, either drop it or
  label the scene `"source": "Illustrative"`. Never present invented statistics as fact, never
  fabricate quotes from real people, and only use real outlet names in `document` scenes for
  headlines that actually ran.
- Use the Vox arc (details in `references/shot-planning.md`):
  **Hook** (surprising fact/question, ≤ 3 s) → **Context** → **Mechanism** (how it works) →
  **Evidence** (data) → **Stakes / twist** → **Payoff + CTA**.
- Narration pace: ~2.6 words/second. One idea per scene. Scene length ≈ words / 2.6 + 1 s
  (the engine computes this automatically if you omit `duration`; with voiceover, scenes
  stretch to fit the audio).

## 3. Shot-plan: turn each beat into a scene

Pick the scene type by what the beat *is*, not what it says:

| Beat is… | Scene `type` | Must-have fields |
|---|---|---|
| Opening hook / big claim | `title` | `headline` (+`kicker`, `sub`, `media`) |
| Punchy rhythm, 2–4 short phrases | `kinetic` | `lines[]` |
| One shocking number | `bignumber` | `value` (+`prefix`,`suffix`,`label`) |
| Ranking / comparison of quantities | `bar` | `data[{label,value}]`, `highlight` |
| Change over time | `line` | `points[{label,y}]`, `annotations[]` |
| A share / percentage | `donut` | `value` (0–100), `title` |
| "1 in N people" | `icongrid` | `total`, `highlight`, `title` |
| Place / geography / trade route | `map` | `highlight[]` and/or `focus`, `pins[]`, `arcs[]` |
| A thing, person, product | `photo` | `media`, `caption`, `frame` |
| Many examples at once | `collage` | `media[]` with labels |
| News report / official doc / study | `document` | `outlet`, `headline`, `body[]` with `==marks==` |
| A memorable line | `quote` | `text`, `author` |
| History / sequence of dates | `timeline` | `events[{date,label}]` |
| A vs B | `compare` | `left`, `right` |
| Takeaways / steps to watch | `list` | `items[]` |
| How a process works | `flow` | `steps[{label,icon}]` |
| Section break | `chapter` | `number`, `title` |
| An app, website, UI, post | `screen` | `device`, `headline` or `media`, `click` |
| Atmosphere / real footage | `broll` | `media[]`, `text`, `lowerThird` |
| Concept + illustration | `explain` | `headline`, `body`, `bullets[]`, `media` |
| Ending | `outro` | `headline`, `cta`, `handle` |

Rules that make it feel like Vox and not a slideshow:
1. **Never repeat a scene type back-to-back.** Alternate text-heavy and visual scenes.
2. **Every scene moves.** Give each one a `camera` (see `references/camera-and-transitions.md`):
   `push-in` for emphasis, `crash-zoom`/`shake-hit` for shocks, `pan-left/right` for charts
   and lists, `tilt-3d` for documents, `dolly-zoom`/`rack-focus` for reveals, `orbit` for
   illustrations, `drift` as the calm default, `handheld` for urgency.
3. **Annotate like a human with a marker.** Use rich-text marks in any headline/label/body:
   `==highlight==` (yellow marker sweep) · `**accent colour**` · `__hand-drawn underline__` ·
   `[[scribbled circle]]` · `~~strike-through~~` · `{{box}}`. 1–2 marks per scene, on the
   words that carry the meaning.
4. **Stickers are punctuation, not decoration.** 0–3 per scene, placed in empty space
   (`x`,`y` in % of frame), timed after the content lands (`at` ≈ 1–2 s). Use draw-on arrows/
   circles to point at things; emoji faces for reactions; `label`/`banner`/`burst` with
   `text` for tags. Full catalog: `references/stickers.md`.
5. **Vary transitions with intent**: `whip-left/right/up/down` (energy), `paper-slide`/`stack`
   (new topic), `zoom-through` (go deeper), `iris`/`circle-burst` (reveal), `tear`/
   `wipe-diagonal` (contrast), `glitch` (tech/disruption), `flash` (shock), `push` (sequence),
   `cut` (hard emphasis). If omitted the engine rotates a tasteful set.
6. **Colour discipline**: one accent per scene; use `highlight` on bars, `color` only for meaning.
7. Put 1 `chapter` card roughly every 4–6 scenes in videos longer than 90 s.

## 4. B-roll & media

`media`/`image`/`video` fields accept, in priority order:
- a **local file** the user gave you (path relative to the storyboard): `.jpg .png .webp .mp4 .mov…`
  (videos are frame-extracted and play in sync; use `look: "duotone"|"bw"|"halftone"|"vintage"`
  for the Vox photo treatment)
- an **https URL** to an image/video you are allowed to use
- `"search:<query>"` (or `pexels:…`, `pixabay:…`, `pexels-video:…`) → downloaded from stock APIs
  when a key is set, otherwise a designed illustrated placeholder labelled with the query
Do not put photos of real, identifiable people into videos unless the user supplied them.

## 5. Write → validate → preview → render

```bash
cd "$SKILL_DIR/engine"
node validate.mjs /abs/path/project/storyboard.json          # fix every ERROR it lists
node render.mjs  /abs/path/project/storyboard.json --stills auto   # one PNG per scene + contact-sheet.jpg
```
**Always open `contact-sheet.jpg` (and any suspicious still) and look at it** before the final render:
check text fits, nothing important is under captions, stickers don't cover content, maps are
framed on the right place. Fix the JSON and re-run stills until it's clean. Then:

```bash
node render.mjs /abs/path/project/storyboard.json --out /abs/path/project/video.mp4
# fast draft: --preview      vertical override: --format 9:16      4K: --res 2160
# scrub in a browser without rendering: --player
```
Keep the storyboard in its own project folder (the engine writes a `.vox-cache/` next to it).
Rendering speed is roughly 5–15 frames/s depending on cores (`--workers N`).

## 6. Deliver

Send the MP4 (and the storyboard JSON so the user can tweak it). In one or two lines say what
was assumed (format, length, voice, which numbers were illustrative) and offer one next step
(e.g. "add your voiceover file", "swap placeholders for your own footage").

## Storyboard skeleton

```json
{
  "meta": { "title": "…", "format": "9:16", "theme": "paper", "captions": "karaoke",
            "handle": "@you", "voice": "none", "progress": false },
  "audio": { "music": "auto", "musicVolume": 0.3 },
  "scenes": [
    { "type": "title", "kicker": "Explained", "headline": "Why ==everyone== wants this",
      "camera": "push-in", "transition": "whip-left",
      "narration": "Hook line spoken or captioned here.",
      "stickers": [{ "type": "arrow", "x": 78, "y": 30, "at": 1.4 }] }
  ]
}
```
Every field, default and option: `references/storyboard-schema.md`.
Complete working examples: `examples/ai-chip-war.json` (16:9, every scene type) and
`examples/ai-news-short.json` (9:16 reel).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Chrome/Chromium found` | `npx playwright install chromium` or `--chrome "/path/to/chrome"` |
| `missing dependency` | `cd engine && npm install` |
| Text too small/large | shorten the text (engine auto-fits) or set `size` (in % of short side) |
| Map shows wrong area | give `focus: {lon, lat, zoom}` explicitly (zoom 1 = whole world, 8 = a country) |
| Narration feels rushed | raise `duration` or cut words (validator warns over 3.3 words/s) |
| No voice | `pip install edge-tts`, set `meta.voice`, or give `voiceover` audio per scene / `audio.voiceover` for one file |
| Want silence | `"audio": {"music": "none"}` and `"meta": {"sfx": false}` |
