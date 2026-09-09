# Magic Shop Stories: Implementation Plan

Repository: https://github.com/joerae/algebralaser  
Reviewed: 9 September 2026, master at a4a3f53f32ea96c415f6871bc31e6e5f49199cc3 (version notes: 1.7.1).  
Source design: magic-finger-concrete-story-mode(1).md, with the decisions below superseding conflicting details.

## Agreed direction and implementation defaults

- Target all four solver modes. Deliver and validate Mode B first as the integration checkpoint; then complete A, C, and D through the same shared presentation layer.
- After reading the story, the learner chooses an equation representing it. Only a correct choice starts the solver.
- During solving, lightly theme the answer panel and provide a Show story button/popover. Do not permanently keep the full story or an additional object scene on screen.
- Keep the same item icon as the unknown throughout.
- Recommended default: four equation choices for every family, distinct from the existing three arithmetic choices. This is a planning recommendation, not a separately confirmed requirement.
- Reveal up to four short sentences automatically, then leave the full text and equation choices visible indefinitely. There is no timed answer or additional Start button.
- Use local authored content and bundled icons. No narration or services.

## Why the equation-choice step helps

It adds an explicit translation task: identify how the purchase becomes an equation, then solve that equation. Wrong choices should expose one understandable mismatch, with feedback pointing back to the story. They must not become a second arithmetic exercise or reveal the unknown price.

The correct choice must represent the original situation directly. Do not accept a later rearrangement as one of the starting choices. After selection, visibly connect the concrete objects to the chosen coefficient and icon.

## Repository findings

| Existing file | Finding and implementation consequence |
| --- | --- |
| src/math/puzzleGenerator.ts | Five equation families, seeded generation, and a fixed five-puzzle curated sequence already exist. Keep their numbers, ordering, and RNG consumption unchanged. |
| src/math/types.ts | LinearEquationDef already provides id, a, b, c, solution, and family. EquationState is the solver state; story progress should live separately. |
| src/game/gameController.ts | All four modes share levels, setMode, restartLevel, nextLevel, and subscriptions. setMode already resets manipulation while retaining the current level. |
| src/game/interactionController.ts | Shared question/solved handling precedes mode handlers. Arithmetic cards are decoded as numbers and keyboard answers currently cover 1–3. Story choices need their own IDs and routing. |
| src/main.ts | Owns subscriptions, rendering, keyboard forwarding, target collection/cache, and animation/vision loop. Add a small presentation integration here; avoid growing it with template or card logic. |
| src/ui/equationView.ts | Hard-coded Y occurs in normal, cancellation, fraction, Mode D, history-related, and solved presentation paths. A single initial-equation replacement is insufficient. |
| src/game/modeRegistry.ts and src/ui/hudView.ts | Hints/instructions also contain Y or coefficient-variable text. Adapt player-facing wording to the chosen item. |
| src/data/version.txt | Recent Mode D work protects compact coefficients, horizontal fraction/cancellation layout, 680px rails, and aim-away rearming. Preserve these behaviours. |
| package.json | Existing validation commands are npm test, npm run typecheck, and npm run build. |

The current solved branch visibly provides derivation history and an answer line, but does not render the full shop verification required here. Add that explicitly rather than relying on the README's description of verification.

## Proposed modules

Keep editable content under src/data, consistent with repository guidance.

| File | Responsibility |
| --- | --- |
| src/data/magicItems.ts (new) | Four item definitions, names, bundled asset references, deterministic item lookup. |
| src/data/storyTemplates.ts (new) | Human-editable text/feedback templates, including singular and plural wording. |
| src/story/types.ts (new) | ConcreteStory, semantic story beats, equation-choice data, and presentation state types. |
| src/story/buildConcreteStory.ts (new) | Pure conversion from the original LinearEquationDef to story and verification data. |
| src/story/equationChoices.ts (new) | Deterministic misconception candidates, validation, deduplication, and shuffle. |
| src/game/storyController.ts (new) | Presentation lifecycle, selected choice, retries, popover state, and cancellation of reveal/transition work. |
| src/ui/storyView.ts (new) | Story card, concrete objects, question, and accessible story popover. |
| src/ui/equationChoiceView.ts (new) | Four equation cards and targeted feedback; stable DOM during dwell. |
| src/ui/mathItemView.ts (new) | Shared variable-icon and coefficient-product rendering for story, cards, and equation views. |
| src/styles/story.css (new) | Scoped story/card/popover/theming styles, imported by src/styles/index.css. |
| public/icons/magic-shop/ (new) | Four readable, consistently sized local icons. |

Use simple local SVG icons initially, including a scroll for the spell. Give each icon an accessible label such as “price of one wand”. No new UI framework or asset service is needed.

## 1. Build the pure story and choice data

Use the original problem, never currentA/currentB/currentC, to describe the purchase.

- Select the item using the design's hash of problem.id. Use a separate seeded shuffle for choice order, derived from the ID and a story-version salt.
- Do not call the puzzle-generation RNG or change generatePuzzle.
- Keep four short sentences maximum. The supplied ax_plus_b and ax_minus_b examples currently contain five beats/sentences: combine purchase and equal-price information into one sentence.
- Present negative b as a positive discount amount.
- Preserve all current ranges, including up to seven repeated objects for ax.
- Build verification from a × solution + b = c, with correctly signed discount/charge wording.
- Do not reveal solution in the story, cards, accessibility text, or rendered data attributes.

Represent choices as data, not equation HTML strings. For these families, a candidate can use coefficient, signed modifier, and total plus a misconception tag. Render all candidates with the same item.

For 3 × [wand] − 1 = 11, an illustrative set is:

1. 3 × [wand] − 1 = 11: matches the purchase.
2. 3 × [wand] + 1 = 11: treats the discount as a charge.
3. [wand] − 1 = 11: omits the quantity.
4. 3 × [wand] − 1 = 12: changes the amount paid.

Shuffle positions deterministically. This order is illustrative only.

Build family-specific candidate pools: wrong modifier sign where applicable, wrong quantity, and wrong total. For ax, avoid an irrelevant discount distractor as the default. For a = 1, use an incorrect quantity such as two, not a duplicate “omit coefficient” candidate.

Filter candidates before display:

- Exactly four distinct rendered expressions and one correct choice.
- Reject any wrong candidate satisfied by the original solution. This prevents a coincidentally valid alternative from confusing the task.
- Reject equivalent rearrangements and duplicate canonical expressions.
- Keep numeric distractors positive and suitable for the existing age/range.
- If a misconception candidate fails, use deterministic alternative quantities/totals until the set is complete.

On a wrong choice, retain the story and options, highlight the relevant story fact, and give a short hint such as “A discount takes gold off the price.” Do not advance the solver, reshuffle, auto-select the answer, or introduce scoring.

## 2. Add the shared presentation lifecycle

Use a separate presentation phase:

reading → choosing_equation → condensing → solving → completed

Keep existing solver GamePhase and pure solving rules unchanged. storyController owns presentation state; main.ts coordinates it with GameController.

- Initial load/new level: derive the story, reset presentation, reveal text and scene, then expose choices.
- Correct choice: lock further submissions, animate repeated objects into a × [icon] over 500–800ms, then enable solving.
- Single-object puzzles: move the icon into the equation without inventing 1 ×.
- Reduced motion: perform the same representational change instantly or with a brief fade.
- Mode switch: retain story, item, choice order, and whether the equation was correctly selected. Reset only manipulation. If switching during reading/choice, stay in that presentation stage; if switching during condensing, cancel stale animation work and complete the transition once.
- Explicit Restart/Replay: replay the same story and equation-choice task with the same values/item/order.
- Undo: retain existing solver undo semantics; never rewind into the equation-choice task.
- Next puzzle, including sequence wrap: begin a fresh presentation session even if a puzzle ID has been seen before.
- Reloading the same puzzle reproduces the same content and choices. Do not add saved-level progression; the current controller starts at level one.

Use a presentation-session counter or cancellation token so delayed callbacks cannot start an old puzzle after restart, next, or a mode switch.

## 3. Route input safely

Equation choice is a shared activity before mode-specific solving.

- Extend shared interaction routing for story choices, Show story, and popover dismissal.
- Use stable IDs such as story-equation-choice-0. Do not route through game.answer or numeric arithmetic-choice decoding.
- Support laser dwell using the existing dwell duration, click/tap, and keys 1–4 during equation selection. Provide normal focus/Enter activation.
- Leave arithmetic answer counts and shortcuts unchanged.
- While reading, choosing, condensing, or showing the popover, block underlying solver inputs through every route: vision, keyboard, direct DOM callbacks, and drag/touch handlers.
- Keep camera/hand rendering active. Restrict collected hit targets to the active presentation.
- Clear dwell, carried interaction state, and cached target geometry on presentation transitions.
- Require aim to leave the previous target before another activation after a wrong answer or after entering solving. Release keyboard/pointer activation before rearming; ignore key repeat.
- Prevent an open palm held during completion from immediately skipping the verification.

Do not change MediaPipe detection or individual mode maths.

## 4. Render the persistent icon across every solver

Introduce shared rendering helpers and use them throughout equationView.

- Replace all variable appearances in ready, carrying, balancing, cancellation, division, simplification, and solved displays.
- Keep icon geometry stable and target IDs unchanged.
- The coefficient-operation target covers the coefficient/multiplication portion; the icon remains the unknown and must not accidentally become part of that target.
- Preserve Mode D's compact grouping and existing 3× extraction animation. Use a compact explicit multiplication mark beside the icon where required to keep the new representation clear.
- Preserve the icon in numerators and after coefficient cancellation, including the 1 × unknown simplification.
- Adapt display-only history/cancellation strings through one controlled formatter for the existing equation-string grammar. Do not put markup into math state or indiscriminately replace letters in arbitrary prose.
- Audit hints, initial HUD text, and any rendered descriptions for player-facing Y/x notation. Use item-aware wording or “the object’s price”.
- Keep internal variables, fixtures, and solver history semantics intact.

Refresh laser target bounds after layout/animation changes, including resize and icon loading.

## 5. Add the light shop theme and story recall

During solving:

- Keep the compact question visible.
- Add the selected item and a restrained shop accent to the existing arithmetic answer panel.
- Do not label every arithmetic answer “gold”: Mode D can ask about coefficients or cancellation results.
- Keep arithmetic prompts prominent and preserve card size/spacing.
- Provide Show story as an actual button with laser, mouse/touch, and keyboard access.
- Open an anchored popover with the original story and scene. Use a close control and Escape, manage focus, and suspend underlying equation manipulation.
- Avoid hover-only behaviour; it is unreliable for touch and laser input.

This supersedes the original requirement to continuously highlight a separately visible concrete scene during solving. Highlight scene elements during story/choice feedback; the solving screen does not keep another permanent scene.

## 6. Complete and verify the purchase

On solve, show:

Each wand costs 4 gold.  
3 wands at 4 gold each = 12 gold.  
12 gold − 1 gold discount = 11 gold paid.  
3 × 4 − 1 = 11.

Render [icon] = 4 gold on the main solved line. Pulse both evaluated sides together when they match; use reduced-motion alternatives. For ax omit the modifier line, and handle singular purchases grammatically.

Keep existing Next/Replay controls and derivation history. Make verification visible before rearming continuation inputs. Do not add a separate correctness question here.

## Delivery sequence

1. Data foundation: story generation, deterministic choices, and pure tests.
2. Mode B vertical slice: story → choose → condense → solve → verify, initially with click/keyboard and the shared icon renderer.
3. Shared input integration: laser dwell, transition guards, story popover, and target refresh.
4. Modes A/C/D: audit all presentation branches, hints, fractions, extraction animations, and mode switches.
5. Layout/acceptance pass: seven-object scene, four equation cards, Mode D fractions, reduced motion, and camera-disabled use.

Complete all four modes unless a concrete integration blocker appears. If one does, document the exact failing path and deliver Mode B as the fallback milestone; do not pre-emptively duplicate the feature by mode.

## Verification and completion criteria

Add targeted Vitest tests for:

- All five families × four items: correct values, grammar, discount signs, and no more than four sentences.
- Deterministic item/choice selection and unchanged seeded puzzle outputs.
- Four unique equation cards with exactly one valid answer across a representative seed sweep and boundary values.
- Wrong answers retain state; correct selection advances once.
- Restart, mode switch, sequence wrap, and stale callback cancellation.
- Input cannot mutate the solver while presentation/popover blocks it.

Use the existing math tests as regression coverage. Do not write duplicate tests of existing solving rules.

Manually check all five curated puzzles in all four modes with click/keyboard; use laser checks for the shared selection flow and mode-specific geometry risks. Inspect icon persistence through cancellation, fractions, history, and final answer, plus no-camera operation and reduced motion.

Run npm test, npm run typecheck, and npm run build. No commands were run as part of this planning review; source was inspected through GitHub.

Acceptance: every puzzle asks the learner to select its equation, only the correct choice unlocks solving, all supported modes retain the same item/story on switching, no player-facing variable letter leaks through, and completion verifies the original purchase.

Before implementation, re-check the branch and any applicable AGENTS.md. Follow src/styles/AGENTS.md for scoped styling work: keep content in its own files, read version notes, add concise release notes listing changed files, and update the displayed version (proposed 1.8.0 if 1.7.1 remains current). Provide a running local preview when delivering the implementation.

