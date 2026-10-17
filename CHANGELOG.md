# Changelog

## 26.10.2 — 2026-10-17

Maintenance release.

- **Help & About** has a small card at the bottom with the OnAir Garage tip jar: one line and one button that opens the site's tip page in your browser, in the language of the app. No pop-ups, nothing in the main window.
- **Dependencies**: electron-store 12 (your settings file is read as it was, nothing is lost) and Electron 44.9.0.

## 26.10.1 — 2026-10-16

First public release. MicTime is a **talk timer for live radio, events and talks**: a signal starts the count, the next one stops it, the total stays on screen for a few seconds and the timer returns to zero. It starts empty: no signal is assigned, no program and no limit, so nothing happens until you choose how to start it.

- **Signals**: **MIDI** (choose the input; start, stop and reset on a note, a controller or a program change, with MIDI learn and a monitor of the incoming messages), a **key** you choose (global, working with another program in front where the system allows it, or with the window in front) and the **level of an audio input** (threshold and hold time; only the level is measured, nothing is recorded; off by default). Two modes: one signal for start and stop, or two. The message format and connection examples are in `docs/MIDI-SPEC.md`.
- **Time limits and programs**: a program is a list of steps, each with a name and a limit (for example Opening 00:45, News 01:00, Interview 03:00); after every speech the next step is armed by itself, and at the end the program starts again or goes on without a limit. Without a program a single time limit can be set. Next step, previous step and restart are signals too.
- **Colours and warnings**: the figures are grey at zero, change to a warning colour before the limit (10 s by default), to red past it, and blink slowly when it is passed by a lot; with "reduce motion" on in the system a steady red frame replaces the blinking. The four colours can be chosen. The total keeps the colour it had at the stop, and can stay on screen until the next start.
- **Backup** of the configuration (MIDI messages, keys, audio and timer settings, programs, colours, language, theme) with *Replace everything* or *Add only the missing*. No passwords or keys: the app uses none.
- **Guided update** (download with progress, SHA-256 check, safety copy, *What's new*), **Help & About** with *Copy support info* and the logs folder, English, Italiano and Español, dark, light or follow the system, always on top and full screen.
- The signal code is in `src/trigger`, independent of Electron, so other OnAir Garage apps can reuse it.
- Thanks to Emanuele, who suggested the idea that became this software.
