# Camera moves, transitions & motion language

Every scene is built in three parallax layers — **bg** (depth 0.35), **mid** (1.0), **fg** (1.3) —
inside a virtual camera. Camera moves therefore produce real 2.5D parallax, and fast moves get
directional motion blur automatically. The layout's safe area shrinks to compensate for zoom,
so text never gets pushed off-frame.

## Camera presets (`"camera": "<name>"`)

| preset | what it does | use it for |
|---|---|---|
| `drift` (default) | slow diagonal Ken-Burns drift, zoom 1.02→1.08 | calm default, anything |
| `static` | locked off | dense charts, reading-heavy docs |
| `push-in` | eased zoom 1→1.16 | emphasis, building tension, titles |
| `push-in-slow` | linear zoom 1→1.07 | long quotes, slow reveals |
| `pull-out` | 1.2→1 | revealing context ("and it's not just here…") |
| `crash-zoom` | snap zoom to 1.32 + impact shake + boom SFX | shocking numbers, hooks |
| `zoom-out-reveal` | from 2.4× down to 1× | start on a detail, reveal the whole |
| `pan-left` / `pan-right` | lateral slide at 1.12× | bar charts, lists, timelines, collages |
| `tilt-up` / `tilt-down` | vertical slide | tall images, phone screens |
| `dolly-zoom` | foreground grows while background shrinks (vertigo) | dramatic realisation, photos |
| `orbit` | slight rotation + counter-drift | illustrations, explain scenes |
| `handheld` | organic camera shake | urgency, breaking news, kinetic type |
| `whip-in` | arrives from the side with blur, settles | energetic entries |
| `rack-focus` | background goes soft mid-scene | pull attention to foreground text |
| `rack-focus-in` | background starts soft, sharpens | quotes, reveals |
| `shake-hit` | strong decaying shake + boom | impact moments |
| `tilt-3d` | page lies back in 3D perspective and rises | documents, newspapers, screenshots |
| `spiral-in` | zoom + rotate settle | playful openers |

### Custom camera
```json
"camera": { "from": { "x": -0.04, "y": 0, "zoom": 1.0, "rot": -2, "tilt": 0 },
            "to":   { "x":  0.04, "y": 0.02, "zoom": 1.25, "rot": 1 },
            "ease": "inOut", "shake": 0.3 }
```
`x`/`y` are fractions of the frame, `rot` degrees, `tilt` degrees of 3D lean-back,
`ease`: linear in out inOut outExpo inExpo inOutExpo outBack outElastic outBounce.

## Transitions (`"transition": "<name>"` = how this scene hands off to the next)

| name | length | feel / when |
|---|---|---|
| `cut` | 0 | hard emphasis, comedic timing |
| `whip-left` `whip-right` `whip-up` `whip-down` | 0.5 s | signature Vox whip pan with motion blur + whoosh |
| `push` | 0.6 s | clean sequential push |
| `slide-up` | 0.6 s | next card slides over, previous recedes |
| `paper-slide` | 0.7 s | new sheet of paper slides in rotated, shadowed |
| `stack` | 0.7 s | next scene drops in with a bounce |
| `zoom-through` | 0.6 s | fly into the scene (go deeper) |
| `zoom-out` | 0.6 s | step back |
| `iris` | 0.7 s | circular reveal |
| `circle-burst` | 0.7 s | iris + push on outgoing scene |
| `tear` | 0.7 s | jagged paper-tear wipe |
| `wipe-diagonal` | 0.6 s | slanted wipe |
| `blinds` | 0.7 s | venetian-blind reveal |
| `flash` | 0.4 s | white flash cut |
| `glitch` | 0.45 s | RGB jitter, tech topics |
| `spin` | 0.7 s | rotating swap |
| `fade` | 0.6 s | soft dissolve (use sparingly) |

Rhythm tips: whips between related beats; paper-slide/stack for a new topic; flash or cut
right before a big number; iris into a map or reveal; `glitch` max once per video.

## Element animations (`fx`)
Words in headlines animate in one by one (`riseBig` for titles, `rise` elsewhere, `stamp` for
punches, `blur` for quotes). Marks (`==…==`, `[[…]]`…) draw after the words land, one after
another, each with a marker/scribble sound.

## Sound design (automatic)
Transitions → whoosh / paper / hit · stickers → pop · draw-on marks → scribble/swish ·
counters → tick-roll + ding · bars → tone · maps → soft whoosh + pin pops · crash-zoom → boom ·
cursor → click. Music bed auto-ducks under voiceover; final mix is loudness-normalised (-15 LUFS).
