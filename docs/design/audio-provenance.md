# Audio provenance

**All audio in the game is synthesised at runtime from code. There are no sample files, no recordings, no third-party loops and no licensed assets.** The sounds are original works of this project.

| Asset | How it is made | Source file |
|---|---|---|
| 25 sound cues (steps, bumps, pushes, drags, switches, doors, plates, the world-change shimmer, commit, exit found, win, loss, UI tick, four reveal cues, the AI replay tick, the spring-switch pop, the campaign-complete fanfare) | Web Audio oscillators (sine, triangle) with gain envelopes and, for thuds and slides, a short deterministic low-pass noise burst. Frequencies, durations and levels are the data table `CUES` | `apps/web/src/audio/engine.ts` |
| Background music | A generative ambient pad (three triangle voices per chord, four-chord loop, 6 s per chord) and a sparse sine "bell" line over an A-minor pentatonic scale. Note choice is a fixed hash of the step number, so it is deterministic: the same music every time, no randomness, no recorded or sampled material | `apps/web/src/audio/engine.ts` (`scheduleMusic`) |
| Event to cue mapping | Pure function of engine events | `apps/web/src/audio/cues.ts` |

Licence: the synthesis code and the resulting sounds are covered by the project's own licence (to be set by the owner); nothing needs attribution.

## Mixing rules (tested)
- Master level is the 0..1 slider squared, with 12 dB headroom; every cue is at least 14 dB below that; the music bus is a further 26 dB down.
- A test computes the worst-case summed voice peak for every cue and asserts it stays below -6 dBFS.
- No cue is longer than 1.2 s. The AI replay tick is quieter than every human action cue.
- Audio is created only after the first user gesture (browser policy) and is suspended while the tab is hidden.
- Sound effects and music have independent switches plus a volume control in Settings; the choices are saved on the device. No sound is the only carrier of information: every cue has a visual twin (animation or text).

## Not verified
Subjective quality and loudness on real devices and speakers, and iOS Safari audio unlock behaviour, have not been tested (no devices available). The numeric gain staging is tested; how it sounds is not.
