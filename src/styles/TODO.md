TODO

[x] The camera view on the screen is moving around between the different phases, i.e. it starts higher up in some stories, and goes lower down during the resolution / next story phase. I don't want it to move around, it is disconcerting! Find the vertical distance it needs to be from the top, and keep it there for all modes. Note that this distance SHOULD change in the standard responsive way as we resize, but it shouldn't change between phases. One of the biggest culprits is the tooltip text that says "Aim laser at Next Puzzle..." in the puzzle resolved phase - this ads vertical height that we just don't need and uses up valulable vertical space and makes the camera smaller. Just remove it.
  - **Notes on implementation:** Wrapped the story and equation regions in a fixed responsive pre-camera slot, so its height changes only at viewport breakpoints rather than between game phases. Removed the solved-state guidance badge and changed the camera header controls to a small overlay, eliminating the "Laser Hand Tracker" and changing hint headings without sacrificing video space.

[x] Make the default side for the answers the LEFT side not the right (i.e. change the default state of that toggle.)
  - **Notes on implementation:** New users now default to left-docked desktop selections. An explicitly saved right-side preference is still respected.

[x] On Chromebook, I want camera window to always stay the same size. It mostly does EXCEPT in the resolution of the puzzle where you select the next puzzle. In this there's lots of padding which leads to the camera window being squeezed. 
  - **Notes on implementation:**
    - Replaced hardcoded inline style (`style="padding: 6px 36px; min-height: 76px;"`) on `.equation-rail` in `src/ui/equationView.ts` with responsive `.solved-rail` class.
    - In `src/styles/responsive.css`, restricted the tall solved equation area (`clamp(205px, 32dvh, 300px)`) to spacious desktop viewports (`min-height: 821px and min-width: 1367px`).
    - For Chromebook / compact displays (`max-height: 820px or max-width: 1366px` and landscape `max-height: 700px`), locked `#app[data-phase="solved"] .equation-area` to the exact same height budget as active gameplay (`145px` on <=820px, `clamp(76px, 18dvh, 112px)` on <=700px).
    - Streamlined padding and gaps on `.solved-panel`, `.solved-line-wrap`, `.solved-actions`, `.action-btn-primary`, and `.open-palm-advance-badge`, and hid receding equation history in solved state on compact screens so all resolution elements fit comfortably inside the standard equation area without squeezing the camera window.


[x] There are four introductory equations, which we can toggle off in settings. I want these to toggle off once I have finished them. So by default these will show the first time, but the flick the info so that it toggles them off for future sessions.
  - **Notes on implementation:**
    - In `src/game/gameController.ts`, added automatic tutorial completion tracking (`markTutorialCompleted()`). When the 4th curated equation (`curated-4`) is solved or advanced past via `nextLevel()`, `this.skipTutorial` is set to `true`, `localStorage.setItem('algebra_skip_tutorial', 'true')` is saved, and `onTutorialCompleted?.()` is invoked.
    - Added `setSkipTutorial(enabled: boolean)` in `src/ui/hudView.ts` to keep the Settings modal `#chk-skip-tutorial` toggle switch visually synchronized.
    - Connected `this.game.onTutorialCompleted = () => this.hudView.setSkipTutorial(true)` in `src/main.ts`.
    - Added a unit test in `src/game/gameController.test.ts` verifying that completing level 4 automatically flips `skipTutorial` to `true` and triggers the completion callback for future sessions.



Below are more complex. Leave for later
[  ] Introduce an alternate way to to shoot out the two bubbles. Instead of just pointing to the equation, you actually need to fire one to each side. Each side has a nice big hitbox though, and it just requires you passing over it rather than holding. I'd like to try this, so make it togglable to the original animated mode by pressing "s". By default, make it this new way though.
