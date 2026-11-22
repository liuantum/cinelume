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
