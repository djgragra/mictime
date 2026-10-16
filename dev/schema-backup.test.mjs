import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaults, sanitizeSettings, parseImport } from '../src/schema.js';
import { buildBackup, prepareImport, applyImport, missingItems, missingSecrets, backupFileName } from '../src/backup.js';
import { createLogger, logFileRe, MAX_LOG_BYTES } from '../src/logs.js';
import { buildSupportInfo, tidy } from '../src/support.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mictime-t-'));
const note = (n, ch = 1) => ({ type: 'note', channel: ch, number: n });
const sample = () => sanitizeSettings({
  language: 'it', theme: 'light',
  timer: { mode: 'separate', holdSeconds: 8, debounceMs: 500 },
  midi: { input: 'X32 Rack', bindings: { start: note(60), stop: note(61), reset: { type: 'pc', channel: 0, number: 9 } } },
  key: { global: false, keys: { start: 'ctrl+alt+f9', reset: 'F12' } },
  audio: { enabled: true, device: 'abc', deviceLabel: 'Studio mic', thresholdDb: -35, holdMs: 2500 }
});

// ---- settings ----
test('defaults: English, dark, toggle mode, 5 s, nothing assigned, audio off', () => {
  const d = defaults();
  assert.equal(d.language, 'en');
  assert.equal(d.theme, 'dark');
  assert.equal(d.timer.mode, 'toggle');
  assert.equal(d.timer.holdSeconds, 5);
  assert.equal(d.audio.enabled, false);
  assert.ok(Object.values(d.midi.bindings).every((b) => b === null));
  assert.ok(Object.values(d.key.keys).every((k) => k === ''));
  assert.deepEqual(sanitizeSettings(d), d, 'defaults are a fixed point');
});

test('sanitizeSettings clamps numbers, drops bad bindings and keys, normalises keys', () => {
  const s = sanitizeSettings({
    timer: { holdSeconds: 99999, debounceMs: -5, mode: 'weird' },
    midi: { bindings: { toggle: { type: 'note', channel: 99, number: 1 }, start: note(200), stop: note(5, 3) } },
    key: { keys: { toggle: 'shift+ctrl+m', start: 'nonsense', stop: 5 } },
    audio: { thresholdDb: 10, holdMs: 1 },
    language: 'fr', theme: 'blue'
  });
  assert.equal(s.timer.holdSeconds, 600);
  assert.equal(s.timer.debounceMs, 0);
  assert.equal(s.timer.mode, 'toggle');
  assert.equal(s.midi.bindings.toggle, null);
  assert.equal(s.midi.bindings.start, null);
  assert.deepEqual(s.midi.bindings.stop, note(5, 3));
  assert.equal(s.key.keys.toggle, 'Ctrl+Shift+M');
  assert.equal(s.key.keys.start, '');
  assert.equal(s.audio.thresholdDb, -5);
  assert.equal(s.audio.holdMs, 200);
  assert.equal(s.language, 'en');
  assert.equal(s.theme, 'dark');
});

test('a partial patch keeps the rest; null clears one binding', () => {
  const base = sample();
  const next = sanitizeSettings({ midi: { bindings: { stop: null } }, timer: { holdSeconds: 3 } }, base);
  assert.equal(next.midi.bindings.stop, null);
  assert.deepEqual(next.midi.bindings.start, note(60));
  assert.equal(next.timer.holdSeconds, 3);
  assert.equal(next.timer.mode, 'separate');
  assert.equal(next.midi.input, 'X32 Rack');
});

// ---- backup ----
test('file name and shape: app slug, version 1, no secrets', () => {
  assert.equal(backupFileName(new Date(2026, 9, 3)), 'mictime-backup-2026-10-03.json');
  const b = buildBackup(sample(), new Date(Date.UTC(2026, 9, 16)));
  assert.equal(b.app, 'mictime');
  assert.equal(b.version, 1);
  assert.equal(b.includesSecrets, false);
  assert.equal(b.exportedAt, '2026-10-16T00:00:00.000Z');
  assert.deepEqual(missingSecrets(), []);
  assert.ok(!/pass|token|secret|apikey/i.test(JSON.stringify(b).replace(/includesSecrets/, '')));
});

test('the backup keeps the MIDI mappings and the key; export then import gives the same settings', () => {
  const s = sample();
  const b = JSON.parse(JSON.stringify(buildBackup(s)));
  assert.deepEqual(b.settings.midi.bindings.start, note(60));
  assert.equal(b.settings.key.keys.start, 'Ctrl+Alt+F9');
  assert.deepEqual(prepareImport(b), s);
});

test('another app\'s file and rubbish are refused; what the file lacks keeps its default', () => {
  assert.throws(() => prepareImport({ app: 'g-clock', settings: {} }), /foreign/);
  for (const bad of [null, [], 'x', 5]) assert.throws(() => prepareImport(bad), /invalid/);
  const minimal = prepareImport({ app: 'mictime', version: 1, settings: { language: 'es' } });
  assert.equal(minimal.language, 'es');
  assert.equal(minimal.timer.holdSeconds, 5);
  assert.equal(parseImport({ language: 'it' }).language, 'it', 'a bare settings object');
});

test('hostile content in a file is cleaned like saved settings', () => {
  const b = buildBackup(sample());
  b.settings.midi.bindings.start = { type: 'sysex', channel: 1, number: 1 };
  b.settings.key.keys.stop = '<script>';
  b.settings.midi.input = 'x'.repeat(5000);
  const s = prepareImport(b);
  assert.equal(s.midi.bindings.start, null);
  assert.equal(s.key.keys.stop, '');
  assert.ok(s.midi.input.length <= 200);
});

test('"replace everything" takes the file; "add only the missing" fills empty mappings and changes nothing else', () => {
  const current = sanitizeSettings({ language: 'en', timer: { holdSeconds: 10 }, midi: { bindings: { start: note(1) } } });
  const incoming = sample();
  assert.deepEqual(applyImport(current, incoming, 'replace'), incoming);
  const merged = applyImport(current, incoming, 'add');
  assert.equal(merged.language, 'en');
  assert.equal(merged.timer.holdSeconds, 10);
  assert.deepEqual(merged.midi.bindings.start, note(1), 'already set here: kept');
  assert.deepEqual(merged.midi.bindings.stop, note(61), 'empty here: filled from the file');
  assert.equal(merged.key.keys.start, 'Ctrl+Alt+F9');
  assert.throws(() => applyImport(current, incoming, 'other'), /invalid-mode/);
  assert.deepEqual(missingItems(incoming, incoming).midi.bindings, incoming.midi.bindings);
});

test('what the app saves apart from the settings is not in a backup', () => {
  const text = JSON.stringify(buildBackup(defaults()));
  for (const k of ['updateState', 'lastSeenVersion', 'windowBounds', 'remindUntil']) assert.ok(!text.includes(k), k);
});

// ---- logs ----
test('log file names: one file per day, mictime prefix; limit and rotation', async () => {
  const dir = tmp();
  const log = createLogger({ dir, prefix: 'mictime', now: () => new Date(2026, 9, 16, 21, 5, 9) });
  log.log('info', 'started', 'app');
  await log.flush();
  assert.deepEqual(fs.readdirSync(dir), ['mictime_16-10-2026.log']);
  assert.match(fs.readFileSync(path.join(dir, 'mictime_16-10-2026.log'), 'utf8'), /^2026-10-16 21:05:09 \| INFO  \| app \| started\n$/);
  assert.equal(MAX_LOG_BYTES, 5 * 1024 * 1024);
  const dir2 = tmp();
  const small = createLogger({ dir: dir2, prefix: 'mictime', maxBytes: 200, now: () => new Date(2026, 9, 16, 12, 0, 0) });
  for (let i = 0; i < 40; i++) small.log('info', 'x'.repeat(60) + i);
  await small.flush();
  const files = fs.readdirSync(dir2);
  assert.ok(files.length > 1 && files.length <= 4, files.join());
  assert.ok(files.every((f) => logFileRe('mictime').test(f)));
});

test('logs older than 7 days are removed, other files are not touched', () => {
  const dir = tmp();
  for (const n of ['mictime_01-10-2026.log', 'mictime_12-10-2026.log', 'other.log']) fs.writeFileSync(path.join(dir, n), 'x');
  const log = createLogger({ dir, prefix: 'mictime', retentionDays: 7, now: () => new Date(2026, 9, 16, 12, 0, 0) });
  assert.equal(log.prune(), 1);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['mictime_12-10-2026.log', 'other.log']);
});

// ---- support info ----
test('support info: version, system, last check and error; home as ~; never settings', () => {
  const text = buildSupportInfo({
    app: 'MicTime', version: '26.10.1', electron: '44.5.1', chrome: '140.0', platform: 'darwin', arch: 'arm64', osRelease: '24.0.0', language: 'es',
    lastCheck: { at: Date.UTC(2026, 9, 16, 8, 0, 0), ok: true },
    lastError: { t: Date.UTC(2026, 9, 16, 9, 0, 0), message: 'failed at /Users/someone/x' },
    home: ''
  });
  assert.match(text, /^MicTime 26\.10\.1\nElectron 44\.5\.1 \(Chrome 140\.0\)\nSystem: darwin arm64 24\.0\.0\nLanguage: es\n/);
  assert.match(text, /Last error: .* failed at ~\/x/);
  assert.ok(!/someone|X32|note|midi/i.test(text));
  assert.equal(tidy('open /root/s/a.txt', '/root'), 'open ~/s/a.txt');
});
