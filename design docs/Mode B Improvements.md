Mode B Improvements


Mode B is actually pretty cool. But we can make it a lot better!

1. Bubble Visualisation

Whenever the player has a bubble in their finger (e.g. +2) it should show both at the top of their finger AND and the end of their ray. And if the player is picking something up from the top of the finger, it should show the bubble moving from it's position in the UI towards the finger ("sucking it up"). SImilarly if they are "dropping something off" if should show it moving fro mthe tip fo the finger towards the target ("blowing it out"). 

In the case of forging the opposite, we'd see a "blow it out" as it moved the the forge, then a "suck it up" afterwards. (Mode D does this a bit, can look there)

2. Equation balancing animation

When a player blows out a forged operator and number to change both sides, we need this animation to help guide the users cognitive load. It currently does the left side first, this is good. But let's make it take a little more time as it attacks the left side, and leave the resulting info there, be it "1 - 1" or "3/3", that bit will stay there for a while, we'll clean that up soon (see 3 below). When this operator and number changes the RIGHT side, we need time for this animation to take root. Right now the player is often pointing there and it goes straight to the calculation part - with a bit more animation time, this shouldn't happen.

3. Allow players to clean up the obvious stuff by just pointing at it quickly- on the left side we'll end up with a lot of "3/3" of "3 - 3" or "-1 + 1" operations that clean up to nothing. I think these should just be able to be hit with the laser and they blast away in a cool whiff of smoke, and the equation then rearranges.

4. We often end up with the width of the left side being too narrow and numbers going on top of each other. We sorted that on Mode D previously. Bring those in and solve it.


## Clarifying Questions

Please answer each question underneath it.

### 1. Applying the forged bubble to both sides

After the player drops the forged bubble at the equals sign, should that single action still apply it to both sides automatically, with a slower left-side animation followed by a slower right-side animation? Or should the player now have to point at/blast the left and right sides separately, as in Mode D?

> Answer: It applies to both. It's just sequenced. Think of it working like a cool powerup in a Match 3 game, the bubble sits there and activates, and it animates down a copy of itself into the LHS, then once that animation resolves it animates down to the RHS. Make like Disney and Playrix and "animate one thing at once to draw the eye", but it is actually one continous action. See bubble witch sage for reference too.

### 2. Bubble visualisation during pickup, carrying, and drop-off

While an operation is being carried, should the same bubble remain visible simultaneously at both the fingertip and the ray endpoint even while a separate animated copy travels between the UI/equation and the finger or target? Also, when the ray is not hitting a valid target, should the ray-end bubble sit at the ray's maximum endpoint or disappear until a target is hit?

> Answer: Actually I think the bubble always starts at its source (while carried the fingertip) and moves to it's target (end of the ray). So I think it stays by your finger. In the case of forging the opposite, we would then see the bubble travel from my fingertip to the forge, it flips around and gets the new sign, then it comes back to my finger.

### 3. Blasting away obvious simplifications

Should cleanup be a required step before the player can continue, or an optional shortcut before the game eventually simplifies automatically? Please also confirm which results qualify: only cancelling pairs and identities such as `3 - 3`, `-1 + 1`, `3/3`, `+0`, and `1Y`, or any arithmetic expression whose answer is visually obvious?

> Answer:
Hmm, think the simplification is required for final resolution. But while other actions are like "dwell here" for simplification they are explosive, so even a laser pointer travelling over it briefly will set it off! However if you're pointing right at it, do you think you need to move off it first and back on so you know what's going on? We'll come back to that part I guiess!