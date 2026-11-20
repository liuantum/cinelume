# Storyboard schema (complete reference)

A storyboard is one JSON file: `{ "meta": {…}, "audio": {…}, "scenes": [ … ] }`.
Coordinates for stickers are **percent of the frame** (`x: 0` left → `100` right, `y: 0` top → `100` bottom).
Sizes are **percent of the frame's short side** (so they look the same in 16:9 and 9:16).
Times (`at`) are **seconds from the start of the scene**.

## meta

| field | type | default | notes |
|---|---|---|---|
| `title` | string | – | used in logs / player title |
| `format` | `16:9` \| `9:16` \| `1:1` \| `4:5` | `16:9` | CLI `--format` overrides |
| `resolution` | number | 1080 | short side in px (`--res`) |
| `fps` | number | 30 | |
| `theme` | `paper` `dark` `yellow` `blueprint` `red` `navy` `mint` | `paper` | per-scene `theme` overrides |
| `bg` | background kind (below) | `paper` | default background for all scenes |
| `captions` | `karaoke` `boxed` `minimal` `none` / `false` | `karaoke` (9:16) / `boxed` | built from each scene's `narration` |
| `voice` | `auto` `male` `female` `narrator` `news` `uk-male` `uk-female` `indian-male` `indian-female` `hindi-male` `hindi-female` `telugu-*` `tamil-*` `australian-*` `spanish-*` `french-*` `german-*`, any Edge id (`en-US-AvaNeural`), `say:Voice`, `espeak`, `gtts:lang`, or `none` | `auto` | built-in neural TTS speaks every scene's `narration`; scenes stretch to fit the voice; captions sync to it |
| `voiceRate` | e.g. `+10%`, `-5%` | `+5%` | speaking speed |
| `handle` | string | – | small watermark top-right |
| `progress` | bool | false | yellow progress bar at bottom |
| `transition` | transition name | rotating set | default transition between scenes |
| `grain` | bool | true | animated film grain |
| `vignette` | bool | true | |
| `sfx` | bool | true | synthesized whooshes, pops, dings… |
| `audio` | bool | true | `false` renders silent video |

## audio

| field | default | notes |
|---|---|---|
| `music` | `auto` | `auto` (calm lo-fi bed), `auto:tense`, `auto:calm`, `none`, or a file path (looped) |
| `musicVolume` | 0.35 | auto-ducks under voiceover |
| `voiceover` | – | ONE audio file for the whole video (disables TTS; set scene `duration`s to match) |
| `voiceoverOffset` | 0 | seconds |
| `sfxVolume` | 0.55 | |

## Fields shared by every scene

| field | notes |
|---|---|
| `type` | scene type (below) — required |
| `duration` | seconds; default = max(type default, words(narration)/2.6 + 1); stretched to fit `voiceover` |
| `narration` | spoken/caption text for this scene (markup is stripped for captions/TTS) |
| `voiceover` | audio file for this scene (overrides TTS); scene stretches to fit it |
| `voice` | per-scene voice override (e.g. a second speaker) |
| `camera` | preset name or object (see camera-and-transitions.md) |
| `transition` | transition **into the next** scene |
| `theme` | per-scene theme |
| `bg` | `paper` `texture` `grid` `dots` `lines` `halftone` `stripes` `rays` (rotating sunburst) `gradient` `spotlight` `plain` |
| `colors` | override theme colours: `{ "accent": "#E5402F", "hl": "#FFD21F", "bg": "…", "ink": "…" }` |
| `stickers` | array of sticker objects (below) |
| `lowerThird` | `{ "title": "Name", "sub": "Role" }` |
| `source` | text shown as "Source: …" bottom-left |
| `sfx` | extra sound cues: `[{ "type": "ding", "at": 1.2 }]` (any SFX name or an audio file path) |

### Rich-text markup (headline, text, lines, label, caption, body, title…)
`==highlight==` · `**accent**` · `__underline__` · `[[circle]]` · `~~strike~~` · `{{box}}` · `\n` line break.

### Sticker object
```json
{ "type": "arrow", "x": 70, "y": 30, "size": 12, "rot": -10, "at": 1.2,
  "text": "NEW", "color": "#E5402F", "textColor": "#fff", "fx": "popBig",
  "idle": "wiggle", "layer": "fg", "out": 4.0 }
```
`fx`: none fade pop popBig rise riseBig drop slideL slideR slideU slideD stamp zoom spin blur wipe wipeUp flipX swing typeOn
`idle`: wiggle float breathe pulse spin bob (or `null`) · draw-type stickers (arrows, circle, underline, check, cross…) draw themselves on.

### Media value
local path · https URL · `search:query` · `pexels:query` · `pixabay:query` · `pexels-video:query` · `pixabay-video:query`.
Media objects inside arrays may be `{ "src": "...", "label": "...", "look": "duotone" }`.
`look`: `color` `duotone` (yellow Vox duotone) `bw` `halftone` `vintage`.

## Scene types

### title
`kicker`, `headline` (required), `sub`, `media` (faint duotone background), `look`, `align: "left"|"center"`, `size`, `fx` (word animation).

### kinetic
`lines[]` (2–4 short phrases) or `text`; `font: "sans"` for Inter Black instead of Anton; `size`; `fx`; `dimPrevious` (default true).

### bignumber
`value` (required), `from`, `prefix`, `suffix`, `decimals`, `separator` (thousands commas, default true), `kicker`, `label`, `sub`, `color`, `size`, `countDur`.

### bar
`data[{label, value, color?, highlight?}]`, `title`, `subtitle`, `highlight` (label or index → only that bar is accent, others muted), `prefix`, `suffix`, `decimals`, `stagger`, `source`.

### line
`points[{label, y}]` (or `value`), `title`, `annotations[{x: "<label>", text}]` or `{index, text}`, `min`, `max`, `prefix`, `suffix`, `decimals`, `color`, `source`.

### donut
`value` (0–100), `title`, `label`, `decimals`, `color`, `source`.

### icongrid
`total` (≤ 100), `highlight` (count coloured), `icon` (any sticker name, default `person`), `title` (e.g. "1 in 4"), `label`, `columns`, `color`, `source`.

### map
- `highlight[]`: `"Country"` or `{ "name", "color", "label", "at" }` (common aliases: USA, UK, UAE, DRC, Korea…)
- `focus`: country name, array of names, or `{ "lon", "lat", "zoom" }` (zoom 1 = world, ~4 = continent, ~8 = country, 14+ = city/region)
- `from`: starting view (same forms as focus); default = 3× wider than focus
- `steps[]`: extra camera stops `{ "focus": …, "at": sec, "dur": sec }`
- `pins[{lon, lat, label, color, at}]`, `arcs[{from:[lon,lat], to:[lon,lat], color, at}]` (animated route with travelling dot)
- `title`, `labels: false` to hide country labels, `source`

### photo
`media` (or `image`/`video`), `frame`: `polaroid` (default, tape) · `cutout` (white sticker outline) · `circle` · `full` (full-bleed); `caption`, `look`, `label` (placeholder text), `aspect`, `rot`, `align`, `fx`, `lowerThird`, `source`.

### collage
`media[]` (2–6 items, strings or `{src, label, look}`), `title`, `look`, `stagger`.

### document
`outlet`, `date`, `headline`, `body[]` (each line can contain `==highlights==` which sweep in sequence), `stamp` (rubber-stamp banner text), `rot`, `source`.

### quote
`text` (required), `author`, `role`, `media` (circular portrait — user-supplied only), `look`, `size`, `source`.

### timeline
`events[{date, label, text?, media?, color?}]` (3–6), `title`. The track pans to each event.

### compare
`left` / `right`: `{ title, value?, prefix?, suffix?, label?, icon? | media?, points[]?, color? }`, `title`, `vs` (badge text), `source`.

### list
`items[]` (strings), `title`, `style: "check"` (drawn check marks instead of numbers), `dimPrevious`.

### flow
`steps[{label, icon?, color?}]` (3–5), `title`. Icons are sticker names; guessed from label if omitted.

### chapter
`number`, `title`. Looks best with `"theme": "yellow"` or `"red"`.

### screen
`device: "browser" | "phone"`, `url`, either `media` (screenshot/video, optional `scroll` %) or `kicker` + `headline` + `body[]`; `click: {x, y, at}` animates a cursor and click ripple; `caption` (marker tag), `source`.

### broll
`media[]` (each clip gets an equal share of the scene with a wipe between), `text` (big overlay headline), `lowerThird`, `look`, `source`.

### explain
`kicker`, `headline`, `body`, `bullets[]`, `media`, `mediaLabel`, `icon` (placeholder icon), `mediaSide: "left"|"right"`, `look`, `source`.

### outro
`headline`, `cta`, `handle`, `stickers` (omit for a default star/sparkle/heart set; `[]` for none).

## Default durations (seconds)
title 4 · kinetic 4 · bignumber 4.5 · bar 6 · line 6.5 · donut 5 · icongrid 5.5 · map 6.5 · photo 5 · collage 5.5 · document 6 · quote 5.5 · timeline 7 · compare 6 · list 6 · chapter 2.8 · screen 5.5 · broll 4.5 · explain 6 · flow 6 · outro 4
