import { app, BrowserWindow, Menu, clipboard, dialog, globalShortcut, ipcMain, net, powerSaveBlocker, screen, session, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaults, isAllowedExternal } from './src/schema.js';
import {
  getSettings, updateSettings, replaceSettings, getWindowBounds, setWindowBounds, getCompactBounds, setCompactBounds,
  getUpdateState, setUpdateState, getLastSeenVersion, setLastSeenVersion, hadSettingsFile, settingsFile, getProgramIndex, setProgramIndex
} from './src/store.js';
import {
  checkForUpdate, downloadInstaller, sweepPartials, bannerState, remindLaterState, skipVersionState, makeSafetyCopy, installPlan,
  whatsNew, startupKind, REPO
} from './src/updater.js';
import { buildBackup, prepareImport, applyImport, backupFileName, MAX_BACKUP_BYTES } from './src/backup.js';
import { createLogger } from './src/logs.js';
import { csvFileName } from './src/speeches.js';
import { buildSupportInfo } from './src/support.js';
import { resolveLanguage, resolveLocale, T } from './src/i18n.js';
import { globalAllowed, toElectron, normalizeAccelerator, BINDING_NAMES } from './src/trigger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Daily log files (5 MB at most each, 7 days kept). Nothing secret is ever written: MicTime has none.
const logDir = path.join(app.getPath('userData'), 'logs');
const logger = createLogger({ dir: logDir, prefix: 'mictime' });
logger.prune();
process.on('uncaughtExceptionMonitor', (err) => logger.log('error', `uncaught: ${err?.message || err}`, 'main'));

// One timer at a time: a second launch just brings the first one forward.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

let mainWindow = null;
let powerBlockerId = null;

const send = (channel, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
};

// ---- window ----------------------------------------------------------------------------

// The remembered place, if it is still on a screen; otherwise only the size.
function visibleBounds(b) {
  const visible = b.x !== undefined && b.y !== undefined && screen.getAllDisplays().some((d) => {
    const w = d.workArea;
    return b.x < w.x + w.width - 40 && b.x + b.width > w.x + 40 && b.y < w.y + w.height - 40 && b.y + b.height > w.y + 40;
  });
  return visible ? b : { width: b.width, height: b.height };
}
const initialBounds = () => visibleBounds(getWindowBounds());

// ---- compact view: a small always-on-top window with the figures only ----
const COMPACT_MIN = { width: 160, height: 70 };
const NORMAL_MIN = { width: 520, height: 320 };
let compact = false;
let normalBounds = null;

function setCompact(on) {
  if (!mainWindow || mainWindow.isDestroyed() || on === compact) return compact;
  if (on) {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    normalBounds = mainWindow.getBounds();
    compact = true;
    mainWindow.setMinimumSize(COMPACT_MIN.width, COMPACT_MIN.height);
    const b = visibleBounds(getCompactBounds());
    mainWindow.setBounds({ ...b, width: Math.max(COMPACT_MIN.width, b.width), height: Math.max(COMPACT_MIN.height, b.height) });
  } else {
    compact = false;
    mainWindow.setMinimumSize(NORMAL_MIN.width, NORMAL_MIN.height);
    if (normalBounds) mainWindow.setBounds(normalBounds);
  }
  applyWindowSettings(getSettings());
  send('event:compact', compact);
  logger.log('info', `compact view ${compact ? 'on' : 'off'}`, 'window');
  return compact;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...initialBounds(),
    minWidth: NORMAL_MIN.width,
    minHeight: NORMAL_MIN.height,
    show: false,
    title: 'MicTime',
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // MIDI messages and the audio level must keep arriving when the window is hidden or behind another one
      backgroundThrottling: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());

  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      e.preventDefault();
      if (compact) setCompact(false);
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'Escape' && compact) {
      e.preventDefault();
      setCompact(false);
    } else if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      e.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });
  mainWindow.on('enter-full-screen', () => send('event:fullscreen', true));
  mainWindow.on('leave-full-screen', () => send('event:fullscreen', false));

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  let boundsTimer = null;
  const persistBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen() || mainWindow.isMaximized()) return;
      (compact ? setCompactBounds : setWindowBounds)(mainWindow.getBounds());
    }, 400);
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Permissions: the page may use MIDI (it asks for note, controller and program messages only) and, only to read a level, the audio
// input. Nothing else: no camera, no screen, no notifications. The page never talks to the network.
function lockDownSession() {
  const ses = session.defaultSession;
  const ok = (perm, details) => {
    // Electron asks for 'midiSysex' for every Web MIDI request, even one made with { sysex: false } (seen in 26.10.1 testing).
    // The page never asks for system exclusive access and no code reads such messages.
    if (perm === 'midi' || perm === 'midiSysex') return true;
    if (perm === 'media') return !details?.mediaTypes || details.mediaTypes.every((t) => t === 'audio');
    return false;
  };
  ses.setPermissionRequestHandler((_wc, perm, cb, details) => { cb(ok(perm, details)); });
  ses.setPermissionCheckHandler((_wc, perm, _origin, details) => { return ok(perm, details); });
  ses.webRequest.onBeforeRequest((details, cb) => {
    const local = /^(file|data|devtools|chrome-extension):/i.test(details.url);
    cb({ cancel: !!details.webContentsId && !local });
  });
}

function buildMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }, { label: 'Compact view', accelerator: 'CmdOrCtrl+Shift+C', click: () => setCompact(!compact) }, { role: 'minimize' }] },
      { role: 'windowMenu' }
    ])
  );
}

// ---- global keys -------------------------------------------------------------------------
// A key assigned in Settings is registered with the system when "global" is on and the key is allowed to be global
// (a modifier, an F key, a numpad or media key). What the system refuses is reported: the page then handles that key
// only while the window is in front.

let keyStatus = { global: {}, failed: [] };
let capturing = false;

function applyKeys() {
  globalShortcut.unregisterAll();
  const s = getSettings();
  const status = { global: {}, failed: [] };
  if (!capturing && s.key.enabled && s.key.global) {
    const used = new Set();
    for (const name of BINDING_NAMES) {
      const accel = normalizeAccelerator(s.key.keys[name]);
      if (!accel || !globalAllowed(accel) || used.has(accel)) continue;
      used.add(accel);
      let ok = false;
      try {
        ok = globalShortcut.register(toElectron(accel), () => send('event:signal', { source: 'key', accel }));
      } catch {
        ok = false;
      }
      if (ok) status.global[accel] = true;
      else status.failed.push(accel);
    }
    if (status.failed.length) logger.log('warn', `${status.failed.length} global shortcut(s) refused by the system`, 'keys');
  }
  keyStatus = status;
  send('event:key-status', keyStatus);
}

function applyWindowSettings(s) {
  if (mainWindow) mainWindow.setAlwaysOnTop(s.alwaysOnTop || compact, 'floating');
  // the PC must not sleep while MicTime waits for a signal on the air
  if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
}

const sig = (o) => JSON.stringify(o);
function afterSettingsChange(prev) {
  const next = getSettings();
  applyWindowSettings(next);
  if (sig(prev.key) !== sig(next.key)) applyKeys();
}

const payload = () => ({ settings: getSettings(), lang: resolveLanguage(), locale: resolveLocale(), platform: process.platform, keyStatus, programIndex: getProgramIndex() });

// ---- IPC ---------------------------------------------------------------------------------

// Only our own window may call the main process.
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('untrusted sender');
    return fn(...args);
  });
}

handle('settings:get', () => payload());
handle('settings:update', (patch) => {
  const prev = getSettings();
  updateSettings(patch);
  afterSettingsChange(prev);
  return payload();
});
handle('keys:status', () => keyStatus);
handle('runtime:get', () => ({ programIndex: getProgramIndex() }));
handle('runtime:set', (id, index) => {
  if (typeof id !== 'string' || id.length > 40 || !Number.isInteger(index) || index < 0 || index > 1000) return false;
  setProgramIndex(id, index);
  return true;
});
handle('keys:capture', (on) => {
  capturing = !!on;
  applyKeys();
  return true;
});

// ---- backup and restore (apps/COMMON-FEATURES.md, section 3) -----------------------------------------

handle('backup:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('exportTitle'),
    defaultPath: path.join(app.getPath('documents'), backupFileName()),
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(res.filePath, JSON.stringify(buildBackup(getSettings()), null, 2), 'utf-8');
    logger.log('info', 'backup exported', 'backup');
    return { ok: true };
  } catch (err) {
    logger.log('error', `backup export failed: ${err.code || err.message}`, 'backup');
    return { ok: false, error: err.message };
  }
});

handle('backup:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: T('importTitle'),
    properties: ['openFile'],
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  try {
    const file = res.filePaths[0];
    if (fs.statSync(file).size > MAX_BACKUP_BYTES) return { ok: false, error: 'too-large' };
    const incoming = prepareImport(JSON.parse(fs.readFileSync(file, 'utf-8')));
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      message: T('importModeMessage'),
      detail: T('importModeDetail'),
      buttons: [T('importReplace'), T('importAdd'), T('cancel')],
      defaultId: 1,
      cancelId: 2
    });
    if (response === 2) return { ok: false, canceled: true };
    const mode = response === 0 ? 'replace' : 'add';
    const prev = getSettings();
    replaceSettings(applyImport(prev, incoming, mode));
    afterSettingsChange(prev);
    logger.log('info', `backup imported (${mode})`, 'backup');
    return { ok: true, mode, mustRetype: [], ...payload() };
  } catch (err) {
    logger.log('warn', `backup import refused: ${err.message === 'foreign' ? 'other app' : 'unreadable'}`, 'backup');
    return { ok: false, error: err.message === 'foreign' ? 'foreign' : 'invalid' };
  }
});

handle('settings:reset', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    message: T('resetMessage'),
    detail: T('resetDetail'),
    buttons: [T('reset'), T('cancel')],
    defaultId: 1,
    cancelId: 1
  });
  if (response !== 0) return { ok: false, canceled: true };
  const prev = getSettings();
  replaceSettings(defaults());
  afterSettingsChange(prev);
  logger.log('info', 'settings reset to the defaults', 'settings');
  return { ok: true, ...payload() };
});

handle('clipboard:write', (text) => {
  if (typeof text !== 'string' || text.length > 200_000) return { ok: false };
  clipboard.writeText(text);
  return { ok: true };
});

handle('window:set-compact', (on) => setCompact(!!on));

handle('speeches:save', async (csv) => {
  if (typeof csv !== 'string' || csv.length > 200_000) return { ok: false };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('csvTitle'),
    defaultPath: path.join(app.getPath('documents'), csvFileName()),
    filters: [{ name: T('csvFilter'), extensions: ['csv'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    // written under a temporary name and renamed, so a failed write never leaves half a file
    const tmp = `${res.filePath}.part`;
    fs.writeFileSync(tmp, csv, 'utf-8');
    fs.renameSync(tmp, res.filePath);
    logger.log('info', 'speeches saved as CSV', 'speeches');
    return { ok: true };
  } catch (err) {
    logger.log('error', `speeches CSV failed: ${err.code || err.message}`, 'speeches');
    return { ok: false, error: err.message };
  }
});

handle('window:toggle-fullscreen', () => {
  if (compact) setCompact(false);
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

// Only the fixed project addresses, the tip jar page of the site and this app's own release pages open in the system browser.
const allowedExternal = (url) => isAllowedExternal(url, REPO);
handle('links:open', async (url) => {
  if (!allowedExternal(url)) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
});

handle('app:info', () => ({ name: 'MicTime', version: app.getVersion(), electron: process.versions.electron, platform: process.platform, arch: process.arch }));

// Version, system, language, last update check and last error. Never settings values or file names.
handle('app:support-info', () =>
  buildSupportInfo({
    app: 'MicTime',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    language: resolveLanguage(),
    lastCheck: getUpdateState().lastCheck,
    lastError: logger.entries().filter((e) => e.level === 'error').at(-1),
    home: os.homedir()
  }));

handle('logs:open', async () => {
  fs.mkdirSync(logDir, { recursive: true });
  const err = await shell.openPath(logDir);
  return { ok: !err };
});

// The page reports its own events (MIDI input connected, audio permission refused…): fixed messages only, no values.
handle('app:log', (level, message) => {
  if (!['info', 'warn', 'error'].includes(level) || typeof message !== 'string') return false;
  logger.log(level, message.slice(0, 200), 'ui');
  return true;
});

// ---- guided update (apps/COMMON-FEATURES.md, section 4) --------------------------------------------------

let lastUpdateInfo = null;
let downloadedInstaller = null; // { version, file }
let installerDownload = null;
let downloadAbort = null;
let startKind = 'same';

const downloadsDir = () => app.getPath('downloads');

const publicInfo = (info) =>
  info && {
    ok: info.ok,
    current: info.current,
    latest: info.latest,
    available: !!info.available,
    url: info.url,
    notes: info.notes || '',
    canInstall: !!(info.installer && info.sumsUrl),
    installerName: info.installer?.name || '',
    error: info.ok ? '' : String(info.error || '')
  };

function updateView(info) {
  const ready = downloadedInstaller && info?.available && downloadedInstaller.version === info.latest && fs.existsSync(downloadedInstaller.file);
  return {
    info: publicInfo(info),
    banner: bannerState(info, getUpdateState()),
    lastCheck: getUpdateState().lastCheck,
    downloading: !!installerDownload,
    downloaded: ready ? path.basename(downloadedInstaller.file) : null
  };
}

async function runUpdateCheck({ manual = false } = {}) {
  const info = await checkForUpdate({ current: app.getVersion(), fetchFn: net.fetch });
  if (info.ok) lastUpdateInfo = info;
  setUpdateState({ lastCheck: { at: Date.now(), ok: !!info.ok, error: info.ok ? '' : String(info.error || '').slice(0, 200) } });
  logger.log(info.ok ? 'info' : 'warn', info.ok ? `update check: ${info.available ? `${info.latest} available` : 'up to date'}` : `update check failed: ${info.error}`, 'update');
  const view = updateView(info);
  if (!manual && view.banner === 'show') send('event:update-available', view);
  return view;
}

handle('update:check', () => runUpdateCheck({ manual: true }));
handle('update:status', () => updateView(lastUpdateInfo));

handle('update:download', async () => {
  const info = lastUpdateInfo;
  if (!info?.available) return { ok: false, error: 'no-update' };
  if (downloadedInstaller?.version === info.latest && fs.existsSync(downloadedInstaller.file)) return { ok: true, version: info.latest };
  if (!installerDownload) {
    sweepPartials(downloadsDir());
    downloadAbort = new AbortController();
    installerDownload = downloadInstaller({
      info,
      dir: downloadsDir(),
      fetchFn: net.fetch,
      current: app.getVersion(),
      signal: downloadAbort.signal,
      onProgress: (received, total) => send('event:update-progress', { received, total })
    })
      .then((file) => {
        downloadedInstaller = { version: info.latest, file };
        logger.log('info', `update ${info.latest} downloaded and verified (SHA-256)`, 'update');
        return { ok: true, version: info.latest };
      })
      .catch((err) => {
        if (!err.cancelled) logger.log('warn', `update download failed: ${err.message}`, 'update');
        return { ok: false, error: err.message };
      })
      .finally(() => {
        installerDownload = null;
        downloadAbort = null;
      });
  }
  return installerDownload;
});

handle('update:cancel', () => {
  downloadAbort?.abort();
  return true;
});
handle('update:remind', () => {
  setUpdateState(remindLaterState(getUpdateState()));
  return updateView(lastUpdateInfo);
});
handle('update:skip', () => {
  setUpdateState(skipVersionState(getUpdateState(), lastUpdateInfo?.latest));
  return updateView(lastUpdateInfo);
});

// "Close and install": a safety copy of the settings first. If a count is running the user is asked before the app closes.
handle('update:install', async (opts) => {
  const d = downloadedInstaller;
  if (!d || !fs.existsSync(d.file)) return { ok: false, error: 'no-installer' };
  if (opts?.busy) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      message: T('installBusyMessage'),
      detail: T('installBusyDetail'),
      buttons: [T('installAnyway'), T('cancel')],
      defaultId: 1,
      cancelId: 1
    });
    if (response !== 0) return { ok: false, error: 'busy' };
  }
  try {
    makeSafetyCopy({ file: settingsFile(), dir: path.join(app.getPath('userData'), 'backups'), version: lastUpdateInfo?.current || app.getVersion() });
  } catch (err) {
    logger.log('error', `safety copy failed: ${err.code || err.message}`, 'update');
    return { ok: false, error: 'safety-copy' };
  }
  const plan = installPlan(process.platform, d.file);
  logger.log('info', `installing update ${d.version} (${plan.kind})`, 'update');
  if (plan.kind === 'run-installer') {
    spawn(plan.file, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 500);
  } else if (plan.kind === 'open-image') {
    await shell.openPath(plan.file);
  } else {
    shell.showItemInFolder(plan.file);
  }
  return { ok: true, hint: plan.hint || '' };
});

handle('whatsnew:get', () => {
  if (startKind !== 'updated') return null;
  try {
    return whatsNew(fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf-8'), app.getVersion());
  } catch {
    return null;
  }
});
handle('whatsnew:seen', () => {
  startKind = 'same';
  setLastSeenVersion(app.getVersion());
  return true;
});

// ---- lifecycle ---------------------------------------------------------------------------

app.whenReady().then(() => {
  startKind = startupKind(getLastSeenVersion(), app.getVersion(), hadSettingsFile);
  if (startKind === 'first') setLastSeenVersion(app.getVersion());
  logger.log('info', `MicTime ${app.getVersion()} started (${process.platform} ${process.arch}, ${startKind})`, 'app');
  const stale = sweepPartials(downloadsDir());
  if (stale.length) logger.log('info', `removed ${stale.length} unfinished installer download(s) left by an earlier run`, 'update');
  lockDownSession();
  buildMenu();
  createWindow();
  applyWindowSettings(getSettings());
  applyKeys();
  if (getSettings().checkUpdates) {
    setTimeout(runUpdateCheck, 15_000);
    setInterval(runUpdateCheck, 24 * 3600_000);
  }
});

app.on('before-quit', () => downloadAbort?.abort());
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
