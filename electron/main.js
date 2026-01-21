import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: Disable GPU hardware acceleration to prevent YouTube iframe crashes
// This only affects Electron's UI rendering, NOT external processes like Demucs CUDA
app.disableHardwareAcceleration();

// Additional GPU flags to prevent crashes with YouTube iframes
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Increase memory limit for large audio buffer decoding
// Default limit is too low for decoding ~20MB of audio data
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// Disable CORS for iframe content
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simplicity in this wrapper; consider contextBridge for security in later stages
            webSecurity: false, // Required for YouTube iframe API to work in Electron
            allowRunningInsecureContent: true, // Allow YouTube's mixed content
            webviewTag: true, // Enable webview for YouTube player
        },
        autoHideMenuBar: true, // Makes it look more like a modern app
    });

    const isDev = process.env.NODE_ENV === 'development';

    // Add crash recovery - auto-reload if renderer crashes
    win.webContents.on('crashed', (event, killed) => {
        console.error('[Electron] Renderer crashed!', killed ? 'killed' : 'crashed');
        // Wait a moment then reload
        setTimeout(() => {
            console.log('[Electron] Attempting recovery...');
            if (isDev) {
                win.loadURL('http://localhost:5173');
            } else {
                win.loadFile(path.join(__dirname, '../dist/index.html'));
            }
        }, 1000);
    });

    win.webContents.on('render-process-gone', (event, details) => {
        console.error('[Electron] Render process gone:', details.reason);
        if (details.reason !== 'clean-exit') {
            setTimeout(() => {
                console.log('[Electron] Attempting recovery from render-process-gone...');
                if (isDev) {
                    win.loadURL('http://localhost:5173');
                } else {
                    win.loadFile(path.join(__dirname, '../dist/index.html'));
                }
            }, 1000);
        }
    });

    if (isDev) {
        // In dev mode, load the Vite server
        win.loadURL('http://localhost:5173');
        // Open DevTools for debugging
        win.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    return win;
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});



ipcMain.handle('show-save-dialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showSaveDialog(win, options);
});

ipcMain.handle('save-file', async (event, { filePath, buffer }) => {
    try {
        await fs.promises.writeFile(filePath, Buffer.from(buffer));
        return { success: true };
    } catch (err) {
        console.error('Failed to save file:', err);
        throw err;
    }
});

ipcMain.handle('copy-file', async (event, { sourcePath, destPath }) => {
    try {
        await fs.promises.copyFile(sourcePath, destPath);
        return { success: true };
    } catch (err) {
        console.error('Failed to copy file:', err);
        return { success: false, error: err.message };
    }
});
