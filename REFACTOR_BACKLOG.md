# Refactoring Backlog: Agent Iteration Speed & Code Modularity

This document catalogs architectural refactorings designed to keep files small, reduce LLM context token consumption, eliminate edit collision risks, and ensure that adding new equation modes (starting with **Mode 4**) is purely additive and isolated rather than touching a dozen existing files.

---

## 🎯 Architectural Goal: Additive Mode Scaling

Currently, adding a mode (Mode B in v1.4, Mode C in v1.5) requires editing 12–14 files across state, controllers, views, styles, and HTML.

**Target Architecture**:
Adding any new mode should require:
1. Creating a dedicated interaction handler (`src/game/modes/ModeXHandler.ts`)
2. Creating a dedicated accessory view/stylesheet if needed (`src/ui/modeX/`, `src/styles/modes/mode-x.css`)
3. Registering the mode in `src/game/modeRegistry.ts` (1 line of metadata)
4. Zero edits to `main.ts`, `hudView.ts`, or existing mode logic.

---

## Phase 0: "Must-Do Before Mode 4" (High ROI Prerequisites)

These 4 items directly unblock clean, rapid development of Mode 4 and eliminate the most severe bottlenecks.

### 1. [x] [COMPLETED] Modularize Monolithic `src/styles/index.css` (Reduced from 2,215 lines to 15-line importer)
* Extracted modular stylesheets:
  * [`src/styles/base.css`](file:///c:/Users/jraeb/algebra/src/styles/base.css) (CSS variables, resets, typography, layout grid)
  * [`src/styles/hud.css`](file:///c:/Users/jraeb/algebra/src/styles/hud.css) (header, footer, camera box, modal dialogs, status badges)
  * [`src/styles/equation.css`](file:///c:/Users/jraeb/algebra/src/styles/equation.css) (equation rail, terms, fractions, history stack)
  * [`src/styles/modes/mode-a.css`](file:///c:/Users/jraeb/algebra/src/styles/modes/mode-a.css) (landing slot, bubble popping animations)
  * [`src/styles/modes/mode-b.css`](file:///c:/Users/jraeb/algebra/src/styles/modes/mode-b.css) (forge panel, split clone bubbles, cancel flashes)
  * [`src/styles/modes/mode-c.css`](file:///c:/Users/jraeb/algebra/src/styles/modes/mode-c.css) (blaster cards, balance scale beam & tilt physics)
* Mode 4 styles can now be written in an isolated `src/styles/modes/mode-d.css`.

### 2. [x] [COMPLETED] Data-Driven Mode Registry & Header Switcher
* Created [`src/game/modeRegistry.ts`](file:///c:/Users/jraeb/algebra/src/game/modeRegistry.ts) defining `ModeDefinition` interface, registry array, and pedagogical/badge hints.
* Refactored [`src/ui/hudView.ts`](file:///c:/Users/jraeb/algebra/src/ui/hudView.ts) to dynamically render mode toggle buttons via `MODE_DEFINITIONS.map(...)` with delegated event handling.
* Simplified [`GameController.getHint()`](file:///c:/Users/jraeb/algebra/src/game/gameController.ts) from a 40-line nested conditional down to 3 lines delegating to the active mode definition.

### 3. [x] [COMPLETED] Extract Bubble Physics & Split Animation from `src/main.ts` (Reduced from 1,263 to 877 lines)
* Extracted Mode B multi-stage timed animation into [`src/ui/animations/splitBalanceAnimation.ts`](file:///c:/Users/jraeb/algebra/src/ui/animations/splitBalanceAnimation.ts).
* Extracted floating bubble tracking, magnetic snapping, audio throttling, and popping burst into [`src/ui/carriedBubbleView.ts`](file:///c:/Users/jraeb/algebra/src/ui/carriedBubbleView.ts).
* Eliminated over 380 lines of nested timeouts and DOM state from `main.ts`.

### 4. [x] [COMPLETED] Extract Mode Interaction Handlers from `src/game/interactionController.ts` (Reduced from 717 to 280 lines)
* Defined `ModeInteractionHandler` interface and contexts in [`src/game/modes/types.ts`](file:///c:/Users/jraeb/algebra/src/game/modes/types.ts).
* Implemented isolated mode handlers:
  * [`src/game/modes/modeACarrier.ts`](file:///c:/Users/jraeb/algebra/src/game/modes/modeACarrier.ts) (carrying, index curl drop, slot hover, escape cancel)
  * [`src/game/modes/modeBForgeHandler.ts`](file:///c:/Users/jraeb/algebra/src/game/modes/modeBForgeHandler.ts) (forge dwell, equals balance application, forge keys)
  * [`src/game/modes/modeCBlasterHandler.ts`](file:///c:/Users/jraeb/algebra/src/game/modes/modeCBlasterHandler.ts) (blaster equip, LHS smash, RHS blast, calc simplify, blaster keys)
* Refactored [`src/game/interactionController.ts`](file:///c:/Users/jraeb/algebra/src/game/interactionController.ts) into a lean coordinator maintaining only shared tracking, question card dwell, and solved advance.

---

## Phase 1: Mode 4 Architecture & Scalability (During Mode 4 Work)

These items streamline the integration of Mode 4 and future equation modes.

### 5. [ ] Generic Left Accessory Mount (`index.html` & `src/main.ts`)
* **Problem**: `index.html` has parallel `<aside id="forge-panel">` and `<aside id="blaster-panel">`. Adding Mode 4 will likely add a third parallel element (`<aside id="mode4-panel">`).
* **Target**: Replace them with a single container `<aside id="left-accessory-panel">`. Mode views mount their HTML into this slot upon mode activation, and unmount on mode switch.
* **Iteration Speed Impact**: No need to edit `index.html` for Mode 4 or Mode 5.

### 6. [ ] Extract Dynamic Layout & Connector Arrow Calculation (`src/main.ts`)
* **Problem**: [`main.ts:updateArrowAndLayout`](file:///c:/Users/jraeb/algebra/src/main.ts#L837-L990) computes docking positions for left panels, right answer columns, and cubic bezier SVG arrows linking terms to cards.
* **Target**:
  * Extract layout bounds and docking calculations to `src/ui/layoutManager.ts`.
  * Extract cubic bezier SVG arrow path generation to `src/ui/connectorArrowView.ts`.
* **Iteration Speed Impact**: Shrinks `main.ts` below 600 lines. Layout changes won't risk breaking vision loop or event dispatching.

### 7. [ ] Mode State Encapsulation in `src/math/types.ts` & `linearEquation.ts`
* **Problem**: [`EquationState`](file:///c:/Users/jraeb/algebra/src/math/types.ts#L98-L115) accumulates optional fields for specific modes:
  * `forgedOperation?: ForgedOperation | null` (Mode B)
  * `balancedDisplay?: BalancedDisplay | null` (Mode B)
  * `blasterState?: BlasterState` (Mode C)
  * Mode 4 will add more optional fields to the shared interface.
* **Target**: Introduce a generic or discriminated union mode payload:
  `modeState?: ModeBState | ModeCState | ModeDState;`
  This keeps core `EquationState` clean (only `a`, `b`, `c`, `stage`, `phase`, `history`).

---

## Phase 2: View & Subsystem Cleanups (Post Mode 4)

Lower urgency refactorings that can be tackled once Mode 4 is playable.

### 8. [ ] Decompose `src/ui/equationView.ts` (725 lines, 28.5 KB)
* **Problem**: `equationView.ts` renders the equation rail, derivation history, physical balance scale, not-yet shakes, and drop zones across 8 different phases.
* **Target**: Extract sub-components:
  * `src/ui/balanceScaleView.ts` (Mode C beam, pans, fulcrum pivot, tilt classes)
  * `src/ui/equationHistoryView.ts` (depth-based past equation steps)
  * `src/ui/equationRailView.ts` (active interactive equation terms & fractions)

### 9. [ ] Decouple Mode-Specific Canvas Overlays (`src/ui/canvasOverlay.ts`)
* **Problem**: Mode C blaster colors (Emerald, Rose, Amber, Purple, Neon Blue) and carried operand badges are embedded directly inside `CanvasOverlay.render()`.
* **Target**: Extract beam coloring and custom laser badges into a theme provider or overlay decorator pattern.

### 10. [ ] Headless Mode Interaction Test Harness
* **Problem**: Current tests only cover pure math state machine (`linearEquation.test.ts`, `linearEquationModeC.test.ts`). Testing gestures or keyboard shortcuts requires opening a browser.
* **Target**: Add Vitest tests for `InteractionController` and `ModeHandler`s using synthetic laser ray and keyboard events.

### 11. [x] [COMPLETED] Add `typecheck` Script to `package.json`
* Added `"typecheck": "tsc --noEmit"` to `package.json` scripts for zero-lag TypeScript validation.

---

## 📋 Recommended Execution Order

```
[Phase 0: MUST-DO BEFORE MODE 4]
  ├── Item 1: Modularize index.css (~20m)
  ├── Item 2: Data-driven Mode Registry in hudView (~25m)
  ├── Item 3: Extract Bubble Physics & Split Animation from main.ts (~35m)
  └── Item 4: Mode Interaction Handlers in interactionController (~45m)
                 │
                 ▼
[IMPLEMENT MODE 4 WITH HIGH VELOCITY]
  ├── Create src/game/modes/modeDHandler.ts
  ├── Create src/styles/modes/mode-d.css
  ├── Create Mode 4 UI view & math reducer
  └── Register in modeRegistry.ts
                 │
                 ▼
[Phase 1 & 2: ONGOING EXTENSIBILITY]
  ├── Item 5 & 6: Generic Left Panel & LayoutManager
  ├── Item 7: EquationState Mode Payload
  └── Item 8: Decompose equationView.ts
```
