/**
 * FFmpeg-based Karaoke Video Export Service
 * Uses ASS (Advanced SubStation Alpha) karaoke subtitles for word-by-word highlighting
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const execAsync = promisify(exec);

// FFmpeg path (resolved from ffmpeg-static npm package)
const FFMPEG_PATH = ffmpegPath;

/**
 * Convert hex color to ASS BGR format
 * ASS uses &HBBGGRR& format
 */
function hexToAssBgr(hex) {
    const cleanHex = hex.replace('#', '');
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    return `&H00${b}${g}${r}&`; // Format: &HBBGGRR&
}

/**
 * Format time as ASS timestamp: h:mm:ss.cc (centiseconds)
 */
function formatAssTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Generate ASS subtitle file with karaoke styling
 * Uses \k tag for word-by-word highlighting
 */
function generateKaraokeAss(lyricsData, highlightColor = '#7CB87C', durationSec = 180) {
    const highlightBgr = hexToAssBgr(highlightColor);

    // DEBUG: Log what we receive
    console.log('[ASS Generator] Received lyricsData type:', typeof lyricsData);
    console.log('[ASS Generator] lyricsData structure:', JSON.stringify(lyricsData).substring(0, 500));

    // ASS Header with simple white text style
    let ass = `[Script Info]
Title: Karaoke Export
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,56,&H00FFFFFF&,${highlightBgr},&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,1,3,2,2,20,20,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Extract lines/sentences and words from lyricsData
    // Handle various possible formats
    let lines = [];

    if (lyricsData?.lines && Array.isArray(lyricsData.lines)) {
        lines = lyricsData.lines;
        console.log('[ASS Generator] Using lyricsData.lines:', lines.length, 'lines');
    } else if (lyricsData?.lyrics && Array.isArray(lyricsData.lyrics)) {
        lines = lyricsData.lyrics;
        console.log('[ASS Generator] Using lyricsData.lyrics:', lines.length, 'lines');
    } else if (Array.isArray(lyricsData)) {
        lines = lyricsData;
        console.log('[ASS Generator] Using lyricsData as array:', lines.length, 'lines');
    } else {
        console.log('[ASS Generator] WARNING: Could not extract lines from lyricsData');
        console.log('[ASS Generator] Keys:', Object.keys(lyricsData || {}));
    }

    if (lines.length === 0) {
        console.log('[ASS Generator] No lines found, creating placeholder subtitle');
        // Create a simple test subtitle
        ass += `Dialogue: 0,0:00:01.00,0:00:10.00,Default,,0,0,0,,No lyrics data available\n`;
        return ass;
    }

    // Generate dialogue events for each line
    let lineCount = 0;
    for (const line of lines) {
        if (!line) continue;

        // Try to extract words from various formats
        let words = line.words || [];
        let lineText = '';
        let lineStart = 0;
        let lineEnd = 10;

        // Handle sentence wrapper format: { sentence: {...}, words: [...] }
        if (line.sentence) {
            lineText = line.sentence.text || '';
            lineStart = line.sentence.start || 0;
            lineEnd = line.sentence.end || lineStart + 5;
        }

        // Handle flat format: { text: '...', startTime: ..., words: [...] }
        if (line.text && !lineText) {
            lineText = line.text;
        }
        if (line.startTime !== undefined) {
            lineStart = line.startTime;
        }
        if (line.endTime !== undefined) {
            lineEnd = line.endTime;
        }

        // Get text from words if no lineText
        if (!lineText && words.length > 0) {
            lineText = words.map(w => w.text || w.word || '').join(' ');
        }

        // Get timing from words if needed
        if (words.length > 0) {
            const firstWord = words[0];
            const lastWord = words[words.length - 1];
            if (firstWord && (firstWord.startTime !== undefined || firstWord.start !== undefined)) {
                lineStart = firstWord.startTime ?? firstWord.start ?? lineStart;
            }
            if (lastWord && (lastWord.endTime !== undefined || lastWord.end !== undefined)) {
                lineEnd = lastWord.endTime ?? lastWord.end ?? lineEnd;
            }
        }

        if (!lineText) {
            console.log('[ASS Generator] Skipping line with no text:', line);
            continue;
        }

        // Build karaoke text with \k tags for word highlighting
        let karaokeText = '';

        if (words.length > 0) {
            // Word-by-word karaoke timing
            let prevEnd = lineStart;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const wordText = word.text || word.word || '';
                const wordStart = word.startTime ?? word.start ?? prevEnd;
                const wordEnd = word.endTime ?? word.end ?? wordStart + 0.3;

                // Duration of the word being highlighted in centiseconds
                const highlightDuration = Math.max(10, Math.round((wordEnd - wordStart) * 100));

                // Use \kf for fill effect (progressive fill)
                karaokeText += `{\\kf${highlightDuration}}${wordText} `;

                prevEnd = wordEnd;
            }
        } else {
            // No word timing, just show the whole line
            karaokeText = lineText;
        }

        // Add dialogue event
        ass += `Dialogue: 0,${formatAssTime(lineStart)},${formatAssTime(lineEnd)},Default,,0,0,0,,${karaokeText.trim()}\n`;
        lineCount++;
    }

    console.log('[ASS Generator] Generated', lineCount, 'dialogue lines');
    return ass;
}

/**
 * Export karaoke video using FFmpeg with ASS subtitles
 */
export async function exportKaraokeVideo({
    bandStemPath,
    vocalStemPath,
    bandVolume = 1,
    vocalVolume = 1,
    lyricsData,
    durationSec = 180,
    highlightColor = '#7CB87C',
    outputPath,
    onProgress
}) {
    const projectRoot = process.cwd();
    const tempDir = path.join(projectRoot, 'temp-export');

    // Ensure temp dir exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const assPath = path.join(tempDir, `karaoke-${timestamp}.ass`);
    const mixedAudioPath = path.join(tempDir, `audio-${timestamp}.mp3`);

    try {
        // Verify FFmpeg exists
        try {
            await execAsync(`"${FFMPEG_PATH}" -version`);
            console.log('[Export] FFmpeg verified at:', FFMPEG_PATH);
        } catch (e) {
            throw new Error('FFmpeg not available at: ' + FFMPEG_PATH);
        }

        onProgress?.(0.05, 'Generating subtitle file...');

        // 1. Generate ASS subtitle file
        const assContent = generateKaraokeAss(lyricsData, highlightColor, durationSec);
        fs.writeFileSync(assPath, assContent, 'utf-8');
        console.log('[Export] ASS file written to:', assPath);
        console.log('[Export] ASS content length:', assContent.length, 'bytes');

        onProgress?.(0.1, 'Mixing audio tracks...');

        // 2. Mix audio with FFmpeg
        const mixCmd = `"${FFMPEG_PATH}" -y ` +
            `-i "${bandStemPath}" ` +
            `-i "${vocalStemPath}" ` +
            `-filter_complex "[0:a]volume=${bandVolume}[a0];[1:a]volume=${vocalVolume}[a1];[a0][a1]amix=inputs=2:duration=longest[aout]" ` +
            `-map "[aout]" ` +
            `-c:a libmp3lame -q:a 2 ` +
            `"${mixedAudioPath}"`;

        console.log('[Export] Mixing audio...');
        try {
            await execAsync(mixCmd, { maxBuffer: 50 * 1024 * 1024 });
        } catch (mixErr) {
            console.error('[Export] Audio mix failed:', mixErr.message);
            throw new Error('Audio mixing failed: ' + mixErr.message);
        }

        // Verify audio file was created
        if (!fs.existsSync(mixedAudioPath)) {
            throw new Error('Mixed audio file was not created');
        }
        const audioStats = fs.statSync(mixedAudioPath);
        console.log('[Export] Mixed audio size:', audioStats.size, 'bytes');

        onProgress?.(0.4, 'Creating video with lyrics...');

        // 3. Create video with black background, burned-in subtitles, and audio
        // Use subtitles filter instead of ass filter for better Windows compatibility
        // The path needs special escaping for FFmpeg's subtitles filter on Windows
        const escapedAssPath = assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

        const videoCmd = `"${FFMPEG_PATH}" -y ` +
            `-f lavfi -i "color=c=black:s=1280x720:r=30:d=${durationSec}" ` +
            `-i "${mixedAudioPath}" ` +
            `-vf "subtitles='${escapedAssPath}'" ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-c:a aac -b:a 192k ` +
            `-shortest ` +
            `-pix_fmt yuv420p ` +
            `"${outputPath}"`;

        console.log('[Export] Video command:', videoCmd);

        try {
            const { stdout, stderr } = await execAsync(videoCmd, { maxBuffer: 100 * 1024 * 1024 });
            console.log('[Export] FFmpeg completed');
            if (stderr) {
                console.log('[Export] FFmpeg stderr (last 1000 chars):', stderr.slice(-1000));
            }
        } catch (videoErr) {
            console.error('[Export] Video creation failed:', videoErr.message);
            console.error('[Export] stderr:', videoErr.stderr?.slice(-1000));
            throw new Error('Video creation failed: ' + videoErr.message);
        }

        onProgress?.(0.9, 'Cleaning up...');

        // 4. Verify output exists and has content
        if (!fs.existsSync(outputPath)) {
            throw new Error('Output file was not created');
        }
        const stats = fs.statSync(outputPath);
        console.log('[Export] Output file size:', stats.size, 'bytes');

        if (stats.size < 10000) {
            throw new Error(`Output file too small (${stats.size} bytes) - encoding may have failed`);
        }

        // 5. Cleanup temp files
        try {
            fs.unlinkSync(assPath);
            fs.unlinkSync(mixedAudioPath);
        } catch (e) {
            console.warn('[Export] Cleanup warning:', e.message);
        }

        onProgress?.(1.0, 'Export complete');
        console.log('[Export] Success! Output:', outputPath, 'Size:', stats.size);

        return { success: true, outputPath, fileSize: stats.size };

    } catch (err) {
        console.error('[Export] Failed:', err);

        // Cleanup on error
        try {
            if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
            if (fs.existsSync(mixedAudioPath)) fs.unlinkSync(mixedAudioPath);
        } catch (e) { /* ignore */ }

        throw err;
    }
}
