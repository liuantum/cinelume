# Sticker catalog

Cinelume ships a **premium set** designed to look like a film's title-design department made it:
fine strokes that draw themselves on, frosted-glass chips, light objects with real bloom, line icons, and real
photo cut-outs. Use these on cinematic themes. The old cartoon set (emoji faces, bursts, sticky notes, tape…) is
kept only for `classic` themes, and the validator warns if you use it with a cinematic theme.

All positions are `x`, `y` in **% of the frame** (centre of the sticker); `size` is **% of the short side**;
`at` is seconds from scene start. Premium stickers enter with a soft blur-in and drift very slightly — no wiggle, no bounce.

## Premium set

| kind | names | what it is | key fields |
|---|---|---|---|
| **Fine annotation** (draws on) | `ring` `arrow-fine` `arrow-line` `underline-fine` `bracket-fine` `cross-fine` `check-fine` `corners` `focus` `divider` | hairline hand-set strokes | `color`, `size`, `rot`, `aspect` (stretch, e.g. corners), `weight` |
| **Callout** | `leader` | dot → angled leader line → label, like a museum caption | `text`, `sub`, `textSize` |
| **Seal** | `seal` | thin double ring with tracked caps inside ("VS", "1987", "EST.") | `text`, `textSize` |
| **Glass chips** | `tag` `pill` `timestamp` `location` `stat` `rec` | frosted glass, Manrope type | `text`, `sub`, `icon`, `value` (stat), `size` (chip height) |
| **Light** | `pulse` `pin-glow` `glint` `flare` `orb` | glowing objects with bloom; `pulse` emits rings forever | `color`, `size`, `aspect` (flare) |
| **Photo** | `photo` | a real photo cut into a circle / rounded tile with a fine white rim | `media` (any media value), `shape`, `label`, `look`, `aspect` |
| **Line icons** | `icon-chip` `icon-cpu` `icon-globe` `icon-bolt` `icon-shield` `icon-trend-up` `icon-trend-down` `icon-dollar` `icon-lock` `icon-eye` `icon-clock` `icon-cloud` `icon-user` `icon-users` `icon-building` `icon-factory` `icon-phone` `icon-laptop` `icon-server` `icon-search` `icon-target` `icon-rocket` `icon-spark` `icon-warning` `icon-check` `icon-flag` `icon-film` `icon-brain` `icon-drop` `icon-camera` `icon-mic` `icon-pin` `icon-ship` `icon-heart` `icon-key` | consistent 3.6-px line icons; as a sticker they sit in a glass disc. Also usable as `icon` in `tag`, `location`, `flow` steps and `compare` sides (`"icon": "bolt"`) | `color`, `size` |

On cinematic themes, any classic icon name used by `flow`, `compare`, `icongrid` or placeholders (`chip`, `globe`, `rocket`…)
is automatically swapped for its line-icon version.

## When to use what
- **Name a thing in the frame** → `leader` with `text` + `sub` (place the dot on the object).
- **Point at a detail** → `ring` around it, or `arrow-fine` beside it (rotate with `rot`).
- **Where / when** → `location` ("Taiwan Strait") or `timestamp` ("04:12 AM · HSINCHU").
- **A number that supports the shot** → `stat` with `value` + `sub`.
- **Documentary / found-footage feel** → `rec` (live timecode) + `corners` (use `establishing` with `viewfinder: true`).
- **A person, product or place inset** → `photo` with `media: "search:…"` and a `label`.
- **A moment of beauty** → `glint` or `flare` on a highlight in the image.
- **A map or a place on a photo** → `pulse` on the spot.

## Placement
- 16:9 letterboxed scenes: keep `y` between ~18 and ~82 (bars cover the rest).
- 9:16: keep `y < 76` so captions stay clear; top band `y: 12–22` is usually empty.
- Glass chips read best on darker parts of the image; on `ivory` they turn into white glass automatically.
- `at`: 0.4–0.8 s after the thing it annotates appears; never more than 2 premium stickers per scene.

## Examples
```json
{ "type": "leader", "text": "EUV scanner", "sub": "Veldhoven, NL", "x": 74, "y": 40, "size": 22, "at": 1.8 }
{ "type": "ring", "x": 30, "y": 68, "size": 12, "at": 1.6 }
{ "type": "location", "text": "Taiwan Strait", "x": 82, "y": 22, "at": 1.6 }
{ "type": "timestamp", "text": "04:12 AM · HSINCHU", "x": 20, "y": 22, "at": 0.8 }
{ "type": "stat", "value": "92%", "sub": "advanced chips", "x": 80, "y": 26, "size": 7, "at": 2.0 }
{ "type": "tag", "text": "Grid capacity", "icon": "bolt", "x": 50, "y": 22, "at": 1.4 }
{ "type": "photo", "media": "search:lithography machine cleanroom", "label": "ASML EUV", "x": 76, "y": 42, "size": 22 }
{ "type": "pulse", "x": 52, "y": 46, "size": 9, "at": 1.4 }
{ "type": "glint", "x": 71, "y": 30, "size": 6, "at": 2.2 }
{ "type": "corners", "x": 50, "y": 50, "size": 60, "aspect": 1.6, "color": "rgba(255,255,255,.7)" }
{ "type": "rec", "x": 86, "y": 20, "at": 0.4 }
```

## Classic set (legacy — classic themes only)
`arrow` `arrow-curve` `arrow-straight` `circle` `underline` `cross` `check` `bracket` `scribble` `sparkle` `star` `burst`
`badge` `label` `banner` `bubble` `note` `tape` `pin` `pushpin` `exclaim` `question` `warning` `heart` `fire` `lightning`
`rocket` `bulb` `clock` `lock` `dollar` `chip` `robot` `globe` `chart-up` `chart-down` `magnifier` `cursor` `hand` `person`
`building` `phone` `laptop` `brain` `money` `flag` `trophy` and the `face-*` reaction faces. These have a white die-cut
outline, pop with a bounce and wiggle. Use them only with `paper`, `dark`, `yellow`, `blueprint`, `red`, `navy` or `mint`.

## Vox set (`vx-*`) — glossy die-cut stickers with the Vox pop

Used with **Vox motion** (`meta.motion: "vox"`, the default on viral and archive themes): stickers land with an overshoot pop,
a confetti burst and a gentle wiggle, hand-drawn marker annotations draw themselves on, photos sit in taped prints.

| group | names |
|---|---|
| Objects | `vx-fire` `vx-bolt` `vx-star` `vx-heart` `vx-rocket` `vx-check` `vx-cross` `vx-arrow` `vx-money` `vx-rupee` `vx-up` `vx-down` `vx-globe` `vx-chip` `vx-brain` `vx-bulb` `vx-trophy` `vx-target` `vx-clock` `vx-lock` `vx-india` |
| Faces (modern 3D style) | `vx-wow` `vx-mindblown` `vx-cool` `vx-think` `vx-laugh` `vx-love` |
| Text (use `text`) | `vx-label` (pill) `vx-burst` (starburst) `vx-bubble` (speech bubble, set `aspect` for long text) `vx-note` (sticky note, marker font) `vx-tape` |
| Marker draw-ons (Vox classics) | `circle` `arrow` `arrow-curve` `arrow-straight` `underline` `scribble` `cross` `check` `bracket` |

Classic names (`fire`, `face-shock`, `burst`, `note`…) are automatically upgraded to their `vx-*` versions on modern themes.
On the paper `archive` theme prefer marker draw-ons in red (`"color": "#C2271E"`), `vx-note`, `vx-tape` and the `story` props over emoji faces.

```json
{ "type": "vx-wow", "x": 80, "y": 22, "size": 14, "at": 2.0 }
{ "type": "vx-label", "text": "1985", "x": 20, "y": 23, "size": 7, "rot": -6, "at": 1.0 }
{ "type": "vx-bubble", "text": "Silicon Valley of India", "x": 74, "y": 62, "size": 8, "aspect": 4.4, "textSize": 0.27, "at": 2.6 }
{ "type": "circle", "x": 50, "y": 38, "size": 30, "at": 2.6, "color": "#C2271E" }
```

## Characters — stickers that act out the story

Original Vox-style cut-out paper people (big head, die-cut white rim) with moving parts. Put them in any scene with
`cast` (plus scene-level `actions`), or as a single `{ "type": "character", … }` sticker.

```json
"cast": [
  { "id": "eng", "role": "engineer", "skin": "fair", "x": 28, "y": 94, "size": 40, "enter": "walk", "from": "left", "at": 0.1 },
  { "id": "boss", "role": "founder-f", "x": 72, "y": 94, "size": 40, "flip": true, "talk": true }
],
"actions": [
  { "who": "eng", "do": "say", "at": 1.3, "text": "We need a satellite link!", "dur": 2.0 },
  { "who": "eng", "do": "shock", "at": 3.6 },
  { "who": "boss", "do": "walk", "at": 4.0, "to": 55, "dur": 1.0 }
]
```

| field | values |
|---|---|
| `role` | `engineer` `founder` `founder-f` `worker` `scientist` `doctor` `student` `farmer` `official` `person` `person-f` |
| look overrides | `skin` (`light` `fair` `medium` `tan` `brown` `deep` or a hex), `hair` (`short` `long` `bun` `ponytail` `curly` `bald` `cap` `hardhat` `strawhat`), `hairColor`, `outfit`, `style` (`hoodie` `blazer` `suit` `labcoat` `vest` `shirt` `tee`), `pants`, `glasses`, `beard`, `prop` (`laptop` `phone` `clipboard` `briefcase` `megaphone` `coffee` `sign` + `propText`, `backpack`) |
| placement | `x` (centre, % of width), `y` (feet line, % of height), `size` (% of frame height), `flip` (face left), `layer` |
| entrance | `enter`: `pop` (Vox pop + confetti) · `walk` (+`from: left/right`) · `rise` · `drop` · `none`; `at` |
| standing pose | `pose`: `idle` `wave` `point` `cheer` `think` `shock`; `mood`: `happy` `sad` `neutral` |
| lip-sync | `talk: true` — the mouth moves while the scene's narration plays |
| photo head | `head: "cutout:search:…"` or a local photo — a real cut-out head on a drawn body (the classic Vox big-head collage) |
| `actions` | `walk` (`to`, `dur`) · `exit` (`to: left/right`) · `wave` · `point` (`dir: up`) · `cheer` · `think` · `shock` · `jump` · `say` (`text`, `dur` → speech bubble + lip-sync) · `face` (`mood`) |

Characters blink, breathe and sway on their own. When a scene has a cast, captions move to the top of the frame
automatically (`captionsAt: "bottom"` to override).

## Real photo stickers & your own sticker packs

```json
{ "type": "image", "media": "cutout:search:vintage satellite dish", "x": 70, "y": 45, "size": 26 }
{ "type": "image", "media": "pack:bullock-cart", "x": 30, "y": 60, "size": 22 }
{ "type": "pack:rocket", "x": 80, "y": 25, "size": 14 }
```
- `cutout:` removes the background (needs `pip install rembg`), then the photo becomes a die-cut sticker that pops,
  bursts and wiggles like the built-in ones. Works with `search:` stock results (credited) and local files.
- **Sticker packs:** put PNG / WebP / SVG files you are allowed to use in `stickers/` next to the storyboard, or in
  `~/.cinelume/stickers/` (or `$CINELUME_STICKERS`), and use them by file name: `pack:<name>`.
- Story props drawn for the skill: `vx-dish` (satellite dish), `vx-cart` (bullock cart), `vx-laptop`, `vx-office`, `vx-news`.

## No sticker for it? `find:` searches the internet and animates the result

When the story needs a thing the built-in set doesn't have (a tiger, a robot, a tractor, a dosa, a chai glass, a
company logo…), ask for it by name. Cinelume picks the first source that has it:

1. a **built-in** drawn sticker if one fits (`find:rocket` → `vx-rocket`, `find:satellite dish` → `vx-dish`)
2. your **sticker pack** (`stickers/`, `~/.cinelume/stickers/`, `$CINELUME_STICKERS`), matching file names by words
3. **Iconify colour emoji sets**: Fluent Emoji (3D-style), Noto, Twemoji, OpenMoji, EmojiOne… (open licences, no key). Add
   the word `logo` for brand logos (`find:google logo`)
4. **Openverse** illustrations & clipart (CC0 / CC BY / CC BY-SA), then **Wikimedia Commons** drawings & PNGs
5. a **real photo** (Pexels / Unsplash / Pixabay if you set keys, else open photos) with the **background removed**

Online finds are cached, cut out to a transparent PNG when needed (rembg, or a flat-background fill), credited in
`credits.txt`, and get the full sticker animation: pop, confetti burst, wiggle, white die-cut rim. If nothing is found
(or you're offline) the sticker becomes a glossy text label so the frame is never empty.

```jsonc
{ "type": "find:tiger", "x": 72, "y": 30, "size": 18 }
{ "type": "find:photo:tractor", "x": 30, "y": 70, "size": 24, "from": "left" }       // force a cut-out photo
{ "type": "find:clipart:bullock cart", "x": 45, "y": 78, "size": 16 }               // prefer clipart
{ "type": "sticker", "query": "masala dosa", "source": "emoji", "x": 50, "y": 40 }  // long form
{ "type": "image", "media": "find:auto rickshaw", "x": 60, "y": 60, "size": 20 }    // same, as media
```
`source`: `any` (default, order above) · `emoji` · `clipart` · `photo`.

**Preview candidates first** (recommended for hero props): `node engine/sticker-search.mjs "auto rickshaw" --n 3 --out stickers/`
downloads the top three into the pack folder with a `CREDITS.txt`. Look at them, keep the best, use `pack:auto-rickshaw`.

Rules: only openly licensed sources are searched (credits are kept for you). Real people: public figures in a news context
only, never private individuals. Logos: refer to the company, don't imply endorsement.

## Sticker motion (any sticker: built-in, found, pack, photo)

| field | effect |
|---|---|
| `from: "left" \| "right" \| "top" \| "bottom"` | drives / slides in from off-screen to `x,y` (instead of popping); `travel` = seconds (1.2) |
| `moves: [{ "x": 80, "y": 15, "at": 1.6, "dur": 1.2 }]` (or `to: {…}`) | travels to new positions on cue (eased); chain several |
| `exit: "right"`, `exitAt: 3.0` | leaves the frame on cue |
| `flip: true` | mirror it (so the cart faces the way it drives) |
| `idle` | `wiggle` (Vox default) · `bounce` · `float` · `bob` · `sway` · `shake` · `roll` · `pulse` · `breathe` · `spin` · `drift` · `null` |
| `roll: false` | no wheel-bump while travelling |
| `out` | fade out at this time |

Example beat — the cart rolls in carrying the dish, stops, then leaves:
```json
{ "type": "vx-cart", "x": 60, "y": 74, "size": 30, "at": 0.4, "from": "left", "exit": "right", "exitAt": 4.2 }
```
