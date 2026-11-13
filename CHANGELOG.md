# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- Camera pad bottom-right (turn, tilt, zoom; hold to keep moving) and arrow keys for the camera, so it can be moved without a right mouse button, e.g. on a Chromebook touchpad or touchscreen
- Tractor tire weapon (key T): rolls into the target, then tips over and lies flat (#8)
- Hover over the version number to see when the game was last updated, in your own time zone, and how long ago
- New targets: four frame buildings, two brick towers, four gates and a Spiral Tower; Spiral Stair rebuilt; target picker grouped (#24)

### Changed
- Physics now runs on crashcat instead of cannon-es: buildings stand still until hit and break apart piece by piece instead of bursting from a light touch (#9, #20)

### Fixed
- Pieces no longer hang in the air when what held them up is knocked away, and the Eiffel spire stands on a crossbar instead of floating (#9)
- The house of cards no longer slumps once it is hit, and Spiral Stair stands until hit instead of shedding its treads (#9)
- Paintball no longer throws an error when it hits the house of cards (#15)
- The wrecking ball sweeps through the barrels instead of catching on the platform edge (#15)
- Stone buildings (fortress, octagon, tower gate, …) break apart again: weapons and explosions could barely move their blocks after the switch to crashcat (#22)
- Magneto, the harpoon reel-in and the earthquake get their full force again: after the switch to crashcat they only acted for a quarter of each frame, so held pieces barely lifted (#29)

## [0.2.0] - 2026-09-29

### Added
- Fullscreen toggle (⛶) in the game navigation

## [0.1.0] - 2026-07-18

### Added

- Initial versioned release of game-barrel-shooter.
- In-game version badge sourced from `version.js`.
