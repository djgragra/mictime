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

  // ---- programs, limits and colours ----
  await set({ audio: { enabled: false }, timer: { mode: 'toggle', holdSeconds: 2, holdForever: false, debounceMs: 0, warnSeconds: 2, flashSeconds: 1 }, midi: { bindings: { toggle: null, start: null, stop: null, reset: null } }, key: { enabled: true, global: false, keys: { toggle: 'F9', reset: 'F10', next: 'F5', prev: 'F6', restart: 'F7' } } });
  await set({ programs: [{ id: 'show', name: 'Show', steps: [{ name: 'News', sec: 3 }, { name: 'Chat', sec: 0 }, { name: 'End', sec: 5 }] }], activeProgram: 'show', programEnd: 'loop' });
  await sleep(300);
  await ev('GC.action("reset", "test")'); // the audio test may have left a count running
  await ev('GC.program.set(0)');
  await sleep(150);
  const text = (id) => ev(`document.getElementById('${id}').textContent`);
  check('program on screen: step 1/3 News 00:03, next Chat', (await text('stepLabel')) === 'Step 1/3 · News · 00:03' && (await text('stepNext')) === 'Next: Chat · no limit', `${await text('stepLabel')} | ${await text('stepNext')}`);
  const cls = () => ev('document.body.className');
  await key('F9', 'F9');
  await sleep(1300);
  check('1.3 s of a 3 s limit with a 2 s warning: warning colour', (await cls()).includes('lim-warn'), await cls());
  await sleep(2000);
  check('past the limit: over colour (red)', /lim-(over|flash)/.test(await cls()), await cls());
  check('the figures are red', (await ev("getComputedStyle(document.getElementById('digits')).color")) === 'rgb(239, 68, 68)');
  await sleep(1200);
  check('past the limit by more than 1 s: blinking', (await cls()).includes('lim-flash') && (await ev("getComputedStyle(document.getElementById('digits')).animationName")) === 'pulse', await cls());
  await key('F9', 'F9');
  await sleep(200);
  check('stop: the total keeps the red colour, no blinking, and the next step is armed', (await cls()).includes('lim-over') && !(await cls()).includes('lim-flash') && (await text('stepNext')).startsWith('Next: Chat') && (await text('stepLabel')).startsWith('News'), `${await cls()} | ${await text('stepLabel')} | ${await text('stepNext')}`);
  await sleep(2300);
  check('after the hold time: back to zero, grey, step 2/3 (no limit) is armed', (await cls()).includes('phase-idle') && (await text('stepLabel')) === 'Step 2/3 · Chat · no limit', `${await cls()} | ${await text('stepLabel')}`);
  await key('F9', 'F9');
  await sleep(1500);
  check('a step with no limit never changes colour', (await cls()).includes('lim-none'), await cls());
  await key('F9', 'F9');
  await sleep(100);
  await key('F10', 'F10');
  check('reset does not advance a step (Chat was stopped before, so End is armed)', (await text('stepLabel')).startsWith('Step 3/3'), await text('stepLabel'));
  await key('F6', 'F6');
  check('previous step', (await text('stepLabel')).startsWith('Step 2/3'));
  await key('F7', 'F7');
  check('restart: first step', (await text('stepLabel')).startsWith('Step 1/3'));
  await key('F5', 'F5');
  await key('F5', 'F5');
  await sleep(50);
  check('next step twice (debounce 0 here): step 3', (await text('stepLabel')).startsWith('Step 3/3'), await text('stepLabel'));
  await key('F5', 'F5');
  check('loop at the end: back to the first step', (await text('stepLabel')).startsWith('Step 1/3'));
  await set({ programEnd: 'free' });
  await key('F6', 'F6');
  await key('F5', 'F5'); await key('F5', 'F5'); await key('F5', 'F5');
  check('"free" at the end: no limit and the program says so', (await text('stepLabel')) === 'End of the program: no limit', await text('stepLabel'));
  // the single limit, with no program active
  await set({ activeProgram: '', timer: { limitSeconds: 2, warnSeconds: 1, flashSeconds: 1, holdForever: false, holdSeconds: 2 } });
  await sleep(200);
  check('single limit: the line under the figures says so', (await text('stepNext')) === 'Limit 00:02', await text('stepNext'));
  await key('F9', 'F9');
  await sleep(1300);
  check('single limit: warning colour near the limit', (await cls()).includes('lim-warn'), await cls());
  await sleep(1000);
  check('single limit: over colour past it', /lim-(over|flash)/.test(await cls()), await cls());
  await key('F9', 'F9');
  await sleep(200);
  check('single limit: no step is armed or advanced (no program), the total stays red', (await cls()).includes('lim-over') && (await text('stepNext')) === 'Limit 00:02', `${await cls()} | ${await text('stepNext')}`);
  await key('F10', 'F10');
  await set({ timer: { limitSeconds: 0 } });
  await sleep(150);
  check('no program and no limit: nothing under the figures', (await text('stepNext')) === '' && (await text('stepLabel')) === '', `${await text('stepNext')}|${await text('stepLabel')}`);
  await set({ activeProgram: 'show', timer: { warnSeconds: 2, flashSeconds: 1 } });

  // a console that sends two messages for one press must not skip a step
  await set({ programEnd: 'loop', timer: { debounceMs: 500 } });
  await ev('GC.program.set(0)');
  await sleep(700);
  await key('F5', 'F5'); await key('F5', 'F5');
  await sleep(80);
  check('two "next step" within the debounce time count as one', (await text('stepLabel')).startsWith('Step 2/3'), await text('stepLabel'));
  await set({ timer: { debounceMs: 0 } });
  await ev('GC.program.set(3)');
  // remembered by the main process
  const idx = JSON.parse(await ev('window.api.runtime.get().then(JSON.stringify)'));
  check('the step is kept by the main process (not in the settings)', idx.programIndex.show === 3 && !JSON.stringify(await ev('GC.state.settings')).includes('programIndex'), JSON.stringify(idx));
  // hold forever
  await set({ programEnd: 'loop', activeProgram: '', timer: { holdForever: true, holdSeconds: 1 } });
  await key('F9', 'F9'); await sleep(1100); await key('F9', 'F9');
  await sleep(2500);
  check('"never reset": the total is still there after the hold time', (await cls()).includes('phase-holding') && (await text('digits')) === '00:01', await cls());
  await key('F9', 'F9');
  check('a new start begins a new count', (await cls()).includes('phase-running'));
  await key('F10', 'F10');
  check('and reset clears it', (await cls()).includes('phase-idle'));
  // with "reduce motion" on in the system there is no blinking: a steady red frame instead
  await set({ programs: [{ id: 'q', name: 'Quick', steps: [{ name: 'Q', sec: 1 }] }], activeProgram: 'q', timer: { warnSeconds: 0, flashSeconds: 0, holdForever: false } });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await ev('GC.program.set(0)');
  await key('F9', 'F9');
  await sleep(2300);
  check('reduce motion: no animation on the figures, a red frame on the stage', (await ev("getComputedStyle(document.getElementById('digits')).animationName")) === 'none' && (await ev("getComputedStyle(document.querySelector('.stage')).boxShadow")).includes('rgb(239, 68, 68)'), await cls());
  await send('Emulation.setEmulatedMedia', { features: [] });
  await key('F10', 'F10');
  await set({ activeProgram: '' });

  // colours chosen by the user
  await set({ colors: { normal: '#00ff00', idle: '#0000ff' }, timer: { holdForever: false } });
  check('chosen colours apply (idle blue)', (await ev("getComputedStyle(document.getElementById('digits')).color")) === 'rgb(0, 0, 255)');
  await key('F9', 'F9');
  check('chosen colours apply (counting green)', (await ev("getComputedStyle(document.getElementById('digits')).color")) === 'rgb(0, 255, 0)');
  await key('F10', 'F10');
  await set({ colors: { normal: '', idle: '' } });

  // ---- Settings → Programs: the labels of the step table line up with the boxes ----
  await set({ programs: [{ id: 'al', name: 'Align', steps: [{ name: 'One', sec: 60 }] }], activeProgram: 'al' });
  await ev(`GC.settingsUi.open(); document.querySelectorAll('#tabs .tab-btn')[1].click()`);
  await sleep(250);
  const al = JSON.parse(await ev(`(() => { const head = [...document.querySelectorAll('.step-row.head span')]; const row = document.querySelector('.step-row:not(.head)'); const inputs = row.querySelectorAll('input'); const r = (e) => e.getBoundingClientRect(); return JSON.stringify({ name: [r(head[1]).left, r(inputs[0]).left], min: [r(head[2]).left, r(inputs[1]).left], sec: [r(head[3]).left, r(inputs[2]).left] }); })()`));
  check('step table: "Name", "Minutes" and "Seconds" start where their boxes start', Object.values(al).every(([a, b]) => Math.abs(a - b) <= 2), JSON.stringify(al));
  await ev(`document.getElementById('btnCloseSettings').click()`);

  // ---- "What's new" must fit the window and close ----
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 480, deviceScaleFactor: 1, mobile: false });
  await ev(`GC.showWhatsNew({ version: '9.9.9', date: '', bullets: Array.from({ length: 14 }, (_, i) => '**Item ' + i + '** with \`code\` and a long text that goes on and on so that the list is much taller than a small window, for sure, and wraps over several lines of the panel.') })`);
  await sleep(200);
  const wn = JSON.parse(await ev(`(() => { const b = document.getElementById('btnWhatsNewClose').getBoundingClientRect(); const p = document.querySelector('#whatsNew .panel').getBoundingClientRect(); return JSON.stringify({ btnBottom: b.bottom, panelBottom: p.bottom, h: innerHeight, text: document.getElementById('whatsNewList').textContent, strong: document.querySelectorAll('#whatsNewList strong').length, code: document.querySelectorAll('#whatsNewList code').length }); })()`));
  check("What's new: the panel and its OK button are inside the window", wn.btnBottom <= wn.h && wn.panelBottom <= wn.h, JSON.stringify(wn));
  check("What's new: bold and code are real elements, no raw ** or backticks", wn.strong === 14 && wn.code === 14 && !wn.text.includes('**') && !wn.text.includes('`'), JSON.stringify(wn));
  await ev(`document.getElementById('btnWhatsNewClose').click()`);
  check("What's new: the button closes it", await ev(`document.getElementById('whatsNew').hidden`));
  await ev(`GC.showWhatsNew({ version: '9.9.9', date: '', bullets: ['one'] })`);
  await key('Escape', 'Escape');
  check("What's new: Esc closes it", await ev(`document.getElementById('whatsNew').hidden`));
  await send('Emulation.clearDeviceMetricsOverride');

  // ---- speeches: the list of the last speeches of the session ----
  await set({ timer: { mode: 'toggle', holdSeconds: 2, debounceMs: 0 } });
  await ev(`GC.action('reset', 'e2e')`);
  await ev(`document.getElementById('btnStart').click()`);
  await sleep(1200);
  await ev(`document.getElementById('btnStart').click()`);
  await ev(`document.getElementById('btnSpeeches').click()`);
  let sp = JSON.parse(await ev(`JSON.stringify({ open: !document.getElementById('speeches').hidden, rows: document.querySelectorAll('#speechesBody tbody tr').length, first: document.querySelector('#speechesBody tbody tr td.num')?.textContent })`));
  check('speeches: the list opens and shows the stopped speech (00:01)', sp.open && sp.rows >= 1 && sp.first === '00:01', JSON.stringify(sp));
  await ev(`document.getElementById('btnSpeechesCopy').click()`);
  await sleep(200);
  check('speeches: Copy answers "Copied."', (await ev(`document.getElementById('speechesMsg').textContent`)) === 'Copied.');
  await ev(`document.getElementById('btnSpeechesClear').click()`);
  check('speeches: Clear empties the list and disables the buttons', (await ev(`document.querySelectorAll('#speechesBody tbody tr').length`)) === 0 && (await ev(`document.getElementById('btnSpeechesSave').disabled`)));
  await key('Escape', 'Escape');
  check('speeches: Esc closes the list', await ev(`document.getElementById('speeches').hidden`));
  await ev(`GC.action('reset', 'e2e')`);

  // ---- compact view: small window, figures only, back with a double-click ----
  const win = () => ev(`JSON.stringify({ compact: document.body.classList.contains('compact'), w: outerWidth, h: outerHeight, header: getComputedStyle(document.querySelector('header')).display, controls: getComputedStyle(document.getElementById('controls')).display, digits: document.getElementById('digits').getBoundingClientRect().width })`).then(JSON.parse);
  const before = await win();
  await ev(`document.getElementById('btnCompact').click()`);
  await sleep(700);
  let cv = await win();
  check('compact: small window, header and buttons hidden, figures visible', cv.compact && cv.w < 520 && cv.header === 'none' && cv.controls === 'none' && cv.digits > 60, JSON.stringify(cv));
  await ev(`document.getElementById('digits').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  await sleep(700);
  cv = await win();
  check('compact: a double-click on the figures brings the full window back', !cv.compact && cv.w === before.w && cv.header !== 'none', JSON.stringify({ before, cv }));
  await ev(`document.getElementById('btnCompact').click()`);
  await sleep(500);
  await ev(`document.getElementById('btnCompactExit').click()`);
  await sleep(500);
  cv = await win();
  check('compact: the corner button also leaves it', !cv.compact && cv.w >= 520, JSON.stringify(cv));

  // ---- settings tabs draw without errors, in the standard order ----
  await ev(`GC.settingsUi.open()`);
  const tabs = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#tabs .tab-btn')].map((b) => b.textContent))`));
  check('tabs in the standard order (own tabs after General)', tabs.join('|') === 'General|Programs|Signals|Updates|Backup|Help & About', tabs.join('|'));
  for (let i = 0; i < 6; i++) {
    await ev(`document.querySelectorAll('#tabs .tab-btn')[${i}].click()`);
    check(`tab ${tabs[i]} has content`, (await ev(`document.getElementById('tabBody').children.length`)) > 0);
  }
  await ev(`document.querySelectorAll('#tabs .tab-btn')[5].click()`);
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
