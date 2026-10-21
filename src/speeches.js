// The speeches of this session: the last ones the timer measured, newest first. Pure code (no Electron, no DOM), unit tested.
// Kept in memory only: nothing is written to disk unless the user saves the CSV, and nothing survives closing the app.
import { formatDuration } from './trigger/stopwatch.js';

export const MAX_SPEECHES = 20;
export const CSV_HEADER = ['time', 'program', 'step', 'duration', 'seconds', 'limit_seconds'];

// entry: { at (ms since epoch), ms (length of the speech), program, step (names, may be empty), limitSec (0 = no limit) }
export function createSpeechLog(max = MAX_SPEECHES) {
  let list = [];
  return {
    add(e) {
      const ms = Math.max(0, Math.round(Number(e.ms) || 0));
      list = [{ at: Number(e.at) || 0, ms, program: String(e.program || ''), step: String(e.step || ''), limitSec: Math.max(0, Number(e.limitSec) || 0) }, ...list].slice(0, max);
    },
    list: () => list.map((e) => ({ ...e })),
    clear() { list = []; },
    get size() { return list.length; }
  };
}

const pad = (n) => String(n).padStart(2, '0');
// local date and time, "2026-10-21 14:05:09": what a spreadsheet reads as a date
export const stampText = (at) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// A name typed by the user can start with = + - @ (a spreadsheet would read it as a formula): a quote in front keeps it text.
function cell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// oldest first in the file, as a log is read
export function toCsv(entries) {
  const rows = [...entries].reverse().map((e) => [stampText(e.at), e.program, e.step, formatDuration(e.ms), Math.round(e.ms / 1000), e.limitSec]);
  return [CSV_HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export const csvFileName = (d = new Date()) => `mictime-speeches-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
