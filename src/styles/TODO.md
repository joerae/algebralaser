TODO


[x] Allow Mode B to work with mouse control. Specifically, I can't click on the "opposite sign" (Done: state caching prevents DOM rebuilding at 60 FPS and pointerdown/click works reliably)

[x] Turn off the tips like "Great! Now Solve the calculation on the right", all of those gold coloured tips, just disable them. (Done: banners removed from markup and disabled via CSS)

[x ] Finger tracking didn't work very well for my daughter, we need to improve it! Can we make it much more liberal for shooting out a laser from the index finger? It doesn't need to be a strict pointing. E.g. if I'm pointing slightly in to the camera, right now it doesn't work.

[ x] During these equations selection, they don't use the same nice colour coding system as the normal equations I need to solve. E.g. for "+3" , it's only the + of the "+3" this is green, rather than "+3" being in it's own box, and it all being green, just like the real equations. You get me?

[ x] The equations on the right don't have colour coding, e.g. it often ends up "3 + 5" or similar on the right, and the +5 isn't coloured green like it would be on the left. Not sure if that is a problem, but maybe?

[ X ] After choosing out of the three equations, it briefly shows the underlying equation, with something like [- extra value] written in green. This just shouldn't be shown

[ x] When having a format of A/4 -B = C, and we are removing the B to the other side, it bugs out. It displays C X B on the screen on the right, rather than C + B.

[ x] When resolving the division by bringing in multiplication bubbles, it would be way better if it would go to a fraction (e.g. 4/4) rather than writing "÷ 4 x 4"

[  ] allow me to skip through the four initial forced problems, with a (saved) "skip tutorial problems" checkbox in settings

[  ] On mobile, it uses a portrait camera most of the time, and has the answers on the right. This works really well. Except, during some states it goes back to having a 4:3 camera box, which is awkward, these states where it goe sback to 4:3 are {waiting for an answer, story mode before the "which equation matches" comes out, equation is presenting up the top, before the user has selected anything}. I think it is the states where there is no selection menu on the right. I just want the camera to stay in the same spot (see nroe below too)

[  ] In story mode, each line of the story comes out one at a time. This is good, but it charges the size of the story block, and it moves the camera box around. I'd rather the camera box just stayed where it was vertically, and we know that the story will have a maximum of 3 lines plus the question, so we put the camera box into the place for that  length of story, so it doesn't jump about. Make sense?

[ ] when it comes to "sweeping the identity" (eliminating things like -7 + 7) my finger laser does this. However often it doesn't happen first time. This is because we have some logic to stop it automatically hapening if your finger is pointing towards it. However this logic is too aggressive. Currently, if I'm pointing up to the equation bar (but not at the "-7 + 7" box), and then a move my finger over the "-7 + 7" box, it should sweep that box away! But it doesn't, because it thinks we were pointing at it. I only want that "point away" protection to be for the the "-7 +7" box itself, not the whole equation bar.

[ ] Can we please make it remember that I have given it camera access before on mobile browser? I'm playing on Safari / iPhone and I have to ask every time.

Below are more complex. Leave for later
[  ] Introduce an alternate way to to shoot out the two bubbles. Instead of just pointing to the equation, you actually need to fire one to each side. Each side has a nice big hitbox though, and it just requires you passing over it rather than holding. I'd like to try this, so make it togglable to the original animated mode by pressing "s". By default, make it this new way though.

