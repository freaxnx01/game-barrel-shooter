# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- Remote and timed charges stick to the first piece or the ground they hit and ride along with it, and no longer knock things over on impact (#62)
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
- Remote charge (key B) that lies where it lands until you press K or the 💥 Boom button, and timed charge (key Z) that explodes 4 s after the throw (#54)
- Heavy net (key N): catches up to six pieces where it lands; hold Space or Pull to drag them in (#54)
- Paintball colours: pick one of seven colours or 🎲 random, where every shot has a different colour; P cycles them (#54)

### Changed
- Desktop: the weapon and target lists collapse into the 🎯 and 💥 buttons like on mobile, so the weapon panel no longer covers the chimney foot (#61)
- Brick chimney is 1.25× wider and 1.5× higher, has no crown and no stone base any more, and stands directly on the ground; it now takes dynamite at the foot to topple it (#58)
- The sniper lens fires a bright tracer round that flies dead straight to the crosshair instead of a gold ball that dropped; it hits barrels about as hard as before (#30)
- Physics now runs on crashcat instead of cannon-es: buildings stand still until hit and break apart piece by piece instead of bursting from a light touch (#9, #20)
- Brighter scene on every device: stronger sky and sun light, a lighter sky, fog and ground; shadows and barrel colours stay as they were (#40)

### Fixed
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
