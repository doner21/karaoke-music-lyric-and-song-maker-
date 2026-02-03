
import { spawn } from 'child_process';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

/**
 * Generates a waveform (array of peaks) from an audio file.
 * 
 * @param {string} inputPath - Absolute path to the audio file
 * @param {Object} options
 * @param {number} options.samples - Number of samples (peaks) to generate (default: 1000)
 * @returns {Promise<number[]>} - Array of normalized peaks (0.0 to 1.0)
 */
export async function generateWaveform(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const samples = options.samples || 1000;
        const result = [];

        // Strategy:
        // 1. Convert to raw PCM (s16le), mono, specific sample rate depending on duration (streaming)
        // However, duration is needed to calculate window size.
        // Simplified approach: Stream all PCM data and use a reservoir sampling or chunking on the fly?
        // Or simpler: Convert to a fixed low sample rate (e.g. 4000Hz) and then downsample in JS.

        // Let's use 4000Hz, mono, s16le.
        // 1 second = 4000 samples. 3 mins = 720,000 samples.
        // This is manageable in memory.

        const SAMPLE_RATE = 4000;



        // ...

        console.log(`[Waveform] Spawning ffmpeg (${ffmpegPath}) for: ${path.basename(inputPath)}`);

        const ffmpeg = spawn(ffmpegPath, [
            '-i', inputPath,
            '-f', 's16le',       // raw PCM 16-bit little-endian
            '-ac', '1',          // mono
            '-ar', SAMPLE_RATE.toString(),
            '-acodec', 'pcm_s16le',
            'pipe:1'             // output to stdout
        ]);

        const chunks = [];
        let totalBytes = 0;

        ffmpeg.stdout.on('data', (chunk) => {
            chunks.push(chunk);
            totalBytes += chunk.length;
        });

        ffmpeg.stderr.on('data', (d) => {
            // console.log('[ffmpeg stderr]', d.toString()); // Too verbose
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`ffmpeg exited with code ${code}`));
            }

            console.log(`[Waveform] ffmpeg finished. Total bytes: ${totalBytes}`);

            // Combine chunks
            const fullBuffer = Buffer.concat(chunks);

            // Process PCM data (16-bit = 2 bytes per sample)
            const numRawSamples = Math.floor(totalBytes / 2);
            const rawData = new Int16Array(numRawSamples);

            for (let i = 0; i < numRawSamples; i++) {
                rawData[i] = fullBuffer.readInt16LE(i * 2);
            }

            // Downsample to target `samples` count (e.g. 1000 peaks)
            // Or better: Return a larger set of peaks (e.g. 1 per 100ms) and let UI scale?
            // To match UI "pxPerMs", we ideally want density.
            // But transferring huge JSON is bad.
            // Let's return a fixed resolution, e.g. 1 peak per 100ms?
            // If track is 5 mins (300s) -> 3000 points. Very small JSON.
            // 4000Hz -> 400 samples per 100ms.

            // Let's aim for ~50-100 points per second for good detail.
            // 100 pts/sec * 300s = 30,000 points. JSON array [0.05, 0.1, ...] is approx 150KB. Fine.

            const POINTS_PER_SECOND = 50;
            const samplesPerWindow = Math.floor(SAMPLE_RATE / POINTS_PER_SECOND);

            const waveform = [];

            for (let i = 0; i < rawData.length; i += samplesPerWindow) {
                let min = 0;
                let max = 0;

                // Find max amplitude in window
                for (let j = 0; j < samplesPerWindow && (i + j) < rawData.length; j++) {
                    const val = rawData[i + j];
                    if (val > max) max = val;
                    if (val < min) min = val; // min is negative usually
                }

                // Normalize 16-bit signed (-32768 to 32767) to 0.0-1.0 range based on max abs
                const peak = Math.max(Math.abs(min), Math.abs(max));
                waveform.push(Number((peak / 32768).toFixed(4)));
            }

            resolve(waveform);
        });

        ffmpeg.on('error', (err) => {
            reject(err);
        });
    });
}
