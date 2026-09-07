# Build Magic Finger Algebra
## Instructions for the coding agent

Build a complete, playable browser game from an empty project using this specification. You have no other repository, screenshot, assets or prior conversation to rely on. Everything essential is described here.

Implement the game, not just a mockup or a plan. Work incrementally, test each stage, and keep a runnable build. Make reasonable decisions for unspecified details. Keep the scope below; do not add accounts, a backend, speech recognition or unrelated features. If a dependency or browser capability is unavailable, report it accurately and preserve the fully playable mouse/keyboard alternative. Never present simulated camera input as real hand tracking.

Priorities, in order:

1. Mathematically valid transformations and understandable feedback.
2. Reliable, enjoyable finger interaction.
3. A polished visual experience.
4. More puzzle content.

The names and module boundaries below are suggestions. The observable behaviour and acceptance tests are requirements.

## 1. The experience

**Magic Finger Algebra** lets a player rearrange equations using a laser that shines from their onscreen index finger.

The player sees their mirrored webcam image and a glowing hand skeleton. Above them is a large equation. They point at a term to pick it up, carry it across the equals sign, and curl their finger to drop it. The equation transforms into an equivalent expression. Three possible arithmetic answers appear on the right. They point at an answer to calculate the expression and continue solving.

The core loop is:

**Pick up → carry across → curl to drop → choose an answer → see the equation simplify.**

This should feel like handling magical mathematical objects, not filling in a worksheet with an awkward mouse replacement. No timer, lives, speed penalties or long instructional paragraphs. Players should be able to rest their arms between moves.

Initial audience: learners beginning one-variable algebra who already know basic arithmetic. Target desktop/laptop landscape, including seated play with either hand. Mouse, touch and keyboard must also work.

## 2. Required first example

Implement this exact example before generating other puzzles.

| Step | Action | Visible result |
| --- | --- | --- |
| Start | Show 3x − 1 = 11 | Instruction: “Get x on its own.” The signed −1 tile is selectable. |
| Pick up | Point at −1 | Tile glows and attaches to the laser; a ghost remains in its original location. |
| Carry | Aim across to the highlighted destination after 11 | Preview 3x = 11 + 1. Caption: “Add 1 to both sides.” |
| Drop | Curl the index finger over the destination | Commit 3x = 11 + 1, still unsimplified. Ask “What is 11 + 1?” |
| Answer | Point at 12 among three options, for example 10, 12, 13 | After a short confirmation dwell, merge 11 + 1 into 12. Show 3x = 12. |
| Pick up again | Point at the coefficient 3 | Only the coefficient lifts; x stays. |
| Carry again | Aim across to a denominator destination beneath 12 | Preview x = 12/3. Caption: “Divide both sides by 3.” |
| Drop again | Curl the index finger | Keep x = 12/3 visible. Ask “What is 12 ÷ 3?” |
| Answer again | Select 4 among, for example, 3, 4, 9 | Show x = 4 and a brief celebration. |
| Verify | No further calculation required | Show 3 × 4 − 1 = 11, then 11 = 11. Offer Next and Replay. |

Shuffle answer positions once per question. Do not simplify the pending arithmetic or reveal the correct answer before selection.

Use a real visual fraction with numerator, bar and denominator for 12/3.

## 3. Teach valid algebra

“Moving across” is a physical metaphor for applying an inverse operation to both sides, not a magical sign-change rule.

When −1 is dropped, briefly show:

- 3x − 1 + 1 = 11 + 1
- Cancellation of −1 and +1
- 3x = 11 + 1

When the coefficient 3 is dropped, briefly show:

- (3x)/3 = 12/3
- Cancellation of the coefficient on the left
- x = 12/3

The animation should be short and clear, around 400–700 ms as an initial tuning range. Keep a compact caption naming the operation. Do not require an extra confirmation to watch it. Reduced-motion mode shows the same mathematical steps without flying objects.

The signed additive term is one selectable unit: −1 cannot split into a minus sign and a 1. In 3x, the coefficient 3 becomes selectable when multiplication is the next operation to undo. x and the equals sign are not draggable in this version.

This is a **guided solver**, not an unrestricted algebra editor. For 3x − 1 = 11, the intended first move is −1. If the player targets 3 first, show “First undo the −1.” Do not call dividing first mathematically wrong: it is valid when applied to the entire equation, but it creates expressions outside this guided path.

Never allow 3x − 1 = 11 to become x − 1 = 11/3. Dividing must apply to the entire side.

The game supplies the inverse operation in the preview. Therefore it practises guided rearrangement and arithmetic; do not claim it independently assesses knowledge of which inverse operation to choose.

## 4. Layout and visual direction

Create the design yourself. No external art assets are required.

Use a dark navy stage, bright readable mathematical symbols, warm gold or cyan laser light, soft tile glows and restrained particles. Symbols should look like mathematical objects with large interaction areas, not tiny form fields.

| Region | Contents |
| --- | --- |
| Upper centre | Equation on a stable horizontal rail, with generous space around the equals sign and a reserved destination region on the right. |
| Centre/lower centre | Mirrored webcam view with luminous hand skeleton and fingertip glow. Optional hands-only display hides the camera image but not tracking. |
| Right column | Arithmetic question and three large vertically stacked answer cards. Hidden outside the answer phase. |
| Bottom | One-line instruction, Hint, Undo, Pause and camera status. |
| Small corner | Progress such as “2 of 5”, mute and settings. |

At a reference viewport of 1280 × 720, start with 56–72 px equation text, selectable areas at least 64 × 72 CSS pixels, and answer cards approximately 160 × 72 px with clear gaps. Tune these sizes rather than treating them as absolute requirements.

Reserve space so that preview animations do not reposition targets under a stationary finger. Give every mathematical node a stable ID. Keep decorative effects out of hit-testing.

Visual states must be distinguishable without colour alone:

- Available: subtle outline.
- Acquired: brighter outline, slight lift, tether to beam.
- Valid destination: large outlined landing area and operation caption.
- Correct answer: arithmetic merges, short sparkle and optional tone.
- Incorrect answer: gentle nudge and a helpful explanation, not a harsh alarm.

Do not mirror equation text. Avoid long flying animations, flashing full-screen effects, visual clutter and mandatory background music.

## 5. Finger interaction contract

### Pointing

A pointing pose means an extended, reasonably straight index finger with other fingers substantially curled. Thumb position is forgiving. The pose must work upward, diagonally and sideways, not only with the finger pointing up.

The laser originates at the displayed fingertip and follows the displayed finger direction. It is **not** a cursor positioned directly under the fingertip, and it does not require physically aiming at a calibrated point on the monitor. The player steers a visible 2D ray emerging from their onscreen hand.

No pinch, raised-hand ritual, microphone or two-hand gesture is required.

### Acquisition and carrying

1. A valid ray entering the padded bounds of an eligible term acquires it immediately. Pose filtering is allowed; a separate tile-selection dwell is not required.
2. Lock that term and controlling hand. Sweeping over another term cannot switch the selection.
3. Leave an origin ghost. The carried tile follows the ray intersection along the equation workspace.
4. Display a broad destination: after the right-side constant for addition/subtraction; beneath the right side for a coefficient division.
5. Entering the destination previews the move. No mathematical state changes yet.
6. Curling the index finger while the destination is active commits the transformation once.
7. Curling elsewhere returns the tile to its source without penalty.
8. Leaving the source tile is normal carrying, not a release condition. Leaving the broad playable workspace cancels after a short grace interval.
9. One hand controls one tile. A second visible hand cannot steal it.

For coefficient dragging, keep the same equation aiming rail used to acquire the coefficient. A broad right-side landing region maps to the visible denominator preview beneath the right-hand value. Do not suddenly change the aiming plane after pickup: that could teleport the tile or accidentally activate its destination. Visually connect the beam's landing point to the denominator slot.

### Intentional release versus lost tracking

These must be separate input events:

- **Observed index curl:** landmarks remain visible and show the index bending. This may commit a valid drop.
- **Tracking missing or ambiguous:** hide/dim the beam and suspend input. This must never commit a drop.
- **Open palm or other invalid pose:** cancel the carry safely; do not interpret every non-pointing pose as a drop.

On curl, hide the beam promptly and evaluate the last reliable pre-curl target. Curling changes the finger direction, so do not use the curled finger's ray as the destination. Require a recent valid sample and continuous tracking through the release.

For a short tracking gap, freeze the carried ghost for about 300 ms. Resume only if the same hand is confidently reacquired. Longer loss or uncertain hand identity cancels the uncommitted move. An already displayed arithmetic question remains intact.

### Answer selection

After a valid drop, display exactly three numeric cards on the right and disable term acquisition.

The player re-extends their finger and aims right. Holding the ray on a card fills a visible confirmation ring over approximately 450 ms. Completion submits once. Moving off, retracting, or losing tracking resets dwell.

A brief dwell is necessary here because sweeping across an answer should not submit it. Tile acquisition remains immediate.

Only enable answer input after the cards settle. Require fresh pointer entry after each question appears. Never inherit dwell from the previous state or let a new answer spawn under a stationary beam and auto-submit.

For a wrong answer:

- Keep the unsimplified equation unchanged.
- Keep the same answer ordering.
- Give an arithmetic-specific hint.
- Require leaving the card or retracting before another attempt.

For a correct answer, simplify only the pending arithmetic, then enable the next move. Lock mathematical input during the short feedback transition.

### Utilities

Hint, Undo, Pause, Resume, Next and Replay must be operable with the laser after initial camera permission. Use large utility targets and the same dwell-confirmation mechanism. Disable them during carrying, except a clearly separated Cancel target if provided. In answer mode, utility targets must not overlap the answer rail.

Browser permission prompts still require ordinary browser interaction. Do not promise to operate those by camera.

## 6. Camera technology and implementation

Use TypeScript, Vite and **@mediapipe/tasks-vision** with **HandLandmarker**. Use Vitest for pure logic tests. A lightweight DOM/CSS UI plus canvas or SVG effects is sufficient; no 3D engine or general-purpose symbolic maths package is needed.

Choose a tested package version and pin it with the matching WASM runtime assets. Do not combine the JavaScript package from one release with a hard-coded WASM directory from another. Include a lockfile.

### Startup and lifecycle

- Show explicit Enable Camera and Play with Mouse actions.
- Request getUserMedia with audio: false and front-facing video, initially ideal 640 × 480 and 30 FPS. Do not require 60 FPS.
- Attach to a muted, autoplay, playsInline video element and await usable video dimensions.
- Resolve the matching WASM files through FilesetResolver.forVisionTasks.
- Create HandLandmarker with a compatible hand_landmarker.task model, runningMode VIDEO, and up to two hands. One hand is sufficient to play.
- Prefer GPU initially; provide a tested CPU fallback or an actionable failure message if GPU creation fails.
- Run detectForVideo only for fresh video frames with monotonically increasing timestamps.
- Stop video tracks, cancel callbacks and close the model on disposal. Guard asynchronous startup with a generation token so cancelled starts cannot resurrect a stream or inference loop.
- On tab hiding, pause interactions and cancel carries. Resume from a safe state with fresh samples.
- Camera denial, missing hardware or model-download failure must leave mouse/keyboard play available.

A suitable model asset is the MediaPipe Hand Landmarker model distributed at:
https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Pin and document the chosen runtime/model assets. Package or self-host them when practical. Runtime downloads do not send camera frames, but still make network requests.

HandLandmarker provides landmarks and handedness; it is not the separate GestureRecognizer. Implement the pointing and curl classifiers from landmarks rather than expecting named gestures from this task.

### Landmark geometry

Useful indices: wrist 0; index MCP 5, PIP 6, DIP 7, tip 8; middle MCP 9; middle/ring/pinky tips 12/16/20.

Use joint angles and distances relative to palm size to detect index straightness and other-finger curl. Avoid screen-Y rules such as “tip above knuckle”, which fail when pointing right. Use hysteresis between pointing and curled thresholds. Treat marginal poses as uncertain, not as a confident release.

Handedness confidence is not pointing confidence. Define pose quality separately using landmark geometry, sample freshness and continuity.

If the projected finger segment is too short, such as when aimed toward the camera, suppress unstable interactions and show “Turn your finger sideways a little.”

### Coordinate system and targeting

Use CSS viewport coordinates for all interaction geometry.

1. Convert normalized image landmarks through the actual displayed video content rectangle, including letterboxing/cropping.
2. Apply horizontal mirroring exactly once.
3. Set ray origin to index tip and direction to the normalized vector from PIP to tip.
4. Apply light, time-based smoothing to origin and direction.
5. Use the same resulting ray and hit result for logic, beam rendering and tile positioning.

For an equation rail at y = railY:

    t = (railY - originY) / directionY
    hitX = originX + t * directionX

For an answer rail at x = answerX:

    t = (answerX - originX) / directionX
    hitY = originY + t * directionY

Reject nearly parallel rays, t <= 0, stale samples and off-workspace hits. Do not clamp an invalid intersection onto a valid answer. The answer rail's Y coordinate selects a card; gaps select nothing.

For utility buttons, use forward ray-to-rectangle intersection. Resolve only phase-eligible targets, with explicit priority and nearest forward intersection where necessary. Do not let one ray activate both an answer and a utility.

Canvas device-pixel scaling is rendering-only. Recompute bounds on resize, zoom/layout changes and camera aspect-ratio changes. A debug overlay should make any mismatch between visible beam and hitbox obvious.

### Hand ownership and performance

Detection array indices are not persistent hand IDs. Match hands across frames with position/landmark continuity, using handedness as supporting information. Lock the active hand during an interaction. If identity is uncertain, cancel instead of transferring the tile.

Design for ordinary 30 FPS video and roughly 20–30 inference updates per second; these are targets to validate, not guarantees. Rendering may run faster than inference. Never finish dwell or release using interpolated/stale data.

detectForVideo is synchronous. Measure UI stalls; move inference to a worker if necessary. Keep at most one inference in flight and drop obsolete frames instead of building a queue. Record fresh video-frame rate, inference rate, duration and sample age separately, not just requestAnimationFrame rate.

Keep acquisition padding, pose thresholds, smoothing, release freshness, loss grace and answer dwell in one tuning configuration.

## 7. Mathematical model and game state

Use deterministic structured data, not equation-string rewriting, regex substitution or eval.

For this restricted game a typed linear-equation model is enough:

- Original problem: a, signed b, c, known solution s, problem ID.
- Stage: undo additive term, undo coefficient, or solved.
- Current exact coefficient and right-side value.
- Pending operation, unsimplified arithmetic operands/operator, answer choices and correct result.
- History snapshot for Undo.

If a = 1, skip coefficient division. If b = 0, start at coefficient division. Use presentation IDs for the signed constant and coefficient. Keep the original problem for final verification.

Allowed transitions:

- From ax + b = c, remove signed b by adding −b to both sides. Pending arithmetic: c − b. After a correct answer, show ax = c − b evaluated.
- From ax = d, divide both sides by nonzero a. Pending arithmetic: d ÷ a. After a correct answer, show x = d/a evaluated.

For negative b, render c − b as c + |b| for introductory content. Do not display confusing “11 − −1” unless explicitly teaching signed arithmetic later.

Use bounded integer arithmetic in MVP and assert division is exact. No arbitrary fractions or decimals are generated. If later extending beyond that scope, introduce exact reduced rational arithmetic; do not silently round.

Every move is transactional:

- Carrying changes only preview state.
- Valid drop creates the equivalent unsimplified equation and a pending question.
- Wrong answer changes only feedback/retry state.
- Correct answer commits simplification and advances the stage.
- Undo during a question restores the equation before its move.
- Undo after a completed answer restores the previous completed equation.
- Cancelling a carry never changes maths.

Suggested phase machine:

| Phase | Allowed actions | Transition |
| --- | --- | --- |
| Ready | Pick up eligible term, utilities | Pick up → Carrying |
| Carrying | Aim, curl/drop, cancel | Valid drop → Question; cancel → Ready |
| Question | Answer, Hint, Undo, Pause | Correct → Feedback; wrong remains Question |
| Feedback | No new mathematical input | Animation ends → Ready or Solved |
| Solved | Next, Replay, utilities | New puzzle → Ready |
| Paused | Resume | Restore safe prior phase with fresh input |

Camera availability is separate from maths phase. Use problem/question IDs and generation tokens to reject delayed events belonging to old states. Reset target locks and dwell on every phase change. An animation callback must never independently decide a mathematical result.

Suggested modules: camera lifecycle; landmark tracker; pose detector; ray/target geometry; interaction controller; pure maths engine; problem/answer generators; game controller; equation/answer/effects views; alternative input adapters. Do not build a large abstraction framework before the example works.

## 8. Puzzles, answers and learning flow

Start with a short skippable control tutorial: point at a glowing target, carry a practice tile, curl to drop, then choose a numeric answer. Offer Replay Tutorial later.

Follow with x + 1 = 3, then the full 3x − 1 = 11 example. Give guided hints when a player pauses, without automatically performing their move.

Progress through:

1. x + b = c
2. x − b = c
3. ax = c
4. ax + b = c
5. ax − b = c

Use positive integer solutions, coefficients 2–9 when applicable, small nonzero constants, and exact division. Initially bound positive right-side and intermediate values at 50.

Generate from a known solution s: choose a and signed b, calculate c = a*s + b, then validate all limits. Use seeded randomness for reproducibility. Exclude degenerate tutorial moves such as adding zero or dividing by one.

Each question needs exactly three numerically distinct choices with exactly one correct answer. Generate plausible distractors such as the opposite arithmetic operation or nearby errors. For 11 + 1, candidates include 10 and 13; for 12 ÷ 3, candidates include 9 and 3. Deduplicate, exclude the correct value, and fill from a bounded nearby-value pool if needed.

Shuffle once, keep the order stable on retries, and vary correct-answer position across puzzles. Validate generation with many seeds.

Wrong-answer hint example: “We added 1. Start at 11 and count up once.” After repeated difficulty show more explicit arithmetic support without punishing the player.

Play in sets of five puzzles with simple progress, then offer another set. No ranking, timer or reward for frantic movements.

## 9. Accessibility and privacy

- Mouse/touch: drag the term, release at destination, click/tap the answer.
- Keyboard: focus eligible term and Enter to pick up; focus destination and Enter to drop; Escape to cancel; 1/2/3 for visible answers.
- All input methods dispatch the same semantic actions to the maths engine.
- Provide accessible equation text, named buttons and restrained live announcements.
- Include mute, reduced motion and adjustable answer dwell.
- Allow seated play and unrestricted thinking/rest time.
- Request camera only after explicit action. No microphone.
- Never upload or record video or persist hand trajectories.
- Optional local storage is limited to settings and completed progress, with reset available.
- HTTPS or localhost is required for the normal camera workflow. Explain camera limitations plainly.
- Keep the initial layout landscape-focused; on narrow screens preserve readable touch/mouse play rather than squeezing camera targets into unusable sizes.

## 10. Build order and gates

### Milestone 1: maths and mouse vertical slice

Scaffold the project, implement pure equation transitions, one fixed example, equation rendering, drag/drop, answers, Undo and final verification.

Gate: 3x − 1 = 11 can be solved fully without a camera. Wrong answers and invalid drops leave the equation intact.

### Milestone 2: real camera interaction

Implement camera startup, MediaPipe integration, orientation-independent pointing, observed curl, hand ownership and ray targeting. Add a debug toggle showing landmarks, pose, sample age, hitboxes and active targets.

Gate: with a real webcam, either hand can acquire a practice tile, carry across and select all three answer positions. Tracking disappearance never drops a tile.

### Milestone 3: complete magic algebra loop

Connect the pointer to the existing maths/game logic. Add stable previews, paired operations on both sides, answer dwell, utility controls and lifecycle recovery.

Gate: after camera permission, the full example, retry, Undo and Next work without a mouse.

### Milestone 4: content and polish

Add seeded generation, the five families, hints, short sessions, onboarding, accessible alternatives and visual/audio feedback.

Gate: all generated problems and choices validate; a five-puzzle session works without dead ends.

### Milestone 5: verify and hand off

Run tests and production build. Exercise browser interactions at multiple viewport sizes and zoom levels. Test camera denial, slow initialization, pause/restart, tracking loss and both hands. If you cannot test with an actual webcam, explicitly list real-camera behaviour as unverified.

Deliver source, lockfile, configuration/content, test coverage and a README with setup, run/build/test commands, camera asset information and known limitations. Give the actual local preview URL if available. Do not deploy publicly unless requested.

## 11. Acceptance tests

### Mathematics and content

- Complete the exact two-move example with correct intermediate expressions.
- Support both signed additive-term cases and coefficient division.
- Reject coefficient-first in a guided two-step puzzle without creating invalid algebra.
- Every generated problem has the known solution and supported intermediate values.
- Exactly three unique choices and one correct choice, across many seeded problems.
- No divide-by-zero, non-exact division or accidental decimal rounding.
- Wrong answer and cancelled carry cannot change the equation.
- Undo works during a question and after a correct answer.
- Final substitution checks the original equation.

### Interaction and lifecycle

- Pointing works upward, diagonally and sideways for either hand.
- Open palm, uncertain pose and missing tracking cannot commit a drop.
- Observed curl at a destination commits once using a fresh pre-curl target.
- Carry remains locked when crossing another term or when a second hand appears.
- Near-parallel/backward rays produce no target.
- A quick sweep across answers does not submit.
- A new question cannot inherit dwell or auto-submit under a stationary pointer.
- Wrong-answer retry requires deliberate re-entry.
- Lost tracking resets dwell and preserves committed maths.
- Rendered beam, tile and actual hit-test agree after resizing and mirroring.
- Camera close/reopen leaves only one stream and inference loop.
- Delayed callbacks after Restart, Undo or Next cannot affect the new state.
- Mouse and keyboard complete the same game with camera unavailable.

Automate pure maths, geometry, pose and state tests with synthetic landmarks/events. Use browser tests for DOM controls and layout integration. A simulated-input test does not replace manual camera validation.

## 12. Avoid these implementation mistakes

- Building only a landing page or static equation animation.
- Replacing the directional laser with a fingertip-position cursor.
- Detecting only an upward-pointing finger.
- Treating hand disappearance as a deliberate drop.
- Releasing a tile when the pointer merely leaves its original hitbox.
- Automatically simplifying before the arithmetic question.
- Separating a negative sign from its number.
- Changing only part of a side when dividing.
- Making every answer instant-click on hover.
- Duplicating targeting geometry separately in rendering and logic.
- Importing unrelated features or building a general symbolic algebra system.

Keep the first build focused: **one finger, a visible beam, a movable term, a balanced operation, and a satisfying calculation.**
