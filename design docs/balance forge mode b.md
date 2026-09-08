Mode B: Balance Both Sides
Overview

Add a second equation interaction mode. The user can switch between:

Mode A: Move Across
Mode B: Balance Both Sides

Both modes use the same equations and progression. A visible mode toggle lets the player switch at any time. Switching modes resets the current equation to its starting state but preserves overall progress.

Mode B teaches rearranging by having the player forge an opposite operation and apply it to both sides.

Screen layout

The equation remains above the camera. The forging controls appear to the left, and the existing arithmetic answer controls appear to the right.

                 ┌──────────────────────────┐
                 │     3 × Y − 1 = 12       │
                 └──────────────────────────┘

┌──────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│ FORGE THE        │  │                          │  │ WHAT IS 12 + 1?  │
│ OPPOSITE         │  │                          │  │                  │
│                  │  │        CAMERA            │  │   12             │
│  +   −   ×   ÷   │  │                          │  │   13             │
│                  │  │                          │  │   14             │
└──────────────────┘  └──────────────────────────┘  └──────────────────┘

The left and right panels appear only when needed:

The forge panel appears after an equation operation is selected.
The forge panel disappears once the opposite is applied.
The arithmetic panel then appears when the resulting calculation must be completed.
Equation layout

Space every meaningful component far enough apart to target individually with the finger laser.

Example:

3 × Y − 1 = 12

Selectable components include:

×3, represented visually by the coefficient 3
−1
Any other operation that can eventually be undone

Only operations that can be cleanly cancelled at the current step are active.

For 3 × Y − 1 = 12, −1 is active first. If the player tries to select 3, give a small “NOT YET” shake and pulse −1. Do not call 3 wrong, because dividing by 3 is mathematically possible but would divide the entire left side and introduce fractions.

After −1 is removed, ×3 becomes active.

Interaction flow
1. Select an operation to undo

The player points at an active equation component and holds to pick it up.

For 3 × Y − 1 = 12, selecting −1 creates a glowing −1 bubble attached to the finger. The original remains visible in the equation.

2. Forge the opposite

A panel appears on the left:

FORGE THE OPPOSITE

It always displays four large targets:

+ − × ÷

The player moves the bubble onto a sign and holds for approximately one second. Show a progress ring during the hold.

Incorrect sign: the sign and bubble give a quick “nah-uh!” shake. The player can immediately try again.
Correct sign: the bubble transforms into the opposite operation with a flip, flash, or pulse.
Selected operation	Correct sign	Forged operation
+4	−	−4
−1	+	+1
×3	÷	÷3
÷5	×	×5

The player chooses the sign. The number is retained automatically.

3. Apply it to both sides

After forging, change the prompt to:

APPLY TO BOTH SIDES

The player pulls the forged bubble upward toward the equation.

When it reaches the equals sign, the equals sign activates and splits the bubble into two identical copies. One lands on each side:

3 × Y − 1 + 1 = 12 + 1

The animation must clearly communicate that exactly the same operation was applied to both sides.

4. Cancel and calculate

The inverse operations on the variable side cancel automatically:

3 × Y = 12 + 1

The right-hand arithmetic panel appears using the existing interaction:

What is 12 + 1?

After the player chooses 13:

3 × Y = 13

The player repeats the Mode B flow:

Select ×3.
Forge ÷3.
Apply ÷3 to both sides.
The left side cancels to Y.
Answer 13 ÷ 3.

Continue until the variable is isolated.

Target eligibility

Mode B supports the complete multi-step Mode A question set.

At each step:

Top-level added or subtracted constants can be selected.
Multiple constants at the same level may be valid targets.
A coefficient or divisor becomes active when the variable side contains only the associated multiplication or division.
Operations nested inside another expression remain individually visible but respond with “NOT YET” if selected.
After each cancellation and arithmetic answer, recalculate which targets are active.
Controls and resilience
Point and hold is the primary interaction.
Click or tap performs the equivalent action.
Forging requires approximately one second of continuous targeting.
Incorrect forge attempts do not reset the step.
Losing hand tracking preserves the current equation state.
The forged bubble remains attached to the finger until it is successfully applied.