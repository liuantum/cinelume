# Sticker & icon catalog (52)

All stickers are vector, themed to the scene palette, get a white die-cut outline + drop shadow
(except line-art ones, which **draw themselves on**), pop in with a bounce + SFX and idle-wiggle.

| group | names | typical use |
|---|---|---|
| **Draw-on annotations** | `arrow` `arrow-curve` `arrow-straight` `circle` `underline` `cross` `check` `bracket` `scribble` | point at a bar, circle a city, cross out a myth, tick a fact |
| **Text badges** (use `text`) | `burst` `badge` `label` `banner` `bubble` `note` | "NEW", "+300%", "WAIT…", "VS", sticky-note asides |
| **Shapes** | `star` `sparkle` `heart` `tape` `pin` `pushpin` | decoration, marking places, taping photos |
| **Signals** | `exclaim` `question` `warning` `fire` `lightning` `clock` `lock` `trophy` `flag` | urgency, mystery, risk, speed, time, security, winner |
| **Tech & money** | `chip` `robot` `brain` `laptop` `phone` `globe` `building` `rocket` `bulb` `dollar` `money` `chart-up` `chart-down` `magnifier` `cursor` `hand` `person` | topical icons; also used by `flow`, `icongrid`, `compare`, placeholders |
| **Reaction faces** | `face-smile` `face-shock` `face-think` `face-sad` `face-money` `face-fire` `face-cool` `face-mindblown` | the "emoji reaction" beat after a surprising fact |

## Placement cheatsheet
- 16:9: free zones are usually the right third (`x: 75–88`) and top corners (`y: 15–25`).
- 9:16: top band (`y: 12–22`) and the sides of the middle (`x: 15` or `85`); keep `y < 78`
  so captions stay clear.
- Arrows: put the sticker *beside* the target and rotate with `rot` so the head points at it.
- `at`: 0.3–0.6 s after the thing it reacts to appears (titles ≈ 1.2–1.8 s).
- `size`: 6–9 small accent, 12 default, 16–20 hero reaction.

## Examples
```json
{ "type": "arrow-curve", "x": 70, "y": 28, "size": 16, "rot": 20, "at": 1.6, "color": "#E5402F" }
{ "type": "burst", "text": "+300%", "x": 82, "y": 22, "size": 14, "at": 2.0 }
{ "type": "note", "text": "wait, what?", "x": 20, "y": 18, "size": 12, "rot": -6, "at": 1.5 }
{ "type": "face-mindblown", "x": 84, "y": 70, "size": 18, "at": 2.2, "idle": "bob" }
{ "type": "circle", "x": 52, "y": 46, "size": 22, "at": 1.0, "color": "#FFD21F" }
```
