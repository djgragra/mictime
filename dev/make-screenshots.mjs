#!/usr/bin/env node
// Screenshots of the REAL app for the README and the site: FICTITIOUS data only (a made-up input name, made-up MIDI
// numbers, a clock moved forward). Starts Electron with a throw-away profile (dev/driver.mjs).
//   node dev/make-screenshots.mjs [outDir]        default docs/screenshots, 1240 x 800 PNG
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './driver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs', 'screenshots'));
fs.mkdirSync(out, { recursive: true });
const app = await launch({ extraArgs: ['--use-fake-device-for-media-stream'] });
const { ev, send } = app;
const W = 1240, H = 800;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await sleep(2500);

const fakeDevice = () => ev(`GC.signals.midi.error = ''; GC.signals.midi.inputs = ['Studio mixer MIDI out']; 1`); // a made-up device name
const shot = async (name) => {
  await fakeDevice();
  await ev('GC.drawPills(); GC.settingsUi.refresh(); 1');
  await sleep(450);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, name), Buffer.from(r.result.data, 'base64'));
  console.log('wrote', name);
};
const set = (patch) => ev(`GC.save(${JSON.stringify(patch)}).then(() => 1)`);
const midi = (bytes) => ev(`GC.signals.handleMidi({ data: new Uint8Array([${bytes}]) })`);

// the clock can be moved forward so a long intervention does not need a long wait
await ev(`window.__skew = 0; const real = performance.now.bind(performance); performance.now = () => real() + window.__skew; 1`);

const steps = [{ name: 'Opening', sec: 45 }, { name: 'News', sec: 60 }, { name: 'Interview', sec: 180 }, { name: 'Closing', sec: 30 }];
await set({
  language: 'en', theme: 'dark',
  timer: { mode: 'toggle', holdSeconds: 8, debounceMs: 0, warnSeconds: 10, flashSeconds: 10 },
  programs: [{ id: 'morning', name: 'Morning show', steps }, { id: 'evening', name: 'Evening show', steps: [{ name: 'News', sec: 90 }, { name: 'Chat', sec: 0 }] }],
  activeProgram: 'morning', programEnd: 'loop',
  midi: { enabled: true, input: 'Studio mixer MIDI out', bindings: { toggle: { type: 'note', channel: 1, number: 60 }, reset: { type: 'pc', channel: 1, number: 9 }, next: { type: 'note', channel: 1, number: 62 }, prev: { type: 'note', channel: 1, number: 59 }, restart: { type: 'cc', channel: 0, number: 21 } } },
  key: { enabled: true, global: true, keys: { toggle: 'Ctrl+Alt+F9', reset: 'Ctrl+Alt+F10', next: 'Ctrl+Alt+Right', prev: 'Ctrl+Alt+Left' } }
});
await ev('GC.signals.reconfigure(); GC.program.set(1); 1');
await sleep(500);

// 1 · near the limit of the step "News" (60 s): the figures turn to the warning colour
await midi([0x90, 60, 100]);
await ev('window.__skew = 52000; 1');
await sleep(300);
await shot('01-counting-warning.png');

// 2 · the step is over by 12 s: the total stays on screen in red, the next step is armed
await ev('window.__skew = 72000; 1');
await sleep(200);
await midi([0x90, 60, 90]);
await sleep(300);
await shot('02-total-over-limit.png');
await midi([0xc0, 9]);

// 3 · Settings → Programs
await ev('GC.program.set(2); GC.settingsUi.open(); document.querySelectorAll("#tabs .tab-btn")[1].click(); 1');
await sleep(300);
await shot('03-programs.png');

// 4 · Settings → Signals (MIDI mapping and monitor)
await set({ timer: { mode: 'separate' }, midi: { bindings: { start: { type: 'note', channel: 1, number: 60 }, stop: { type: 'note', channel: 1, number: 61 }, toggle: null } } });
for (const m of [[0x90, 60, 100], [0x90, 61, 100], [0x90, 62, 100], [0xb0, 30, 64], [0xc0, 3]]) { await midi(m); await sleep(30); await ev('window.__skew += 3000; 1'); }
await ev('GC.action("reset", "demo"); document.querySelectorAll("#tabs .tab-btn")[2].click(); 1');
await sleep(300);
await shot('04-signals-midi.png');
await ev('document.getElementById("btnCloseSettings").click(); 1');

console.log(app.errors.length ? `errors: ${app.errors.join(' | ')}` : 'no console errors');
app.close();
process.exit(app.errors.length ? 1 : 0);
