// Settings: defaults and validation. Everything read from disk or from an imported file goes through
// sanitizeSettings(), so nothing unchecked reaches the rest of the app. Pure code, unit tested.
import { normalizeBinding, BINDING_NAMES } from './trigger/midi.js';
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

// The tip jar page of the site, one per language. Opened in the system browser; never a payment link, so the
// app does not change if the site changes its payment provider.
export const TIP_LINKS = {
  en: 'https://onairgarage.com/support/',
  it: 'https://onairgarage.com/it/support/',
  es: 'https://onairgarage.com/es/support/'
};
export const tipUrl = (lang) => TIP_LINKS[lang] || TIP_LINKS.en;

// What may open in the system browser: the fixed project addresses, the tip jar page and the repository's release pages.
export const isAllowedExternal = (url, repo) =>
  typeof url === 'string' && (REPO_LINKS.includes(url) || Object.values(TIP_LINKS).includes(url) || url.startsWith(`https://github.com/${repo}/releases/`));

export const LIMITS = {
  holdSeconds: [1, 600],
  debounceMs: [0, 2000],
  thresholdDb: [-80, -5],
  audioHoldMs: [200, 60000],
  warnSeconds: [0, 3600],
  flashSeconds: [0, 3600],
  stepSeconds: [0, 36000], // 0 = no limit
  limitSeconds: [0, 36000], // the single limit used when no program is active; 0 = no limit
  programs: 8,
  steps: 40,
  programName: 60,
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
      holdForever: false, // true: the total stays until the next start or a reset
      limitSeconds: 0, // the time limit when no program is active (a program has a limit for each step); 0 = no limit
      debounceMs: 300, // a second start/stop within this time is taken as the same press
      warnSeconds: 10, // the figures turn to the warning colour this many seconds before the limit
      flashSeconds: 10 // and blink slowly when the limit is passed by this many seconds
    },
    // Colours of the figures: '#rrggbb', or '' for the default of the theme.
    colors: { normal: '', warn: '', over: '', idle: '' },
    // Programs: lists of steps { name, sec } (sec 0 = no limit). The active one arms the limit of the current step and
    // moves on after every speech. '' = no program, no limit. At the end: 'loop' (back to the first step) or 'free'.
    programs: [],
    activeProgram: '',
    programEnd: 'loop',
    midi: {
      enabled: true,
      input: '', // name of the input port; '' = all inputs
      bindings: Object.fromEntries(BINDING_NAMES.map((n) => [n, null]))
    },
    key: {
      enabled: true,
      global: true, // works with another program in front (where the system allows it)
      keys: Object.fromEntries(BINDING_NAMES.map((n) => [n, '']))
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
const hexColor = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : '');

// -> a clean list of programs: at most 8, each with at most 40 steps, ids unique, names and limits checked.
export function sanitizePrograms(input) {
  const out = [];
  const seen = new Set();
  for (const p of Array.isArray(input) ? input : []) {
    if (!p || typeof p !== 'object' || out.length >= LIMITS.programs) continue;
    let id = cleanText(p.id, 40);
    if (!id || seen.has(id)) id = `p${out.length + 1}-${Math.random().toString(36).slice(2, 7)}`;
    seen.add(id);
    const steps = (Array.isArray(p.steps) ? p.steps : []).slice(0, LIMITS.steps).filter((x) => x && typeof x === 'object')
      .map((x) => ({ name: cleanText(x.name, LIMITS.programName), sec: clampInt(x.sec, LIMITS.stepSeconds, 0) }));
    out.push({ id, name: cleanText(p.name, LIMITS.programName) || 'Program', steps });
  }
  return out;
}

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
  const col = { ...(base?.colors || {}), ...(i.colors || {}) };
  const programs = sanitizePrograms(i.programs ?? base?.programs ?? []);
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
      holdForever: bool(t.holdForever, false),
      limitSeconds: clampInt(t.limitSeconds, LIMITS.limitSeconds, 0),
      debounceMs: clampInt(t.debounceMs, LIMITS.debounceMs, def.timer.debounceMs),
      warnSeconds: clampInt(t.warnSeconds, LIMITS.warnSeconds, def.timer.warnSeconds),
      flashSeconds: clampInt(t.flashSeconds, LIMITS.flashSeconds, def.timer.flashSeconds)
    },
    colors: { normal: hexColor(col.normal), warn: hexColor(col.warn), over: hexColor(col.over), idle: hexColor(col.idle) },
    programs,
    activeProgram: programs.some((p) => p.id === (i.activeProgram ?? base?.activeProgram)) ? (i.activeProgram ?? base?.activeProgram) : '',
    programEnd: oneOf(i.programEnd ?? base?.programEnd, ['loop', 'free'], 'loop'),
    midi: {
      enabled: bool(m.enabled, true),
      input: cleanText(m.input),
      bindings: Object.fromEntries(BINDING_NAMES.map((n) => [n, normalizeBinding(mb[n])]))
    },
    key: {
      enabled: bool(k.enabled, true),
      global: bool(k.global, true),
      keys: Object.fromEntries(BINDING_NAMES.map((n) => [n, normalizeAccelerator(kk[n]) || '']))
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
