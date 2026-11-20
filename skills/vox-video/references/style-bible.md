# Vox-style visual bible (what the engine does, and how to lean into it)

## Look
- **Paper**: warm cream background (#EFE7D6) with fibre texture, animated film grain and a soft
  vignette. Everything looks printed, cut out and taped — not glossy.
- **Ink**: near-black #171614. **Accent**: Vox red #E5402F. **Highlighter**: yellow #FFD21F.
  Secondary data colours: blue #2D6FB7, teal #1E9C8F, purple #8E5CC4, orange #F28C28.
- **Type**: Anton (condensed caps) for headlines and numbers · Inter Black for statements and
  labels · IBM Plex Mono for kickers, dates and sources · Permanent Marker for handwritten notes
  · Playfair Display italic for quotes and newspaper mastheads.
- **Photos**: white polaroid border with tape, die-cut sticker outline, or yellow duotone
  (`look: "duotone"`) — the classic Vox treatment of archival imagery.
- **Maps**: flat equirectangular, muted land on paper, dotted graticule, countries fill with
  accent colour, black label tags, map pins and arcing routes with travelling dots.

## Motion principles
1. **Nothing is ever fully still.** Camera drift + idle wiggle on stickers + film grain.
2. **Ease everything.** Expo-out for arrivals, back-out (overshoot) for pops, in-out for camera.
3. **Stagger, don't dump.** Words arrive one by one; bars grow one after another; marks draw in
   sequence after text lands.
4. **Hand-made annotation.** Circles, underlines, arrows are wobbly strokes that draw on.
5. **Parallax depth.** Background moves less than foreground; fast moves get motion blur.
6. **Sound sells motion.** Every visible event has a matching SFX.

## Themes
| theme | when |
|---|---|
| `paper` | default, most topics |
| `dark` | night, crime, space, serious tone |
| `yellow` | chapter cards, outros, high-energy beats |
| `blueprint` | engineering, how-things-work, tech internals |
| `red` | breaking news, warnings |
| `navy` | finance, geopolitics, premium feel |
| `mint` | health, climate, nature |

## Do / Don't
- Do mix themes for rhythm (paper → yellow chapter → paper → dark twist).
- Do give every number a source or an "Illustrative" label.
- Don't put more than one hero element per scene.
- Don't use real people's photos unless the user supplied them; don't imitate a real outlet's
  branding for invented articles.
- Don't put stickers where captions are (bottom 20% in 9:16).
