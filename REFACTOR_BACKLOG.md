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

### 1. [ ] Modularize Monolithic `src/styles/index.css` (2,215 lines, 49.5 KB)
* **Problem**: Editing styles currently requires reading or modifying a 2,200+ line stylesheet. Every mode's CSS has been appended to the bottom, causing token bloat and collision risk.
* **Target**: Split into modular stylesheets loaded via CSS `@import` or Vite imports:
  * `src/styles/base.css` (CSS variables, resets, typography, layout grid)
  * `src/styles/hud.css` (header, footer, camera box, modal dialogs, status badges)
  * `src/styles/equation.css` (equation rail, terms, fractions, history stack)
  * `src/styles/modes/mode-a.css` (landing slot, bubble popping animations)
  * `src/styles/modes/mode-b.css` (forge panel, split clone bubbles, cancel flashes)
  * `src/styles/modes/mode-c.css` (blaster cards, balance scale beam & tilt physics)
* **Iteration Speed Impact**: Mode 4 styles go into a brand-new `src/styles/modes/mode-d.css`. Zero risk of corrupting existing mode styles.
* **Effort**: ~20 mins.

### 2. [ ] Data-Driven Mode Registry & Header Switcher (`src/ui/hudView.ts`)
* **Problem**: [`src/ui/hudView.ts`](file:///c:/Users/jraeb/algebra/src/ui/hudView.ts#L145-L186) hardcodes `#btn-mode-a`, `#btn-mode-b`, `#btn-mode-c` in HTML and binds individual click listeners. Adding Mode 4 requires modifying HTML markup and handler bindings.
* **Target**: Create `src/game/modeRegistry.ts` with a `ModeDefinition` list:
  ```typescript
  export interface ModeDefinition {
    id: SolverMode;
    title: string;
    label: string;
    icon: string;
    description: string;
    getInstruction(state: EquationState): string;
    getBadgeHint(state: EquationState): string;
    getPedagogicalHint(state: EquationState): string;
  }
  ```
  `HudView` iterates over `MODE_REGISTRY` to render toggle buttons dynamically.
* **Iteration Speed Impact**: Adding Mode 4 to the UI header becomes a single config entry in `modeRegistry.ts`.
* **Effort**: ~25 mins.

### 3. [ ] Extract Bubble Physics & Split Animation from `src/main.ts` (1,263 lines)
* **Problem**: `main.ts` contains:
  * 100+ lines of nested `setTimeout` callbacks for Mode B's split animation ([`triggerSplitAndBalance`](file:///c:/Users/jraeb/algebra/src/main.ts#L234-L328)).
  * 150+ lines of magnetic snapping, hold duration math, audio tick throttling, and SVG progress ring offset calculation ([`main.ts:loop`](file:///c:/Users/jraeb/algebra/src/main.ts#L546-L797)).
* **Target**:
  * Extract Mode B split animation into `src/ui/animations/splitBalanceAnimation.ts`.
  * Extract floating bubble tracking, magnetic snapping, and progress rings into `src/ui/carriedBubbleView.ts`.
* **Iteration Speed Impact**: Cuts ~300 lines from `main.ts`, reducing it from 1,263 to <900 lines and eliminating animation side-effects from the core game loop.
* **Effort**: ~35 mins.

### 4. [ ] Extract Mode Interaction Handlers from `src/game/interactionController.ts` (717 lines)
* **Problem**: [`src/game/interactionController.ts`](file:///c:/Users/jraeb/algebra/src/game/interactionController.ts) contains deeply interleaved `if (gameState.mode === ...)` branches across vision frame processing, dwell confirmation, palm detection, and keyboard shortcuts. Adding Mode 4 adds more conditionals to a 700-line method.
* **Target**:
  * Define `ModeInteractionHandler` interface:
    ```typescript
    export interface ModeInteractionHandler {
      onVisionFrame?(ctx: VisionInteractionContext): boolean;
      onKeyDown?(e: KeyboardEvent, state: EquationState, game: GameController): boolean;
      resetDwell?(): void;
    }
    ```
  * Delegate to isolated handlers:
    * `src/game/modes/modeACarrier.ts` (Mode A carrying, curl drop, landing slot)
    * `src/game/modes/modeBForgeHandler.ts` (Mode B forging dwell, equals apply)
    * `src/game/modes/modeCBlasterHandler.ts` (Mode C blaster equip, LHS smash, RHS blast, calc simplify)
* **Iteration Speed Impact**: Mode 4 interaction is authored in `src/game/modes/modeDHandler.ts` with zero risk of breaking existing modes.
* **Effort**: ~45 mins.

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

### 11. [ ] Add `typecheck` Script to `package.json`
* **Problem**: Currently `package.json` only has `"test": "vitest run"` and `"build": "tsc && vite build"`. Fast headless type verification requires running `npx tsc --noEmit`.
* **Target**: Add `"typecheck": "tsc --noEmit"` to `package.json` scripts.

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
