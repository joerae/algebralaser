TODO


[x] Allow Mode B to work with mouse control. Specifically, I can't click on the "opposite sign" (Done: state caching prevents DOM rebuilding at 60 FPS and pointerdown/click works reliably)

[x] Turn off the tips like "Great! Now Solve the calculation on the right", all of those gold coloured tips, just disable them. (Done: banners removed from markup and disabled via CSS)

[  ] Finger tracking didn't work very well for my daughter, we need to improve it! Can we make it much more liberal for shooting out a laser from the index finger? It doesn't need to be a strict pointing. E.g. if I'm pointing slightly in to the camera, right now it doesn't work.


Below are more complex. Leave for later
[  ] Introduce an alternate way to to shoot out the two bubbles. Instead of just pointing to the equation, you actually need to fire one to each side. Each side has a nice big hitbox though, and it just requires you passing over it rather than holding. I'd like to try this, so make it togglable to the original animated mode by pressing "s". By default, make it this new way though.

[  ] When I'm in a smaller window size, it isn't very responsive. Namely, the boxes on the left and right for select aren't scaling to the size of my video window. So it is hard to point at the bottom of the boxes, or they might be off the screen