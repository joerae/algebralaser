TODO

[  ] The camera view on the screen is moving around between the different phases, i.e. it starts higher up in some stories, and goes lower down during the resolution / next story phase. I don't want it to move around, it is disconcerting! Find the vertical distance it needs to be from the top, and keep it there for all modes. Note that this distance SHOULD change in the standard responsive way as we resize, but it shouldn't change between phases


[x] For desktop mode, I'd like all selections to appear docked to the right of the camera. And just like mobile mode, I'd like to be able to toggle it over to the left in settings. This allows me to play with one hand.
  - **Notes on implementation:**
    - Added `desktopDock: 'left' | 'right'` state (defaulting to `'right'`) persisted in `localStorage` under `algebra_desktop_dock`.
    - Added a "Selections on Right (Desktop)" toggle switch in `src/ui/hudView.ts` inside the Settings dialog (⚙️ / 'M' key shortcut).
    - Unified desktop panel placement in `src/main.ts` via `computeDesktopPanelLeft(...)`. All five selection containers (`forgePanelEl`, `blasterPanelEl`, `inversePanelEl`, `storyChoicesColumnEl`, and `answersColumnEl`) now dock to the right of the camera feed by default, and switch to the left of the camera when the setting is toggled off.
    - Updated Mode D inverse connector arrows and arithmetic question connector arrows to dynamically compute curvature and anchor points based on whether panels are docked to the right or left of the equation/camera.

[x] During the story display, it always finishes with "How much does X cost", but really that final line should be the much clearer call to action of "which equation matches"
  - **Notes on implementation:**
    - In `src/data/storyTemplates.ts`, updated `buildStoryBeats()` across all 8 equation families (`x_plus_b`, `x_minus_b`, `ax`, `ax_plus_b`, `ax_minus_b`, `x_div_d`, `x_div_d_plus_b`, `x_div_d_minus_b`) so the final question beat is `{ type: 'question', text: 'Which equation matches?' }`.
    - Retained `shortQuestion` (e.g. "How much did each spell scroll cost?") for the solving-phase prompt bar and popover goal where the player is actually solving for the unknown value $x$.
    - Added a unit test in `src/story/buildConcreteStory.test.ts` verifying all story levels end with the "Which equation matches?" call to action.

[x] On Chromebook, I want camera window to always stay the same size. It mostly does EXCEPT in the resolution of the puzzle where you select the next puzzle. In this there's lots of padding which leads to the camera window being squeezed. 
  - **Notes on implementation:**
    - Replaced hardcoded inline style (`style="padding: 6px 36px; min-height: 76px;"`) on `.equation-rail` in `src/ui/equationView.ts` with responsive `.solved-rail` class.
    - In `src/styles/responsive.css`, restricted the tall solved equation area (`clamp(205px, 32dvh, 300px)`) to spacious desktop viewports (`min-height: 821px and min-width: 1367px`).
    - For Chromebook / compact displays (`max-height: 820px or max-width: 1366px` and landscape `max-height: 700px`), locked `#app[data-phase="solved"] .equation-area` to the exact same height budget as active gameplay (`145px` on <=820px, `clamp(76px, 18dvh, 112px)` on <=700px).
    - Streamlined padding and gaps on `.solved-panel`, `.solved-line-wrap`, `.solved-actions`, `.action-btn-primary`, and `.open-palm-advance-badge`, and hid receding equation history in solved state on compact screens so all resolution elements fit comfortably inside the standard equation area without squeezing the camera window.

[x] During story display, the border of the story field flashes with each new line coming in. I don't want it to flash, it is distracting and looks like a bug.
  - **Notes on implementation:**
    - In `src/ui/storyView.ts`, modified `render()` so that when beat updates arrive for an already-mounted story, `this.container.innerHTML` is not destroyed and recreated.
    - Existing sentence elements are now updated in-place by toggling `.sentence-revealed`, `.sentence-pending`, and `.sentence-highlight` classes.
    - This keeps `.story-presentation-panel` and `.story-card` continuously mounted, preventing the CSS entrance animation (`storyFadeIn`) from replaying on every tick and completely eliminating the border and box-shadow flashing while allowing individual sentences to smoothly fade in.

[x] There are four introductory equations, which we can toggle off in settings. I want these to toggle off once I have finished them. So by default these will show the first time, but the flick the info so that it toggles them off for future sessions.
  - **Notes on implementation:**
    - In `src/game/gameController.ts`, added automatic tutorial completion tracking (`markTutorialCompleted()`). When the 4th curated equation (`curated-4`) is solved or advanced past via `nextLevel()`, `this.skipTutorial` is set to `true`, `localStorage.setItem('algebra_skip_tutorial', 'true')` is saved, and `onTutorialCompleted?.()` is invoked.
    - Added `setSkipTutorial(enabled: boolean)` in `src/ui/hudView.ts` to keep the Settings modal `#chk-skip-tutorial` toggle switch visually synchronized.
    - Connected `this.game.onTutorialCompleted = () => this.hudView.setSkipTutorial(true)` in `src/main.ts`.
    - Added a unit test in `src/game/gameController.test.ts` verifying that completing level 4 automatically flips `skipTutorial` to `true` and triggers the completion callback for future sessions.



Below are more complex. Leave for later
[  ] Introduce an alternate way to to shoot out the two bubbles. Instead of just pointing to the equation, you actually need to fire one to each side. Each side has a nice big hitbox though, and it just requires you passing over it rather than holding. I'd like to try this, so make it togglable to the original animated mode by pressing "s". By default, make it this new way though.
