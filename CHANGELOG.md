# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- Hover over the version number to see when the game was last updated, in your own time zone, and how long ago

### Changed
- Physics now runs on crashcat instead of cannon-es: buildings stand still until hit and break apart piece by piece instead of bursting from a light touch (#9, #20)

### Fixed
- Pieces no longer hang in the air when what held them up is knocked away, and the Eiffel spire stands on a crossbar instead of floating (#9)
- The house of cards no longer slumps once it is hit, and Spiral Stair stands until hit instead of shedding its treads (#9)
- Paintball no longer throws an error when it hits the house of cards (#15)
- The wrecking ball sweeps through the barrels instead of catching on the platform edge (#15)

## [0.2.0] - 2026-09-29

### Added
- Fullscreen toggle (⛶) in the game navigation

## [0.1.0] - 2026-07-18

### Added

- Initial versioned release of game-barrel-shooter.
- In-game version badge sourced from `version.js`.
