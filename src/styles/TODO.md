TODO


[x] Allow Mode B to work with mouse control. Specifically, I can't click on the "opposite sign" (Done: state caching prevents DOM rebuilding at 60 FPS and pointerdown/click works reliably)

[x] Turn off the tips like "Great! Now Solve the calculation on the right", all of those gold coloured tips, just disable them. (Done: banners removed from markup and disabled via CSS)

[  ] Finger tracking didn't work very well for my daughter, we need to improve it! Can we make it much more liberal for shooting out a laser from the index finger? It doesn't need to be a strict pointing. E.g. if I'm pointing slightly in to the camera, right now it doesn't work.

[  ] During these equations selection, they don't use the same nice colour coding system as the normal equations I need to solve. E.g. for "+3" , it's only the + of the "+3" this is green, rather than "+3" being in it's own box, and it all being green, just like the real equations. You get me?

[  ] The equations on the right don't have colour coding, e.g. it often ends up "3 + 5" or similar on the right, and the +5 isn't coloured green like it would be on the left. Not sure if that is a problem, but maybe?

[x] After choosing out of the three equations, it briefly shows the underlying equation, with something like [- extra value] written in green. This just shouldn't be shown (Done: removed intermediate condensing screen entirely so selecting an equation transitions directly to solving)

[  ] When having a format of A/4 -B = C, and we are removing the B to the other side, it bugs out. It displays C X B on the screen on the right, rather than C + B.

[  ] When resolving the division by bringing in multiplication bubbles, it would be way better if it would go to a fraction (e.g. 4/4) rather than writing "÷ 4 x 4"

[  ] allow me to skip through the four initial forced problems, with a (saved) "skip tutorial problems" checkbox in settings

Below are more complex. Leave for later
[  ] Introduce an alternate way to to shoot out the two bubbles. Instead of just pointing to the equation, you actually need to fire one to each side. Each side has a nice big hitbox though, and it just requires you passing over it rather than holding. I'd like to try this, so make it togglable to the original animated mode by pressing "s". By default, make it this new way though.

[  ] When I'm in a smaller window size, it isn't very responsive. Namely, the boxes on the left and right for select aren't scaling to the size of my video window. So it is hard to point at the bottom of the boxes, or they might be off the screen. I want it to work on both a Chromebook (with 768 height) and on my iPhone in portrait mode.