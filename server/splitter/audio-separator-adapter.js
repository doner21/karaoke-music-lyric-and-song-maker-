import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPath from 'ffmpeg-static';
import { Storage } from '../downloader/storage.js';

const execAsync = util.promisify(exec);

// Path to Venv Python
const VENV_PYTHON = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

// FFMPEG Path Injection (resolved from ffmpeg-static npm package)
const FFMPEG_DIR = path.dirname(ffmpegPath);

export class AudioSeparatorAdapter {
    constructor() {
        this.name = 'audio-separator';
    }

    async checkHealth() {
        try {
            // Check if audio-separator module can be imported
            await execAsync(`"${VENV_PYTHON}" -c "import audio_separator; print(audio_separator.__version__)"`);
            return { available: true };
        } catch (e) {
            console.error('[AudioSeparator] Health Check Failed:', e.message);
            return { available: false, error: 'audio-separator not available' };
        }
    }

    /**
     * Run Separation using audio-separator CLI
     * @param {string} jobId 
     * @param {string} inputPath - Absolute path to input audio
     * @param {object} options - { modelId: 'htdemucs'|'UVR-MDX-NET-Inst_HQ_3', stems: 2|4 }
     * @param {function} onProgress - (percent, logMsg) => void
     */
    async separate(jobId, inputPath, options, onProgress) {
        const { modelId = 'htdemucs', stems = 2 } = options;

        // Output Dir: downloads/{jobId}/separated
        const outputRoot = Storage.getFilePath(jobId, 'separated');
        await fs.ensureDir(outputRoot);

        // audio-separator CLI:
        // audio-separator <input> -m <model> --output_dir <output>
        // Models: htdemucs, UVR-MDX-NET-Inst_HQ_3, etc.

        // Construct command with ffmpeg path in environment
        const ffmpegDllsDir = path.join(process.cwd(), 'ffmpeg-dlls');
        const env = {
            ...process.env,
            PATH: `${ffmpegDllsDir};${FFMPEG_DIR};${process.env.PATH}`
        };

        // audio-separator uses different model naming
        // For 2-stem (vocals only), use UVR-MDX-NET models or htdemucs with --two_stems
        // For simplicity, just run and let it output all stems, then pick what we need.

        const cmd = `"${VENV_PYTHON}" -m audio_separator.utils.cli "${inputPath}" --model_filename "${modelId}" --output_dir "${outputRoot}"`;

        console.log(`[AudioSeparator] Cmd: ${cmd}`);
        onProgress(0.01, `Starting Audio Separator (${modelId})...`);

        return new Promise((resolve, reject) => {
            const child = exec(cmd, { env, maxBuffer: 50 * 1024 * 1024 }); // 50MB buffer for progress output

            child.stdout.on('data', (d) => {
                const s = d.toString();
                console.log('[AudioSeparator]', s);
                // Try to parse progress from output (often percentage-based)
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) onProgress(parseInt(m[1]) / 100);
                }
            });

            child.stderr.on('data', (d) => {
                const s = d.toString();
                console.log('[AudioSeparator Stderr]', s);
                // Progress often in stderr for tqdm
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) onProgress(parseInt(m[1]) / 100);
                }
            });

            child.on('close', async (code) => {
                if (code !== 0) {
                    return reject(new Error(`audio-separator exited with code ${code}`));
                }

                onProgress(0.95, 'Finalizing...');

                // audio-separator outputs files like:
                // <original_filename>_(Vocals)_<model>.mp3
                // <original_filename>_(Instrumental)_<model>.mp3

                try {
                    const files = await fs.readdir(outputRoot);
                    console.log('[AudioSeparator] Output Files:', files);

                    const result = {
                        modelUsed: modelId,
                        files: {}
                    };

                    // Find vocals and instrumental
                    const vocalFile = files.find(f => f.toLowerCase().includes('vocal'));
                    const instrFile = files.find(f => f.toLowerCase().includes('instrumental') || f.toLowerCase().includes('no_vocal'));

                    if (vocalFile) result.files.vocals = path.join(outputRoot, vocalFile);
                    if (instrFile) result.files.band = path.join(outputRoot, instrFile);

                    // For 4-stems, check for drums, bass, other
                    const drumsFile = files.find(f => f.toLowerCase().includes('drum'));
                    const bassFile = files.find(f => f.toLowerCase().includes('bass'));
                    const otherFile = files.find(f => f.toLowerCase().includes('other'));

                    if (drumsFile) result.files.drums = path.join(outputRoot, drumsFile);
                    if (bassFile) result.files.bass = path.join(outputRoot, bassFile);
                    if (otherFile) result.files.other = path.join(outputRoot, otherFile);

                    // Fallback: if no band found but other stems exist
                    if (!result.files.band && result.files.other) {
                        result.files.band = result.files.other;
                    }

                    onProgress(1.0, 'Done');
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
