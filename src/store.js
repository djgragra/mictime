import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Store from 'electron-store';
import { defaults, sanitizeSettings } from './schema.js';

// Read before the store is created: creating it writes the file with its defaults.
const existedBefore = fs.existsSync(path.join(app.getPath('userData'), 'mictime-data.json'));

const store = new Store({
  name: 'mictime-data',
  defaults: {
    settings: defaults(),
    windowBounds: { width: 1100, height: 640 },
    // the compact view remembers its own size and place, apart from the normal window
    compactBounds: { width: 320, height: 140 },
    // kept apart from the settings on purpose: not part of a backup, not reset by an import
    updateState: { skipVersion: '', remindUntil: 0, lastCheck: null },
    lastSeenVersion: '',
    // the step each program is at: { <programId>: index }. Runtime state, not part of the settings or of a backup.
    programIndex: {}
  }
});

export const hadSettingsFile = existedBefore;
export const settingsFile = () => store.path;

store.set('settings', sanitizeSettings(store.get('settings'), defaults()));

export const getSettings = () => store.get('settings');
export function updateSettings(patch) {
  const next = sanitizeSettings(patch, getSettings());
  store.set('settings', next);
  return next;
}
export function replaceSettings(settings) {
  store.set('settings', settings);
  return settings;
}
export const getWindowBounds = () => store.get('windowBounds');
export const setWindowBounds = (b) => store.set('windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
export const getCompactBounds = () => store.get('compactBounds');
export const setCompactBounds = (b) => store.set('compactBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
export const getUpdateState = () => store.get('updateState');
export function setUpdateState(patch) {
  store.set('updateState', { ...getUpdateState(), ...patch });
  return getUpdateState();
}
export const getLastSeenVersion = () => store.get('lastSeenVersion');
export const setLastSeenVersion = (v) => store.set('lastSeenVersion', String(v || ''));
export const getProgramIndex = () => store.get('programIndex');
export function setProgramIndex(id, index) {
  const all = { ...getProgramIndex(), [id]: index };
  // forget programs that no longer exist
  const alive = new Set(getSettings().programs.map((p) => p.id));
  store.set('programIndex', Object.fromEntries(Object.entries(all).filter(([k]) => alive.has(k))));
}
