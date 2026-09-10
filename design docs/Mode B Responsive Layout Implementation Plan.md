# Mode B Responsive Layout Implementation Plan

## Goal

Make the complete Mode B game flow usable across desktop, Chromebook, tablet, and phone viewports, with special attention to short browser viewports and finger-laser targeting. The layout must preserve the camera as the central interaction surface, keep every active control visible, align side-panel choices to the camera, and guarantee that neighbouring laser hitboxes do not overlap.

Modes A, C, and D are explicitly out of scope except where a shared component must keep its existing behaviour. Story presentation and equation-choice screens that lead into Mode B are in scope.

## What the current implementation is doing

- `#app` is a fixed `100vh` flex column with a header, flexible stage, and footer. On desktop the stage clips overflow.
- The story area, equation area, and camera are stacked inside `.workspace-center`. Compact rules replace the equation area with fixed `145px` and `55px` height buckets, while the camera uses a separate viewport-height formula.
- The Mode B forge panel, story-equation choices, and arithmetic answers are absolutely positioned from `cameraBox.getBoundingClientRect()` in `main.ts`. Their card containers are intended to equal the camera height, while their prompts sit above it.
- Portrait layouts switch those panels into normal-flow docks below the camera and turn the choices into horizontal rows.
- Laser targets are built by expanding each visible DOM rectangle with a fixed padding (`22px` for answer and forge cards, `16px` for story equation choices). This padding is unrelated to the actual gap between adjacent cards, so the expanded rectangles overlap on short layouts.
- The full story card has compact overrides, but its typography and icon sizes use several independent fixed/rem values. The solving prompt is another separately sized component. This is why the top content does not scale as one coherent unit.
- Resize invalidates the target cache, but layout is recalculated in the animation loop using repeated inline styles. There is no single computed “available play area” or shared layout contract for the camera, side panels, story, equation, header, and footer.

## Proposed layout contract

The implementation should be driven by available space, not by a list of device-specific screenshots.

### 1. Define supported layout bands by capability

Use a small set of layout bands, selected from both width and height:

- **Wide:** camera with a left Mode B forge rail and right story/answer rail.
- **Compact landscape:** same three-column arrangement, but with fluid type, gaps, prompt heights, equation height, and camera size. This is the target arrangement for a Chromebook when sufficient horizontal space remains.
- **Narrow/portrait:** camera centered, with the currently active choice set in a compact horizontal dock in normal document flow. This avoids shrinking the camera and answer text to unusable sizes merely to preserve left/right placement.
- **Short viewport modifier:** independently reduces non-interactive chrome and top-content spacing. It can apply to either wide or narrow layouts.

Prefer CSS container/media queries and `clamp()` for continuous scaling inside these bands. JavaScript should measure anchors and publish geometry, not contain a second set of breakpoint-specific dimensions.

### 2. Establish a vertical-space budget

Create shared CSS custom properties for compact header height, footer height, stage padding, top-content allowance, inter-region gaps, and minimum camera height. Use `100dvh` with a `100vh` fallback so mobile browser chrome and Chromebook Chrome UI are reflected in the usable CSS viewport.

For each rendered phase, the budget is:

`usable viewport = header + stage(top story/equation + camera) + footer`

The camera receives the remaining height after visible phase content is measured, capped by available width at its aspect ratio. This replaces competing fixed heights such as `145px`, `55px`, and `calc(100vh - 270px)`.

Add phase/state classes to `#app` or `.stage-container` (for example story-reading, story-choosing, Mode B forging, Mode B arithmetic) so only visible content reserves space. Empty story/history regions must consume no height.

### 3. Make the top story and solving prompt fluid

Treat the full “Cauldron Purchase” card and the short “How much did each cauldron cost?” bar as a responsive component family:

- Scale width, padding, border radius, line gap, heading, sentence text, and inline item tokens from shared custom properties.
- Use `clamp()` tied to viewport width and short-height modifiers rather than isolated fixed font sizes.
- Allow text to wrap naturally without clipping; long item names/questions must be tested.
- Keep the full reading/choosing card legible while reducing its footprint on short viewports.
- Collapse unused margins/gaps during solving so the short question moves upward immediately beneath the compact header.
- Make equation history and the Mode B equation rail fluid in the same budget, including Mode B-specific term tiles, fractions, cleanup targets, and solve targets.

### 4. Simplify the header and footer

- Remove the “Level N of N” element from the rendered header and remove/update its view code.
- Keep the camera control functional but make its active state compact: icon plus a short status label on roomy screens, icon/status affordance on narrow or short screens. Preserve an accessible name and camera on/off feedback.
- Remove the visible “Show Story” dock button from the solving phase and reclaim its footer overlap/target area. Resolve whether its popover and keyboard shortcut should also be removed based on Question 3 below.
- Reduce header/footer padding and control gaps fluidly. On the shortest supported viewport, allow secondary footer instruction text to abbreviate or hide before reducing interactive button sizes below a usable touch target.
- Respect safe-area insets on mobile (`env(safe-area-inset-*)`).

### 5. Anchor side-panel prompts above the camera and cards to the camera edges

Refactor the repeated forge/story-choice/answer positioning in `main.ts` into one Mode B-aware side-panel layout helper.

For the desktop and compact-landscape arrangements:

- The panel prompt/header bottom aligns with the camera top (with one intentional small gap).
- The card-list top aligns with the camera top.
- The card-list bottom aligns with the camera bottom.
- The list uses `display: grid`, `grid-template-rows: repeat(count, minmax(0, 1fr))`, and a fluid gap. This gives every choice an equal, maximised target lane.
- The left forge list contains four rows; story equations and arithmetic answers contain three rows.
- Column widths and the camera are solved together from available stage width so neither panel is pushed over the camera or viewport edge.
- Prompt feedback inserted after a wrong story choice is included in the above-camera prompt stack and must not shorten/misalign the card lane.

For narrow/portrait, keep the active choices in normal flow and use equal-width columns below the camera unless Question 2 selects another mobile arrangement.

Use a `ResizeObserver` (plus `visualViewport` resize where available) on the header, footer, story/equation content, camera, and visible panel. Schedule a single layout update with `requestAnimationFrame`. This handles font wrapping, browser chrome changes, rotation, camera state, and feedback banners without doing redundant style writes every animation frame.

### 6. Generate non-overlapping laser hitboxes

Move rectangle expansion into a reusable geometry helper and test it independently.

For each ordered set of forge, story-choice, or answer cards:

- Start with the actual rendered card rectangle.
- Expand toward free space, but cap each inner edge at the midpoint of the visual gap between neighbouring cards, leaving a small dead-zone guard (proposed: `2–4px`).
- Clip expansion to the panel lane/viewport bounds.
- Never allow two enabled targets in the same panel to intersect.
- Keep generous padding on the outer top, bottom, and horizontal edges where no neighbour competes for that space.
- Derive padding after layout/resize, and invalidate cached targets whenever observed geometry changes.

Apply this first to Mode B forge cards, story-equation cards, and arithmetic answer cards. Do not change the gameplay dwell timing or ray-selection priority unless testing exposes a separate problem.

The debug inspector should continue drawing the final computed rectangles. It becomes the acceptance tool for verifying that targets are generous but have visible separation.

### 7. Keep visual and interaction geometry in sync

- Position connector arrows only after the current layout measurement has been applied.
- Recompute arrow endpoints on resize, orientation change, story feedback insertion, and phase transition.
- Confirm that camera feed coordinates and the canvas overlay still use the live camera-feed rectangle after camera resizing.
- Cancel or recompute stale dwell state when a resize moves the currently hovered target, preventing an answer from completing against an old rectangle.

## Likely files to change

- `index.html`: only if a small wrapper/grid hook is required.
- `src/main.ts`: phase classes, consolidated responsive layout scheduling, observed geometry, and non-overlapping target collection.
- `src/ui/hudView.ts`: remove level output and render the compact camera control.
- `src/ui/storyView.ts`: remove the Show Story dock UI and, depending on Question 3, its related popover hooks.
- `src/styles/base.css`: viewport shell, dynamic-height handling, stage/workspace structure, camera sizing variables.
- `src/styles/hud.css`: compact header/footer and camera button states.
- `src/styles/equation.css`: fluid shared equation and answer-card dimensions.
- `src/styles/story.css`: fluid full-story and short-question components; equation-choice rails.
- `src/styles/modes/mode-b.css`: Mode B forge rail and Mode B-specific equation scaling.
- `src/styles/responsive.css`: replace overlapping device overrides with the agreed layout bands and short-height modifier.
- A small new geometry module and test beside the existing vision/UI geometry code (exact location to be chosen during implementation).
- `src/data/version.txt` and concise version notes, as required by the repository instructions for a feature release.

## Implementation sequence

1. Record baseline screenshots and debug hitboxes for each Mode B phase at the agreed viewport matrix.
2. Add phase/layout state hooks and the shared viewport/spacing variables.
3. Compact the HUD, remove the level indicator, and remove the Show Story button per the clarified scope.
4. Convert the story card, short prompt, equation history, and Mode B rail to fluid sizing.
5. Consolidate camera and side-panel geometry so prompts sit above the camera and all choice lanes exactly span its height.
6. Implement and unit-test non-overlapping hitbox expansion; wire it to forge, equation-choice, and arithmetic-answer targets.
7. Add resize/orientation/visual-viewport observation and ensure target/arrow updates are atomic.
8. Test every Mode B phase with mouse/touch and the finger laser, including wrong-answer feedback, camera on/off, rotation, reduced motion, and long text.
9. Run typecheck, unit tests, and production build; update the app version and concise notes.

## Acceptance criteria

- No Mode B screen clips or hides an active control at the agreed minimum CSS viewport.
- At a short Chromebook viewport, the top story/prompt, equation, camera, visible choice rails, and footer all fit the chosen scrolling policy.
- On desktop/compact landscape, the forge prompt and right-side prompts sit above the camera; their first card starts at the camera top and their last card ends at the camera bottom (within 2px).
- The full Cauldron-style story card and short solving prompt scale continuously and remain readable without overflowing.
- Each visible answer/choice row receives an equal share of the camera-height lane.
- Debug rectangles for sibling forge, equation-choice, and answer targets never overlap and retain a small dead zone.
- Resizing, browser zoom, mobile toolbar changes, and orientation changes update panels, arrows, canvas mapping, and hitboxes without a stale frame causing a selection.
- Camera, Settings, Hint, Undo, Restart, keyboard selection, touch/click selection, dwell progress, and all Mode B transitions remain functional.
- Modes A, C, and D receive no intentional visual redesign and still build/run.
- Automated geometry tests, existing tests, typecheck, and production build pass.

## Proposed verification matrix

Exact minimums depend on Question 1. Initial matrix:

| CSS viewport | Purpose |
| --- | --- |
| 1366 × 650 and 1366 × 768 | Chromebook with/without substantial Chrome UI |
| 1024 × 600 and 1024 × 768 | Short/narrow landscape boundary |
| 1280 × 720 | Common compact laptop |
| 1440 × 900 and 1920 × 1080 | Standard/wide desktop |
| 844 × 390 and 932 × 430 | Phone landscape |
| 390 × 844 and 430 × 932 | Phone portrait |
| 768 × 1024 | Tablet portrait |

Test phases: full story reading, equation selection, initial Mode B equation, choose opposite, forged/applying animation, cleanup, right-side arithmetic answers, solved/completed, and story wrong-choice feedback.

## Clarifications needed before implementation

### 1. Minimum supported CSS viewport and scrolling policy

Should the strict no-scroll target be **1366 × 650 CSS pixels** (a realistic 768px-tall Chromebook after Chrome/OS UI), and should phone portrait be allowed to scroll vertically while keeping the camera and active choice dock together?

**Answer:** use 1366 × 650 and 1024 × 600 as no-scroll landscape baselines. I also think phones should not scroll. However I am up for moving the LEFT and RIGHT answer fields on portrait mobile phones to be above the camera box, because pointing up is totally fine and feels nice; this would be for things like "forging the opposite", and equation selection in story mode, and calculations like "what is 7-5". I believe with that change we can accomodate portrait mode with no scrolling.

### 2. Mobile placement of active choices

On narrow phone portrait, there is not enough width for a useful left rail + camera + right rail. Should the four forge signs and three answers/equations remain as horizontal docks immediately below the camera, as the existing mobile layout intends?

**Answer:** As above, for portrait layout I think the left rail and right rail should move to ABOVE the camera, to allow a nice interaction of pointing up. Note that often the portrait camera is quite tall on an iPhone, so potentially we reduce the rendered height of the camera somewhat on the screen so we don't run out of vertical space.

### 3. Meaning of removing “Show Story”

Should only the visible bottom button disappear, leaving the `S` keyboard shortcut/popover available, or should the story popover feature and its interaction targets be removed entirely once solving begins?

**Answer:** We are talking about removing the button in the UI that says "Show Story" during the equation solving step. Let's just remove the visible button and laser target, but retain `S` as an unobtrusive accessibility/recall shortcut.

### 4. Compact camera control

May “Camera Active” become an icon-only toggle on short/narrow screens (with tooltip/accessible label and coloured active state), while retaining a short text label on wider screens?

**Recommendation:** yes; use icon-only only when space is constrained and keep at least a 44 × 44px touch target.

### 5. Camera priority versus text/control size

When space is extremely short, should the layout prioritise the largest possible camera after maintaining minimum readable text and 44px touch targets, even if the footer instruction sentence is shortened or hidden?

**Answer :** yes. Preserve active controls and the camera first; progressively abbreviate non-interactive instructions and decorative spacing.

## Confidence

With answers to Questions 1–5, confidence is **high** that implementation can proceed without further product decisions. The current code already exposes the necessary camera and panel rectangles; the main work is replacing competing fixed-size rules and fixed hitbox padding with one explicit layout/geometry system. If the recommendations are accepted as written, no additional clarification should be necessary before coding.
