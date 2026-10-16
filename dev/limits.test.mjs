import test from 'node:test';
import assert from 'node:assert/strict';
import { limitState, clampIndex, currentStep, advance, back, stepAfter, stepText } from '../src/limits.js';
import { defaults, sanitizeSettings, sanitizePrograms } from '../src/schema.js';
import { buildBackup, prepareImport, applyImport } from '../src/backup.js';

const prog = (n = 3, extra = {}) => ({ id: 'p', name: 'Show', steps: Array.from({ length: n }, (_, i) => ({ name: `S${i + 1}`, sec: (i + 1) * 60 })), ...extra });

// ---- the colour of the figures ----
test('limitState: ok, warn 10 s before, over past the limit, flash 10 s later', () => {
  const o = { warnSec: 10, flashSec: 10 };
  assert.equal(limitState(0, 60, o), 'ok');
  assert.equal(limitState(49_999, 60, o), 'ok');
  assert.equal(limitState(50_000, 60, o), 'warn');
  assert.equal(limitState(60_000, 60, o), 'warn', 'the limit itself is not yet over');
  assert.equal(limitState(60_001, 60, o), 'over');
  assert.equal(limitState(70_000, 60, o), 'over');
  assert.equal(limitState(70_001, 60, o), 'flash');
});

test('limitState: no limit means no state; a warning longer than the limit warns from the start; zero values', () => {
  assert.equal(limitState(99_999, 0), 'none');
  assert.equal(limitState(99_999, undefined), 'none');
  assert.equal(limitState(0, 5, { warnSec: 10, flashSec: 10 }), 'warn');
  assert.equal(limitState(1_000, 60, { warnSec: 0, flashSec: 0 }), 'ok');
  assert.equal(limitState(60_000, 60, { warnSec: 0, flashSec: 0 }), 'warn');
  assert.equal(limitState(60_001, 60, { warnSec: 0, flashSec: 0 }), 'flash');
});

// ---- the steps ----
test('advance: step by step, then loop or free at the end', () => {
  const p = prog(3);
  assert.equal(advance(p, 0, 'loop'), 1);
  assert.equal(advance(p, 1, 'loop'), 2);
  assert.equal(advance(p, 2, 'loop'), 0, 'loop: back to the first step');
  assert.equal(advance(p, 2, 'free'), 3, 'free: past the end');
  assert.equal(currentStep(p, 3), null, 'past the end there is no step, so no limit');
  assert.equal(advance(p, 3, 'free'), 3);
  assert.equal(advance(p, 3, 'loop'), 0);
  assert.equal(advance(null, 5), 0);
  assert.equal(advance(prog(0), 0), 0);
});

test('back: one step back, never before the first, and from the end to the last step', () => {
  const p = prog(3);
  assert.equal(back(p, 2), 1);
  assert.equal(back(p, 0), 0);
  assert.equal(back(p, 3), 2);
});

test('stepAfter: the step the "Next:" line shows', () => {
  const p = prog(3);
  assert.equal(stepAfter(p, 0, 'loop').name, 'S2');
  assert.equal(stepAfter(p, 2, 'loop').name, 'S1');
  assert.equal(stepAfter(p, 2, 'free'), null);
  assert.equal(stepAfter(p, 3, 'loop').name, 'S1');
  assert.equal(stepAfter(null, 0), null);
});

test('clampIndex keeps the index inside the program, also after steps were removed', () => {
  const p = prog(3);
  assert.equal(clampIndex(p, 99), 3);
  assert.equal(clampIndex(p, -4), 0);
  assert.equal(clampIndex(p, 1.9), 1);
  assert.equal(clampIndex(p, NaN), 0);
  assert.equal(clampIndex(null, 4), 0);
  assert.equal(currentStep(p, 1).name, 'S2');
});

test('stepText: name, limit as mm:ss, or "free"', () => {
  assert.equal(stepText({ name: 'News', sec: 60 }), 'News · 01:00');
  assert.equal(stepText({ name: 'Chat', sec: 0 }, 'no limit'), 'Chat · no limit');
  assert.equal(stepText({ name: '', sec: 90 }), '01:30');
  assert.equal(stepText({ name: 'Long', sec: 3725 }), 'Long · 1:02:05');
  assert.equal(stepText(null), '');
});

// ---- settings: programs and colours ----
test('defaults: no program, loop at the end, colours of the theme, warning 10 s, blink 10 s, hold not forever', () => {
  const d = defaults();
  assert.deepEqual(d.programs, []);
  assert.equal(d.activeProgram, '');
  assert.equal(d.programEnd, 'loop');
  assert.deepEqual(d.colors, { normal: '', warn: '', over: '', idle: '' });
  assert.equal(d.timer.warnSeconds, 10);
  assert.equal(d.timer.flashSeconds, 10);
  assert.equal(d.timer.holdForever, false);
  for (const n of ['next', 'prev', 'restart']) assert.equal(d.midi.bindings[n], null);
  assert.deepEqual(sanitizeSettings(d), d);
});

test('the single limit (no program): default none, clamped, kept by a patch, in the backup', () => {
  assert.equal(defaults().timer.limitSeconds, 0);
  assert.equal(sanitizeSettings({ timer: { limitSeconds: 90 } }).timer.limitSeconds, 90);
  assert.equal(sanitizeSettings({ timer: { limitSeconds: -4 } }).timer.limitSeconds, 0);
  assert.equal(sanitizeSettings({ timer: { limitSeconds: 99_999_999 } }).timer.limitSeconds, 36000);
  assert.equal(sanitizeSettings({ timer: { limitSeconds: 'x' } }).timer.limitSeconds, 0);
  const base = sanitizeSettings({ timer: { limitSeconds: 60, holdSeconds: 9 } });
  assert.equal(sanitizeSettings({ timer: { holdSeconds: 3 } }, base).timer.limitSeconds, 60, 'a patch keeps it');
  assert.equal(prepareImport(JSON.parse(JSON.stringify(buildBackup(base)))).timer.limitSeconds, 60);
});

test('programs: at most 8 of 40 steps, clean names, limits clamped, ids unique, active must exist', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, steps: [] }));
  assert.equal(sanitizePrograms(many).length, 8);
  const p = sanitizePrograms([{ id: 'a', name: '  Morning\u0007 show ', steps: Array.from({ length: 60 }, (_, i) => ({ name: `s${i}`, sec: -5 })) }, { id: 'a', name: '', steps: 'x' }, null, 5]);
  assert.equal(p.length, 2);
  assert.equal(p[0].name, 'Morning  show');
  assert.equal(p[0].steps.length, 40);
  assert.equal(p[0].steps[0].sec, 0);
  assert.notEqual(p[1].id, 'a', 'a repeated id gets a new one');
  assert.equal(p[1].name, 'Program');
  assert.deepEqual(p[1].steps, []);
  assert.equal(sanitizePrograms([{ id: 'x', name: 'n', steps: [{ name: 'a', sec: 99_999_999 }] }])[0].steps[0].sec, 36000);
  const s = sanitizeSettings({ programs: [{ id: 'a', name: 'A', steps: [] }], activeProgram: 'zzz' });
  assert.equal(s.activeProgram, '');
  assert.equal(sanitizeSettings({ activeProgram: 'a' }, s).activeProgram, 'a', 'an existing program can be made active');
  const t = sanitizeSettings({ activeProgram: 'a' }, sanitizeSettings({ programs: [{ id: 'a', name: 'A', steps: [] }] }));
  assert.equal(t.activeProgram, 'a');
  assert.equal(sanitizeSettings({ programs: [] }, t).activeProgram, '', 'deleting the active program clears it');
});

test('colours: #rrggbb only (lower case), anything else means "the theme\'s own"; warning and blink times are clamped', () => {
  const s = sanitizeSettings({ colors: { normal: '#FFFFFF', warn: 'yellow', over: '#12345', idle: ' #AbCdEf ' }, timer: { warnSeconds: -3, flashSeconds: 99999, holdForever: 'yes' } });
  assert.deepEqual(s.colors, { normal: '#ffffff', warn: '', over: '', idle: '#abcdef' });
  assert.equal(s.timer.warnSeconds, 0);
  assert.equal(s.timer.flashSeconds, 3600);
  assert.equal(s.timer.holdForever, false);
  assert.equal(sanitizeSettings({ timer: { holdForever: true } }).timer.holdForever, true);
  assert.equal(sanitizeSettings({ colors: { warn: '#ff0000' } }, sanitizeSettings({ colors: { over: '#00ff00' } })).colors.over, '#00ff00', 'a patch keeps the other colours');
});

test('MIDI and key bindings include next, prev and restart', () => {
  const s = sanitizeSettings({ midi: { bindings: { next: { type: 'cc', channel: 0, number: 30 }, restart: { type: 'pc', channel: 1, number: 2 } } }, key: { keys: { next: 'ctrl+alt+right', prev: 'F6' } } });
  assert.deepEqual(s.midi.bindings.next, { type: 'cc', channel: 0, number: 30 });
  assert.equal(s.midi.bindings.prev, null);
  assert.equal(s.key.keys.next, 'Ctrl+Alt+Right');
  assert.equal(s.key.keys.prev, 'F6');
});

// ---- backup ----
const withPrograms = () => sanitizeSettings({
  programs: [{ id: 'a', name: 'Morning', steps: [{ name: 'News', sec: 60 }, { name: 'Chat', sec: 0 }] }, { id: 'b', name: 'Evening', steps: [{ name: 'One', sec: 30 }] }],
  activeProgram: 'b', programEnd: 'free', colors: { warn: '#ffaa00' }, timer: { holdForever: true, warnSeconds: 5, flashSeconds: 20 }
});

test('the backup carries programs, colours and the new timer settings, and imports them back', () => {
  const s = withPrograms();
  const back2 = prepareImport(JSON.parse(JSON.stringify(buildBackup(s))));
  assert.deepEqual(back2, s);
  assert.equal(back2.activeProgram, 'b');
  assert.ok(!JSON.stringify(buildBackup(s)).includes('programIndex'), 'the step a program is at is runtime state, not backup');
});

test('"add only the missing": the programs this computer lacks are added, its own stay, colours fill the empty ones', () => {
  const current = sanitizeSettings({ programs: [{ id: 'a', name: 'My morning', steps: [{ name: 'X', sec: 10 }] }], activeProgram: 'a', colors: { over: '#111111' }, timer: { warnSeconds: 3 } });
  const merged = applyImport(current, withPrograms(), 'add');
  assert.deepEqual(merged.programs.map((p) => p.id), ['a', 'b']);
  assert.equal(merged.programs[0].name, 'My morning', 'same id: this computer keeps its own');
  assert.equal(merged.activeProgram, 'a');
  assert.equal(merged.colors.over, '#111111');
  assert.equal(merged.colors.warn, '#ffaa00');
  assert.equal(merged.timer.warnSeconds, 3);
});
