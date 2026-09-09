# Blast Sides, Mode D

## Purpose

Add a new algebra mode called **Blast Sides** alongside the existing modes.

Mode D should help learners understand that solving an equation means:

1. Identifying the operation currently being applied to the unknown.
2. Choosing the inverse operation that will undo it.
3. Applying that operation to the **whole of both sides**.
4. Seeing that changing only one side breaks the balance.
5. Simplifying the resulting expressions.

The experience should feel physical and playful. The learner uses their finger to select an inverse operation and blast it onto both sides of an equation displayed on an old-fashioned balance scale.

## Relationship to Mode C

Mode D has just been implemented after Mode C and should reuse as much of Mode C as practical. Do not create parallel versions of systems that can be shared.

Reuse or extend Mode C's existing:

- equation balance and beam
- scale-pan movement and settling
- hand/finger targeting
- rays, blasting and impact effects
- equation-term hit detection
- operation colours and symbols
- charged operation attached to the fingertip
- cancellation and term-removal animations
- arithmetic calculation area and answer selection
- equation transition and completion flow
- shared layout, sizing, sound and feedback conventions

Mode D should primarily introduce a new puzzle flow and state machine around those systems. Extract shared Mode C behaviour into reusable components or helpers only where required for Mode D. Avoid a broad refactor unrelated to this mode.

## Core Principle

Operations are always applied to an **entire side of the equation**, never to an isolated term.

A learner may target a term to identify what must be undone. For example, they target `-1` in `3Y - 1`. However, the resulting `+1` is visibly applied to the whole left side:

```text
3Y - 1 + 1
```

It must not immediately delete `-1` or imply that algebra works by removing symbols.

The same applies to division. Targeting the `3` in `3Y` can identify `÷3` as the required inverse, but the operation is applied to the whole side:

```text
(3Y) ÷ 3
```

Never describe or animate this as "dividing the 3 away."

## Example Puzzle

```text
3Y - 1 = 11
```

The equation sits on a physical balance scale, with the equals sign at the centre of the beam.

### Stage 1: Identify what to undo

Prompt:

> What should you undo first?

The learner points at `-1`.

For initial content, puzzles should guide learners toward undoing the outermost operation first. Incorrect targets receive brief feedback and do not advance the state.

### Stage 2: Choose the inverse

Prompt:

> What can you blast at -1 to cancel it out?

If a shorter prompt works better in the layout, use:

> What blasts away -1?

Prefer this over `What undoes -1?`, which is mathematically reasonable but does not sound natural for the target age. `What magics away -1?` is less clear than the blast wording. The later animation must still show that the terms cancel to zero rather than simply implying arbitrary deletion.

Show exactly four answer choices using the established calculation-choice interaction. Include distractors based on both the target operation and values elsewhere in the equation. Example:

- `+1` (correct)
- `-1`
- `+11`
- `-11`

The learner must select `+1`. The other-side values help reveal whether the learner understands that the inverse is determined by the operation around `Y`, not by the standalone number on the other side.

After the correct choice, the `+1` blaster becomes charged and `+1` appears at the learner's fingertip.

### Stage 3: Blast the first side

The learner blasts `+1` onto the left side.

The left expression becomes:

```text
3Y - 1 + 1    [unbalanced]    11
```

Do not simplify yet.

The left side is now heavier, so the scale tips down on the left. While the scale is unbalanced, visually break or dim the equals connection so the interface does not assert a false equality. The right side becomes the **unmatched side** and begins glowing or pulsing to invite the same operation.

The charged `+1` remains attached to the learner's fingertip.

### Stage 4: Restore balance

The learner blasts the glowing right side.

The expression becomes:

```text
3Y - 1 + 1 = 11 + 1
```

The right side receives the additional weight, the scale returns to level, and the unmatched-side glow stops. The `+1` charge is consumed only after both sides have received it.

The equals sign or connection becomes fully active again only when balance is restored.

For guided introductory puzzles, encourage the learner to apply the operation to the side containing the target first. The underlying system should support either side being blasted first if that is easy to preserve from Mode C.

### Stage 5: Simplify both sides

Once both sides match, prompt the learner to simplify. Reuse the established calculation area and answer-selection flow. The two sides do not need separate simplification states.

Left side:

```text
-1 + 1 = 0
3Y + 0 = 3Y
```

The `-1` and `+1` should cancel with a satisfying version of Mode C's existing pop or blast animation. The resulting `0` can then pop away.

Right side:

```text
11 + 1 = 12
```

When the learner completes the required calculation choice, simplify both sides in one synchronized animation. The left cancellation and the right arithmetic happen at the same time. The equation becomes:

```text
3Y = 12
```

The balance remains level throughout simplification because the value of each side has not changed.

### Stage 6: Repeat for multiplication

Prompt:

> What should you undo next?

The learner identifies `×3`, represented by the coefficient in `3Y`.

Prompt:

> What undoes ×3?

Example choices:

- `÷3` (correct)
- `×3`
- `÷12`
- `×12`

The learner receives the `÷3` blaster and applies it to both complete sides. After the first blast, the opposite side glows and the scale tips. On the left, the blast's `÷3` can settle directly under the coefficient `3`, immediately creating a proper fraction. It does not need to show a separate `(3Y) ÷ 3` layout first. The whole side remains the interaction target even though the visual fraction resolves around the coefficient.

After the second blast, the scale returns to level:

```text
(3/3)Y = 12/3
```

Render both divisions with proper fraction bars in the UI.

### Stage 7: Simplify division

The left-side animation continues from the fraction created by the blast:

```text
(3/3)Y
→ 1Y
→ Y
```

The `1` then pops away using the same visual language as a zero disappearing, because `1Y` is simply `Y`.

The right side is calculated through the existing answer-selection flow:

```text
12 ÷ 3 = 4
```

As in Stage 5, simplify the left and right sides at the same time once the required calculation answer has been completed. The completed equation is:

```text
Y = 4
```

## Unbalanced-Side Feedback

This is a core Mode D behaviour.

After an operation has been applied to only one side:

- physically tip the scale toward the changed/heavier side, or away from it for an operation that reduces its value
- make the **other, unmatched side** glow or pulse
- use the active operation's colour for the glow
- keep the charged operation and its value visible at the fingertip
- visually deactivate or break the equals connection while the two sides do not match
- optionally show a short prompt such as `Balance the other side`
- make the glow intensify gently when the finger or ray approaches the correct side

The cue should communicate: **this side still needs the same operation**.

Do not use a generic error state. Being temporarily out of balance is an expected and important part of the interaction.

If the learner tries to blast the same side twice, reject the blast with light feedback and keep the other side glowing. Do not mutate the equation.

## Suggested State Flow

1. `SELECT_TARGET`
2. `CHOOSE_INVERSE`
3. `OPERATION_CHARGED`
4. `ONE_SIDE_APPLIED`
5. `BOTH_SIDES_APPLIED`
6. `SIMPLIFY_BOTH`
7. Return to `SELECT_TARGET`, or `COMPLETE`

The exact names can follow existing project conventions. The important requirement is that applying an operation, restoring balance and simplifying remain distinct states.

## Interaction Rules

- A specific operation includes both its operator and operand, such as `+1` or `÷3`.
- Once charged, the same specific operation must be applied once to each side.
- A blast targets the whole left or right expression, even if its visual impact is centred near the selected term.
- The expression remains unsimplified until both sides have received the operation.
- Simplification cannot begin while the scale is unbalanced.
- Incorrect inverse choices use the existing incorrect-answer feedback and allow another attempt.
- Every inverse-choice question has exactly four options: the correct inverse, a same-operation distractor, and distractors using a relevant value from the other side of the equation.
- Incorrect equation targets do not change the equation.
- Completion should use the existing Mode C success flow where possible.

## Visual Requirements

- Keep the current equation large and readable above or directly on the scale.
- Use consistent colours for each operator across selection, fingertip charge, ray, impact and unmatched-side glow.
- Show newly applied operations as distinct coloured additions before they merge into the equation's normal styling.
- Animate the beam continuously between balanced and unbalanced positions rather than snapping it.
- Preserve mathematical readability during all effects. Particles and flashes must not obscure which operation was applied to which side.
- Use proper multiplication, division and fraction notation in the rendered equation, even if internal content definitions use simpler tokens.

## Content Requirements

Initial Mode D puzzles should use integer solutions and operations that simplify cleanly. Sequence them so the learner first experiences:

1. Addition as the inverse of subtraction.
2. Subtraction as the inverse of addition.
3. Division as the inverse of multiplication.
4. Multiplication as the inverse of division.
5. Two-step equations that require operations to be undone in reverse order.

Content data should explicitly provide or derive:

- the valid target for each step
- the inverse operator and operand
- plausible incorrect choices
- the unsimplified expression after applying the operation
- the simplified expression and calculation answers

Prefer deriving these from the equation model if Mode C already has a reliable transformation system. Avoid maintaining duplicate display strings that can drift away from the actual equation state.

## Out of Scope

- Speech synthesis or spoken explanations
- Free-form equation entry
- Fractions or decimals as puzzle solutions in the initial version
- Multiple valid solution paths within a single puzzle
- A broad rewrite of Modes A, B or C
- Symbolic algebra beyond the transformations required by the initial puzzle set

Speech synthesis may be considered later, but Mode D must work clearly through visuals, motion and short text prompts alone.

## Acceptance Criteria

Mode D is ready when:

- it is selectable alongside the existing equation modes
- the learner must identify an operation to undo and choose its inverse
- the selected inverse becomes a specific charged operation on the fingertip
- blasting one side visibly tips the balance
- the other side glows in the active operation's colour until it receives the same operation
- the equals connection is visibly inactive while the scale is unbalanced and restores with the balance
- the same operation cannot be applied twice to one side
- both complete equation sides visibly receive the operation
- the scale returns to level only after both sides have received matching operations
- expressions remain unsimplified until balance has been restored
- cancellation and arithmetic are shown during one synchronized simplification stage for both sides
- division of `3Y` by `3` places the divisor directly beneath the coefficient during the blast, then shows `(3/3)Y`, `1Y`, and `Y`
- every inverse question presents exactly four plausible choices, including choices built from a relevant value on the other side
- zero and coefficient-one removal use consistent pop-away feedback
- the example `3Y - 1 = 11` can be completed as `Y = 4`
- Mode C's balance, blast, targeting, calculation and animation systems are reused rather than duplicated wherever practical
- existing modes continue to behave as before

## Implementation Questions

### 1. Blaster Tray vs. Inverse Multiple-Choice UI
- **1.1**: In Mode C, a bottom blaster dock (`+`, `-`, `×`, `÷`, `calc`) is always visible. In Mode D, inverse operations are selected from 4 choice cards (`+1`, `-1`, etc.). Should the Mode C bottom blaster dock be completely hidden in Mode D, or does it serve any secondary purpose?
>> The blaster dock from Mode C is gone. Instead there's the "Choose Inverse" step which asks to choose both the operator and the operand. This could happen on the LHS of the camera, similar to where the blaster dock was. However, let's make this have more vertical height for ease of selection, like the panel on the RHS.
- **1.2**: Where should the 4 inverse-choice cards be rendered on screen (e.g., occupying the bottom area where the blaster dock was, or overlaid in the center calculation/question area like `AnswersView`)?
>> Occupying the LEFT side of the camera, which is where the blaster doc was (you said the bottom, the blaster doc wasn't there)
- **1.3**: How should keyboard navigation work for choosing the inverse and firing the blasters (e.g., number keys `1`–`4` for selecting options, and `Left`/`Right` arrow keys or `Space`/`Enter` to blast the respective sides)?
>> Sure, you can support keyboard. But camera and mouse control are more important. So try doing keyboard too but don't stress if it doesn't work. But yeah sure 1-4 for selecting options but DON'T SHOW THAT ON SCREEN as it will confuse it with the other numbers! 
### 2. Side-Blasting Hit Targets & Trigger Interaction
- **2.1**: A blast applies to an entire side. For laser ray hit-detection, should the target bounding box be the entire scale pan / side container (`scale-pan-lhs` / `scale-pan-rhs`), or can the learner aim at any term on that side?
>> The who scale pan I think. Let's try that
- **2.2**: How should firing the blast be confirmed—using continuous dwell time (e.g., 400–500ms hold, matching Mode C's `term-rhs-mode-c`), pinch gesture, or immediate ray contact?
>>Mode C does it pretty well when it fires the operarator / operand group to the RHS. So let's use that. It is a dwess where you see the blast impacting the targent, supported by a radial fill (I think) and some sounds and vfx 
- **2.3**: If a learner aims at the already-blasted side during the unbalanced state, what visual/audio rejection should be shown (e.g., a "shake-not-yet" wobble with a banner like "Already blasted this side! Balance the other side!"), and should dwell be disabled on that side?
>> Can't do that shake.
### 3. Simplification Phase Flow & Interaction
- **3.1**: After both sides receive the blast (Stage 5 & 7), does simplification trigger automatically into the arithmetic question, or does the learner have to manually activate it (e.g., dwelling on a "Simplify" target or using a `calc` blaster)?
>> The thing to be simplified has a pulsing affordance, suggesting you can interact with it. When you point at it, it goes into the simplifying calculation, like you'd blasted it with the Calc blaster in Mode C. However there are no blasters to select in Mode D, it just happens in context. The user would then select the answer from four answers on the RHS, just like all the other modes.
- **3.2**: Does the learner interact only with the right-side arithmetic calculation (`11 + 1 = ?`), while the left-side cancellation (`-1 + 1 = 0 -> 3Y`) plays automatically in synchronized animation, or is there any interaction required on the left side?
>> Let's make it that we have to simplify both of them. There will be a lot of "1 - 1 = 0" going on, but I think that is OK. Once that is selected, the 0 will animate out and disappear (I think, though we could make it stay there and just be blasted away next time the ray comes close to it!! That could be fun!)
- **3.3**: For the RHS arithmetic simplification question, should it use the existing 3-choice format (`PendingArithmetic`), or should it be updated to 4 choices to match the inverse-choice step?
>>Let's just keep 3 choices.
### 4. Scale Physics, Tilt Direction, and Equals Indicator
- **4.1**: For scale tilt direction when one side is blasted: should `+` and `×` always tilt that side down (heavier), while `-` and `÷` tilt that side up (lighter)?
>>Yes, just like that
- **4.2**: Is a fixed discrete tilt angle (e.g., standard `lhs_heavy` / `lhs_light` CSS classes from Mode C) sufficient, or do you require continuous dynamic angular physics proportional to the numerical weights?
>>Something in between would be good! Like even with a +1 there should be a noticeable tilt, but with something like a x3 there should be more. I think the best system is if you calculate the difference, and know that a difference of 1 is an angle of, say 10 degrees, and a difference of (3* variable) is the maximum at 30 degrees, then you can just run that range in between. Or some similar interpolation.
- **4.3**: When the scale is unbalanced and the equals connection is broken/deactivated, what visual style is preferred for the equals sign (e.g., dimmed/slashed `≠`, lowered opacity with dashed border, or separated into disconnected bars)?
>>Just dim it, and when it is balanced it will light back up
