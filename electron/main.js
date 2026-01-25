import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: Hardware acceleration was previously disabled to prevent YouTube iframe crashes.
// However, this breaks VideoEncoder API needed for MP4 export.
// TRADE-OFF: Enabling GPU for MP4 export - if YouTube iframes become unstable,
// consider alternative approaches like running export in a separate process.

// REMOVED: These flags break VideoEncoder which needs GPU acceleration
// app.disableHardwareAcceleration();
// app.commandLine.appendSwitch('disable-gpu');
// app.commandLine.appendSwitch('disable-gpu-compositing');
// app.commandLine.appendSwitch('disable-software-rasterizer');

// Enable WebCodecs API for video encoding (required for MP4 export)
app.commandLine.appendSwitch('enable-features', 'WebCodecs,WebCodecsEncoderEnergy');
app.commandLine.appendSwitch('enable-blink-features', 'WebCodecs');

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

// ===== FFmpeg Frame-Based Export =====
// Using image2pipe format for exact preview match

const FFMPEG_PATH = 'C:\\Users\\donald clark\\AppData\\Roaming\\Youka Desktop\\youka\\data\\binaries\\ffmpeg\\ffmpeg.exe';
const activeExports = new Map(); // exportId -> { ffmpeg, tempDir, outputPath }

ipcMain.handle('export-start', async (event, options) => {
    const { exportId, width, height, fps, totalFrames, outputFilename, bandStemPath, vocalStemPath, bandVol, vocalVol } = options;

    try {
        // Create temp directory
        const tempDir = path.join(app.getPath('temp'), 'karaoke-export', exportId);
        await fs.promises.mkdir(tempDir, { recursive: true });

        const outputPath = path.join(tempDir, outputFilename);
        const framesDir = path.join(tempDir, 'frames');
        await fs.promises.mkdir(framesDir, { recursive: true });

        // Store export state
        activeExports.set(exportId, {
            framesDir,
            tempDir,
            outputPath,
            width,
            height,
            fps,
            totalFrames,
            frameCount: 0,
            bandStemPath,
            vocalStemPath,
            bandVol: bandVol || 1,
            vocalVol: vocalVol || 1
        });

        console.log(`[Export] Started: ${exportId}, output: ${outputPath}`);
        console.log(`[Export] Stems: band=${bandStemPath}, vocal=${vocalStemPath}`);
        return { success: true, exportId };

    } catch (err) {
        console.error('[Export] Start failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-frames', async (event, { exportId, frames }) => {
    const exp = activeExports.get(exportId);
    if (!exp) {
        return { success: false, error: 'Export not found' };
    }

    try {
        // Write frames as JPEG files
        for (const frame of frames) {
            const frameNum = String(frame.frameIndex).padStart(6, '0');
            const framePath = path.join(exp.framesDir, `frame_${frameNum}.jpg`);
            const buffer = Buffer.from(frame.data, 'base64');
            await fs.promises.writeFile(framePath, buffer);
            exp.frameCount++;
        }

        return { success: true, written: frames.length };
    } catch (err) {
        console.error('[Export] Frame write failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-finalize', async (event, { exportId }) => {
    const exp = activeExports.get(exportId);
    if (!exp) {
        return { success: false, error: 'Export not found' };
    }

    try {
        console.log(`[Export] Finalizing: ${exp.frameCount} frames`);

        const inputPattern = path.join(exp.framesDir, 'frame_%06d.jpg');
        const videoOnlyPath = path.join(exp.tempDir, 'video_only.mp4');
        const mixedAudioPath = path.join(exp.tempDir, 'mixed_audio.mp3');

        // Step 1: Encode video frames
        console.log('[Export] Step 1: Encoding video frames...');
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(FFMPEG_PATH, [
                '-y',
                '-framerate', String(exp.fps),
                '-i', inputPattern,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                videoOnlyPath
            ], { stdio: 'pipe' });

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
            ffmpeg.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Video encode failed: ${stderr.slice(-300)}`));
            });
            ffmpeg.on('error', reject);
        });

        console.log('[Export] Video encoded');

        // Step 2: Mix audio from stem files
        if (exp.bandStemPath && exp.vocalStemPath) {
            console.log('[Export] Step 2: Mixing audio stems...');
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(FFMPEG_PATH, [
                    '-y',
                    '-i', exp.bandStemPath,
                    '-i', exp.vocalStemPath,
                    '-filter_complex', `[0:a]volume=${exp.bandVol}[a0];[1:a]volume=${exp.vocalVol}[a1];[a0][a1]amix=inputs=2:duration=longest[aout]`,
                    '-map', '[aout]',
                    '-c:a', 'libmp3lame',
                    '-q:a', '2',
                    mixedAudioPath
                ], { stdio: 'pipe' });

                let stderr = '';
                ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                ffmpeg.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Audio mix failed: ${stderr.slice(-300)}`));
                });
                ffmpeg.on('error', reject);
            });

            console.log('[Export] Audio mixed');

            // Step 3: Combine video + audio
            console.log('[Export] Step 3: Combining video and audio...');
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(FFMPEG_PATH, [
                    '-y',
                    '-i', videoOnlyPath,
                    '-i', mixedAudioPath,
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-shortest',
                    exp.outputPath
                ], { stdio: 'pipe' });

                let stderr = '';
                ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                ffmpeg.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Combine failed: ${stderr.slice(-300)}`));
                });
                ffmpeg.on('error', reject);
            });

            console.log('[Export] Combined');
        } else {
            // No audio, just rename video
            await fs.promises.rename(videoOnlyPath, exp.outputPath);
        }

        // Verify output
        const stats = await fs.promises.stat(exp.outputPath);
        console.log(`[Export] Output: ${exp.outputPath}, Size: ${stats.size} bytes`);

        return { success: true, outputPath: exp.outputPath, fileSize: stats.size };

    } catch (err) {
        console.error('[Export] Finalize failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-cleanup', async (event, { exportId }) => {
    const exp = activeExports.get(exportId);
    if (exp) {
        try {
            // Remove temp directory
            await fs.promises.rm(exp.tempDir, { recursive: true, force: true });
            activeExports.delete(exportId);
            console.log(`[Export] Cleaned up: ${exportId}`);
        } catch (e) {
            console.warn('[Export] Cleanup warning:', e.message);
        }
    }
    return { success: true };
});
