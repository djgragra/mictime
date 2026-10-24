# MicTime manual

MicTime is a talk timer. A **signal** starts the count, the **next signal** stops it, the **total** stays on screen for a few seconds and
the timer returns to zero. It is made for live radio (how long did that intervention last?), but works for talks, panels and any
control room.

## Install and first launch

Download the installer for your system from the [Releases](https://github.com/djgragra/mictime/releases) page and check it against `SHA256SUMS.txt`:
`MicTime-Setup-<V>.exe` (Windows), `MicTime-<V>-arm64.dmg` (Mac with Apple silicon), `MicTime-<V>-x64.dmg` (Mac with Intel), `MicTime-<V>.AppImage` (Linux).
The app is free and has no Apple or Microsoft certificate, so the first launch may show a warning.

- **macOS**: the app is signed ad hoc, which is what an Apple silicon Mac needs to open it. The first start still shows the "unidentified developer" notice: open *System Settings → Privacy & Security* and click *Open Anyway* (right-click → Open no longer exists on macOS 15 and later). If an earlier version (26.10.2 or older) says the app is "damaged", run this once in Terminal: `xattr -cr /Applications/MicTime.app && codesign --force --deep -s - /Applications/MicTime.app`
- **Windows**: if SmartScreen appears, click *More info* → *Run anyway*.
- **Linux**: `chmod +x MicTime-*.AppImage`, then run it.

## The screen

- The big figures show minutes and seconds (`mm:ss`; `h:mm:ss` from one hour).
- The word above them says what is happening: **READY** (zero, waiting), **COUNTING**, **TOTAL** (the stopped count, kept on screen; a thin bar
  shows how long it will stay).
- With a **program** active, under the figures you see the step being timed and the one after it, with a menu to choose the program and buttons for
  the previous step, the next step and *restart from the first step*. The figures change colour with the limit of the step (see *Programs*).
- **START / STOP** (or **START** and **STOP**) and **RESET** do by hand what the signals do. The three small indicators at the top right say what
  each input is doing: **MIDI** (ready, no input, no access), **KEY** (global, window only), **AUDIO**.
- **Full screen**: `F11`, the button at the top right, or a double-click on the figures; `Esc` leaves it. In full screen only the figures, the step and the total bar show.
- **Compact view**: the button next to full screen (on macOS also *View → Compact view*). The window shrinks to the figures, stays on top of the other windows and remembers its own size and place; drag its edges to resize it (down to a small box). To go back: double-click the figures, press `Esc`, or use the small button that appears in its corner when the mouse is over the window. It is not remembered at the next start.
- **Speeches** (the list button at the top right): the last 20 speeches of this session, newest first, with time, program and step, duration and limit (the duration is red when the limit was passed). *Copy* puts them on the clipboard as CSV, *Save CSV…* writes a file, *Clear* empties the list. They live in memory only: closing MicTime forgets them.
- `S` opens the settings.

## Settings → General

- **Language**, **theme** (dark, light, follow the system).
- **How signals work**: *one signal* (the first starts, the next stops, the same message or key) or *two signals* (one starts, the other stops).
- **Show the total for**: how many seconds the total stays on screen after a stop (1–600, default 5). With **Never reset by itself** the total stays until the
  next start signal or a reset.
- **Ignore a repeated signal within**: some consoles send two messages for one press; two start/stop signals closer than this many
  milliseconds count as one (default 300; reset is never ignored).
- **Always on top**.
- **Figures only in full screen**: in full screen the step line and the total bar are hidden too, only the figures stay (off by default).

## Settings → Programs

**A program** is a list of steps, each with a name and a time limit (minutes and seconds; 00:00 = no limit): for example *Opening 00:45, News 01:00,
Interview 03:00, Closing 00:30*. Without an active program the **single time limit** applies (same tab, *Time limit, colours and warnings*): minutes and seconds, 00:00 = no limit. It gets the same colours,
warning and blinking as the steps of a program, and the line under the figures says `Limit 01:00`.

- **Using it**: choose the active program (here or with the menu on the main screen). The first step is armed. When a speech ends (the stop signal), the total stays on
  screen in the colour it had, and the **next step is armed by itself**. **Reset** cancels the count in progress and does *not* move to the next step.
- **At the end of the program**: *start again from the first step*, or *go on without a limit*.
- **When the running order changes**: **Previous step**, **Next step** and **Restart from the first step**, with the buttons or with signals you assign in
  *Signals* (a MIDI message or a key, with Learn). Two messages for one press (see *Ignore a repeated signal*) do not skip a step.
- **Editing**: name, minutes and seconds of every step, move up and down, remove, add (up to 40 steps); up to 8 programs. The step in green is the one ready now.
  The step each program is at is remembered when the app is closed; it is not part of the backup.

**Colours and warnings** (same tab)
- The figures are **grey** at zero, in the **counting** colour while counting, in the **warning** colour from *N seconds before the limit* (default 10), in the
  **limit passed** colour (red) once the limit is passed, and they **blink slowly** (about once a second) once it is passed by *M seconds* (default 10). The total keeps
  the colour it had at the stop and never blinks. A step with no limit never changes colour.
- With *reduce motion* on in the system there is no blinking: a steady red frame is shown instead.
- Each of the four colours can be chosen; *Default* goes back to the colour of the theme.

**Alert at the limit** (same tab, both options off by default)
- **One short beep** and/or **one short flash of the window** the moment the time limit of the step is reached, once for each speech. *Test* plays them. With *reduce motion* on in the system the flash is not shown.
- **Careful with the beep**: it comes out of the computer's default sound output. If that output feeds the mixer or the stream, the beep can go on air: use the flash, or send the computer's sound to a monitor only.

## Settings → Signals

### MIDI

1. Connect the device (or the virtual port of the software that sends MIDI). Press **Refresh** if it is not in the list.
2. Choose the **MIDI input**, or *All inputs*.
3. Press **Learn** next to *Start / stop* (or *Start*, *Stop*, *Reset*) and send the message from the console: a button, a note, a
   controller or a program change. MicTime shows it, for example `Note C4 (60) · ch 1`. Set the channel to *any channel* if the source
   changes it.
4. The **Incoming messages** list shows the last messages and what MicTime did with each: use it to see what your device really sends. *Show all messages* also lists
   the ones MicTime ignores (clock, keep-alive), in hexadecimal. **Ports seen by the system** lists each input with its state and connection.
5. Next step, Previous step and Restart program can be assigned the same way (they act on *on* only, like Reset).

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

### If nothing arrives

1. Does the monitor show anything? If the sender is on the same computer, a *virtual port* connects the two (see [MIDI-SPEC.md](MIDI-SPEC.md)).
2. Is the port in *Ports seen by the system*? If not, press *Refresh*; if still not, the system does not show it.
3. Does the sender show activity but nothing arrives (for example loopMIDI's *Total data* stays at 0 while you play)? In a test on Windows a virtual port that had been created
   once passed nothing until it was **removed and created again**, then everything worked. Recreate the port, restart the sender, press *Refresh*.
4. Two programs on the same input at the same time may not both receive: close the other one, to see if it changes anything.

## Settings → Updates

MicTime looks for a new version once a day (switch it off here). A strip under the header offers **Download and install**, **Remind me later**
(24 hours), **Skip this version** and the release notes. The download shows a progress bar and can be cancelled; the file is checked against
the SHA-256 in the release. **Close and install** first saves a safety copy of the settings (the last 3 are kept): on Windows it closes MicTime
and starts the installer, on macOS it opens the disk image, on Linux it shows the AppImage. If a count is running it asks first. After an
update, **What's new** shows once. Nothing is installed without a click.

## Settings → Backup

**Export** saves the configuration (MIDI messages, keys, audio and timer settings, programs, colours, language, theme) as `mictime-backup-YYYY-MM-DD.json`.
**Import** reads it back: *Replace everything*, or *Add only the missing* (mappings and colours you have not set yet are filled in, programs this computer lacks are added, everything else stays).
The file holds no passwords or keys.

## Settings → Help & About

Version, links, **Copy support info** (version, system, language, last update check, last error: never your settings), **Open logs
folder** (daily files, 5 MB at most each, 7 days kept), the first-launch warnings (on macOS: *Open Anyway*, and the Terminal command for an older version that says it is damaged) and the credits.

The small tip card at the bottom has a button and a jar, both open the tip page of the site in your browser.

## Limits

- MicTime is not a certified instrument; the count follows the computer's clock and the arrival of the signals.
- A signal that never arrives, or arrives twice a long time apart, gives the wrong total: check the monitor.
- The PC must stay on and MicTime open. While it is open the system is kept from suspending.
