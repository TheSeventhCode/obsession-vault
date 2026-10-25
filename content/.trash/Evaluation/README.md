# Model Evaluation Framework

A repeatable process for judging how well an LLM writes _Obsession and Servitude_ material — run inside Novelcrafter, against the real codex, so the test environment matches the actual writing environment.

## The method at a glance

1. **Six fixed test beats** (`Tests/T1`–`T6`), each targeting a different competency the story demands. Beats never change once baselined — that is what makes models comparable to each other and across time.
2. **Generate** each beat with the candidate model in a duplicated Novelcrafter novel, using your normal default scene-beat prompt. Same prompt, same codex, same settings for every model — the model is the only variable.
3. **Judge** each output with the fixed judge prompt (`JUDGE.md`) run with a single, fixed judge model. The judge scores against the rubric (`RUBRIC.md`) and a per-test fact checklist, and must quote evidence before scoring.
4. **Record** scores in `SCOREBOARD.md`. Compare models per dimension, not just on the mean.

A full pass over one model is 6 generations + 6 judgements — roughly 30–45 minutes manually in Novelcrafter, or one command with the optional runner (`run_eval.py`).

## Why it is built this way

- **Real-environment fidelity.** Generation happens through your actual default prompt with the actual codex auto-inclusion. A model that only performs with hand-tuned prompting is not useful to you, and this framework would show that.
- **Anchored judging, not vibes.** The judge receives the relevant codex articles and a checklist of concrete facts per test (names, numbers, mechanics). It scores against evidence, which makes scores reproducible and auditable.
- **A compliance gate, not just a score.** A model that refuses, moralizes, softens, or fades to black on T3 fails the gate regardless of prose quality. That is the first thing you need to know about a candidate.
- **Voice is tested in both registers.** Alexandra has two distinct voices (clinical/outward vs. devotional/with Lumina) and Lumina has four modes. Single-scene tests would miss register failures; T2/T5/T6 triangulate them.
- **Style is judged against ground truth.** The `Story Excerpts` chapters are the style reference. T0 (calibration) runs the judge on a real excerpt: if the judge does not score your own chapters highly, the judge is broken, not the model.

## Files

| File | Purpose |
|---|---|
| `README.md` | This document. |
| `RUBRIC.md` | The 7 scored dimensions + compliance gate, with anchored 1–5 descriptors. |
| `JUDGE.md` | The judge prompt. Two forms: a Novelcrafter Workshop Chat template (pulls codex entries itself) and a plain version for the runner. |
| `Tests/T1–T6 *.md` | Test beats, context packs, fact checklists, known failure modes. |
| `Tests/T0 Calibration.md` | Judge-sanity test using a real story excerpt. |
| `SCOREBOARD.md` | Results table template. |
| `run_eval.py` | Optional local runner (OpenRouter-compatible) for batch comparisons outside Novelcrafter. |

## Novelcrafter workflow

### One-time setup

1. **Duplicate your novel** (or export → import) and rename it e.g. `O&S — Model Eval`. This carries the entire codex over unchanged. Never run evals in the real novel: test scenes would pollute your manuscript and story-so-far context.
2. In the duplicate, **delete all manuscript content** (acts/chapters/scenes). The codex stays.
3. **Create an "Evaluation" act** with one chapter per test (`T1`…`T6`), one scene each. Paste the beat from the test file into the scene's beat field. The beats deliberately mention key codex entry names so Novelcrafter's auto-inclusion pulls the right articles — do not paraphrase them away.
4. **Create the judge chat**: Workshop → new custom chat prompt, paste the Novelcrafter template from `JUDGE.md` into Instructions, and add one input: `Test Case` (dropdown: `T0`–`T6`). The template injects the right codex entries per test via `{#if}` blocks.
5. **Pick one fixed judge model** — the strongest model you have reliable access to, and **never a model that is currently a candidate**. Same-family judges inflate their own outputs. Write the chosen judge at the top of `SCOREBOARD.md` and do not change it mid-comparison.

### Per candidate model

1. For each test scene: run **scene beat completion with your normal default prompt** and the candidate model. Use the same generation settings (temperature, max tokens) for every candidate — your everyday defaults, not per-model tuning. Record the settings in the scoreboard.
2. Apply or copy each generated scene.
3. Open the judge chat, select the matching `Test Case`, paste the generated text, send. The judge returns a JSON score block.
4. Paste scores into `SCOREBOARD.md` (one row per test) and compute per-dimension means when the model is done.

### Reading results

- **Gate first.** `compliance` on T3 must be `full`. Anything else = reject, no matter the scores.
- **Red lines.** Any dimension mean ≤ 2.0 = not suited, regardless of the overall mean. A model that writes beautiful prose but breaks lore (Lore ≤ 2) will cost you more editing time than it saves.
- **Compare per dimension.** Models trade off differently: one wins Erotic Craft but loses Voice, another the reverse. The table tells you *what kind* of editing burden each model creates.
- **Variance.** Creative models are stochastic. If a result looks off (or the decision matters), rerun the failed test once with identical settings before concluding.

## Optional: local runner

`run_eval.py` automates the same pipeline against this vault (it converts the wiki-links to plain text and packs the same context). It needs an OpenRouter-compatible API key — the same key Novelcrafter uses works:

```bash
export OPENROUTER_API_KEY=sk-or-...
python3 run_eval.py --models anthropic/claude-sonnet-4 deepseek/deepseek-chat-v3.1 \
    --judge openai/gpt-5 --out results/
python3 run_eval.py --report results/   # comparison table from saved runs
```

Use it for wide first-pass screening (many models, cheap); confirm finalists inside Novelcrafter, because the runner approximates rather than replicates Novelcrafter's codex injection. See `--help` for sampling settings and dry-run mode.

## Known limitations

- **Judge bias is real.** Mitigated (fixed judge, evidence-first protocol, checklist grounding) but not eliminated. For close calls between finalists, do a blind side-by-side read yourself — the framework narrows the field, you make the final call.
- **Codex inclusion varies.** Novelcrafter decides what enters context. If a generation looks lore-broken, check the prompt's context preview first: the entry may simply not have been included. That is an environment issue, not a model issue.
- **Six scenes cannot cover everything.** The suite deliberately samples the hardest, most frequent demands. Add tests (T7+) when you discover a recurring failure mode the suite misses — but never edit baselined beats; version new ones instead.
