TODO

[  ] Fix failing Netlify Builds. This is when I put it live on Netlify, they fail at "Build" step with this error: 8:05:52 PM: Netlify Build                                                 
8:05:52 PM: ────────────────────────────────────────────────────────────────
8:05:52 PM: ​
8:05:52 PM: ❯ Version
8:05:52 PM:   @netlify/build 36.4.6
8:05:52 PM: ​
8:05:52 PM: ❯ Flags
8:05:52 PM:   accountId: 688846280dc24afb054e602f
8:05:52 PM:   baseRelDir: true
8:05:52 PM:   buildId: 6aa11351fa6bdf000850ce82
8:05:52 PM:   deployId: 6aa11351fa6bdf000850ce84
8:05:52 PM: ​
8:05:52 PM: ❯ Current directory
8:05:52 PM:   /opt/build/repo
8:05:52 PM: ​
8:05:52 PM: ❯ Config file
8:05:52 PM:   No config file was defined: using default values.
8:05:52 PM: ​
8:05:52 PM: ❯ Context
8:05:52 PM:   production
8:05:52 PM: ​
8:05:52 PM: Build command from Netlify app                                
8:05:52 PM: ────────────────────────────────────────────────────────────────
8:05:52 PM: ​
8:05:52 PM: $ npm run build
8:05:52 PM: > magic-finger-algebra@1.0.0 build
8:05:52 PM: > tsc && vite build
8:05:52 PM: sh: 1: tsc: Permission denied
8:05:52 PM: ​
8:05:52 PM: "build.command" failed                                        
8:05:52 PM: ────────────────────────────────────────────────────────────────
8:05:52 PM: ​
8:05:52 PM:   Error message
8:05:52 PM:   Command failed with exit code 127: npm run build (https://ntl.fyi/exit-code-127)
8:05:52 PM: ​
8:05:52 PM:   Error location
8:05:52 PM:   In Build command from Netlify app:
8:05:52 PM:   npm run build
8:05:52 PM: ​
8:05:52 PM:   Resolved config
8:05:52 PM:   build:
8:05:52 PM:     command: npm run build
8:05:52 PM:     commandOrigin: ui
8:05:52 PM:     publish: /opt/build/repo/dist
8:05:52 PM:     publishOrigin: ui
8:05:53 PM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
8:05:53 PM: Build failed due to a user error: Build script returned non-zero exit code: 2
8:05:53 PM: Failing build: Failed to build site
8:05:53 PM: Finished processing build request in 14.325s


[  ] Confirm all these done: 

1A (3 Equations in 1 Row): 

equationChoices.ts
 now generates 3 candidates instead of 4, and 

story.css
 lays them out in a single horizontal row (repeat(3, 1fr)) right above the camera box.
1B ("2 ×" Sizing): 

equationChoiceView.ts
 now passes custom choice classes, preventing the choice cards from inheriting the giant 58px / 76px equation rail tile dimensions.
1C (Reasons for Charges): 

storyTemplates.ts
 selects realistic charge reasons (delivery fee, gift wrapping, express delivery, packaging) based on the puzzle ID.
1D (Streamlined Story): Removed duplicate questions like "before the extra charge?", asking only once: "How much did the broomstick cost?".
1E (Shortened Prompt): Simplified the prompt to "Which equation matches?".
1F (Camera Box Stability): Pre-allocated min-height on .story-card (195px) and .story-beats-container (125px) so the camera box does not jump or push down as lines appear.
1G (No Spoiler Diagram): Removed the equation preview badge ([broomstick] + 1 gold = 3 gold) from the card during the reading/choosing phases.
Screenshot 2 Items
2a ("3 − 1" Hitbox): Enlarged the .mode-b-solve-target to min-height: 78px, min-width: 120px, padding: 8px 24px, and font-size: 48px (matching the LHS cleanup target), with pad = 32 in 

main.ts
.
2b ("Show Story" at Bottom): Removed "Show Story" from above the equation rail and docked it at the bottom of the screen (#story-bottom-dock) with dwell support. Pointing down triggers it without any interference above the equation.
2c (Broomstick Icon Sizing): Scaled the item icon ~80% larger in the equation rail from 38px to 68px (width: 68px; height: 68px; padding: 6px; border-radius: 14px;).
2d (Icon in History Rail): 

mathItemView.ts
 now renders the magical item icon instead of text [broomstick] in previous history lines, automatically scaling with perspective depth.