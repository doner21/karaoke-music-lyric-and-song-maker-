import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawn } from 'child_process';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VideoEncoder API needs GPU acceleration, so hardware acceleration is kept enabled. 
// If YouTube iframes become unstable, consider running export in a separate process.

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
    const verifyMode = process.argv.includes('--verify-mode');

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
        const url = verifyMode ? 'http://localhost:5173/#/verify' : 'http://localhost:5173';
        win.loadURL(url);
        // Open DevTools for debugging
        win.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        const hashSuffix = verifyMode ? '#/verify' : '';
        win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: hashSuffix });
    }

    if (verifyMode) {
        console.log('[Electron] Started in VERIFY MODE — loading #/verify route');
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

// ===== GPU Encoder Probing =====

ipcMain.handle('probe-gpu-encoders', async () => {
    try {
        const result = await new Promise((resolve, reject) => {
            const proc = spawn(FFMPEG_PATH, ['-encoders'], { stdio: 'pipe' });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('close', (code) => {
                // FFmpeg -encoders exits with 0 on success
                resolve(stdout);
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });

        const nvenc = result.includes('h264_nvenc');
        const qsv = result.includes('h264_qsv');
        console.log(`[GPU Probe] NVENC: ${nvenc}, QSV: ${qsv}`);
        return { success: true, nvenc, qsv };
    } catch (err) {
        console.error('[GPU Probe] Failed:', err.message);
        return { success: false, nvenc: false, qsv: false, error: err.message };
    }
});

// ===== FFmpeg Frame-Based Export =====
// Using image2pipe format for exact preview match

const FFMPEG_PATH = ffmpegPath;
const FFMPEG_DIR = path.dirname(ffmpegPath);
const activeExports = new Map(); // exportId -> { ffmpeg, tempDir, outputPath }

ipcMain.handle('export-start', async (event, options) => {
    const { exportId, width, height, fps, totalFrames, outputFilename, bandStemPath, vocalStemPath, bandVol, vocalVol, encoder } = options;

    try {
        // Create temp directory
        const tempDir = path.join(app.getPath('temp'), 'karaoke-export', exportId);
        await fs.promises.mkdir(tempDir, { recursive: true });

        const outputPath = path.join(tempDir, outputFilename);
        const framesDir = path.join(tempDir, 'frames');
        await fs.promises.mkdir(framesDir, { recursive: true });

        // Validate encoder — default to libx264 if not specified or invalid
        const validEncoders = ['h264_nvenc', 'h264_qsv', 'libx264'];
        const resolvedEncoder = validEncoders.includes(encoder) ? encoder : 'libx264';

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
            vocalVol: vocalVol || 1,
            encoder: resolvedEncoder
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
        // Write frames as PNG files (lossless — preserves text quality)
        for (const frame of frames) {
            const frameNum = String(frame.frameIndex).padStart(6, '0');
            const framePath = path.join(exp.framesDir, `frame_${frameNum}.png`);
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

        const inputPattern = path.join(exp.framesDir, 'frame_%06d.png');
        const videoOnlyPath = path.join(exp.tempDir, 'video_only.mp4');
        const mixedAudioPath = path.join(exp.tempDir, 'mixed_audio.mp3');

        // Step 1: Encode video frames
        // Build FFmpeg args based on encoder selection
        const encoder = exp.encoder || 'libx264';
        let videoEncodeArgs;

        if (encoder === 'h264_nvenc') {
            // NVENC: GPU-accelerated encoding (NVIDIA)
            // -preset p7 = highest quality NVENC preset
            // -rc constqp -cq 19 ≈ x264 CRF 17 for synthetic/text content
            // -rc-lookahead 32 = look-ahead for better quality
            videoEncodeArgs = [
                '-y',
                '-framerate', String(exp.fps),
                '-i', inputPattern,
                '-c:v', 'h264_nvenc',
                '-preset', 'p7',
                '-rc', 'constqp',
                '-cq', '19',
                '-profile:v', 'high',
                '-rc-lookahead', '32',
                '-pix_fmt', 'yuv420p',
                videoOnlyPath
            ];
            console.log('[Export] Step 1: Encoding video frames with NVENC (GPU)...');
        } else if (encoder === 'h264_qsv') {
            // QSV: GPU-accelerated encoding (Intel)
            videoEncodeArgs = [
                '-y',
                '-framerate', String(exp.fps),
                '-i', inputPattern,
                '-c:v', 'h264_qsv',
                '-preset', 'veryslow',
                '-global_quality', '19',
                '-profile:v', 'high',
                '-pix_fmt', 'yuv420p',
                videoOnlyPath
            ];
            console.log('[Export] Step 1: Encoding video frames with QSV (Intel GPU)...');
        } else {
            // CPU fallback: libx264 (unchanged from original)
            // CRF 17 = visually lossless for synthetic/text content
            // -tune animation = optimized for flat areas with sharp edges (karaoke text)
            // -preset slow = better compression efficiency (offline export, speed less critical)
            videoEncodeArgs = [
                '-y',
                '-framerate', String(exp.fps),
                '-i', inputPattern,
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '17',
                '-tune', 'animation',
                '-pix_fmt', 'yuv420p',
                videoOnlyPath
            ];
            console.log('[Export] Step 1: Encoding video frames with libx264 (CPU)...');
        }

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(FFMPEG_PATH, videoEncodeArgs, { stdio: 'pipe' });

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    // If GPU encoder failed, try CPU fallback
                    if (encoder !== 'libx264') {
                        console.warn(`[Export] ${encoder} failed (code ${code}), falling back to libx264...`);
                        console.warn(`[Export] ${encoder} stderr: ${stderr.slice(-200)}`);
                        const fallbackFfmpeg = spawn(FFMPEG_PATH, [
                            '-y',
                            '-framerate', String(exp.fps),
                            '-i', inputPattern,
                            '-c:v', 'libx264',
                            '-preset', 'slow',
                            '-crf', '17',
                            '-tune', 'animation',
                            '-pix_fmt', 'yuv420p',
                            videoOnlyPath
                        ], { stdio: 'pipe' });

                        let fallbackStderr = '';
                        fallbackFfmpeg.stderr.on('data', (data) => { fallbackStderr += data.toString(); });
                        fallbackFfmpeg.on('close', (fallbackCode) => {
                            if (fallbackCode === 0) {
                                console.log('[Export] CPU fallback encoding succeeded');
                                resolve();
                            } else {
                                reject(new Error(`Video encode failed (both GPU and CPU): ${fallbackStderr.slice(-300)}`));
                            }
                        });
                        fallbackFfmpeg.on('error', reject);
                    } else {
                        reject(new Error(`Video encode failed: ${stderr.slice(-300)}`));
                    }
                }
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

// ===== GPU Streaming Export (Raw Pixel Pipeline) =====
// Frames arrive as raw RGBA ArrayBuffers piped directly to FFmpeg stdin.
// No intermediate PNG files on disk.

ipcMain.handle('export-start-streaming', async (event, options) => {
    const { exportId, width, height, fps, totalFrames, outputFilename, bandStemPath, vocalStemPath, bandVol, vocalVol, encoder } = options;

    try {
        const tempDir = path.join(app.getPath('temp'), 'karaoke-export', exportId);
        await fs.promises.mkdir(tempDir, { recursive: true });

        const outputPath = path.join(tempDir, outputFilename);
        const videoOnlyPath = path.join(tempDir, 'video_only.mp4');

        // Validate encoder
        const validEncoders = ['h264_nvenc', 'h264_qsv', 'libx264'];
        const resolvedEncoder = validEncoders.includes(encoder) ? encoder : 'libx264';

        // Build FFmpeg args for raw video input via stdin pipe
        let videoArgs = [
            '-y',
            '-f', 'rawvideo',
            '-pix_fmt', 'rgba',
            '-s', `${width}x${height}`,
            '-r', String(fps),
            '-i', 'pipe:0'
        ];

        // Encoder-specific args
        if (resolvedEncoder === 'h264_nvenc') {
            videoArgs.push(
                '-c:v', 'h264_nvenc',
                '-preset', 'p7',
                '-rc', 'constqp',
                '-cq', '19',
                '-profile:v', 'high',
                '-rc-lookahead', '32',
                '-pix_fmt', 'yuv420p'
            );
        } else if (resolvedEncoder === 'h264_qsv') {
            videoArgs.push(
                '-c:v', 'h264_qsv',
                '-preset', 'veryslow',
                '-global_quality', '19',
                '-profile:v', 'high',
                '-pix_fmt', 'yuv420p'
            );
        } else {
            videoArgs.push(
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '17',
                '-tune', 'animation',
                '-pix_fmt', 'yuv420p'
            );
        }

        videoArgs.push(videoOnlyPath);

        console.log(`[StreamExport] Spawning FFmpeg with ${resolvedEncoder}: ${videoArgs.join(' ')}`);

        // Spawn FFmpeg immediately with stdin pipe
        const ffmpegProcess = spawn(FFMPEG_PATH, videoArgs, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let ffmpegStderr = '';
        ffmpegProcess.stderr.on('data', (data) => {
            ffmpegStderr += data.toString();
        });

        // Track pending writes for backpressure
        let pendingWrites = 0;

        activeExports.set(exportId, {
            tempDir,
            outputPath,
            videoOnlyPath,
            width,
            height,
            fps,
            totalFrames,
            frameCount: 0,
            bandStemPath,
            vocalStemPath,
            bandVol: bandVol || 1,
            vocalVol: vocalVol || 1,
            encoder: resolvedEncoder,
            ffmpegProcess,
            ffmpegStderr: () => ffmpegStderr,
            pendingWrites: () => pendingWrites,
            incrementPending: () => { pendingWrites++; },
            decrementPending: () => { pendingWrites--; },
            streaming: true
        });

        console.log(`[StreamExport] Started: ${exportId}, encoder: ${resolvedEncoder}`);
        return { success: true, exportId };

    } catch (err) {
        console.error('[StreamExport] Start failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-frame-raw', async (event, { exportId, frameIndex, pixels }) => {
    const exp = activeExports.get(exportId);
    if (!exp || !exp.streaming) {
        return { success: false, error: 'Streaming export not found' };
    }

    try {
        // Check backpressure — if too many writes pending, signal back
        if (exp.pendingWrites() > 30) {
            return { success: false, backpressure: true };
        }

        const buffer = Buffer.from(pixels);
        exp.incrementPending();

        const canWrite = exp.ffmpegProcess.stdin.write(buffer, () => {
            exp.decrementPending();
        });

        exp.frameCount++;

        // If FFmpeg buffer is full, signal backpressure
        if (!canWrite) {
            return { success: true, backpressure: true };
        }

        return { success: true };
    } catch (err) {
        console.error('[StreamExport] Frame write failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-finalize-streaming', async (event, { exportId }) => {
    const exp = activeExports.get(exportId);
    if (!exp || !exp.streaming) {
        return { success: false, error: 'Streaming export not found' };
    }

    try {
        console.log(`[StreamExport] Finalizing: ${exp.frameCount} frames`);

        // Close FFmpeg stdin to signal end of input
        await new Promise((resolve, reject) => {
            exp.ffmpegProcess.stdin.end(() => {
                resolve();
            });
        });

        // Wait for FFmpeg to finish encoding
        await new Promise((resolve, reject) => {
            exp.ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    const stderr = typeof exp.ffmpegStderr === 'function' ? exp.ffmpegStderr() : '';
                    reject(new Error(`FFmpeg streaming encode failed (code ${code}): ${stderr.slice(-300)}`));
                }
            });
            exp.ffmpegProcess.on('error', reject);
        });

        console.log('[StreamExport] Video encoded');

        const mixedAudioPath = path.join(exp.tempDir, 'mixed_audio.mp3');

        // Mix audio (same as CPU path)
        if (exp.bandStemPath && exp.vocalStemPath) {
            console.log('[StreamExport] Mixing audio stems...');
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

            console.log('[StreamExport] Audio mixed');

            // Combine video + audio
            console.log('[StreamExport] Combining video and audio...');
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(FFMPEG_PATH, [
                    '-y',
                    '-i', exp.videoOnlyPath,
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

            console.log('[StreamExport] Combined');
        } else {
            await fs.promises.rename(exp.videoOnlyPath, exp.outputPath);
        }

        const stats = await fs.promises.stat(exp.outputPath);
        console.log(`[StreamExport] Output: ${exp.outputPath}, Size: ${stats.size} bytes`);

        return { success: true, outputPath: exp.outputPath, fileSize: stats.size };

    } catch (err) {
        console.error('[StreamExport] Finalize failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('export-cleanup', async (event, { exportId }) => {
    const exp = activeExports.get(exportId);
    if (exp) {
        try {
            // Kill FFmpeg process if streaming export
            if (exp.ffmpegProcess && !exp.ffmpegProcess.killed) {
                try { exp.ffmpegProcess.kill('SIGKILL'); } catch (e) { /* ignore */ }
            }
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

// ===== Verification Screenshot Capture =====

ipcMain.handle('verify-capture', async (event, { cpuImage, gpuImage, diffImage, time, matchPct }) => {
    try {
        const outputDir = path.join(app.getPath('userData'), 'verify_output');
        await fs.promises.mkdir(outputDir, { recursive: true });

        const timestamp = String(Math.round(time * 100)).padStart(8, '0');

        if (cpuImage) {
            const cpuBuffer = Buffer.from(cpuImage.split(',')[1], 'base64');
            await fs.promises.writeFile(path.join(outputDir, `cpu_t${timestamp}.png`), cpuBuffer);
        }
        if (gpuImage) {
            const gpuBuffer = Buffer.from(gpuImage.split(',')[1], 'base64');
            await fs.promises.writeFile(path.join(outputDir, `gpu_t${timestamp}.png`), gpuBuffer);
        }
        if (diffImage) {
            const diffBuffer = Buffer.from(diffImage.split(',')[1], 'base64');
            await fs.promises.writeFile(path.join(outputDir, `diff_t${timestamp}.png`), diffBuffer);
        }

        console.log(`[Verify] Captured at t=${time}s, match=${matchPct}%, saved to ${outputDir}`);
        return { success: true, outputDir };
    } catch (err) {
        console.error('[Verify] Capture failed:', err);
        return { success: false, error: err.message };
    }
});
