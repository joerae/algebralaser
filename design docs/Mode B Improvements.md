Mode B Improvements


Mode B is actually pretty cool. But we can make it a lot better!

1. Bubble Visualisation

Whenever the player has a bubble in their finger (e.g. +2) it should show both at the top of their finger AND and the end of their ray. And if the player is picking something up from the top of the finger, it should show the bubble moving from it's position in the UI towards the finger ("sucking it up"). SImilarly if they are "dropping something off" if should show it moving fro mthe tip fo the finger towards the target ("blowing it out"). 

In the case of forging the opposite, we'd see a "blow it out" as it moved the the forge, then a "suck it up" afterwards

2. Equation balancing animation

When a player blows out a forged operator and number to change both sides, we need this animation to help guide the users cognitive load. It currently does the left side first, this is good. But let's make it take a little more time as it attacks the left side, and leave the resulting info there, be it "1 - 1" or "3/3", that bit will stay there for a while, we'll clean that up soon (see 3 below). When this operator and number changes the RIGHT side, we need time for this animation to take root. Right now the player is often pointing there and it goes straight to the calculation part - with a bit more animation time, this shouldn't happen.

3. Try cleaning up the obvious stuff - on the left side we'll end up with a lot of "3/3" of "3 - 3" or "-1 + 1" operations that clean up to nothing. I think these should just be able to be hit with the laser and they blast away in a cool whiff of smoke, and the equation then rearranges.

