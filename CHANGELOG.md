# Changelog

## 0.2.0 — 2026-10-16 (beta)

- **Time limits and programs.** A **program** is a list of steps, each with a name and a time limit (for example Opening 00:45, News 01:00, Interview 03:00). The active program arms the limit of the current step, and **after every speech the next step is armed by itself**; at the end it starts again from the first step or goes on without a limit. A step with 00:00 has no limit. The step on screen and the next one are shown under the figures. Up to 8 programs of 40 steps, chosen from a menu on the main screen or in the new **Programs** tab. The step each program is at is remembered when the app is closed.
- **Next step, Previous step, Restart program**: three new signals, assignable to a MIDI message or a key with Learn, for when the running order changes. A console that sends two messages for one press does not skip a step.
- **Colours and warnings**: the figures are grey at zero, turn to the warning colour a few seconds before the limit (10 by default), to the "limit passed" colour (red) once it is passed, and blink slowly (about once a second) when it is passed by a lot (10 s by default). The total keeps the colour it had at the stop. The four colours can be chosen (default: the colours of the theme). With "reduce motion" on in the system a steady red frame replaces the blinking.
- **Never reset by itself**: the total can stay on screen until the next start or a reset, instead of going back to zero after a number of seconds.
- **MIDI diagnosis**: Settings → Signals lists the ports the system shows (state and connection) and can show all incoming messages, clock included, to see what a device really sends; the manual has a short troubleshooting section (a virtual port that passes nothing is recreated).
- The backup carries the programs and the colours too; "add only the missing" adds the programs this computer does not have.
- `src/trigger` is now version 2 (the three program signals, an infinite hold time).
- Tests: 83 unit tests and an end-to-end run of the real app with the programs, the colours, the blinking, the debounce and "reduce motion".

## 0.1.0 — 2026-10-16 (beta)

Beta versions are numbered `0.N.P` and published as GitHub pre-releases, so nobody is offered them by the update check. The first public release will be numbered `YY.M.N` (the year and month it comes out) and will carry this list.

- First version. MicTime is a **talk timer for live radio and events**: the first signal starts the count, the next one stops it, the total stays on screen for a few seconds (you choose how many) and the timer returns to zero. Very large figures, readable across a studio.
- **MIDI**: pick the input, assign start / stop / reset to a **note, a controller (CC) or a program change** with **MIDI learn**, and watch the incoming messages in a monitor. Two modes: **one signal** (the same message starts and stops) and **two signals** (start and stop are different, or the same message with "on starts, off stops"). A value above 0 is on, 0 is off. The message format and connection examples are in `docs/MIDI-SPEC.md`.
- **Keyboard**: a key or combination you choose, as a **global shortcut** that works with another program in front where the system allows it, and as a key with the window in front everywhere. If the system refuses a shortcut the app says so and keeps the window-only key.
- **Audio level** (off by default): choose an input, a threshold and a hold time; the count starts when the level goes over the threshold and stops after it stays below for the hold time. Only the level is measured: nothing is recorded, saved or sent, and the sound is not played.
- Repeated messages (a console that sends two for one press) are taken as one, within a time you can change.
- **Backup** (Settings → Backup): export or import the MIDI mappings, the keys, the audio and timer settings, language and theme as `mictime-backup-YYYY-MM-DD.json`; on import you choose **Replace everything** or **Add only the missing**. The file holds no passwords or keys: the app uses none.
- **Guided update, the same in every OnAir Garage app**: a strip offers **Download and install**, **Remind me later**, **Skip this version** and the release notes; progress bar and Cancel; the installer is checked against the published SHA-256 sums; **Close and install** makes a safety copy of the settings first and asks if a count is running; **What's new** shows once after the update. Nothing is installed without a click.
- **Signature of the OnAir Garage apps**: Settings in the standard order (General, Signals, Updates, Backup, Help & About), **Copy support info**, **Open logs folder**, daily log files of at most 5 MB kept for 7 days.
- English, Italiano and Español; dark, light or follow the system; always on top; full screen (`F11`, or double-click the figures).
- The signal code lives in `src/trigger` (MIDI, keys, audio gate, the timer), independent of Electron, so it can be reused in other OnAir Garage apps.
- Thanks to Emanuele, who described how he needs a talk timer on a live radio show, with a mixer and a playout program that can send MIDI, and wrote to us.
