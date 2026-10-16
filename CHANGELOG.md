# Changelog

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
