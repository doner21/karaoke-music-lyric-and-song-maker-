import { useState, useCallback } from 'react';
import { exportToMp4Electron } from '../utils/electronExport';
import { normalizeLyrics } from '../utils/lyricsTimingNormalizer';

const API_URL = 'http://localhost:3002';

/**
 * Hook for exporting karaoke video via Electron frame-based export
 * 
 * Uses the same canvas rendering as preview mode for pixel-perfect output.
 * 
 * Requirements:
 * - Lyrics centered in middle of screen
 * - Instrumental and outro sections rendered
 * - White base lyrics, green highlighted lyrics
 * - Output filename matches original YouTube video title
 */
export function useKaraokeExport({
    songId, // Song ID to fetch stem paths from server
    bandVolume = 1,
    vocalVolume = 1,
    timingJson, // alignResult - raw timing data from AudioShake
    linesPerPage = 4,
    highlightColor = '#7CB87C', // Green highlight
    trackDuration,
    songTitle = 'karaoke-export'
}) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportError, setExportError] = useState(null);

    /**
     * Start the MP4 export
     */
    const startExport = useCallback(async () => {
        if (!songId) {
            setExportError('No song selected');
            return;
        }
        if (!timingJson) {
            setExportError('Lyrics timing data not available - please align lyrics first');
            return;
        }
        if (!trackDuration) {
            setExportError('Track duration not available');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);
        setExportError(null);

        try {
            // Step 1: Get stem file paths from server
            setExportProgress(0.02);
            console.log('[Export] Fetching stem paths for song:', songId);

            const artifactsRes = await fetch(`${API_URL}/api/library/songs/${songId}/artifacts`);
            if (!artifactsRes.ok) {
                throw new Error('Failed to fetch artifacts');
            }
            const artifacts = await artifactsRes.json();

            const vocalArtifact = artifacts.find(a => a.kind === 'vocal_stem');
            const bandArtifact = artifacts.find(a => a.kind === 'band_stem');

            if (!vocalArtifact || !bandArtifact) {
                throw new Error('Stem files not available - please split song first');
            }

            // Get the file paths from the storagePath field (or fetch via API if not included)
            let bandStemPath = bandArtifact.storagePath;
            let vocalStemPath = vocalArtifact.storagePath;

            // If paths aren't included in artifacts response, fetch them from server
            if (!bandStemPath || !vocalStemPath) {
                console.log('[Export] Stem paths not in artifacts, fetching from server...');
                const pathsRes = await fetch(`${API_URL}/api/library/songs/${songId}/stem-paths`);
                if (pathsRes.ok) {
                    const paths = await pathsRes.json();
                    bandStemPath = paths.bandPath;
                    vocalStemPath = paths.vocalPath;
                }
            }

            if (!bandStemPath || !vocalStemPath) {
                throw new Error('Could not get stem file paths from server');
            }

            console.log('[Export] Stem paths:', { bandStemPath, vocalStemPath });

            // Step 2: Normalize lyrics timing data
            const normalized = normalizeLyrics(timingJson, trackDuration);

            // Convert to the format expected by export (same as preview mode)
            const lyrics = normalized.lines.map((line, si) => ({
                _si: si, // Sentence index for color lookup
                sentence: {
                    start: line.startTime,
                    end: line.endTime,
                    text: line.text
                },
                words: line.words.map(w => ({
                    text: w.text,
                    start: w.startTime,
                    end: w.endTime
                }))
            }));

            const allWords = normalized.lines.flatMap(line =>
                line.words.map(w => ({
                    text: w.text,
                    start: w.startTime,
                    end: w.endTime
                }))
            );

            console.log('[Export] Starting export:', {
                lyrics: lyrics.length,
                allWords: allWords.length,
                duration: trackDuration,
                highlightColor,
                bandStemPath,
                vocalStemPath
            });

            // Step 3: Call the Electron-based export
            await exportToMp4Electron({
                width: 1280,
                height: 720,
                fps: 30,
                totalDuration: trackDuration,
                lyrics,
                allWords,
                linesPerPage,
                highlightColor,
                songTitle,
                bandStemPath,
                vocalStemPath,
                bandVol: bandVolume,
                vocalVol: vocalVolume,
                onProgress: (progress, message) => {
                    setExportProgress(progress);
                    console.log(`[Export] ${Math.round(progress * 100)}%: ${message}`);
                }
            });

            setExportProgress(1);
            console.log('[Export] Complete!');

        } catch (err) {
            console.error('[Export] Error:', err);
            setExportError(err.message || 'Export failed');
        } finally {
            setIsExporting(false);
        }
    }, [songId, bandVolume, vocalVolume, timingJson, linesPerPage, highlightColor, trackDuration, songTitle]);

    return {
        isExporting,
        exportProgress,
        exportError,
        startExport
    };
}
