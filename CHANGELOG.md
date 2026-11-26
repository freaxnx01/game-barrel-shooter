# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- Cutting charge (key Y): a remote charge for controlled demolition, numbered and detonated like the others (K, Boom, number buttons, same limit of 6), but with a small 1.2 m blast and no upward kick that knocks the piece it sits on sideways, so the rest of a building falls under gravity; bomb, dynamite, remote and timed charge are unchanged (#87)
- Paintball colour picker is visible again: choosing Paintball keeps the weapon list open so the colour swatches show, and a colour dot next to the 💥 button (🎲 for random) shows the colour and cycles it with a click, like the P key (#81)
- Numbered remote charges: every placed remote charge shows a number (1-6) above it, the 💥 Boom button shows how many are armed, and a ▸ toggle next to it opens buttons `1`..`6` that detonate a single charge; Boom and K still detonate all (#79)
- Action buttons on desktop: Pull, Boom and a new Cut button (key O) that lets go of a harpoon or heavy net, each shown only while it applies; Cut is on mobile too (#63)
- Camera pad bottom-right (turn, tilt, zoom; hold to keep moving) and arrow keys for the camera, so it can be moved without a right mouse button, e.g. on a Chromebook touchpad or touchscreen
- Tractor tire weapon (key T): rolls into the target, then tips over and lies flat (#8)
- Hover over the version number to see when the game was last updated, in your own time zone, and how long ago
- New targets: four frame buildings, two brick towers, four gates and a Spiral Tower; Spiral Stair rebuilt; target picker grouped (#24)
- Mobile mode for phones and tablets: weapon and target lists open as sheets, Quake and Pull hold buttons, two-finger drag to orbit and pinch to zoom, a smaller camera pad; desktop layout unchanged (#37)
- Web app manifest and icons, so "Add to Home Screen" opens the game fullscreen (#37)
- Jenga tower: hold a block to push it out; the round ends when the tower falls (#34)
- Falling targets make sounds when they hit the ground or each other: oil barrels clank, wooden barrels, Jenga and the Eiffel truss knock, stone buildings thud, bowling pins clack and cards rustle; louder for harder hits, at most 8 at once, and silent while a fresh target settles (#44)
- Magneto hums while held: an electric mains hum with a pulsing, crackling buzz that grows louder and higher the more pieces it holds, and fades out on release (#44)
- American football (key F): a spiral pass that flies nose-first, then hops off in unpredictable directions; light enough to tip single barrels rather than the whole pyramid (#45)
- Reload button: "⟳ Reload" in the mobile "?" panel and a small ⟳ next to the version in the footer, so the fullscreen home-screen app can be reloaded and picks up a new version right away (#46)
- On an iPhone or iPad in the browser, a tip shows how to play Barrel Blast as an app: "Share ⬆ → Add to Home Screen"; × hides it for good, the "?" panel keeps the line, and it never shows in the installed app or on other devices (#50)
- Maskable app icon, so Android launchers show the barrel pyramid in a full round or squircle icon instead of a small one on a white plate; the browser bar colour now matches the app colour
- Brick industrial chimney target: a tapering factory chimney of red brick with a soot-blackened top; hit it at the foot and it tips over and breaks apart (#55)
- Remote charge (key B) that waits until you press K or the 💥 Boom button, and timed charge (key Z) that explodes 4 s after the throw; both fly fast and straight to where the crosshair points (no arc, no gravity until they hit) and stick flat on the visible surface of the first piece they hit (or where they land on the ground), ride along with it, do no impact damage and never push the pieces around them before they go off (#54, #62, #78, #90)
- Heavy net (key N): a 4 m × 4 m throw net of thick rope with wide meshes that opens in flight, falls over the catch like cloth, hanging down the sides of the pieces and following them as they are dragged, and holds up to 14 pieces within 2.4 m; hold Space or Pull to drag them in (#54, #60, #70)
- Paintball colours: pick one of seven colours or 🎲 random, where every shot has a different colour; P cycles them. A paintball only colours the piece it hits: almost no force, so stone stays standing, and no splash blob (#54, #82)

### Changed
- The 🌋 Quake hold button shows on desktop too (bottom right), next to holding Shift
- The chimney opens zoomed in: the camera starts at about half the old distance, so the chimney fills the screen with crown and foot in view
- Chimney bricks look elongated and seamless: every brick block shows two courses of long bricks and is drawn as a wedge, so the blocks of a ring meet without dark gaps from every angle; the chimney's size and how it falls are unchanged (#64, #71)
- Desktop: the weapon and target lists collapse into the 🎯 and 💥 buttons like on mobile, so the weapon panel no longer covers the chimney foot (#61)
- Brick chimney is 1.25× wider and 1.5× higher, has no crown and no stone base any more, and stands directly on the ground; it now takes dynamite at the foot to topple it (#58)
- The sniper lens fires a bright tracer round that flies dead straight to the crosshair instead of a gold ball that dropped; it hits barrels about as hard as before (#30). It no longer zooms the whole screen: a round scope at the cursor (lifted above the finger on touch screens) shows the target 5× magnified with a reticle, and the shot lands at its centre (#91)
- Physics now runs on crashcat instead of cannon-es: buildings stand still until hit and break apart piece by piece instead of bursting from a light touch (#9, #20)
- Brighter scene on every device: stronger sky and sun light, a lighter sky, fog and ground; shadows and barrel colours stay as they were (#40)

### Fixed
- The harpoon now holds where it strikes a barrel instead of sinking to the barrel's centre (#78)
- Zoom (camera pad + / −, mouse wheel) works again on Windows with display scaling (125 %, 150 %); the camera was re-fitted every frame and the zoom undone (#76)
- Barrels that lose their support now slide off and fall instead of hanging in mid-air (#28)
- Pieces no longer hang in the air when what held them up is knocked away, and the Eiffel spire stands on a crossbar instead of floating (#9)
- The house of cards no longer slumps once it is hit, and Spiral Stair stands until hit instead of shedding its treads (#9)
- Paintball no longer throws an error when it hits the house of cards (#15)
- The wrecking ball sweeps through the barrels instead of catching on the platform edge (#15)
- Stone buildings (fortress, octagon, tower gate, …) break apart again: weapons and explosions could barely move their blocks after the switch to crashcat (#22)
- Magneto, the harpoon reel-in and the earthquake get their full force again: after the switch to crashcat they only acted for a quarter of each frame, so held pieces barely lifted (#29)
- On a phone in portrait, wide targets such as Fortress, Colosseum and Pyramid fit the screen instead of being cut off at the sides; turning the phone re-fits the view, and zooming out is no longer capped below the starting distance (#39)
- On phones with a notch or an on-screen navigation bar, the game navigation, the Quake/Pull buttons, the camera pad and the top controls no longer sit under the system bars (#40)

## [0.2.0] - 2026-09-29

### Added
- Fullscreen toggle (⛶) in the game navigation

## [0.1.0] - 2026-07-18

### Added

- Initial versioned release of game-barrel-shooter.
- In-game version badge sourced from `version.js`.
