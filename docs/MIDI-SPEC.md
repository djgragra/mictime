# MicTime MIDI specification

How to make a mixer, a piece of software or a button box start and stop MicTime. Version 1.1, 16 October 2026.

MicTime only **receives** MIDI. It never sends anything and never asks for system-exclusive access. Any source that can send one of
the three messages below on a MIDI port the computer can see will work. You choose the message in *Settings → Signals → MIDI* with
**Learn** (press the button on the console, MicTime takes the message) or by hand, and the **Incoming messages** monitor shows what
arrives, so you can always check what your device really sends.

## The messages

| Message | Status byte (hex) | Data 1 | Data 2 | Meaning in MicTime |
|---|---|---|---|---|
| Note On | `9n` | note 0–127 | velocity 0–127 | velocity **> 0 = on**, velocity **0 = off** |
| Note Off | `8n` | note 0–127 | any | **off** |
| Control Change (CC) | `Bn` | controller 0–127 | value 0–127 | value **> 0 = on**, value **0 = off** |
| Program Change | `Cn` | program 0–127 | – | always **on** (it has no value) |

`n` is the channel, 0–15 on the wire, shown as **1–16** in MicTime. A mapping can name one channel or **any channel**. Clock, active
sensing, system-exclusive, pitch bend and aftertouch are ignored and never shown.

## What "on" and "off" do

| Mode (Settings → General) | Signals | Behaviour |
|---|---|---|
| **One signal** (toggle) | `Start / stop`, `Reset` | Each **on** message starts the count if it is not running and stops it if it is. **Off** messages are ignored, so a button that sends on and then off does not act twice. |
| **Two signals** (separate) | `Start`, `Stop`, `Reset` | **On** of `Start` starts, **on** of `Stop` stops. If you give `Start` and `Stop` the **same** message, **on starts and off stops** (a fader, a mute button, a note held while the microphone is open). |
| both | `Reset` | **On** returns to zero at once. |
| both | `Next step`, `Previous step`, `Restart program` | **On** moves the active program (a list of steps with time limits, *Settings → Programs*) one step on, one step back, or to the first step. They do not start or stop the count. |

After a stop the total stays on screen for the time set in *Settings → General* (1–600 s, 5 by default) and the timer goes back to zero.
A new start during that time begins a new count.

**Repeated messages.** Some devices send two messages for one press (for example a Note and a CC). Two start/stop signals closer than
*Ignore a repeated signal within* (300 ms by default, 0–2000) count as one. Reset is never ignored. If your device sends **Note On
immediately followed by Note Off** for a single press and you use *Two signals* with the **same** note for start and stop, the Note Off
arrives inside that window and is ignored, so the count would only ever start: use *One signal* mode, or two different messages.

## Number conventions

- Note names follow *middle C = C4 = note 60*. Some devices call note 60 "C3" or "C5": **the number is what counts**, and the monitor shows
  the number.
- Program numbers are 0–127 on the wire. Some devices show 1–128: if Learn takes a message, the numbers always agree; if you type one by
  hand and nothing happens, try one less or one more.

## Connecting a source

MicTime lists every MIDI input the system offers. If your source is software on the **same computer**, a *virtual MIDI port* connects
the two:

| System | Virtual port | Status |
|---|---|---|
| Windows | a virtual MIDI cable program such as loopMIDI | general knowledge; **not tested with MicTime** |
| macOS | the *IAC Driver* bus (Audio MIDI Setup → MIDI Studio) | general knowledge; **not tested with MicTime** |
| Linux | an ALSA virtual port (for example `snd-seq-dummy`, connected with `aconnect`) | general knowledge; **not tested with MicTime** |

### Examples to check against the manuals

None of these has been tried with MicTime on the real equipment. Each row says where the information comes from; **check your own
model and firmware, and use the monitor to see what arrives**.

| Source | What it can send | Status of the information |
|---|---|---|
| **Behringer X32 / X32 Rack** | A scene (and, per the sources found, a snippet or cue) can be given one MIDI event that is sent once when it is loaded: Program Change, Control Change or Note; a Note goes out as Note On followed at once by Note Off. The user-assignable buttons can also be set to send MIDI. | Read in forum threads and a guide by a third party that quote the manufacturer's MIDI implementation; the **manufacturer's manual was not read** here. Numbering of scenes (0–99 or 1–100) is reported differently: check on the unit. Which connector (DIN or USB) carries it on your unit and where the menus are: **Dati insufficienti per verificare**, read the X32 manual. |
| **MB Studio** | – | **Dati insufficienti per verificare**: no documentation was found for MIDI output. If the software can send a note, controller or program message to a MIDI output port, route that port to MicTime (see the virtual ports above) and use Learn. |
| Any MIDI controller, pad or foot switch | Note On/Off, usually | General MIDI behaviour; Learn takes it. |
| Contact closure to MIDI (a small microcontroller that shows up as a USB-MIDI device) | whatever the device is programmed to send | Possible in general; send Note On velocity > 0 for "on" and velocity 0 or Note Off for "off". |
| DAW or automation software that can send MIDI | Note, CC or Program Change | General MIDI behaviour. |

### Suggested messages for a new setup

There is no standard for this: these are suggestions so that two installations can use the same numbers. Channel 1.

| Action | Message |
|---|---|
| Start / stop (toggle) or Start | Note 60 (C4) |
| Stop (two signals) | Note 62 (D4) |
| Reset | Note 64 (E4), or Program Change 0 |
| Next step / Previous step | Note 65 (F4) / Note 63 (D#4) |
| Restart program | Program Change 1 |
| Gate (same message for start and stop) | CC 20, 127 = on, 0 = off |

## Sources to re-check

| Document | What to read in it | Read for this version |
|---|---|---|
| Behringer X32 Rack user manual and the X32 MIDI implementation sheet | which events a scene, snippet or cue can send, the assignable buttons, DIN/USB MIDI | not read (second-hand sources only) |
| MB Studio manual | whether and how it sends MIDI | not found |
| MIDI 1.0 specification (MIDI Manufacturers Association) | message formats | not read; the formats above are the basic channel messages |
