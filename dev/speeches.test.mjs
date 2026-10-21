import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechLog, toCsv, stampText, csvFileName, MAX_SPEECHES, CSV_HEADER } from '../src/speeches.js';

const at = new Date(2026, 9, 21, 14, 5, 9).getTime();

test('the log keeps the last 20 speeches, newest first', () => {
  const log = createSpeechLog();
  for (let i = 1; i <= 25; i++) log.add({ at: at + i, ms: i * 1000, step: `s${i}` });
  assert.equal(MAX_SPEECHES, 20);
  assert.equal(log.size, 20);
  assert.equal(log.list()[0].step, 's25');
  assert.equal(log.list()[19].step, 's6');
  log.clear();
  assert.equal(log.size, 0);
});

test('bad input is made safe, and list() hands out copies', () => {
  const log = createSpeechLog();
  log.add({ ms: -5, limitSec: 'x', program: null });
  const [e] = log.list();
  assert.deepEqual([e.ms, e.limitSec, e.program, e.step, e.at], [0, 0, '', '', 0]);
  e.ms = 99;
  assert.equal(log.list()[0].ms, 0);
});

test('the CSV has a fixed English header, oldest speech first, CRLF lines', () => {
  const log = createSpeechLog();
  log.add({ at, ms: 65_400, program: 'Morning', step: 'News', limitSec: 60 });
  log.add({ at: at + 120_000, ms: 3_725_000, program: '', step: '', limitSec: 0 });
  const csv = toCsv(log.list());
  assert.equal(csv, [
    CSV_HEADER.join(','),
    '2026-10-21 14:05:09,Morning,News,01:05,65,60',
    '2026-10-21 14:07:09,,,1:02:05,3725,0'
  ].join('\r\n') + '\r\n');
  assert.equal(toCsv([]), CSV_HEADER.join(',') + '\r\n');
});

test('the CSV quotes commas, quotes and new lines, and keeps a formula from being one', () => {
  const csv = toCsv([{ at, ms: 1000, program: 'A, B', step: 'say "hi"\nthen', limitSec: 0 }, { at, ms: 1000, program: '=1+1', step: '@x', limitSec: 0 }]);
  const lines = csv.split('\r\n');
  assert.ok(lines[1].startsWith("2026-10-21 14:05:09,'=1+1,'@x,"));
  assert.ok(csv.includes('"A, B","say ""hi""\nthen"'));
});

test('time stamp and file name use the local date', () => {
  assert.equal(stampText(at), '2026-10-21 14:05:09');
  assert.equal(csvFileName(new Date(2026, 9, 5)), 'mictime-speeches-2026-10-05.csv');
});
