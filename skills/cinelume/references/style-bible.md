# Cinelume visual bible

The goal: every frame should look like a still from a well-made documentary or a film's title sequence —
real images, graded light, quiet confident type, motion that breathes. Nothing bounces, nothing wiggles,
nothing looks like clip-art.

## The look (cinematic themes)

| element | what the engine does |
|---|---|
| **Images** | real photos / footage from `search:` providers, graded with the `cine` look (lifted contrast, tamed saturation, teal shadows / warm highlights), slow camera moves, letterboxed to 2.39:1 on story scenes |
| **Type** | **Cormorant Garamond** (serif) for titles and narrative lines · **Cinzel** tracked caps for film titles and place names · **Manrope** for UI, numbers, captions and labels · IBM Plex Mono for timecodes and coordinates |
| **UI** | frosted-glass chips with a 1-px light edge; hairline rules; accent used sparingly (one per frame) |
| **Light** | ambient light leaks, lens-flare sweeps across titles, bokeh in atmospheric backgrounds, vignette, fine film grain, global colour grade |
| **Motion** | blur-in reveals (no pops), eased dolly/crane/truck moves, steadicam float, parallax depth, soft film transitions |
| **Sound** | generated cinematic score (pads, drone, arpeggio; suspense heartbeat; epic taiko), braams and impacts on chapter cards, swells into transitions, soft taps for UI, typewriter keys for place stamps |
| **Captions** | `cinema` (words brighten as spoken) in 9:16 · `subtitle` (film subtitles in the letterbox bar) in 16:9 |

## Themes

| theme | palette | grade | when |
|---|---|---|---|
| `noir` (default) | near-black, warm ivory ink, antique-gold accent | teal-orange | almost anything: tech, history, business, mystery |
| `film` | teal-black, cream ink, amber accent | teal-orange | travel, nature, human stories, golden-hour footage |
| `midnight` | deep navy, ice-blue accent | cool | space, AI, cyber, night cities |
| `ember` | smoked brown-black, ember-orange accent | warm | energy, war, industry, fire, drama |
| `slate` | graphite, teal accent | cool | finance, science, product, clean corporate |
| `ivory` | editorial paper-white, oxblood + gold | warm | culture, design, food, luxury, long-form essays |

Mix themes per scene sparingly — e.g. a `midnight` turn inside a `noir` film. Classic themes (`paper`, `dark`, `yellow`,
`blueprint`, `red`, `navy`, `mint`) still exist for the old flat motion-graphics look; use them only when asked.

## Principles
1. **Real images carry the story.** Data and diagrams are interludes between shots of the world.
2. **One idea per frame, one hero element, one accent.**
3. **Let it breathe.** Hold a shot 0.5–1 s after the line ends. Slow beats beat busy beats.
4. **Light, not decoration.** A glint, a flare, a light leak — never a cartoon sticker.
5. **Type is quiet.** Sentence case, generous size, no outlines, no marker highlights; emphasis is italic accent colour
   (`**word**`) or a fine gold underline (`==word==`).
6. **Sound sells it.** Score under everything, impacts on turns, silence before reveals.

## Do / Don't
- Do write `search:` queries with subject + light + angle + mood ("fishing boats harbour dawn fog aerial").
- Do give every number a `source` or label it `Illustrative`.
- Do use `establishing` to open locations, `chapter` with `dip-black` for act breaks, `outro` with a glass CTA.
- Don't use emoji faces, bursts, sticky notes, tape or polaroids on cinematic themes.
- Don't put text on the brightest part of an image; use `align` / `scrim` to keep it legible.
- Don't use photos of real, identifiable private people; don't fabricate quotes; don't dress invented stories in a
  real outlet's branding.
