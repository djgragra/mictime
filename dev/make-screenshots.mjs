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

await set({ language: 'en', theme: 'dark', timer: { mode: 'toggle', holdSeconds: 8, debounceMs: 0 }, midi: { enabled: true, input: 'Studio mixer MIDI out', bindings: { toggle: { type: 'note', channel: 1, number: 60 }, reset: { type: 'pc', channel: 1, number: 9 } } }, key: { enabled: true, global: true, keys: { toggle: 'Ctrl+Alt+F9', reset: 'Ctrl+Alt+F10' } } });
await ev('GC.signals.reconfigure(); 1');
await sleep(500);

// 1 · counting
await midi([0x90, 60, 100]);
await ev('window.__skew = 137000; 1');
await sleep(300);
await shot('01-counting.png');

// 2 · the total stays on screen
await sleep(200);
await midi([0x90, 60, 90]);
await ev('window.__skew += 1500; 1');
await sleep(300);
await shot('02-total.png');
await midi([0xc0, 9]);

// 3 · Settings → Signals (MIDI mapping and monitor)
await set({ timer: { mode: 'separate' }, midi: { bindings: { start: { type: 'note', channel: 1, number: 60 }, stop: { type: 'note', channel: 1, number: 62 }, reset: { type: 'cc', channel: 0, number: 21 }, toggle: null } } });
for (const m of [[0x90, 60, 100], [0x90, 62, 100], [0xb0, 21, 127], [0xb0, 30, 64], [0xc0, 3]]) { await midi(m); await sleep(30); await ev('window.__skew += 3000; 1'); }
await ev('GC.action("reset", "demo"); GC.settingsUi.open(); document.querySelectorAll("#tabs .tab-btn")[1].click(); 1');
await sleep(300);
await shot('03-signals-midi.png');
await ev('document.getElementById("tabBody").scrollTop = 600; 1');
await shot('04-signals-key-audio.png');
await ev('document.getElementById("btnCloseSettings").click(); 1');

console.log(app.errors.length ? `errors: ${app.errors.join(' | ')}` : 'no console errors');
app.close();
process.exit(app.errors.length ? 1 : 0);
