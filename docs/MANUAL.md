# MicTime manual

MicTime is a talk timer. A **signal** starts the count, the **next signal** stops it, the **total** stays on screen for a few seconds and
the timer returns to zero. It is made for live radio (how long did that intervention last?), but works for talks, panels and any
control room.

## The screen

- The big figures show minutes and seconds (`mm:ss`; `h:mm:ss` from one hour).
- The word above them says what is happening: **READY** (zero, waiting), **COUNTING**, **TOTAL** (the stopped count, kept on screen; a thin bar
  shows how long it will stay).
- **START / STOP** (or **START** and **STOP**) and **RESET** do by hand what the signals do. The three small indicators at the top right say what
  each input is doing: **MIDI** (ready, no input, no access), **KEY** (global, window only), **AUDIO**.
- **Full screen**: `F11`, the button at the top right, or a double-click on the figures; `Esc` leaves it. In full screen only the figures show.
- `S` opens the settings.

## Settings → General

- **Language**, **theme** (dark, light, follow the system).
- **How signals work**: *one signal* (the first starts, the next stops, the same message or key) or *two signals* (one starts, the other stops).
- **Show the total for**: how many seconds the total stays on screen after a stop (1–600, default 5).
- **Ignore a repeated signal within**: some consoles send two messages for one press; two start/stop signals closer than this many
  milliseconds count as one (default 300; reset is never ignored).
- **Always on top**.

## Settings → Signals

### MIDI

1. Connect the device (or the virtual port of the software that sends MIDI). Press **Refresh** if it is not in the list.
2. Choose the **MIDI input**, or *All inputs*.
3. Press **Learn** next to *Start / stop* (or *Start*, *Stop*, *Reset*) and send the message from the console: a button, a note, a
   controller or a program change. MicTime shows it, for example `Note C4 (60) · ch 1`. Set the channel to *any channel* if the source
   changes it.
4. The **Incoming messages** list shows the last messages and what MicTime did with each: use it to see what your device really sends.

A value above 0 is **on**, 0 is **off**; only *on* acts, except when *Start* and *Stop* are the same message, where on starts and off stops. The full
description, with examples, is in [MIDI-SPEC.md](MIDI-SPEC.md).

### Keyboard

**Set key**, then press the key or combination. Esc cancels. With **Global shortcut** on, the key works even when another program is in front
(a modifier such as Ctrl, Alt or Shift, or an F key, a numpad key or a media key is needed, so ordinary typing is never taken over).
The line under the key says if it is global, only works with the window in front, or was refused by the system (usually because another
program uses it). On Linux a global shortcut may not work on every desktop (for example Wayland): then use the key with the window in front,
or MIDI.

### Audio level

Off by default. Switch it on, choose the **audio input**, set the **threshold** (the meter shows the level; the orange line is the
threshold) and the **hold time**. The count **starts** when the level reaches the threshold and **stops** when it stays below it for
the hold time, so a breath or a short pause does not end it. The first time, the system asks to allow the microphone. Only the level is
measured: nothing is recorded, saved or sent, and the sound is not played.

## Settings → Updates

MicTime looks for a new version once a day (switch it off here). A strip under the header offers **Download and install**, **Remind me later**
(24 hours), **Skip this version** and the release notes. The download shows a progress bar and can be cancelled; the file is checked against
the SHA-256 in the release. **Close and install** first saves a safety copy of the settings (the last 3 are kept): on Windows it closes MicTime
and starts the installer, on macOS it opens the disk image, on Linux it shows the AppImage. If a count is running it asks first. After an
update, **What's new** shows once. Nothing is installed without a click.

## Settings → Backup

**Export** saves the configuration (MIDI messages, keys, audio and timer settings, language, theme) as `mictime-backup-YYYY-MM-DD.json`.
**Import** reads it back: *Replace everything*, or *Add only the missing* (mappings you have not set yet are filled in, everything else stays).
The file holds no passwords or keys.

## Settings → Help & About

Version, links, **Copy support info** (version, system, language, last update check, last error: never your settings), **Open logs
folder** (daily files, 5 MB at most each, 7 days kept), the first-launch warnings and the credits.

## Limits

- MicTime is not a certified instrument; the count follows the computer's clock and the arrival of the signals.
- A signal that never arrives, or arrives twice a long time apart, gives the wrong total: check the monitor.
- The PC must stay on and MicTime open. While it is open the system is kept from suspending.
