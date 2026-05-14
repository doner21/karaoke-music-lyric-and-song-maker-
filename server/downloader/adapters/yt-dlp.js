import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { DownloadEngine } from '../engine-interface.js';

const ffmpegDir = path.dirname(ffmpegPath);

const execAsync = util.promisify(exec);

export class YtDlpAdapter extends DownloadEngine {
    constructor() {
        super();
        this.name = 'yt-dlp';
    }

    async checkHealth() {
        try {
            await execAsync('python -m yt_dlp --version');
            return { available: true };
        } catch (e) {
            return { available: false, error: 'yt-dlp binary not found' };
        }
    }

    async getMetadata(videoId) {
        try {
            const { stdout } = await execAsync(`python -m yt_dlp --dump-json "https://www.youtube.com/watch?v=${videoId}"`);
            const info = JSON.parse(stdout);
            return {
                title: info.title,
                channel: info.uploader,
                duration: info.duration,
                thumbnail: info.thumbnail,
                source: 'youtube'
            };
        } catch (e) {
            throw new Error(`YtDlp Metadata: ${e.message}`);
        }
    }

    async download(jobId, request, storage, onProgress) {
        const videoId = request.video?.videoId || request.videoId;
        const outputPath = storage.getAbsolutePath(jobId, '%(title)s.%(ext)s'); // yt-dlp template

        console.log(`[YtDlp] Starting download for ${videoId}`);

        return new Promise((resolve, reject) => {
            // --extract-audio --audio-format mp3
            const cmd = `python -m yt_dlp -x --audio-format mp3 --output "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`;

            const process = exec(cmd);

            process.stdout.on('data', (data) => {
                const str = data.toString();
                // [download]  23.5% of 3.44MiB at 45.67KiB/s ETA 01:00
                if (str.includes('[download]')) {
                    const match = str.match(/(\d+\.\d+)%/);
                    if (match) {
                        const percent = parseFloat(match[1]) / 100;
                        onProgress(percent);
                    }
                }
            });

            process.stderr.on('data', (data) => {
                console.error(`[YtDlp Error]: ${data}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    // Find the file. yt-dlp replaces template. 
                    // We need to know the actual filename.
                    // Simple hack used in spec: we can use fixed filename if we trust concurrency isolation
                    // But yt-dlp output templates are powerful.
                    // The storage.js getAbsolutePath assumes we know the filename. 
                    // Let's use a fixed name for simplicity in this context: 'audio.%(ext)s'

                    // Re-run safely? Or just list dir?
                    // Let's rely on standard 'audio.mp3' if we force it.
                    // Modified cmd below for fixed output.
                    resolve([{
                        type: 'audio',
                        filename: 'audio.mp3', // We forced it
                        path: storage.getFilePath(jobId, 'audio.mp3'),
                        format: 'mp3'
                    }]);
                } else {
                    reject(new Error(`yt-dlp exited with code ${code}`));
                }
            });
        });
    }

    // Override for download to use fixed filename with MP3 conversion
    async download_fixed(jobId, request, storage, onProgress) {
        const videoId = request.video?.videoId || request.videoId;
        // Fixed filename 'audio.mp3' in the job folder
        const outputTemplate = storage.getAbsolutePath(jobId, 'audio.%(ext)s');

        // FFMPEG Path Injection for MP3 conversion (ffmpegDir set at module level from ffmpeg-static)

        // Convert to MP3 using yt-dlp's --extract-audio --audio-format mp3
        // This requires ffmpeg, so we inject ffmpeg path
        const cmd = `python -m yt_dlp -x --audio-format mp3 --ffmpeg-location "${ffmpegDir}" --output "${outputTemplate}" "https://www.youtube.com/watch?v=${videoId}"`;

        console.log(`[YtDlp] Starting download for ${videoId}`);
        console.log(`[YtDlp] Command: ${cmd}`);

        return new Promise((resolve, reject) => {
            const child = exec(cmd);
            child.stdout.on('data', d => {
                const s = d.toString();
                if (s.includes('%')) {
                    const m = s.match(/(\d+\.?\d*)%/);
                    if (m) onProgress(parseFloat(m[1]) / 100);
                }
            });
            child.stderr.on('data', d => {
                const s = d.toString();
                console.log('[YtDlp Stderr]', s);
                if (s.includes('%')) {
                    const m = s.match(/(\d+\.?\d*)%/);
                    if (m) onProgress(parseFloat(m[1]) / 100);
                }
            });
            child.on('close', async (code) => {
                // Check for audio.mp3 file
                try {
                    const fs = await import('fs-extra');
                    const path = await import('path');

                    const jobDir = storage.getAbsolutePath(jobId, '');
                    const mp3Path = path.default.join(jobDir, 'audio.mp3');

                    if (await fs.default.exists(mp3Path)) {
                        resolve([{
                            type: 'audio',
                            filename: 'audio.mp3',
                            path: mp3Path,
                            format: 'mp3'
                        }]);
                    } else {
                        // Fallback: check for any audio file
                        const files = await fs.default.readdir(jobDir);
                        const audioFile = files.find(f => f.startsWith('audio.') && !f.endsWith('.json'));

                        if (audioFile) {
                            resolve([{
                                type: 'audio',
                                filename: audioFile,
                                path: storage.getFilePath(jobId, audioFile),
                                format: path.default.extname(audioFile).substring(1)
                            }]);
                        } else {
                            if (code === 0) reject(new Error('yt-dlp success but no file found'));
                            else reject(new Error(`yt-dlp error ${code}`));
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}

// Monkey patch the download method to use the fixed version
YtDlpAdapter.prototype.download = YtDlpAdapter.prototype.download_fixed;
