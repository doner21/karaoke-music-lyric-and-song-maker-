import { drawKaraokeFrame } from './karaokeDrawer';
import { drawKaraokeFrameGL, initGL, destroyGL } from './karaokeDrawerGL';
import { computeInstrumentalGap, computeOutroGap } from './karaokeHelpers';

/**
 * Flip raw RGBA pixel buffer vertically (WebGL readPixels returns bottom-up).
 * @param {Uint8Array} pixels - RGBA pixel data
 * @param {number} width
 * @param {number} height
 */
function flipVertical(pixels, width, height) {
    const rowSize = width * 4;
    const temp = new Uint8Array(rowSize);
    for (let y = 0; y < Math.floor(height / 2); y++) {
        const topOffset = y * rowSize;
        const bottomOffset = (height - y - 1) * rowSize;
        temp.set(pixels.subarray(topOffset, topOffset + rowSize));
        pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
        pixels.set(temp, bottomOffset);
    }
}

/**
 * Export karaoke video to MP4 using canvas rendering + Electron IPC + server-side FFmpeg
 * 
 * This approach:
 * 1. Renders frames client-side using drawKaraokeFrame (CPU) or drawKaraokeFrameGL (GPU)
 * 2. Streams frames to Electron main process via IPC
 * 3. Main process encodes to video with FFmpeg (libx264 CPU or h264_nvenc GPU) and mixes audio
 * 
 * GPU Path (renderMode === 'webgl2'):
 *   - WebGL2 canvas → gl.readPixels(RGBA) → flipVertical → IPC ArrayBuffer → FFmpeg stdin pipe
 *   - Eliminates PNG encode/decode and disk I/O entirely
 * 
 * CPU Path (renderMode === 'canvas2d', default — unchanged from original):
 *   - Canvas 2D → toDataURL('image/png') → base64 → IPC → write PNG files → FFmpeg reads PNGs
 */
export async function exportToMp4Electron({
    width = 1280,
    height = 720,
    fps = 30,
    totalDuration,
    lyrics,
    allWords,
    linesPerPage = 4,
    highlightColor = '#7CB87C',
    songTitle = 'karaoke-export',
    bandStemPath,
    vocalStemPath,
    bandVol = 1,
    vocalVol = 1,
    onProgress,
    // GPU pipeline options (Phase 4/6/7)
    renderMode = 'canvas2d',  // 'canvas2d' | 'webgl2'
    encoder = 'libx264'       // 'libx264' | 'h264_nvenc' | 'h264_qsv'
}) {
    // Check for Electron IPC
    const isElectron = typeof window !== 'undefined' && window.require;
    if (!isElectron) {
        throw new Error('This export method requires Electron');
    }

    const { ipcRenderer } = window.require('electron');

    const useGPU = renderMode === 'webgl2';
    const useStreamingPipe = useGPU; // GPU path uses raw pixel streaming; CPU path uses PNG files

    // Prepare export parameters
    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDuration = 1 / fps;

    console.log(`[ElectronExport] Starting export: ${width}x${height}@${fps}fps, ${totalFrames} frames, ${totalDuration.toFixed(2)}s`);
    console.log(`[ElectronExport] Mode: render=${renderMode}, encoder=${encoder}`);
    console.log(`[ElectronExport] Lyrics: ${lyrics?.length || 0} lines, ${allWords?.length || 0} words`);
    console.log(`[ElectronExport] Stems: band=${bandStemPath}, vocal=${vocalStemPath}`);

    onProgress?.(0.01, 'Preparing export...');

    // Create canvas and rendering context
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let ctx = null;       // Canvas 2D context (CPU path)
    let glRenderer = null; // WebGL2 renderer (GPU path)

    if (useGPU) {
        try {
            glRenderer = initGL(canvas);
            console.log('[ElectronExport] WebGL2 renderer initialized');
        } catch (err) {
            console.warn(`[ElectronExport] WebGL2 init failed, falling back to Canvas 2D: ${err.message}`);
            // Canvas is locked to WebGL context type after failed init — create a fresh one
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = width;
            fallbackCanvas.height = height;
            canvas = fallbackCanvas;
            ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get 2D context');
        }
    } else {
        ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
    }

    // Determine actual render mode after potential fallback
    const actualGPU = glRenderer !== null;
    const actualEncoder = actualGPU ? encoder : 'libx264'; // If GPU render failed, use CPU encoder too

    // Helper to compute state at time t (same as fastExport.js and preview)
    const getStateAt = (t) => {
        const instGap = computeInstrumentalGap(allWords, t, 8);
        const adjEnd = instGap ? Math.max(instGap.start, instGap.end - 3) : null;
        const showInst = !!(instGap && t >= instGap.start && t < (adjEnd ?? instGap.end));
        const instProg = showInst ? (t - instGap.start) / Math.max(instGap.duration - 3, 0.001) : 0;

        const trackEnd = totalDuration;
        const outroGap = computeOutroGap(allWords, t, trackEnd, 0);
        const showOutro = !!outroGap;
        const outroProg = showOutro ? (t - outroGap.start) / Math.max(outroGap.duration, 0.001) : 0;

        let showLyrics = false;
        let visibleSentences = [];

        if (!showOutro && !showInst && allWords && allWords.length > 0 && lyrics && lyrics.length > 0) {
            const pages = [];
            for (let i = 0; i < lyrics.length; i += linesPerPage) {
                pages.push(lyrics.slice(i, i + linesPerPage));
            }

            let pageIdx = pages.length - 1;
            for (let i = 0; i < pages.length; i++) {
                const pg = pages[i];
                const lastS = pg[pg.length - 1];
                if (lastS && lastS.sentence && t < lastS.sentence.end) {
                    pageIdx = i;
                    break;
                }
            }

            visibleSentences = pages[pageIdx] || [];

            const firstWord = allWords[0];
            const during = visibleSentences.length > 0;
            if (firstWord && t < firstWord.start && (firstWord.start - t) >= 8) {
                showLyrics = false;
            } else {
                showLyrics = during;
            }
        }

        return {
            showOutro,
            outroGap,
            outroProgress: outroProg,
            showInstrumental: showInst,
            instrumentalGap: instGap,
            instrumentalProgress: instProg,
            shouldShowLyrics: showLyrics,
            visibleSentences: visibleSentences || []
        };
    };

    // Start export
    const exportId = `export-${Date.now()}`;
    const safeName = songTitle.replace(/[<>:"/\\|?*]/g, '_');

    try {
        if (actualGPU && useStreamingPipe) {
            // ============================================================
            // GPU STREAMING PATH — raw pixels piped directly to FFmpeg
            // ============================================================
            console.log('[ElectronExport] Using GPU streaming pipeline');

            // Step 1: Start streaming export (spawns FFmpeg immediately with stdin pipe)
            const startResult = await ipcRenderer.invoke('export-start-streaming', {
                exportId,
                width,
                height,
                fps,
                totalFrames,
                outputFilename: `${safeName}.mp4`,
                bandStemPath,
                vocalStemPath,
                bandVol,
                vocalVol,
                encoder: actualEncoder
            });

            if (!startResult.success) {
                throw new Error(startResult.error || 'Failed to start streaming export');
            }

            console.log(`[ElectronExport] Streaming export started: ${exportId}`);
            onProgress?.(0.05, 'Rendering frames (GPU)...');

            // Step 2: Render frames and stream raw pixels
            const gl = glRenderer.gl;
            const pixels = new Uint8Array(width * height * 4);

            const RETRY_LIMIT = 20;
            let retries = 0;

            for (let i = 0; i < totalFrames; i++) {
                const t = i * frameDuration;
                const state = getStateAt(t);

                // Draw frame using WebGL2 renderer
                drawKaraokeFrameGL(glRenderer, {
                    width,
                    height,
                    now: t,
                    showOutro: state.showOutro,
                    outroGap: state.outroGap,
                    showInstrumental: state.showInstrumental,
                    instrumentalGap: state.instrumentalGap,
                    shouldShowLyrics: state.shouldShowLyrics,
                    visibleSentences: state.visibleSentences,
                    outroProgress: state.outroProgress,
                    instrumentalProgress: state.instrumentalProgress,
                    highlightColor: highlightColor
                });

                // Read pixels from GPU
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                // WebGL readPixels returns bottom-up; flip to top-down
                flipVertical(pixels, width, height);

                // Send raw RGBA frame to main process via IPC (ArrayBuffer transfer)
                const frameResult = await ipcRenderer.invoke('export-frame-raw', {
                    exportId,
                    frameIndex: i,
                    pixels: pixels.buffer.slice(0) // Copy for transfer
                });

                if (!frameResult.success) {
                    // Check for backpressure signal
                    if (frameResult.backpressure) {
                        retries++;
                        if (retries > RETRY_LIMIT) {
                            throw new Error('Frame ' + i + ' retry limit exceeded. FFmpeg may have crashed.');
                        }
                        await new Promise(r => setTimeout(r, 10));
                        i--; // Retry this frame
                        continue;
                    } else {
                        retries = 0;
                    }
                    throw new Error(frameResult.error || 'Failed to write frame');
                }

                // Update progress (5% to 75% is frame rendering)
                if (i % 5 === 0) {
                    const progress = 0.05 + (i / totalFrames) * 0.70;
                    onProgress?.(progress, `Rendering frame ${i + 1}/${totalFrames} (GPU)`);
                }

                // Yield to UI every 10 frames
                if (i % 10 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            onProgress?.(0.75, 'Finalizing video...');

            // Step 3: Finalize streaming export (close stdin, wait for FFmpeg, mix audio)
            const finalResult = await ipcRenderer.invoke('export-finalize-streaming', {
                exportId
            });

            if (!finalResult.success) {
                throw new Error(finalResult.error || 'Failed to finalize streaming export');
            }

            // Cleanup GL renderer
            destroyGL(glRenderer);
            glRenderer = null;

            onProgress?.(0.90, 'Saving file...');

            // Step 4: Save dialog
            const saveResult = await ipcRenderer.invoke('show-save-dialog', {
                title: 'Save Karaoke Video',
                defaultPath: `${safeName}.mp4`,
                filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
            });

            if (saveResult.canceled || !saveResult.filePath) {
                await ipcRenderer.invoke('export-cleanup', { exportId });
                return null;
            }

            await ipcRenderer.invoke('copy-file', {
                sourcePath: finalResult.outputPath,
                destPath: saveResult.filePath
            });

            await ipcRenderer.invoke('export-cleanup', { exportId });

            onProgress?.(1.0, 'Export complete!');
            console.log(`[ElectronExport] GPU export complete: ${saveResult.filePath}`);
            return saveResult.filePath;

        } else {
            // ============================================================
            // CPU PATH — PNG frames to disk (original, unchanged behavior)
            // ============================================================
            console.log('[ElectronExport] Using CPU pipeline (PNG frames)');

            const startResult = await ipcRenderer.invoke('export-start', {
                exportId,
                width,
                height,
                fps,
                totalFrames,
                outputFilename: `${safeName}.mp4`,
                bandStemPath,
                vocalStemPath,
                bandVol,
                vocalVol,
                encoder: actualEncoder
            });

            if (!startResult.success) {
                throw new Error(startResult.error || 'Failed to start export');
            }

            console.log(`[ElectronExport] Export started: ${exportId}`);
            onProgress?.(0.05, 'Rendering frames...');

            // Dynamic batch size
            const estimatedFrameSize = (width * height * 4) / 3;
            const BATCH_SIZE = Math.max(1, Math.floor(40_000_000 / estimatedFrameSize));
            console.log(`[ElectronExport] Batch size: ${BATCH_SIZE} (est frame size: ${(estimatedFrameSize / 1024 / 1024).toFixed(1)}MB)`);
            let frameBuffer = [];

            for (let i = 0; i < totalFrames; i++) {
                const t = i * frameDuration;
                const state = getStateAt(t);

                // Draw frame using Canvas 2D
                drawKaraokeFrame(ctx, {
                    width,
                    height,
                    now: t,
                    showOutro: state.showOutro,
                    outroGap: state.outroGap,
                    showInstrumental: state.showInstrumental,
                    instrumentalGap: state.instrumentalGap,
                    shouldShowLyrics: state.shouldShowLyrics,
                    visibleSentences: state.visibleSentences,
                    outroProgress: state.outroProgress,
                    instrumentalProgress: state.instrumentalProgress,
                    highlightColor: highlightColor
                });

                // Get frame as base64 PNG (lossless)
                const frameData = canvas.toDataURL('image/png').split(',')[1];
                frameBuffer.push({ frameIndex: i, data: frameData });

                // Send batch when full or on last frame
                if (frameBuffer.length >= BATCH_SIZE || i === totalFrames - 1) {
                    await ipcRenderer.invoke('export-frames', {
                        exportId,
                        frames: frameBuffer
                    });
                    frameBuffer = [];

                    const progress = 0.05 + (i / totalFrames) * 0.65;
                    onProgress?.(progress, `Rendering frame ${i + 1}/${totalFrames}`);
                }

                // Yield to UI every 10 frames
                if (i % 10 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            onProgress?.(0.70, 'Encoding video...');

            // Finalize
            const finalResult = await ipcRenderer.invoke('export-finalize', {
                exportId
            });

            if (!finalResult.success) {
                throw new Error(finalResult.error || 'Failed to finalize export');
            }

            onProgress?.(0.90, 'Saving file...');

            // Save dialog
            const saveResult = await ipcRenderer.invoke('show-save-dialog', {
                title: 'Save Karaoke Video',
                defaultPath: `${safeName}.mp4`,
                filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
            });

            if (saveResult.canceled || !saveResult.filePath) {
                await ipcRenderer.invoke('export-cleanup', { exportId });
                return null;
            }

            await ipcRenderer.invoke('copy-file', {
                sourcePath: finalResult.outputPath,
                destPath: saveResult.filePath
            });

            await ipcRenderer.invoke('export-cleanup', { exportId });

            onProgress?.(1.0, 'Export complete!');
            console.log(`[ElectronExport] CPU export complete: ${saveResult.filePath}`);
            return saveResult.filePath;
        }

    } catch (err) {
        console.error('[ElectronExport] Failed:', err);
        // Cleanup GL renderer if still alive
        if (glRenderer) {
            try { destroyGL(glRenderer); } catch (e) { /* ignore */ }
        }
        try {
            await ipcRenderer.invoke('export-cleanup', { exportId });
        } catch (e) { /* ignore */ }
        throw err;
    }
}
