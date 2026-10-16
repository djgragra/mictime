// garage-common: backup 1
// Configuration backup (apps/COMMON-FEATURES.md, section 3). Pure code: the main process only asks for files.
// MicTime holds no passwords or tokens, so the file never carries secrets and there is no "include passwords" box.
// What it keeps: the signal mappings (MIDI messages, keys, audio gate), the timer mode and times, the programs, the colours,
// language and theme.
// Not in it: the choice made about updates, the window position, logs.
import { APP_SLUG, isOwnFile, parseImport, sanitizeSettings } from './schema.js';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5_000_000;

const pad = (n) => String(n).padStart(2, '0');
export const backupFileName = (d = new Date()) => `${APP_SLUG}-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

export function buildBackup(settings, now = new Date()) {
  return { app: APP_SLUG, version: BACKUP_VERSION, exportedAt: now.toISOString(), includesSecrets: false, settings: structuredClone(settings) };
}

// -> the complete settings the file describes (what it does not carry keeps its default), validated like saved settings.
// Throws 'foreign' for another app's file and 'invalid' for anything unreadable.
export function prepareImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
  if (!isOwnFile(parsed.app)) throw new Error('foreign');
  return parseImport(parsed);
}

// "Add only the missing items": the mappings the file has and this computer has not (an empty slot) are filled in, and
// the programs of the file that this computer lacks (by id) are added; everything already set here stays as it is.
export function missingItems(current, incoming) {
  const fill = (have, extra, empty) => Object.fromEntries(Object.keys({ ...have, ...extra }).map((k) => [k, empty(have[k]) ? extra[k] ?? have[k] : have[k]]));
  const have = new Set(current.programs.map((p) => p.id));
  return {
    midi: { bindings: fill(current.midi.bindings, incoming.midi.bindings, (v) => !v) },
    key: { keys: fill(current.key.keys, incoming.key.keys, (v) => !v) },
    colors: fill(current.colors, incoming.colors, (v) => !v),
    programs: [...current.programs, ...incoming.programs.filter((p) => !have.has(p.id))]
  };
}

// What has to be typed again after an import: nothing here, MicTime keeps no secrets. Kept so every app answers the same way.
export const missingSecrets = () => [];

// 'replace' or 'add' (only the empty mappings are filled).
export function applyImport(current, incoming, mode) {
  if (mode === 'replace') return incoming;
  if (mode === 'add') return sanitizeSettings(missingItems(current, incoming), current);
  throw new Error('invalid-mode');
}
