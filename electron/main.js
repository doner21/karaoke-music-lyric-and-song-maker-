import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simplicity in this wrapper; consider contextBridge for security in later stages
        },
        autoHideMenuBar: true, // Makes it look more like a modern app
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        // In dev mode, load the Vite server
        win.loadURL('http://localhost:5173');
        // Open DevTools for debugging
        win.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        // Note: We need to go up one level from 'electron' folder to find 'dist' if we place this in electron/main.js
        // Actually, usually we build to distinct folders. Let's assume dist/index.html exists relative to root.
        // If run from root... file referencing might be tricky.
        // Let's standardise: we will run this file from the root context usually or bundled.
        // But simplified:
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
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
