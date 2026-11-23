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
| `theme` | **Vox edit:** `archive` `newsroom` · **viral shorts:** `neon` `sunset` `electric` `aurora` `candy` · **cinematic:** `noir` `film` `ivory` `midnight` `ember` `slate` · classic: `paper` `dark` `yellow` `blueprint` `red` `navy` `mint` | `noir` | per-scene `theme` overrides. Cinematic themes switch on the premium layer (serif titles, glass UI, graded photos, letterboxing, light leaks, cinematic score) |
| `grade` | `vivid` `teal-orange` `warm` `cool` `noir` `bleach` `none` | per theme | global colour grade over the whole frame |
| `letterbox` | `true` / `false` / ratio number (e.g. `2.39`, `1.85`) | auto | auto = bars slide in on `cinematic`, `establishing`, `opening`, `narrative`, `depth` scenes (16:9 only) and out for data scenes; per-scene `letterbox` overrides |
| `lightLeaks` | number 0–1 / `false` | `0.14` on cinematic themes | ambient warm light drifting across the frame |
| `bpm` | number | from music | tempo used for beat-synced cuts; set it when you supply your own music file |
| `beatSync` | bool | true | snap scene cuts to beats (only when a bpm is known) |
| `beatPulse` | number | `0.022` on viral themes | camera zoom pulse on each kick (0 = off) |
| `progress` | bool | true on viral themes | gradient retention bar at the top |
| `placeholderLabels` | bool | true | show the search query on atmospheric placeholders |
| `bg` | background kind (below) | `atmos` (cinematic) / `paper` | default background for all scenes |
| `captions` | `voxedit` (big caption words mid-frame, alternating bold sans / italic serif, `==word==` in narration becomes a red box) `viral` (giant word-by-word pop, each phrase a new colour) `cinema` `subtitle` `karaoke` `boxed` `minimal` `none` / `false` | cinematic: `cinema` (9:16) / `subtitle` (16:9); classic: `karaoke` / `boxed` | built from each scene's `narration`. `cinema` = words brighten as they're spoken; `subtitle` = film subtitles (sit inside the letterbox bar when it's down) |
| `voice` | offline studio (Kokoro): `studio-female` `studio-male` `studio-hype` `studio-deep` `studio-uk-male` `studio-uk-female` `studio-hindi-male` `studio-hindi-female` `kokoro:<id>` · Edge neural: `hype` `hype-female` `creator` `creator-female` `indian-creator` `indian-creator-female` `storyteller` `storyteller-female` `documentary` (British) `documentary-female` `trailer` `indian-storyteller` `auto` `male` `female` `narrator` `news` `uk-male` `uk-female` `indian-male` `indian-female` `hindi-male` `hindi-female` `telugu-*` `tamil-*` `australian-*` `spanish-*` `french-*` `german-*`, any Edge id (`en-US-AvaNeural`), `say:Voice`, `espeak`, `gtts:lang`, or `none` | `auto` | built-in neural TTS speaks every scene's `narration`; scenes stretch to fit the voice; captions sync to it |
| `voiceRate` | e.g. `+10%`, `-5%` | `-2%` cinematic / `+5%` classic | speaking speed |
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
| `music` | `auto` | shorts (beat-synced): `auto:viral` (140 bpm trap, default on viral themes), `auto:upbeat` (118 pop), `auto:phonk` (128), `auto:hype` (150) · cinematic scores: `auto:cinematic` (default on cinematic themes), `auto:suspense` (heartbeat pulse), `auto:hopeful`, `auto:epic` (taiko drums), `auto:ambient` · classic beds: `auto:tense`, `auto:calm` · `none` · or a file path (looped) |
| `musicVolume` | 0.35 | auto-ducks under voiceover |
| `voiceFx` | true | broadcast voice chain (EQ, de-ess, compression, limiter); `false` = raw |
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
| `bg` | `atmos` (drifting light + dust, cinematic default) `haze` `black` `paper` `texture` `grid` `dots` `lines` `halftone` `stripes` `rays` (rotating sunburst) `gradient` `spotlight` `plain` |
| `colors` | override theme colours: `{ "accent": "#E5402F", "hl": "#FFD21F", "bg": "…", "ink": "…" }` |
| `stickers` | array of sticker objects (below) |
| `lowerThird` | `{ "title": "Name", "sub": "Role" }` |
| `source` | text shown as "Source: …" bottom-left |
| `sfx` | extra sound cues: `[{ "type": "ding", "at": 1.2 }]` (any SFX name or an audio file path) |

### Rich-text markup (headline, text, lines, label, caption, body, title…)
`==highlight==` · `**accent**` · `__underline__` · `[[circle]]` · `~~strike~~` · `{{box}}` · `\n` line break.

### Sticker object (premium set — see stickers.md)
```json
{ "type": "leader", "text": "EUV scanner", "sub": "Veldhoven, NL", "x": 74, "y": 40, "size": 22, "at": 1.8 }
{ "type": "tag", "text": "Grid capacity", "icon": "bolt", "x": 50, "y": 20, "at": 1.4 }
{ "type": "stat", "value": "92%", "sub": "of advanced chips", "x": 80, "y": 24, "size": 7, "at": 2 }
{ "type": "photo", "media": "search:moon surface", "label": "Our Moon", "x": 76, "y": 42, "size": 22, "shape": "circle" }
{ "type": "ring", "x": 52, "y": 46, "size": 18, "at": 1.0, "color": "#D6AE62" }
```
Premium fields: `text`, `sub`, `value`, `icon` (glass chips), `media` + `shape: circle|rounded|square` + `label` (photo),
`aspect` (stretch line stickers like `corners`), `weight` (line thickness), `color`, `at`, `size`, `x`, `y`, `fx`, `idle`.

### Classic sticker object
```json
{ "type": "arrow", "x": 70, "y": 30, "size": 12, "rot": -10, "at": 1.2,
  "text": "NEW", "color": "#E5402F", "textColor": "#fff", "fx": "popBig",
  "idle": "wiggle", "layer": "fg", "out": 4.0 }
```
`fx`: none fade pop popBig rise riseBig drop slideL slideR slideU slideD stamp zoom spin blur wipe wipeUp flipX swing typeOn
`idle`: wiggle float breathe pulse spin bob (or `null`) · draw-type stickers (arrows, circle, underline, check, cross…) draw themselves on.

### Media value
local path · https URL · `search:query` (best realistic photo across providers) · `search-video:query` (real footage; falls back to a photo) ·
`pexels:` `unsplash:` `pixabay:` `openverse:` `wikimedia:` `pexels-video:` `pixabay-video:` · append `#2`, `#3` to take the 2nd/3rd best result.
Provider chain for `search:` → Pexels → Unsplash → Pixabay (each needs its free key: `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`,
`PIXABAY_API_KEY`) → **Openverse** and **Wikimedia Commons** (no key, openly-licensed photos) → atmospheric placeholder.
Results are scored for orientation, aspect and resolution; every credit/licence lands in `<video>.credits.txt`.
Write queries like a cinematographer: subject + light + angle + mood — `"container ship aerial sunset"`, `"cleanroom engineer yellow light"`.
Media objects inside arrays may be `{ "src": "...", "label": "...", "look": "duotone" }`.
`look`: `cine` (graded teal/orange film look — default on cinematic themes) `noir` (high-contrast B&W) `warm` `cool` `bleach` · classic: `color` `duotone` `bw` `halftone` `vintage`.

## Scene types

### story (Vox edit)
`frame`: `full` | `print` | `polaroid` | `cutout` | `tv` | `clipboard` | omit for a paper-only shot · `media` (use `"cutout:<media>"` for
background removal — needs `pip install rembg`) · `look` (default `archive`: B&W halftone print) · `year` (bracketed, e.g. "in 1985") ·
`name` (italic serif label) · `tag` (+`tagAt`) red box label · `text` big words (+`spot`: `true` or a colour) · `note` (typed on the
clipboard) · `magnifier: true` (or `{ "path": [[x,y],…] }` in 0–1 frame units) · `x`, `y`, `size`, `aspect`, `rot` for prints/cut-outs.
Default camera `push-in-slow`, default 4.5 s, default motion `vox`.

### hook (viral shorts)
`lines[]` (or `text`) — 2–3 short lines that punch in word by word (last line in the theme's first colour; `colorLast: false`
to disable), `media` (vivid, darkened by `scrim`, default 0.75), `kicker` (pill), `size`, `upper: false` for sentence case.
Default camera `punch-in`, default 2.4 s, captions off for this scene (set `"captions": true` to keep them).
Any scene accepts `"captions": false` to hide captions while its text is on screen.

### Cinematic scenes (new)

#### cinematic
Full-bleed real photo/footage, graded, with a film title. `media` (or `query`), `kicker`, `title`/`headline` (required), `sub`,
`align: bottom-left|bottom|left|center`, `intro: fade|slit|blur|none`, `font: "film"` (Cinzel caps instead of serif), `scrim` (0–1.5 darkness),
`flare: false`, `size`, `look`. Default camera `dolly-in`; letterboxed in 16:9.

#### establishing
Documentary place/time stamp typed over footage. `location` (required), `time`, `date`, `coords`, `media`/`query`,
`viewfinder: true` (camera corners + REC timecode), `align`. Default camera `truck-right`.

#### opening
Film title card. `presenter` ("Liuantum presents"), `title` (required, tracks in from wide letter-spacing with a lens flare),
`tagline`/`sub`, optional `media` (dimmed, `dim` 0–1). Braam + swell sound design. Default camera `slow-push`.

#### narrative
Documentary intertitles: serif `lines[]` (or `text`) surface one by one; `media` behind (darkened), `italic`, `align: left|center`,
`dimPrevious` (default true), `size`. Default camera `steadicam`.

#### depth
2.5D parallax plate: `media` background, `headline` (required), `kicker`, `sub`, optional `foreground` (cut-out PNG:
`"fg.png"` or `{ "media": "fg.png", "x": 72, "y": -4, "size": 62 }`), `particles` (floating dust count, default 18),
`font: "sans"`. Default camera `parallax`.

### Core scenes (all restyled automatically on cinematic themes)

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

## Scene cast & actions (character stickers)

Any scene may add `cast` (array of characters) and `actions` (timed directions). Full field list in
[`stickers.md`](stickers.md#characters--stickers-that-act-out-the-story).

```json
{ "type": "story", "duration": 5,
  "cast": [{ "id": "eng", "role": "engineer", "x": 26, "y": 94, "size": 40, "enter": "walk", "from": "left" }],
  "actions": [{ "who": "eng", "do": "say", "at": 1.3, "text": "We need a satellite link!" }] }
```
`who` must match a cast `id`; `at` is seconds from scene start. Captions move to the top while a cast is on screen
(`captionsAt: "bottom"` to keep them low).
