TODO

[x] The camera box has now been made smaller and wider, it is clipping the camera to a smaller area. This makes it hard for me to use finger gestures
    - Fixed in v1.2.0 & v1.3.0: Unclipped 4:3 view with object-fit: contain; on big screens expanded to twice the size (up to 1066px x 800px) with 2x/1x view toggle button in header.

[x] Finger lasers feel a little laggy and unresponsive, and not that accurate. Please tune them for performance and accuracy
    - Fixed in v1.2.0: Adaptive velocity-responsive smoothing (0.85 fast / 0.38 steady) and doubled MCP knuckle-to-tip baseline to halve angular noise.

[x] ensure the layout is responsive. I want this to run on a Chromebook too, even with a resolution of 1366x768
    - Fixed in v1.2.0 & v1.3.0: Fluid clamp formulas and dedicated @media queries prevent scrolling on 1366x768 while seamlessly scaling up on big displays.

[x] let's add colours for each of the operations (plus, minus, divided, multiplied) to make it really obvious that plus and minus are opposites. Like maybe Plus is glowing white ,and minus is glowing black. Multiplied is glowing red, and divided is glowing purple? I'm not sure
    - Fixed in v1.2.0: Plus (Glowing Ice-White), Minus (Dark Void Obsidian), Multiplied (Glowing Crimson-Red), Divided (Glowing Royal-Purple) with live duality morphing across the equals sign.

NOT YET, BIGGER TASK
 I'd like it to try "mode B" on equations, that I can choose between. In this one, I can choose what part of the equation I want to blast. There's lots of room between each part. And to "blast" it, I then need to choose it's opposite. Like to get rid of a +4, I start blasting it, then on the left I need to choose what to blast it with, and I can point to a minus for a while to get that beam, then a blast out four of it... somehow? By selecting four? And then when I have that, I blast it to BOTH sides of the equation by holding up. After that is done, I have to do the calcualtion on the right side that subtracts 4 from it.