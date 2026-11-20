# From one prompt to a shot list

## 1. Script formula (Vox / Johnny-Harris structure)

| beat | share of runtime | job | best scene types |
|---|---|---|---|
| Hook | 5–8% | a surprising fact, image or question in ≤ 3 s | `title` + `crash-zoom`, `bignumber`, `kinetic` |
| Context | 10–15% | where/when/who — orient the viewer | `map`, `timeline`, `photo`, `broll` |
| Mechanism | 20–30% | how it actually works | `explain`, `flow`, `screen`, `compare` |
| Evidence | 20–30% | the data that proves it | `bar`, `line`, `donut`, `icongrid`, `document` |
| Stakes / twist | 10–15% | why it matters, what's surprising | `quote`, `kinetic`, `bignumber`, `map` arcs |
| Payoff | 5–10% | the takeaway + what to watch | `list`, `outro` |

Write narration as spoken English: short sentences, concrete nouns, one claim per sentence.
Hooks that work: a counter-intuitive number ("90% of…"), a "this tiny thing…" object, a
question the viewer can't answer, a before/after contrast.

## 2. Pacing math
- Speech ≈ 2.6 words/s (shorts can run 3.0). Scene length = words/2.6 + ~1 s breathing room.
- Shorts (9:16): 7–10 scenes, 3–6 s each, first scene ≤ 4 s, total 30–60 s.
- Explainers (16:9): 12–20 scenes, 4–8 s each; chapter card every 4–6 scenes.
- Never more than ~12 words on screen at once outside `document`/`explain`.

## 3. Visual variety checklist (run it on your scene list)
- [ ] no scene type twice in a row; ≥ 5 different types in a short, ≥ 8 in an explainer
- [ ] at least one map OR timeline (place/time grounding) when the topic allows
- [ ] at least one data scene with a real `source`
- [ ] every scene has a `camera`; ≥ 4 different presets used
- [ ] transitions vary; whips dominate, max one `glitch`, max two `flash`
- [ ] 1–2 rich-text marks per scene on the meaning-carrying words
- [ ] stickers on ~half the scenes, each with a purpose
- [ ] theme switches (`yellow`/`dark`) for chapter cards or the outro to create rhythm

## 4. Worked example

**Prompt:** "Make a 45-second vertical reel explaining why Nvidia became so valuable, Vox style, for @mychannel"

Brief: 9:16, ~45 s, paper theme, karaoke captions, handle `@mychannel`, music `auto:tense`.

| # | beat | type | camera | transition | content |
|---|---|---|---|---|---|
| 1 | hook | `title` | crash-zoom | whip-up | "How a ==gaming chip== company ate the AI world" + `face-mindblown` |
| 2 | context | `timeline` | drift | paper-slide | 1993 founded · 1999 first GPU · 2006 CUDA · 2022 AI boom |
| 3 | mechanism | `explain` | orbit | whip-left | "GPUs do ==thousands of small maths== at once" + bullets |
| 4 | mechanism | `flow` | static | push | Data → GPU → trained model → app |
| 5 | evidence | `line` | pan-right | iris | revenue by year, annotation at the AI-boom year (real, sourced numbers) |
| 6 | evidence | `bignumber` | push-in | flash | market-cap figure with `source` |
| 7 | stakes | `kinetic` | handheld | tear | "Everyone needs them" / "Few can make them" / "==That's the moat==" |
| 8 | payoff | `outro` | push-in | – | "Follow for daily AI explainers", `@mychannel` |

Then: write JSON → `validate.mjs` → `--stills auto` → look at the contact sheet → fix → render.

## 5. Writing good on-screen text
- Headlines: 3–8 words, Anton caps. Put the key noun in `==highlight==` or `[[circle]]`.
- Bar/line titles are sentences that state the finding ("Demand doubled in two years"), not
  labels ("Demand 2019–2025").
- Use `kicker` (small mono caps) for the category: "EXPLAINED", "THE DATA", "PART 2".
- Keep `source` short: "IEA, 2025" or "Company filings".
