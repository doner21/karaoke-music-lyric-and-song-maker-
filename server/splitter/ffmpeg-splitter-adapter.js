import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPath from 'ffmpeg-static';
import { Storage } from '../downloader/storage.js';

const execAsync = util.promisify(exec);

// FFMPEG Path (resolved from ffmpeg-static npm package)
const FFMPEG_PATH = ffmpegPath;

/**
 * FFmpeg Phase Inversion Vocal Remover
 * 
 * This uses classic audio processing (not AI) to remove center-panned vocals:
 * - Extract L-R difference (removes center channel where vocals typically are)
 * - The result is an instrumental/karaoke track
 * 
 * Quality is lower than AI models but requires NO Python dependencies.
 */
export class FFmpegSplitterAdapter {
    constructor() {
        this.name = 'ffmpeg-phase';
    }

    async checkHealth() {
        try {
            await execAsync(`"${FFMPEG_PATH}" -version`);
            return { available: true };
        } catch (e) {
            return { available: false, error: 'FFmpeg not available' };
        }
    }

    /**
     * Run Phase Inversion Separation
     * @param {string} jobId 
     * @param {string} inputPath - Absolute path to input audio
     * @param {object} options - { modelId: ignored, stems: 2 only }
     * @param {function} onProgress - (percent, logMsg) => void
     */
    async separate(jobId, inputPath, options, onProgress) {
        const outputRoot = Storage.getFilePath(jobId, 'separated');
        await fs.ensureDir(outputRoot);

        const instrumentalPath = path.join(outputRoot, 'instrumental.mp3');
        const vocalPath = path.join(outputRoot, 'vocals.mp3');

        onProgress(0.1, 'Starting FFmpeg Phase Inversion...');

        // Step 1: Create instrumental (L-R difference / center removal)
        // pan=stereo|c0=c0-c1|c1=c1-c0 removes center-panned content
        // Alternative: use stereo widening + center cancellation
        const instrumentalCmd = `"${FFMPEG_PATH}" -i "${inputPath}" -af "pan=stereo|c0=c0-c1|c1=c1-c0" -y "${instrumentalPath}"`;

        try {
            console.log('[FFmpegSplitter] Creating instrumental...');
            await execAsync(instrumentalCmd);
            onProgress(0.5, 'Instrumental created, extracting vocals...');
        } catch (e) {
            console.error('[FFmpegSplitter] Instrumental failed:', e);
            throw new Error(`FFmpeg instrumental failed: ${e.message}`);
        }

        // Step 2: Create vocals (difference between original and instrumental)
        // This is an inversion of the instrumental from the original
        // Use sidechaincompress or simple mix inversion
        // Simpler: just extract the center channel
        const vocalCmd = `"${FFMPEG_PATH}" -i "${inputPath}" -af "pan=mono|c0=0.5*c0+0.5*c1" -ac 2 -y "${vocalPath}"`;

        try {
            console.log('[FFmpegSplitter] Extracting vocals (center channel)...');
            await execAsync(vocalCmd);
            onProgress(0.9, 'Vocals extracted...');
        } catch (e) {
            console.error('[FFmpegSplitter] Vocal extraction failed:', e);
            // Non-fatal, we at least have instrumental
        }

        onProgress(1.0, 'Done');

        const result = {
            modelUsed: 'ffmpeg-phase-inversion',
            files: {
                band: instrumentalPath,
            }
        };

        if (await fs.exists(vocalPath)) {
            result.files.vocals = vocalPath;
        }

        return result;
    }
}
