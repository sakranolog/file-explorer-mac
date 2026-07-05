import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC, type UpdateState } from '../shared/types'

/**
 * Over-the-air updates backed by GitHub Releases.
 *
 * On launch (packaged builds only) we check the project's GitHub Releases for a
 * newer version, download it in the background, and — once it's staged — push an
 * `update-downloaded` state to the renderer so it can show a "Restart to update"
 * banner. The actual swap happens on `quitAndInstall()` (the banner button) or
 * automatically on the next quit (`autoInstallOnAppQuit`).
 *
 * The update feed (owner/repo) and the manifest (`latest-mac.yml`) come from the
 * `build.publish` config in package.json; electron-updater reads them at runtime.
 *
 * Updates are OFF in dev / tests (auto-update needs a signed, packaged app on a
 * real install path) and can be force-disabled with FE_NO_UPDATES. macOS
 * auto-update additionally requires the app be code-signed — which our release
 * builds are (Developer ID + notarized).
 */

/** A string env var that means "yes" — anything but empty/0/false. */
function truthy(v: string | undefined): boolean {
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
}

/** True only for packaged builds where the user hasn't opted out. */
function updatesEnabled(): boolean {
  if (truthy(process.env['FE_NO_UPDATES'])) return false
  // Never reach out from dev runs or the test suite unless explicitly forced.
  if (!app.isPackaged && !truthy(process.env['FE_UPDATES_DEBUG'])) return false
  return true
}

/** Whether the in-flight check was triggered by the user ("Check for Updates…"). */
let pendingManual = false

/** Version of the update currently being downloaded (from `update-available`). */
let pendingVersion = ''

/**
 * True from the moment a check starts until it reaches a terminal state
 * (not-available / downloaded / error). While set, a manual "Check for
 * Updates…" must NOT call checkForUpdates() again: with autoDownload on, the
 * launch auto-check is usually still downloading, and a second concurrent
 * download of the same file makes the final temp-file rename fail with ENOENT —
 * the update dies at 100%.
 */
let activityInFlight = false

/** Last state broadcast, so a manual re-check can re-surface live progress. */
let lastBroadcast: UpdateState | null = null

/** Push an update lifecycle state to every open window. */
function broadcast(state: UpdateState): void {
  lastBroadcast = state
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.updateStatus, state)
  }
}

/** Wire autoUpdater's events to renderer broadcasts. Call once, before checking. */
function wireEvents(): void {
  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking', manual: pendingManual })
  })
  autoUpdater.on('update-available', (info) => {
    // Stays `manual` through the download so the renderer keeps any progress UI.
    pendingVersion = info.version
    broadcast({ status: 'available', version: info.version, manual: pendingManual })
  })
  autoUpdater.on('update-not-available', () => {
    broadcast({ status: 'not-available', manual: pendingManual })
    pendingManual = false
    activityInFlight = false
  })
  autoUpdater.on('download-progress', (p) => {
    // The update can be large; a manual check must keep showing progress or the
    // UI looks like the update silently died ("downloading… then nothing").
    broadcast({
      status: 'downloading',
      version: pendingVersion,
      percent: Math.round(p.percent),
      manual: pendingManual
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ status: 'downloaded', version: info.version })
    pendingManual = false
    activityInFlight = false
  })
  autoUpdater.on('error', (err) => {
    broadcast({ status: 'error', message: err?.message ?? String(err), manual: pendingManual })
    pendingManual = false
    activityInFlight = false
  })
}

let initialized = false

/**
 * Configure auto-update and kick off the first background check. Safe to call
 * unconditionally on app ready — it no-ops in dev/tests and never throws.
 */
export function initAutoUpdater(): void {
  if (initialized || !updatesEnabled()) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Log lifecycle to stdout so a packaged app launched from a terminal can be
  // diagnosed; updates otherwise fail invisibly.
  autoUpdater.logger = console

  wireEvents()
  // First check shortly after launch so it never competes with window paint.
  void runCheck(false)
}

/** Run a check, swallowing the promise rejection (errors arrive via the event). */
function runCheck(manual: boolean): Promise<unknown> {
  pendingManual = manual
  activityInFlight = true
  return autoUpdater.checkForUpdates().catch(() => {
    // The 'error' event already broadcast a user-facing message.
  })
}

/**
 * Manually check for updates (the "Check for Updates…" menu item). When updates
 * are disabled (dev / opted out) it tells the user rather than silently failing.
 */
export function checkForUpdates(): void {
  if (!updatesEnabled()) {
    broadcast({
      status: 'error',
      manual: true,
      message: 'Updates are only available in the installed app.'
    })
    return
  }
  if (!initialized) {
    // initAutoUpdater kicks off the first check itself; adopt it as manual
    // (after — its runCheck(false) resets the flag).
    initAutoUpdater()
    pendingManual = true
    return
  }
  if (activityInFlight) {
    // The launch auto-check is still working (often mid-download). Starting a
    // second concurrent download corrupts the staged file, so instead adopt the
    // in-flight one as manual and re-surface its current state in the UI.
    pendingManual = true
    const s = lastBroadcast
    if (s) {
      if (s.status === 'checking' || s.status === 'available' || s.status === 'downloading') {
        broadcast({ ...s, manual: true })
      } else {
        broadcast(s)
      }
    }
    return
  }
  void runCheck(true)
}

/** Quit and install a downloaded update (the banner's Restart button). */
export function installUpdate(): void {
  if (!updatesEnabled()) return
  // isSilent=false (show installer), isForceRunAfter=true (relaunch the app).
  autoUpdater.quitAndInstall(false, true)
}
