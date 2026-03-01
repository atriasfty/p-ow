import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen, shell, safeStorage } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'
import crypto from 'crypto'
import Store from 'electron-store'

// Store schema type
interface StoreSchema {
    hotkey: string
    toggleHotkey: string
    overlayOpacity: number
    panelPosition: { x: number; y: number }
    authToken: string | null
}

// Secure store for settings
const store = new Store<StoreSchema>({
    defaults: {
        hotkey: 'Alt+V',
        toggleHotkey: 'Alt+Shift+V',
        overlayOpacity: 0.95,
        panelPosition: { x: 100, y: 100 },
        authToken: null
    }
})

let overlayWindow: BrowserWindow | null = null
let isOverlayVisible = false
let isQuitting = false

function createOverlayWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize

    overlayWindow = new BrowserWindow({
        width: 380,
        height: 500,
        x: store.get('panelPosition.x') as number || 100,
        y: store.get('panelPosition.y') as number || 100,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false, // Show in taskbar for easy access
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // Keep on top of fullscreen apps (works for borderless fullscreen)
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Apply saved opacity
    const savedOpacity = store.get('overlayOpacity')
    overlayWindow.setOpacity(savedOpacity)

    // Load the React app - check for dev server URL
    const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    const isDev = !app.isPackaged

    if (isDev) {
        overlayWindow.loadURL(VITE_DEV_SERVER_URL)
        overlayWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
        overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    // Save position when moved
    overlayWindow.on('moved', () => {
        const [x, y] = overlayWindow!.getPosition()
        store.set('panelPosition', { x, y })
    })

    // Hide instead of close
    overlayWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault()
            overlayWindow?.hide()
            isOverlayVisible = false
        }
    })
}

function registerHotkey() {
    const hotkey = store.get('hotkey') as string
    const toggleHotkey = store.get('toggleHotkey') as string

    // Unregister all first
    globalShortcut.unregisterAll()

    // Register the capture hotkey
    const registered = globalShortcut.register(hotkey, async () => {
        if (!overlayWindow) return

        // Show overlay if hidden
        if (!isOverlayVisible) {
            overlayWindow.show()
            isOverlayVisible = true
        }

        // Trigger OCR capture
        overlayWindow.webContents.send('trigger-capture')
    })

    if (!registered) {
        console.error(`Failed to register hotkey: ${hotkey}`)
    }

    // Toggle visibility hotkey (configurable)
    const toggleRegistered = globalShortcut.register(toggleHotkey, () => {
        if (overlayWindow) {
            if (isOverlayVisible) {
                overlayWindow.hide()
                isOverlayVisible = false
            } else {
                overlayWindow.show()
                isOverlayVisible = true
            }
        }
    })

    if (!toggleRegistered) {
        console.error(`Failed to register toggle hotkey: ${toggleHotkey}`)
    }
}

// Helper to get screen sources with retry logic
async function getScreenSourceWithRetry(width: number, height: number, retries = 3): Promise<Electron.DesktopCapturerSource | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width, height }
            })

            // Return first valid source found
            if (sources.length > 0) {
                // If we found a source with a valid thumbnail, return it
                if (!sources[0].thumbnail.isEmpty()) {
                    return sources[0]
                }
            }
            console.warn(`[Screen Capture] Attempt ${i + 1} failed: No valid sources found`)
        } catch (e) {
            console.error(`[Screen Capture] Attempt ${i + 1} error:`, e)
        }
        // Wait 100ms before retry
        await new Promise(r => setTimeout(r, 100))
    }
    return null
}

// Screen capture for OCR - captures region around cursor
ipcMain.handle('capture-screen', async () => {
    try {
        // On macOS, check for screen recording permission
        if (process.platform === 'darwin') {
            const { systemPreferences } = require('electron')
            const hasPermission = systemPreferences.getMediaAccessStatus('screen')

            if (hasPermission !== 'granted') {
                console.error('[Screen Capture] Screen recording permission not granted')
                await desktopCapturer.getSources({ types: ['screen'] })
            }
        }

        // Get cursor position and active display
        const cursorPoint = screen.getCursorScreenPoint()
        const display = screen.getDisplayNearestPoint(cursorPoint)
        console.log('[Screen Capture] Cursor at:', cursorPoint.x, cursorPoint.y, 'Display:', display.id)

        // Capture at full resolution (accounting for Retina/High DPI)
        const width = display.size.width * display.scaleFactor
        const height = display.size.height * display.scaleFactor

        // Try to get sources with retry
        let source = await getScreenSourceWithRetry(width, height)

        if (!source) {
            console.error('[Screen Capture] Failed to get screen source after retries')
            return { image: null, cursorX: cursorPoint.x, cursorY: cursorPoint.y }
        }

        // If multiple screens, try to match the correct one
        // Note: Electron display IDs and DesktopCapturer source IDs don't always match 1:1 format perfectly across OSs
        // We'll trust the retry logic to give us a valid Primary source (usually index 0) if single monitor
        // For multi-monitor precision, we would strictly match `source.display_id` if available (newer Electron versions)

        const thumbnail = source.thumbnail
        const fullSize = thumbnail.getSize()

        // Double check validity
        if (fullSize.width === 0 || fullSize.height === 0) {
            console.error('[Screen Capture] Final thumbnail is empty')
            return { image: null, cursorX: cursorPoint.x, cursorY: cursorPoint.y }
        }

        // Define capture region around cursor (800x200 box)
        const regionWidth = 800
        const regionHeight = 200

        // Calculate region bounds, ensuring we stay within screen
        const relativeX = cursorPoint.x - display.bounds.x
        const relativeY = cursorPoint.y - display.bounds.y

        // Scale factor for retina displays
        const scaleX = fullSize.width / display.bounds.width
        const scaleY = fullSize.height / display.bounds.height

        let cropX = Math.round((relativeX - regionWidth / 2) * scaleX)
        let cropY = Math.round((relativeY - regionHeight / 2 - 50) * scaleY) // Offset up to catch name tag
        let cropWidth = Math.round(regionWidth * scaleX)
        let cropHeight = Math.round(regionHeight * scaleY)

        // Clamp to image bounds
        cropX = Math.max(0, Math.min(cropX, fullSize.width - cropWidth))
        cropY = Math.max(0, Math.min(cropY, fullSize.height - cropHeight))
        cropWidth = Math.min(cropWidth, fullSize.width - cropX)
        cropHeight = Math.min(cropHeight, fullSize.height - cropY)

        console.log('[Screen Capture] Cropping region:', cropX, cropY, cropWidth, cropHeight)

        // Crop the thumbnail to the region around cursor
        const croppedImage = thumbnail.crop({
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight
        })

        const dataUrl = croppedImage.toDataURL()
        console.log('[Screen Capture] Success. DataURL length:', dataUrl.length)

        return {
            image: dataUrl,
            cursorX: cursorPoint.x,
            cursorY: cursorPoint.y
        }
    } catch (error) {
        console.error('[Screen Capture] Error:', error)
        return { image: null, cursorX: 0, cursorY: 0 }
    }
})

// Get/Set settings
ipcMain.handle('get-settings', () => {
    return {
        hotkey: store.get('hotkey'),
        toggleHotkey: store.get('toggleHotkey'),
        overlayOpacity: store.get('overlayOpacity')
    }
})

ipcMain.handle('set-settings', (_event, settings: { hotkey?: string; toggleHotkey?: string; overlayOpacity?: number }) => {
    if (settings.hotkey) {
        store.set('hotkey', settings.hotkey)
    }
    if (settings.toggleHotkey) {
        store.set('toggleHotkey', settings.toggleHotkey)
    }
    if (settings.overlayOpacity !== undefined) {
        store.set('overlayOpacity', settings.overlayOpacity)
        // Apply opacity to the window
        if (overlayWindow) {
            overlayWindow.setOpacity(settings.overlayOpacity)
        }
    }
    // Re-register hotkeys with new values
    registerHotkey()
    return true
})

// Auth token storage (using Electron's safe storage for encryption at rest)
ipcMain.handle('store-auth-token', (_event, token: string) => {
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(token)
            store.set('authToken', encrypted.toString('base64'))
        } else {
            // Fallback for systems where encryption is not available (rare)
            store.set('authToken', token)
        }
        return true
    } catch (e) {
        console.error('Failed to encrypt/store auth token:', e)
        return false
    }
})

ipcMain.handle('get-auth-token', () => {
    const stored = store.get('authToken')
    if (!stored) return null

    try {
        if (safeStorage.isEncryptionAvailable()) {
            return safeStorage.decryptString(Buffer.from(stored, 'base64'))
        }
        return stored
    } catch (e) {
        console.error('Failed to decrypt auth token:', e)
        return null
    }
})

ipcMain.handle('clear-auth-token', () => {
    store.delete('authToken')
    return true
})

// Shared secret for HMAC verification - hardcoded to match server
const VISION_HMAC_SECRET = 'pow-vision-hmac-secret-2024'
// Generate a random instance ID for this session
const SESSION_INSTANCE_ID = crypto.randomBytes(8).toString('hex')

ipcMain.handle('generate-signature', () => {
    const timestamp = Date.now().toString()
    const message = `${timestamp}:${SESSION_INSTANCE_ID}`
    const signature = crypto
        .createHmac('sha256', VISION_HMAC_SECRET)
        .update(message)
        .digest('hex')

    return `${timestamp}:${SESSION_INSTANCE_ID}:${signature}`
})

// Open URL in system default browser - with security allowlist
const ALLOWED_ORIGINS = [
    'https://pow.ciankelly.xyz',
    'http://localhost:3000', // Local dev dashboard
    'https://github.com/ciankelly' // Project links
]

ipcMain.handle('open-external', async (_event, urlString: string) => {
    try {
        const url = new URL(urlString)
        const isAllowed = ALLOWED_ORIGINS.some(origin => {
            const originUrl = new URL(origin)
            return url.protocol === originUrl.protocol && url.hostname === originUrl.hostname
        })

        if (isAllowed) {
            await shell.openExternal(urlString)
        } else {
            console.warn(`[Security] Blocked attempt to open external URL: ${urlString}`)
        }
    } catch (e) {
        console.error('Failed to open external URL:', e)
    }
})

// Hide overlay (for X button in UI)
ipcMain.handle('hide-overlay', () => {
    if (overlayWindow) {
        overlayWindow.hide()
        isOverlayVisible = false
    }
    return true
})

// Move window to position near cursor (for positioning near detected username)
ipcMain.on('move-window', (_event, x: number, y: number) => {
    if (!overlayWindow) return

    const display = screen.getDisplayNearestPoint({ x, y })
    const windowBounds = overlayWindow.getBounds()

    // Position to the right of cursor by default, flip to left if near edge
    let newX = x + 20  // Offset to the right
    if (newX + windowBounds.width > display.bounds.x + display.bounds.width) {
        // Flip to left side if would go off right edge
        newX = x - windowBounds.width - 20
    }

    // Keep vertical position centered on cursor, within screen bounds
    let newY = y - windowBounds.height / 2
    newY = Math.max(display.bounds.y, Math.min(newY, display.bounds.y + display.bounds.height - windowBounds.height))

    overlayWindow.setPosition(Math.round(newX), Math.round(newY))
})

// Request screen capture permission (macOS only)
// Request screen capture permission (macOS only)
async function requestScreenCapturePermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
        // Windows/Linux don't require special permission
        return true
    }

    const { systemPreferences, dialog } = require('electron')
    const status = systemPreferences.getMediaAccessStatus('screen')
    console.log('[Permission] Screen recording status:', status)

    if (status === 'granted') {
        return true
    }

    // Show a dialog explaining we need permission
    const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Screen Recording Permission Required',
        message: 'POW Vision needs screen recording permission to detect player names.',
        detail: 'Click "Open Settings" to grant permission in System Preferences, then restart the app.',
        buttons: ['Open Settings', 'Later'],
        defaultId: 0,
        cancelId: 1
    })

    if (result.response === 0) {
        // Open System Preferences to the screen recording section
        const { shell } = require('electron')
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }

    // Try to trigger the permission prompt by attempting a capture
    try {
        await desktopCapturer.getSources({ types: ['screen'] })
    } catch (e) {
        console.log('[Permission] Capture attempt (for permission prompt):', e)
    }

    // Re-check status
    const newStatus = systemPreferences.getMediaAccessStatus('screen')
    return newStatus === 'granted'
}

let tray: any = null

function createTray() {
    const { Tray, Menu, nativeImage } = require('electron')

    // Use the icon from build resources
    // On macOS, it wants a resized image usually, but for now we try the standard icon path
    // In dev, we might not have the icon, so handle gracefully
    try {
        const iconPath = path.join(__dirname, '../../build/icon.png')
        const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

        tray = new Tray(image)

        // Build menu dynamically based on visibility state
        const buildContextMenu = () => {
            return Menu.buildFromTemplate([
                {
                    label: isOverlayVisible ? 'Hide Overlay' : 'Show Overlay',
                    click: () => {
                        if (overlayWindow) {
                            if (isOverlayVisible) {
                                overlayWindow.hide()
                                isOverlayVisible = false
                            } else {
                                overlayWindow.show()
                                isOverlayVisible = true
                            }
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit POW Vision',
                    click: () => {
                        isQuitting = true
                        app.quit()
                    }
                }
            ])
        }

        tray.setToolTip('POW Vision')

        // On Windows, right-click shows menu. On macOS, regular click does.
        // We rebuild the menu each time to ensure it reflects current state
        tray.on('click', () => {
            tray.setContextMenu(buildContextMenu())
        })
        tray.on('right-click', () => {
            tray.setContextMenu(buildContextMenu())
            tray.popUpContextMenu()
        })

        // Set initial menu
        tray.setContextMenu(buildContextMenu())

        // Restore on double click
        tray.on('double-click', () => {
            if (overlayWindow) {
                overlayWindow.show()
                isOverlayVisible = true
            }
        })

    } catch (e) {
        console.error('Failed to create tray:', e)
    }
}

// App lifecycle
app.whenReady().then(async () => {
    // Request screen recording permission on macOS
    const hasPermission = await requestScreenCapturePermission()
    console.log('[Permission] Screen recording permission granted:', hasPermission)

    // Ensure icon shows in dock/force quit
    if (process.platform === 'darwin') {
        app.dock.show()
    }

    createOverlayWindow()
    createTray()
    registerHotkey()

    // Check for updates (only in production)
    if (app.isPackaged) {
        console.log('[Updater] Checking for updates...')
        autoUpdater.checkForUpdatesAndNotify()

        // Check every hour
        setInterval(() => {
            autoUpdater.checkForUpdatesAndNotify()
        }, 60 * 60 * 1000)
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createOverlayWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (overlayWindow) {
            overlayWindow.show()
            overlayWindow.focus()
        }
    })
}

// Mark app as quitting
app.on('before-quit', () => {
    isQuitting = true
})
