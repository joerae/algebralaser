TODO


[x] Mode D implementation plan completed in v1.6.0.

Mode D Scale Alignment, Blasting Enhancements & Bug Fixes
This implementation plan addresses the 6 feedback items for Mode D and the balance scale system:

Centering the equals sign (=) directly above the scale fulcrum.
Updating the inverse choice panel header to "BLAST IT AWAY" (Item 2.1) and fixing laser finger hit-testing so choices can be selected with the laser (Item 2.2).
Expanding the blast hit target to the entire LHS/RHS of the equation and scale beam (Item 3), and animating the carried bubble along the laser ray during blasting (Item 3.1).
Synchronizing equation rail tilt and animation with the scale beam.
Making the physically down side of the scale pan glow when the scale is out of balance.
Preserving the variable Y in the numerator when displaying and simplifying the LHS fraction (3Y/3).
Proposed Changes
1. Equation Layout & Equals Sign Centering
Files:

equationView.ts
equation.css
Details:

Currently, .equation-rail uses flex centering with direct sibling term tiles and symbols. Because LHS has multiple terms (3 x Y - 1) and RHS has only one (11), the = sign is pushed far to the right of the center fulcrum.
Wrap LHS elements in .equation-side.equation-lhs and RHS elements in .equation-side.equation-rhs.
Configure .equation-lhs with flex: 1; justify-content: flex-end; and .equation-rhs with flex: 1; justify-content: flex-start;.
Center .symbol-equals with flex: 0 0 auto; margin: 0 16px;.
Set .equation-rail to match the scale width (min-width: 480px; max-width: 580px;). This guarantees that = is located at the exact 50% midpoint of the rail, positioned directly over the middle of the scale fulcrum (▲).
2. "BLAST IT AWAY" & Laser Selection on Inverse Choices
Files:

inversePanelView.ts
main.ts
rayCaster.ts
Details:

Item 2.1: In inversePanelView.ts, change header title text from Choose Inverse to BLAST IT AWAY.
Item 2.2: In main.ts inside collectTargets(), register the interactive cards from this.inversePanelView.getInteractiveElements() when gameState.mode === 'mode_d' and gameState.phase === 'choose_inverse'.
Update InteractiveTarget.type in rayCaster.ts to include 'inverse_choice'.
This enables laser ray-casting to hit the inverse choice cards and trigger modeDBlastSidesHandler.ts dwell selection.
3. Large Blast Hit Target & Bubble Travel Effect
Files:

equationView.ts
modeDBlastSidesHandler.ts
canvasOverlay.ts
mode-d.css
Details:

Item 3 (Wide hit target):
In equationView.ts, add target identifiers to the entire left and right halves: #equation-side-lhs / #scale-side-lhs (or a unified #blast-target-lhs) and #equation-side-rhs / #scale-side-rhs (or #blast-target-rhs).
In equationView.getInteractiveElements(), return these wide hit targets instead of only the tiny scale pan when in blast_first_side or blast_second_side.
In modeDBlastSidesHandler.ts, accept hits on any LHS target (scale-pan-lhs, blast-target-lhs, equation-side-lhs) or RHS target (scale-pan-rhs, blast-target-rhs, equation-side-rhs).
Update operation banner text from "Aim laser at the left scale pan..." to "Aim laser anywhere on the left side to blast...".
Item 3.1 (Bubble travels along laser line):
In canvasOverlay.ts, update drawLaserRay where blasterInfo.carriedOperandText is rendered.
Generalize isTargeting from the hardcoded Mode C 'term-rhs-mode-c' to any blast target (including Mode D's LHS/RHS blast targets and scale pans).
Interpolate badgeX and badgeY along the laser ray from origin (fingertip) toward (endX, endY) (target hit location) based on dwellProgress. When hovering/blasting, the purple operand bubble travels up the laser line directly into the scale/equation.
4. Equation Tilting and Animation
Files:

equationView.ts
equation.css
Details:

In equationView.ts, apply the dynamic rotation to .equation-rail:
html

<div class="equation-rail mode-c-rail" style="transform: rotate(${tiltAngle}deg); transform-origin: 50% 50%; transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);">
Because = is at 50% width (the pivot center), the equation rail tilts synchronously with the scale beam below it around the = fulcrum, smoothly animating with the spring transition when a side is blasted or balanced.
5. Down Side Glowing on Imbalance
Files:

equationView.ts
mode-d.css
linearEquation.ts
Details:

Determine which side is physically down based on tiltAngle:
With browser CSS rotation, negative angle tilts LHS down and RHS up; positive angle tilts RHS down and LHS up.
When the scale is unbalanced (tiltAngle !== 0 or phase is blast_second_side), identify the side that has sunk down (downSide = tiltAngle < 0 ? 'lhs' : 'rhs').
Apply .down-side-glow animation to the down side pan/beam half so it glows with radiant energy while out of balance.
Ensure the remaining unblasted side also has its target affordance so the user clearly sees both: the tilted down side glowing, and the prompt guiding the next blast to restore balance.
6. Variable Y Preservation in LHS Fraction
Files:

equationView.ts
Details:

In equationView.ts lines 230-268 (during phase === 'question' / simplifying):
When mode === 'mode_d' and isSimplifyingLhs is true with pendingArithmetic.operator === '÷': The numerator was previously rendered as ${pendingArithmetic.operand1} (just 3), omitting the variable Y.
Update the numerator to render ${pendingArithmetic.operand1}<span class="term-variable">Y</span> (or ${currentA}<span class="term-variable">Y</span>).
This keeps 3Y in the numerator (3Y / 3) matching Screenshot 4 and preserves the algebraic integrity of the term.
Verification Plan
Automated Tests
Run existing unit tests via Vitest:
bash

npm test
Verify all equation state transitions, Mode C, Mode D, and pose classifier tests pass.
Manual Verification
Launch local dev server (already running) and inspect in browser:
Equals Alignment: Verify that = is in the exact center and aligned with the scale fulcrum ▲.
Choose Inverse Panel: Verify title is "BLAST IT AWAY", aim laser finger at the inverse options, verify dwell ring fills and selects option.
Wide Hit Target & Blasting: Aim laser anywhere across the entire LHS of equation or scale; verify target acquires easily.
Bubble Travel: Verify that as you dwell-blast, the purple bubble moves along the laser beam toward the target.
Tilt & Animation: Verify that upon impact, both the scale beam and the equation rail tilt together smoothly.
Down Side Glow: Verify that the down side pan/half glows when the scale is tilted out of balance.
Preserved Variable Y: Progress to coefficient division step and verify that when simplifying LHS, 3Y / 3 is displayed with the Y clearly visible.



[x] Balance mode - make it the default mode on loading

[x] Balance mode - Forge panel. Need to lay out the opposites vertically. Right now I can't get to the + because it is in a column next to the -. Make them take up the full height of the camera box, so it is easy to hit the one I want

[x] Balancing mode - once I've picked up a number that needs forging, run an arrow pointing down to the forging area, similar to the one that makes me do the equations. This is to help me focus my attention there.

[x] Balancing mide - after I have forged, right now I have to push the result up to the equals. In fact, it could be to the whole equation

[x] Balancing mode - after targeting the equation with the forged number, there's an animation showing removing the forged number for both sides. That's cool, but right now it goes so fast I can't take it in. Maybe the forged number floats above each side, and we see it smash in and remove on side one, then side two. And when it hits side two, this transitions into the arrow that makes up do the calcaultion on the other side

[x] Balancing mode - Equation finished info. It should be tracking each new version of the equation on both sides as I adapt it (e.g. point the forged sign to the equation, and also answer the question on the right) - the equation should adapt, and I can see the new version of it up above.


Not Yet
[x] Mode D writes "3Y", then extracts "3×" into the laser bubble before forging it into the inverse operation.
