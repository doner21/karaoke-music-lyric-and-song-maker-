import { drawKaraokeFrame } from './karaokeDrawer';
import { computeInstrumentalGap, computeOutroGap } from './karaokeHelpers';

/**
 * Export karaoke video to MP4 using canvas rendering + Electron IPC + server-side FFmpeg
 * 
 * This approach:
 * 1. Renders frames client-side using the same drawKaraokeFrame as preview (pixel-perfect match)
 * 2. Streams frames to Electron main process via IPC
 * 3. Main process encodes to video with FFmpeg and mixes audio from stem files
 * 
 * Requirements implemented:
 * - Lyrics centered in middle of screen (drawKaraokeFrame)
 * - Instrumental and outro sections rendered
 * - White base lyrics, green highlighted lyrics
 * - Output filename matches original YouTube video title
 */
export async function exportToMp4Electron({
    width = 1280,
    height = 720,
    fps = 30,
    totalDuration,
    lyrics, // array of sentences with words
    allWords,
    linesPerPage = 4,
    highlightColor = '#7CB87C', // Green highlight
    songTitle = 'karaoke-export',
    bandStemPath, // Path to band stem file on disk
    vocalStemPath, // Path to vocal stem file on disk
    bandVol = 1,
    vocalVol = 1,
    onProgress
}) {
    // Check for Electron IPC
    const isElectron = typeof window !== 'undefined' && window.require;
    if (!isElectron) {
        throw new Error('This export method requires Electron');
    }

    const { ipcRenderer } = window.require('electron');

    // Prepare export parameters
    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDuration = 1 / fps;

    console.log(`[ElectronExport] Starting export: ${width}x${height}@${fps}fps, ${totalFrames} frames, ${totalDuration.toFixed(2)}s`);
    console.log(`[ElectronExport] Lyrics: ${lyrics?.length || 0} lines, ${allWords?.length || 0} words`);
    console.log(`[ElectronExport] Stems: band=${bandStemPath}, vocal=${vocalStemPath}`);

    onProgress?.(0.01, 'Preparing export...');

    // Create offscreen canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get 2D context');
    }

    // Helper to compute state at time t (same as fastExport.js and preview)
    const getStateAt = (t) => {
        // Instrumental gap detection
        const instGap = computeInstrumentalGap(allWords, t, 8);
        const adjEnd = instGap ? Math.max(instGap.start, instGap.end - 3) : null;
        const showInst = !!(instGap && t >= instGap.start && t < (adjEnd ?? instGap.end));
        const instProg = showInst ? (t - instGap.start) / Math.max(instGap.duration - 3, 0.001) : 0;

        // Outro gap detection
        const trackEnd = totalDuration;
        const outroGap = computeOutroGap(allWords, t, trackEnd, 0);
        const showOutro = !!outroGap;
        const outroProg = showOutro ? (t - outroGap.start) / Math.max(outroGap.duration, 0.001) : 0;

        // Lyrics pagination
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

    // Step 1: Start the FFmpeg export process
    const exportId = `export-${Date.now()}`;
    const safeName = songTitle.replace(/[<>:"/\\|?*]/g, '_');

    try {
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
            vocalVol
        });

        if (!startResult.success) {
            throw new Error(startResult.error || 'Failed to start export');
        }

        console.log(`[ElectronExport] Export started: ${exportId}`);

        onProgress?.(0.05, 'Rendering frames...');

        // Step 2: Render and stream frames
        // Dynamic batch size — PNG frames are ~40x larger than JPEG.
        // Scale batch size inversely with resolution to keep IPC payload ~40MB.
        const estimatedFrameSize = (width * height * 4) / 3; // rough PNG size estimate
        const BATCH_SIZE = Math.max(1, Math.floor(40_000_000 / estimatedFrameSize));
        console.log(`[ElectronExport] Batch size: ${BATCH_SIZE} (est frame size: ${(estimatedFrameSize / 1024 / 1024).toFixed(1)}MB)`);
        let frameBuffer = [];

        for (let i = 0; i < totalFrames; i++) {
            const t = i * frameDuration;
            const state = getStateAt(t);

            // Draw frame using exact same function as preview
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

            // Get frame as base64 PNG (lossless — preserves text anti-aliasing)
            const frameData = canvas.toDataURL('image/png').split(',')[1];
            frameBuffer.push({ frameIndex: i, data: frameData });

            // Send batch when full or on last frame
            if (frameBuffer.length >= BATCH_SIZE || i === totalFrames - 1) {
                await ipcRenderer.invoke('export-frames', {
                    exportId,
                    frames: frameBuffer
                });
                frameBuffer = [];

                // Update progress (5% to 70% is frame rendering)
                const progress = 0.05 + (i / totalFrames) * 0.65;
                onProgress?.(progress, `Rendering frame ${i + 1}/${totalFrames}`);
            }

            // Yield to UI every 10 frames to keep responsive
            if (i % 10 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        onProgress?.(0.70, 'Encoding video...');

        // Step 3: Finalize export (encode video, mix audio, combine)
        const finalResult = await ipcRenderer.invoke('export-finalize', {
            exportId
        });

        if (!finalResult.success) {
            throw new Error(finalResult.error || 'Failed to finalize export');
        }

        onProgress?.(0.90, 'Saving file...');

        // Step 4: Show save dialog and copy file
        const saveResult = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Save Karaoke Video',
            defaultPath: `${safeName}.mp4`,
            filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
        });

        if (saveResult.canceled || !saveResult.filePath) {
            // Clean up temp file
            await ipcRenderer.invoke('export-cleanup', { exportId });
            return null;
        }

        // Copy temp file to user's chosen location
        await ipcRenderer.invoke('copy-file', {
            sourcePath: finalResult.outputPath,
            destPath: saveResult.filePath
        });

        // Cleanup temp file
        await ipcRenderer.invoke('export-cleanup', { exportId });

        onProgress?.(1.0, 'Export complete!');
        console.log(`[ElectronExport] Complete: ${saveResult.filePath}`);

        return saveResult.filePath;

    } catch (err) {
        console.error('[ElectronExport] Failed:', err);
        // Try to cleanup
        try {
            await ipcRenderer.invoke('export-cleanup', { exportId });
        } catch (e) { /* ignore */ }
        throw err;
    }
}
