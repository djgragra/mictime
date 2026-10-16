// Settings: defaults and validation. Everything read from disk or from an imported file goes through
// sanitizeSettings(), so nothing unchecked reaches the rest of the app. Pure code, unit tested.
import { normalizeBinding, ACTIONS } from './trigger/midi.js';
import { normalizeAccelerator } from './trigger/keys.js';

export const APP_ID = 'com.onairgarage.mictime';
export const APP_SLUG = 'mictime'; // the "app" field of a backup file (apps/COMMON-FEATURES.md)
export const isOwnFile = (app) => app === undefined || app === APP_SLUG || app === APP_ID;
export const SETTINGS_VERSION = 1;

export const REPO_LINKS = [
  'https://onairgarage.com/tools/mictime/',
  'https://onairgarage.com',
  'https://github.com/djgragra/mictime',
  'https://github.com/djgragra/mictime/releases',
  'https://github.com/djgragra/mictime/blob/main/README.md',
  'https://github.com/djgragra/mictime/blob/main/docs/MANUAL.md',
  'https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md'
];

export const LIMITS = {
  holdSeconds: [1, 600],
  debounceMs: [0, 2000],
  thresholdDb: [-80, -5],
  audioHoldMs: [200, 60000],
  nameLen: 200
};

export function defaults() {
  return {
    version: SETTINGS_VERSION,
    language: 'en',
    theme: 'dark', // dark | light | system
    alwaysOnTop: false,
    checkUpdates: true,
    timer: {
      mode: 'toggle', // toggle: one signal starts and the next stops | separate: start and stop are different signals
      holdSeconds: 5, // the total stays on screen this long, then back to zero
      debounceMs: 300 // a second start/stop within this time is taken as the same press
    },
    midi: {
      enabled: true,
      input: '', // name of the input port; '' = all inputs
      bindings: { toggle: null, start: null, stop: null, reset: null }
    },
    key: {
      enabled: true,
      global: true, // works with another program in front (where the system allows it)
      keys: { toggle: '', start: '', stop: '', reset: '' }
    },
    audio: {
      enabled: false, // off until the user chooses an input: needs the microphone permission of the system
      device: '', // deviceId of the input; '' = system default
      deviceLabel: '',
      thresholdDb: -40,
      holdMs: 3000 // the level must stay below the threshold this long to stop
    }
  };
}

const clampInt = (v, [lo, hi], fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
export const cleanText = (v, max = LIMITS.nameLen) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

// `input` is anything (an imported file, a patch); `base` is what is kept where `input` says nothing.
export function sanitizeSettings(input, base = defaults()) {
  const i = input && typeof input === 'object' ? input : {};
  const def = defaults();
  const b = { ...def, ...base };
  const t = { ...def.timer, ...(base?.timer || {}), ...(i.timer || {}) };
  const m = { ...def.midi, ...(base?.midi || {}), ...(i.midi || {}) };
  const k = { ...def.key, ...(base?.key || {}), ...(i.key || {}) };
  const a = { ...def.audio, ...(base?.audio || {}), ...(i.audio || {}) };
  const mb = { ...(base?.midi?.bindings || {}), ...(i.midi?.bindings || {}) };
  const kk = { ...(base?.key?.keys || {}), ...(i.key?.keys || {}) };
  return {
    version: SETTINGS_VERSION,
    language: oneOf(i.language ?? b.language, ['en', 'it', 'es'], 'en'),
    theme: oneOf(i.theme ?? b.theme, ['dark', 'light', 'system'], 'dark'),
    alwaysOnTop: bool(i.alwaysOnTop, bool(b.alwaysOnTop, false)),
    checkUpdates: bool(i.checkUpdates, bool(b.checkUpdates, true)),
    timer: {
      mode: oneOf(t.mode, ['toggle', 'separate'], 'toggle'),
      holdSeconds: clampInt(t.holdSeconds, LIMITS.holdSeconds, def.timer.holdSeconds),
      debounceMs: clampInt(t.debounceMs, LIMITS.debounceMs, def.timer.debounceMs)
    },
    midi: {
      enabled: bool(m.enabled, true),
      input: cleanText(m.input),
      bindings: Object.fromEntries(ACTIONS.map((n) => [n, normalizeBinding(mb[n])]))
    },
    key: {
      enabled: bool(k.enabled, true),
      global: bool(k.global, true),
      keys: Object.fromEntries(ACTIONS.map((n) => [n, normalizeAccelerator(kk[n]) || '']))
    },
    audio: {
      enabled: bool(a.enabled, false),
      device: cleanText(a.device),
      deviceLabel: cleanText(a.deviceLabel),
      thresholdDb: clampInt(a.thresholdDb, LIMITS.thresholdDb, def.audio.thresholdDb),
      holdMs: clampInt(a.holdMs, LIMITS.audioHoldMs, def.audio.holdMs)
    }
  };
}

// An imported file: { app, settings } or the bare settings. Throws 'foreign' / 'invalid'.
export function parseImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
  if (!isOwnFile(parsed.app)) throw new Error('foreign');
  const body = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
  return sanitizeSettings(body, defaults());
}
