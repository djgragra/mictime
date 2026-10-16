// Start-up and the timer screen. The timer itself (src/trigger/stopwatch.js) is plain logic; this file draws it.
import { createStopwatch, formatDuration } from '../../src/trigger/stopwatch.js';
import { createSignals } from './signals.js';
import { initSettings } from './settings.js';

const GC = window.GC;
const { $ } = GC;

const sw = createStopwatch();
const now = () => performance.now();
let lastPhase = 'idle';
let lastText = '';

GC.drawPills = () => drawPills();
GC.timer = { isBusy: () => sw.snapshot(now()).phase === 'running' };

function applySettings(s) {
  const root = document.documentElement;
  const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
  root.dataset.theme = theme;
  sw.configure({ holdMs: s.timer.holdSeconds * 1000, debounceMs: s.timer.debounceMs });
  const separate = s.timer.mode === 'separate';
  $('btnStop').hidden = !separate;
  $('btnStart').textContent = GC.t(separate ? 'ctl.start' : 'ctl.toggle');
  const anySignal = Object.values(s.midi.bindings).some(Boolean) || Object.values(s.key.keys).some(Boolean) || s.audio.enabled;
  $('hint').hidden = anySignal;
}

function onAction(action, source) {
  const res = sw.signal(action, now());
  if (res.accepted) window.api.app.log('info', `signal ${action} via ${source}`);
  draw();
}

// ---- drawing ----
function draw() {
  const snap = sw.snapshot(now());
  const text = formatDuration(snap.ms);
  if (text !== lastText) {
    $('digits').textContent = text;
    lastText = text;
  }
  if (snap.phase !== lastPhase) {
    lastPhase = snap.phase;
    document.body.className = document.body.className.replace(/phase-\w+/, `phase-${snap.phase}`);
    $('stateLabel').textContent = GC.t(`phase.${snap.phase}`);
    $('stateLabel').setAttribute('data-i18n', `phase.${snap.phase}`);
    GC.updates?.syncVisibility?.();
  }
  const fill = $('holdFill');
  const hold = GC.state.settings.timer.holdSeconds * 1000;
  fill.style.width = snap.phase === 'holding' ? `${Math.max(0, Math.min(100, (snap.holdLeftMs / hold) * 100))}%` : '0%';
}

// ---- pills: what each input is doing ----
function drawPills() {
  const s = GC.state.settings;
  const sig = GC.signals;
  const box = $('pills');
  const pill = (cls, label, text) => GC.h('span', { class: `pill ${cls}`, title: `${label}: ${text}` }, GC.h('span', { class: 'pill-dot' }), GC.h('span', { text: `${label} ${text}` }));
  const flash = performance.now() - sig.midi.flashAt < 400;
  let midi;
  if (!s.midi.enabled) midi = pill('off', 'MIDI', GC.t('sig.off'));
  else if (sig.midi.error) midi = pill('bad', 'MIDI', GC.t('sig.noAccess'));
  else if (!sig.midi.inputs.length) midi = pill('warn', 'MIDI', GC.t('sig.noInput'));
  else midi = pill(flash ? 'hot' : 'ok', 'MIDI', GC.t('sig.ready'));
  const anyKey = Object.values(s.key.keys).some(Boolean);
  const key = !s.key.enabled || !anyKey ? pill('off', GC.t('pill.key'), GC.t(anyKey ? 'sig.off' : 'sig.none'))
    : pill(GC.state.keyStatus.failed.length ? 'warn' : 'ok', GC.t('pill.key'), GC.t(GC.state.keyStatus.failed.length ? 'sig.localOnly' : s.key.global ? 'sig.global' : 'sig.window'));
  const a = sig.audio;
  const audio = !s.audio.enabled ? pill('off', GC.t('pill.audio'), GC.t('sig.off'))
    : a.status === 'listening' ? pill(a.open ? 'hot' : 'ok', GC.t('pill.audio'), GC.t('sig.ready'))
    : pill('bad', GC.t('pill.audio'), GC.t(a.status === 'denied' ? 'sig.denied' : 'sig.noInput'));
  box.replaceChildren(midi, key, audio);
}

let drawPillsQueued = false;
function onSignalsChange(levelOnly) {
  GC.settingsUi?.refresh?.(levelOnly);
  if (levelOnly && drawPillsQueued) return;
  drawPillsQueued = true;
  setTimeout(() => { drawPillsQueued = false; drawPills(); }, levelOnly ? 250 : 0);
}

async function save(patch) {
  const res = await window.api.settings.update(patch);
  adopt(res);
  return res;
}

function adopt(res) {
  GC.state.settings = res.settings;
  GC.state.keyStatus = res.keyStatus || GC.state.keyStatus;
  GC.state.lang = res.lang;
  GC.state.locale = res.locale;
  document.documentElement.lang = res.lang;
  GC.applyTexts?.();
  applySettings(res.settings);
  GC.signals?.reconfigure();
  drawPills();
}

async function init() {
  const res = await window.api.settings.get();
  GC.state.platform = res.platform;
  GC.state.settings = res.settings;
  GC.state.keyStatus = res.keyStatus || GC.state.keyStatus;
  GC.state.lang = res.lang;
  GC.state.locale = res.locale;
  document.documentElement.lang = res.lang;
  GC.applyTexts();
  applySettings(res.settings);

  GC.save = save;
  GC.adopt = adopt;
  GC.signals = createSignals({ getSettings: () => GC.state.settings, onAction, onChange: onSignalsChange });
  GC.action = onAction;
  initSettings();

  window.api.on.signal((d) => GC.signals.onGlobalSignal(d));
  window.api.on.keyStatus((st) => { GC.state.keyStatus = st; drawPills(); GC.settingsUi?.refresh?.(); });
  window.api.on.fullscreen((on) => document.body.classList.toggle('fullscreen', on));

  $('btnStart').addEventListener('click', () => onAction(GC.state.settings.timer.mode === 'separate' ? 'start' : 'toggle', 'button'));
  $('btnStop').addEventListener('click', () => onAction('stop', 'button'));
  $('btnReset').addEventListener('click', () => onAction('reset', 'button'));
  $('btnFullscreen').addEventListener('click', () => window.api.window.toggleFullscreen());
  $('digits').addEventListener('dblclick', () => window.api.window.toggleFullscreen());
  document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, select, textarea')) return;
    if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey && $('settings').hidden) GC.settingsUi.open();
  });

  GC.updates.init();
  setInterval(draw, 100);
  setInterval(() => { GC.updates.syncVisibility(); }, 1000);
  setInterval(() => { if (performance.now() - GC.signals.midi.flashAt < 600) drawPills(); }, 400);
  draw();
  GC.signals.reconfigure();
  drawPills();

  // after an update: what's new, once
  const wn = await window.api.whatsNew.get();
  if (wn) {
    $('whatsNewTitle').textContent = GC.t('whatsnew.title', { v: wn.version });
    $('whatsNewList').replaceChildren(...wn.bullets.map((b) => GC.h('li', { text: b })));
    $('whatsNew').hidden = false;
    $('btnWhatsNewClose').addEventListener('click', () => { $('whatsNew').hidden = true; window.api.whatsNew.seen(); });
  }
}

init();
