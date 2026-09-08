Blast Balance Mode C

New Mode to sit alongside "Move Across" and "Balance Both Sides". It's called "Blast Balance"

Philosophy

Allow learners to phsycally see the balance they are creating with the inverse operations. Make it physical and fun.


How it works

There is a set of invese operators down the left, like in Mode B. However these are now the first thing you pick up with your finger. Each of these creates a ray that is coloured, and blasts out it's symbol.

For example, for 3 Y - 1 = 11. This equation sits on an old fasioned set of scales, with the = in the middle. To progress you must first pick up the "+" ray. You can then blast it to either side of the equation, to makes more sense to blast it to the left. As you blast it on the left side, the -1 gets netralised, and you see it pop away. But now that side is heavier and the scales move, physically, to show that. And you're encouraged to blast the other side to equal it out. 

There's also a "simplify" blaster. If you then blast the righthand side of "11 + 1", it launches the calculation for this (like it does in the other modes automatically) and upon completing the equation (on the righthand side, just like in Mode A and Mode B) it collapses that side to 12.

The player can then continue by grabbing the "Divided" blaster, which maybe just has the / symbol on it, and by blasting the 3, it divides the 3 away. Now this side is lighter, and you have to divide the other side. Then you continue by picking up the "calcaultate" blaster, and blasting the right side. 

Screen Layout

                 ┌──────────────────────────┐
                 │     3 × Y − 1 = 11       │
                 └──────────────────────────┘

┌──────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│ Blasters         │  │                          │  │  Calculation area│
│             +    │  │        CAMERA            │  │   12             │
│             −    │  │                          │  │   13             │
│             x    │  │                          │  │   14             │
│             /    │  │                          │  │                  │
│  Calculator icon │  │                          │  │                  │
│                  │  │                          │  │                  │
└──────────────────┘  └──────────────────────────┘  └──────────────────┘

## Top 3 Questions Before Implementation

### 1. Operand & Value Resolution: How does a blaster know what numeric value it is firing?
In Mode B, players picked up an existing term from the equation (e.g. `−1`), so the operand value (`1`) was already determined. In Mode C, the blasters on the left only display bare operator symbols (`+`, `−`, `×`, `÷`).
- When a player picks up the `+` blaster, does it automatically adapt to the value of the target being blasted (e.g., hitting `−1` fires `+1`, hitting `3` with `/` fires `÷3`)?
>>OK, here's how I think it works. When you blast the left side with the "+" it hits away agains tat value in a circle to smash it free. Once it smashes free, then you have +1 on your fingertip. Then you can point that +1 onto the righthand side. So the act of smashing the LHS grants you that operand.

- Once one side is neutralized (e.g. LHS becomes `3Y`), does the blaster "hold" that operand value (`1`) so blasting the RHS automatically adds `+1` (giving `11 + 1`)?
>>Yes, you now have that operand on your fingertip as per question above. And make it be attached to your fingertip until you point at a target, in which case it will move down the laser line from your fingertip to that target 

- What happens if the player blasts the right-hand side *first*? Can they blast `11` before touching `−1`, and if so, how does the game know what number is being added?
>>Actually let's surpress that. But we do have a general "you are blasting a target with something that makes sense, do a "nuh uh" shake like in Mode B

### 2. Scale Physics, State Gating & Error Feedback: What happens when the scale is unbalanced or a wrong blast occurs?
The design introduces a physical scale where the equation sits and tilts when one side is blasted.
- **Physics & Visual representation**: Does the entire equation rail physically tilt around the `=` sign (fulcrum), or is there a dedicated graphical balance scale (beam and pans) rendered beneath the equation?
>>Eventually there would be a beam and pans, yes. Let's just render a line under the equation for now, and a little Triangle under where the equals is to represent this.

- **State Gating**: When one side is blasted and the scale tips (unbalanced), is the player strictly required to balance the other side before they can switch blasters or simplify?
>>Yes, actually I think. The number is on their fingertip, so they do have to pull it across and hold it on the other side for it to blast up to there.

- **Error Handling**: If the player fires the wrong operator (e.g. firing `−` at `−1`, or firing `/` at `3` before `−1` is eliminated), does the blast deflect/shake with a "not yet" warning, or does it actually apply the wrong operation and throw the scale further out of balance (requiring undo/correction)?
>>Just "not yet" for the moment. Later on if this works we can give the players more freedom to mess things up!

### 3. "Simplify / Calculate" Blaster Flow: How does the calculation step integrate with the right-hand panel?
In Modes A and B, simplifying is automatic—once both sides receive the operation, the 3 arithmetic answer tiles appear in the right column immediately.
- In Mode C, the player must pick up the "Calculator" blaster and shoot `11 + 1`. Does blasting `11 + 1` open the 3 multiple-choice answer tiles (`12`, `13`, `14`) in the right Calculation Area for standard laser/click selection, or is the calculation resolved in a different way?
>>Great question! It Opens up the calculation panel just like in Mode A and Mode B! So we can reuse that exact same calculation panel :) (In fact we should to avoid code duplication)
- Does the variable side (`3Y − 1 + 1` or `3Y / 3`) automatically collapse upon being blasted with the operator, or does the player also have to blast the variable side with the Calculator blaster?
>>It automatically collapses, with similar animations to Mode B. 
