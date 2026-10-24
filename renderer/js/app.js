// Start-up and the timer screen. The timer itself (src/trigger/stopwatch.js) is plain logic; this file draws it.
import { createStopwatch, formatDuration } from '../../src/trigger/stopwatch.js';
import { limitState, clampIndex, currentStep, advance, back, stepAfter, stepText } from '../../src/limits.js';
import { createSignals } from './signals.js';
import { initSettings } from './settings.js';

const GC = window.GC;
const { $ } = GC;

const sw = createStopwatch();
const now = () => performance.now();
let lastPhase = 'idle';
let lastText = '';
let lastLimitClass = '';
let lastStepKey = '';
let limitAlerted = false; // the limit alert fires once for each speech

// ---- programs: the step each program is at, and the speech that just ended ----
let programIndex = {}; // { programId: index }, remembered by the main process
let finished = null; // { step } while the total of the last speech is on screen: it is shown in that step's colour
let lastStepSignalAt = -Infinity;

const program = () => GC.state.settings.programs.find((p) => p.id === GC.state.settings.activeProgram) || null;
const indexOf = (p) => clampIndex(p, programIndex[p?.id] ?? 0);
const setIndex = (p, i) => {
  if (!p) return;
  programIndex[p.id] = i;
  window.api.runtime.setProgramIndex(p.id, i);
};
// The step being timed: the current step of the active program, or, with no program, the single limit of the settings.
const activeStep = () => {
  const p = program();
  if (p) return currentStep(p, indexOf(p));
  const sec = GC.state.settings.timer.limitSeconds;
  return sec > 0 ? { name: '', sec } : null;
};

GC.drawPills = () => drawPills();
GC.program = { current: program, index: () => indexOf(program()), set: (i) => { const p = program(); if (p) { setIndex(p, i); lastStepKey = ''; draw(); } } };
GC.timer = { isBusy: () => sw.snapshot(now()).phase === 'running' };

function applySettings(s) {
  const root = document.documentElement;
  const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
  root.dataset.theme = theme;
  for (const k of ['normal', 'warn', 'over', 'idle']) {
    if (s.colors[k]) root.style.setProperty(`--c-${k}`, s.colors[k]);
    else root.style.removeProperty(`--c-${k}`);
  }
  sw.configure({ holdMs: s.timer.holdForever ? Infinity : s.timer.holdSeconds * 1000, debounceMs: s.timer.debounceMs });
  document.body.classList.toggle('figures-only', !!s.figuresOnly);
  fillProgramSelect();
  lastStepKey = '';
  const separate = s.timer.mode === 'separate';
  $('btnStop').hidden = !separate;
  $('btnStart').textContent = GC.t(separate ? 'ctl.start' : 'ctl.toggle');
  const anySignal = Object.values(s.midi.bindings).some(Boolean) || Object.values(s.key.keys).some(Boolean) || s.audio.enabled;
  $('hint').hidden = anySignal;
}

function fillProgramSelect() {
  const sel = $('programSelect');
  const s = GC.state.settings;
  sel.replaceChildren(GC.h('option', { value: '', text: GC.t('prog.none'), selected: !s.activeProgram }), ...s.programs.map((p) => GC.h('option', { value: p.id, text: p.name, selected: p.id === s.activeProgram })));
  $('stepbar').hidden = !s.programs.length;
}

function onAction(action, source) {
  const t = now();
  const s = GC.state.settings;
  if (action === 'next' || action === 'prev' || action === 'restart') {
    // a console that sends two messages for one press must not skip a step
    if (t - lastStepSignalAt < s.timer.debounceMs) return;
    lastStepSignalAt = t;
    const p = program();
    if (!p) return;
    const i = indexOf(p);
    setIndex(p, action === 'restart' ? 0 : action === 'prev' ? back(p, i) : advance(p, i, s.programEnd));
    window.api.app.log('info', `program ${action} via ${source}`);
    lastStepKey = '';
    draw();
    GC.settingsUi?.refresh?.();
    return;
  }
  const before = sw.snapshot(t).phase;
  const res = sw.signal(action, t);
  if (res.accepted) {
    window.api.app.log('info', `signal ${action} via ${source}`);
    const p = program();
    if (before === 'running' && res.phase === 'holding') {
      // the speech ended: remember its step for the colour of the total, and arm the next step
      finished = { step: activeStep() };
      GC.speeches.record({ ms: sw.snapshot(t).ms, program: p?.name || '', step: finished.step?.name || '', limitSec: finished.step?.sec || 0 });
      if (p) setIndex(p, advance(p, indexOf(p), s.programEnd));
    } else if (res.phase === 'running' || res.phase === 'idle') {
      finished = null;
    }
  }
  lastStepKey = '';
  draw();
}

// ---- alert when the limit is reached: one short beep and/or one flash, each off by default ----
let audioCtx = null;
GC.beep = () => {
  try {
    audioCtx = audioCtx || new AudioContext();
    audioCtx.resume?.();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  } catch (e) { window.api.app.log('warn', `beep failed: ${e?.message || e}`); }
};
GC.flashWindow = () => {
  const el = $('limitFlash');
  el.classList.remove('on');
  void el.offsetWidth; // restart the animation
  el.classList.add('on');
};
function limitReached() {
  const t = GC.state.settings.timer;
  window.api.app.log('info', 'limit reached');
  if (t.limitSound) GC.beep();
  if (t.limitFlash) GC.flashWindow();
}

// ---- drawing ----
function draw() {
  const snap = sw.snapshot(now());
  if (snap.phase !== 'running') limitAlerted = false;
  else if (!limitAlerted) {
    const sec = activeStep()?.sec || 0;
    if (sec > 0 && snap.ms >= sec * 1000) { limitAlerted = true; limitReached(); }
  }
  const text = formatDuration(snap.ms);
  if (text !== lastText) {
    $('digits').textContent = text;
    document.body.classList.toggle('long', text.length > 5); // an hour or more: the compact view needs smaller figures
    lastText = text;
  }
  if (snap.phase === 'idle' && finished) finished = null; // the total went away by itself
  // the limit of the step being timed: while the total is shown it is the step that just ended
  const step = snap.phase === 'holding' ? finished?.step : activeStep();
  const state = snap.phase === 'idle' ? 'none' : limitState(snap.ms, step?.sec || 0, { warnSec: GC.state.settings.timer.warnSeconds, flashSec: GC.state.settings.timer.flashSeconds });
  const limitClass = `lim-${state === 'flash' && snap.phase !== 'running' ? 'over' : state}`; // it never blinks while the total is shown
  if (limitClass !== lastLimitClass) {
    document.body.className = document.body.className.replace(/\blim-\w+/g, '').trim() + ` ${limitClass}`;
    lastLimitClass = limitClass;
  }
  drawSteps(snap.phase, step);
  if (snap.phase !== lastPhase) {
    lastPhase = snap.phase;
    document.body.className = document.body.className.replace(/phase-\w+/, `phase-${snap.phase}`);
    $('stateLabel').textContent = GC.t(`phase.${snap.phase}`);
    $('stateLabel').setAttribute('data-i18n', `phase.${snap.phase}`);
    GC.updates?.syncVisibility?.();
  }
  const fill = $('holdFill');
  const hold = GC.state.settings.timer.holdSeconds * 1000;
  fill.style.width = snap.phase === 'holding' && Number.isFinite(snap.holdLeftMs) ? `${Math.max(0, Math.min(100, (snap.holdLeftMs / hold) * 100))}%` : '0%';
}

// the line under the figures: the step on screen, and the one after it
function drawSteps(phase, shown) {
  const p = program();
  const s = GC.state.settings;
  const i = p ? indexOf(p) : 0;
  const key = `${phase}|${p?.id}|${i}|${shown?.name}|${shown?.sec}|${finished ? 1 : 0}|${GC.state.lang}|${s.timer.limitSeconds}`;
  if (key === lastStepKey) return;
  lastStepKey = key;
  const free = GC.t('prog.free');
  let label = '';
  let next = '';
  if (p) {
    const ended = i >= p.steps.length;
    if (phase === 'holding' && finished?.step) {
      label = stepText(finished.step, free);
      const upcoming = currentStep(p, i);
      next = upcoming ? GC.t('prog.nextStep', { s: stepText(upcoming, free) }) : GC.t('prog.end');
    } else if (ended) {
      label = GC.t('prog.end');
    } else {
      label = GC.t('prog.step', { i: i + 1, n: p.steps.length }) + ' · ' + stepText(shown, free);
      const after = stepAfter(p, i, s.programEnd);
      next = after ? GC.t('prog.nextStep', { s: stepText(after, free) }) : GC.t('prog.end');
    }
  }
  if (!p && s.timer.limitSeconds > 0) next = GC.t('prog.limitOnly', { s: formatDuration(s.timer.limitSeconds * 1000) });
  $('stepLabel').textContent = label;
  $('stepNext').textContent = next;
  $('btnPrev').disabled = $('btnNext').disabled = $('btnRestart').disabled = !p;
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
  if (res.programIndex) programIndex = { ...res.programIndex };
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

// **bold** and `code` of the CHANGELOG become real bold and code (through the DOM, never as HTML)
function rich(text) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) return GC.h('strong', { text: part.slice(2, -2) });
    if (part.startsWith('`') && part.endsWith('`')) return GC.h('code', { text: part.slice(1, -1) });
    return part;
  });
}

// "What's new": shown once after an update. It never grows taller than the window (the list scrolls, the button stays
// in view) and closes with the button, with Esc or with a click outside the panel.
function showWhatsNew(wn) {
  const box = $('whatsNew');
  $('whatsNewTitle').textContent = GC.t('whatsnew.title', { v: wn.version });
  $('whatsNewList').replaceChildren(...wn.bullets.map((b) => GC.h('li', {}, ...rich(b))));
  const close = () => {
    box.hidden = true;
    document.removeEventListener('keydown', onKey, true);
    window.api.whatsNew.seen();
  };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  $('btnWhatsNewClose').onclick = close;
  box.onclick = (e) => { if (e.target === box) close(); };
  box.hidden = false;
  $('btnWhatsNewClose').focus();
}
GC.showWhatsNew = showWhatsNew;

async function init() {
  const res = await window.api.settings.get();
  GC.state.platform = res.platform;
  GC.state.settings = res.settings;
  GC.state.keyStatus = res.keyStatus || GC.state.keyStatus;
  GC.state.lang = res.lang;
  GC.state.locale = res.locale;
  document.documentElement.lang = res.lang;
  programIndex = { ...(res.programIndex || {}) };
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
  window.api.on.compact((on) => document.body.classList.toggle('compact', on));

  $('btnStart').addEventListener('click', () => onAction(GC.state.settings.timer.mode === 'separate' ? 'start' : 'toggle', 'button'));
  $('btnStop').addEventListener('click', () => onAction('stop', 'button'));
  $('btnReset').addEventListener('click', () => onAction('reset', 'button'));
  $('btnPrev').addEventListener('click', () => onAction('prev', 'button'));
  $('btnNext').addEventListener('click', () => onAction('next', 'button'));
  $('btnRestart').addEventListener('click', () => onAction('restart', 'button'));
  $('programSelect').addEventListener('change', (e) => { save({ activeProgram: e.target.value }); });
  $('btnFullscreen').addEventListener('click', () => window.api.window.toggleFullscreen());
  $('btnCompact').addEventListener('click', () => window.api.window.setCompact(true));
  $('btnCompactExit').addEventListener('click', () => window.api.window.setCompact(false));
  $('btnSpeeches').addEventListener('click', () => GC.speeches.open());
  // double-click: leave the compact view, otherwise toggle full screen
  $('digits').addEventListener('dblclick', () => (document.body.classList.contains('compact') ? window.api.window.setCompact(false) : window.api.window.toggleFullscreen()));
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
  if (wn) showWhatsNew(wn);
}

init();
