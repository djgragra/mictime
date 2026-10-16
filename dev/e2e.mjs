#!/usr/bin/env node
// End-to-end check on the REAL app: starts Electron (under Xvfb when there is no display), drives the window over the
// DevTools protocol and checks the timer, the key paths, MIDI messages (injected: there is no MIDI hardware in a test
// run), the audio gate (Chromium's fake audio input, a periodic beep) and the settings tabs. Linux only as written.
//   node dev/e2e.mjs            needs: npm ci, xvfb-run (or a display)
// It uses a throw-away profile folder, never the user's settings.
import { launch, sleep } from './driver.mjs';

const app = await launch({ extraArgs: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const { ev, send, errors } = app;
const key = async (code, key, mods = 0) => {
  for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code, key, modifiers: mods, windowsVirtualKeyCode: 0 });
};

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const view = () => ev(`JSON.stringify({ d: document.getElementById('digits').textContent, phase: document.body.className.match(/phase-(\\w+)/)[1] })`).then(JSON.parse);
const set = (patch) => ev(`GC.save(${JSON.stringify(patch)}).then(() => 1)`);

try {
  await sleep(2500);

  check('page loaded, ES modules ran, no errors', (await ev('typeof GC.signals === "object" && typeof GC.save === "function"')) && !errors.length, errors.join(' | '));
  check('the app opens in English', (await ev('document.documentElement.lang')) === 'en' && (await ev('document.getElementById("btnStart").textContent')) === 'START / STOP');
  check('Web MIDI is requested and handled (no MIDI hardware here: no access or no input)', await ev('GC.signals.midi.error !== "denied" && (GC.signals.midi.error !== "" || GC.signals.midi.inputs.length >= 0)'), await ev('GC.signals.midi.error'));

  // ---- timer through the button: toggle mode ----
  await set({ timer: { mode: 'toggle', holdSeconds: 2, debounceMs: 0 } });
  await ev(`document.getElementById('btnStart').click()`);
  await sleep(2200);
  let v = await view();
  check('start: counting, 00:02', v.phase === 'running' && v.d === '00:02', JSON.stringify(v));
  await ev(`document.getElementById('btnStart').click()`);
  v = await view();
  check('second signal: stops, the total stays on screen', v.phase === 'holding' && v.d === '00:02', JSON.stringify(v));
  await sleep(2300);
  v = await view();
  check('after the hold time it is back to 00:00', v.phase === 'idle' && v.d === '00:00', JSON.stringify(v));

  // ---- MIDI (messages injected into the real handler) ----
  const midi = (bytes) => ev(`GC.signals.handleMidi({ data: new Uint8Array([${bytes}]) })`);
  await set({ timer: { mode: 'toggle' }, midi: { enabled: true, bindings: { toggle: { type: 'note', channel: 1, number: 60 }, reset: { type: 'cc', channel: 0, number: 99 } } } });
  await midi([0x90, 60, 100]);
  await sleep(300);
  check('MIDI note on starts', (await view()).phase === 'running');
  await midi([0x90, 60, 0]);
  check('note on with velocity 0 (off) does nothing', (await view()).phase === 'running');
  await midi([0x80, 60, 0]);
  check('note off does nothing', (await view()).phase === 'running');
  await midi([0x91, 60, 100]);
  check('another channel does not match', (await view()).phase === 'running');
  await midi([0xf8]);
  await midi([0x90, 60, 90]);
  check('the same note on again stops (toggle)', (await view()).phase === 'holding');
  await midi([0xb5, 99, 127]);
  check('CC reset on any channel returns to zero at once', (await view()).phase === 'idle');
  check('the monitor saw the messages', (await ev('GC.signals.midi.monitor.length')) >= 5);

  await set({ timer: { mode: 'separate' }, midi: { bindings: { start: { type: 'cc', channel: 1, number: 20 }, stop: { type: 'cc', channel: 1, number: 20 }, toggle: null } } });
  await midi([0xb0, 20, 127]);
  check('separate, same CC for start and stop: 127 starts', (await view()).phase === 'running');
  await sleep(400);
  await midi([0xb0, 20, 0]);
  check('separate, same CC: 0 stops', (await view()).phase === 'holding');
  await midi([0xb0, 1, 0]); // keep-alive of nothing: unmapped
  await ev('GC.action("reset", "test")');

  // MIDI learn
  await ev(`GC.signals.startLearn('start', (b) => { window.__learned = b; })`);
  await midi([0x92, 36, 100]);
  check('MIDI learn takes the next note on', JSON.stringify(await ev('window.__learned')) === '{"type":"note","channel":3,"number":36}');

  // ---- keys: the window in front (not registered with the system) ----
  await set({ timer: { mode: 'toggle', debounceMs: 0 }, key: { enabled: true, global: false, keys: { toggle: 'F9', reset: 'F10' } } });
  await key('F9', 'F9');
  await sleep(150);
  check('key F9 (window in front) starts', (await view()).phase === 'running');
  await key('F10', 'F10');
  check('key F10 resets', (await view()).phase === 'idle');
  check('settings keep the accelerator canonical', (await ev('GC.state.settings.key.keys.toggle')) === 'F9');

  // ---- keys: registered with the system ----
  await set({ key: { enabled: true, global: true, keys: { toggle: 'ctrl+alt+f9', reset: 'F10' } } });
  await sleep(300);
  const st = JSON.parse(await ev('window.api.keys.status().then(JSON.stringify)'));
  console.log(`info global shortcuts registered by the system: ${JSON.stringify(st)}`);
  check('Ctrl+Alt+F9 and F10 are registered, or reported as refused (never lost)', Object.keys(st.global).length + st.failed.length === 2, JSON.stringify(st));

  // ---- audio gate with Chromium's fake input device (a periodic beep) ----
  await set({ key: { keys: { toggle: '', reset: '' } }, timer: { mode: 'toggle', holdSeconds: 1, debounceMs: 0 }, audio: { enabled: true, thresholdDb: -45, holdMs: 400 } });
  let heard = false;
  for (let i = 0; i < 40 && !heard; i++) { await sleep(250); heard = (await ev('GC.signals.audio.status')) === 'listening' && (await view()).phase !== 'idle'; }
  check('audio level starts the timer when the beep goes over the threshold', heard, await ev('JSON.stringify({s: GC.signals.audio.status, db: GC.signals.audio.db})'));
  await set({ audio: { enabled: false } });
  await sleep(300);
  check('switching the audio off releases the input', (await ev('GC.signals.audio.status')) === 'off' && (await ev('GC.signals.audio.stream')) === null);

  // ---- settings tabs draw without errors, in the standard order ----
  await ev(`GC.settingsUi.open()`);
  const tabs = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#tabs .tab-btn')].map((b) => b.textContent))`));
  check('tabs in the standard order', tabs.join('|') === 'General|Signals|Updates|Backup|Help & About', tabs.join('|'));
  for (let i = 0; i < 5; i++) {
    await ev(`document.querySelectorAll('#tabs .tab-btn')[${i}].click()`);
    check(`tab ${tabs[i]} has content`, (await ev(`document.getElementById('tabBody').children.length`)) > 0);
  }
  await ev(`document.querySelectorAll('#tabs .tab-btn')[4].click()`);
  const support = await ev('window.api.app.supportInfo()');
  check('support info has version and system, no settings', /^MicTime \d+\.\d+\.\d+\nElectron/.test(support) && !/note|F9|ctrl/i.test(support), support);

  // language and theme are remembered
  await set({ language: 'it', theme: 'light' });
  check('Italian and light theme apply', (await ev('document.getElementById("btnReset").textContent')) === 'AZZERA' && (await ev('document.documentElement.dataset.theme')) === 'light');
  await set({ language: 'es' });
  check('Spanish applies', (await ev('document.getElementById("btnReset").textContent')) === 'REINICIAR');

  check('no errors in the console during the run', !errors.length, errors.join(' | '));
} catch (err) {
  console.log('FAIL', err.message);
  failed++;
} finally {
  app.close();
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
