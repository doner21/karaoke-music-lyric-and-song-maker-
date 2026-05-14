import { exec, spawn } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPath from 'ffmpeg-static';
import { Storage } from '../downloader/storage.js';

const execAsync = util.promisify(exec);

// Path to Venv Python
const VENV_PYTHON = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

// FFMPEG Path (resolved from ffmpeg-static npm package)
const FFMPEG_PATH = ffmpegPath;
const FFMPEG_DIR = path.dirname(ffmpegPath);

export class UVRMDXNetAdapter {
    constructor() {
        this.name = 'uvr-mdx-net';
        this.supportedModels = [
            'UVR-MDX-NET-Inst_Main',
            'UVR-MDX-NET-Inst_HQ_1',
            'UVR-MDX-NET-Inst_HQ_3'
        ];
    }

    async checkHealth() {
        try {
            // Verify audio_separator module is importable
            await execAsync(`"${VENV_PYTHON}" -c "from audio_separator.separator import Separator; print('OK')"`);
            console.log('[UVR-MDX-NET] Health Check: available');
            return { available: true };
        } catch (e) {
            console.error('[UVR-MDX-NET] Health Check Failed:', e.message);
            return { available: false, error: 'audio-separator not available' };
        }
    }

    /**
     * Run Separation using audio-separator with UVR-MDX-NET model
     * @param {string} jobId 
     * @param {string} inputPath - Absolute path to input audio
     * @param {object} options - { modelId: 'uvr-mdx-inst-main', stems: 2 }
     * @param {function} onProgress - (percent, logMsg) => void
     */
    async separate(jobId, inputPath, options, onProgress) {
        onProgress(0, `[UVR-MDX-NET] Starting separation...`);

        // UVR-MDX-NET only supports 2-stem (vocals + instrumental)
        const stems = 2; // Force 2-stem

        // Map frontend modelId to actual model filename
        let modelFilename = 'UVR-MDX-NET-Inst_Main.onnx';
        const modelId = options.modelId?.toLowerCase() || '';
        if (modelId.includes('hq_1') || modelId.includes('hq-1')) {
            modelFilename = 'UVR-MDX-NET-Inst_HQ_1.onnx';
        } else if (modelId.includes('hq_3') || modelId.includes('hq-3')) {
            modelFilename = 'UVR-MDX-NET-Inst_HQ_3.onnx';
        }

        console.log(`[UVR-MDX-NET] Using model: ${modelFilename}`);
        onProgress(0.01, `Model: ${modelFilename}`);

        // Output Dir: downloads/{jobId}/separated
        const outputRoot = Storage.getFilePath(jobId, 'separated');
        await fs.ensureDir(outputRoot);

        // Environment with FFmpeg in PATH (includes shared DLLs for torchcodec)
        const ffmpegDllsDir = path.join(process.cwd(), 'ffmpeg-dlls');
        const env = {
            ...process.env,
            PATH: `${ffmpegDllsDir};${FFMPEG_DIR};${process.env.PATH}`
        };

        // === CRITICAL: Pre-convert to 44.1kHz WAV for alignment integrity ===
        const wavPath = path.join(outputRoot, 'input_canonical.wav');

        // Verify input file exists and has content
        const stat = await fs.stat(inputPath).catch(() => null);
        if (!stat || stat.size === 0) {
            throw new Error(`[UVR-MDX-NET] Input file invalid or empty: ${inputPath}`);
        }

        onProgress(0.02, 'Canonicalizing audio format (44.1kHz WAV)...');
        console.log(`[UVR-MDX-NET] Pre-converting ${inputPath} -> ${wavPath}`);

        try {
            await execAsync(`"${FFMPEG_PATH}" -y -i "${inputPath}" -ar 44100 -ac 2 "${wavPath}"`);
            console.log('[UVR-MDX-NET] Audio conversion successful');
        } catch (e) {
            console.error('[UVR-MDX-NET] Audio conversion failed:', e);
            throw new Error(`[UVR-MDX-NET] Audio conversion failed: ${e.message}`);
        }

        // Build command with critical MDX parameters for alignment
        // Use python -m (NOT the .exe wrapper — fragile on Windows spawn)
        const args = [
            '-m', 'audio_separator.utils.cli',
            wavPath,
            '--model_filename', modelFilename,
            '--output_dir', outputRoot,
            '--mdx_segment_size', '256',
            '--sample_rate', '44100',
            '--output_format', 'MP3'
        ];

        console.log(`[UVR-MDX-NET] Spawning: ${VENV_PYTHON} ${args.join(' ')}`);
        onProgress(0.05, `Running UVR-MDX-NET (${modelFilename})...`);

        return new Promise((resolve, reject) => {
            const child = spawn(VENV_PYTHON, args, { env });

            let stderrOutput = '';

            child.stdout.on('data', (d) => {
                const s = d.toString();
                console.log('[UVR-MDX-NET]', s);
                // Try to parse progress from output
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) {
                        const pct = parseInt(m[1]) / 100;
                        onProgress(0.05 + pct * 0.9); // Scale to 5%-95%
                    }
                }
            });

            child.stderr.on('data', (d) => {
                const s = d.toString();
                stderrOutput += s;
                console.log('[UVR-MDX-NET Stderr]', s);
                // Progress often in stderr for tqdm
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) {
                        const pct = parseInt(m[1]) / 100;
                        onProgress(0.05 + pct * 0.9);
                    }
                }
            });

            child.on('close', async (code) => {
                clearTimeout(timeout);

                if (code !== 0) {
                    console.error('[UVR-MDX-NET] FULL STDERR:', stderrOutput);
                    return reject(new Error(`[UVR-MDX-NET] Process exited with code ${code}: ${stderrOutput.slice(-500)}`));
                }

                onProgress(0.95, 'Finalizing...');

                try {
                    // Wait a moment for files to be flushed to disk
                    await new Promise(r => setTimeout(r, 500));

                    // audio-separator outputs files with naming pattern:
                    // <original_filename>_(Vocals)_<model>.mp3
                    // <original_filename>_(Instrumental)_<model>.mp3
                    const files = await fs.readdir(outputRoot);
                    console.log('[UVR-MDX-NET] Output Files:', files);

                    const result = {
                        modelUsed: modelFilename.replace('.onnx', ''),
                        files: {}
                    };

                    // Find vocals and instrumental files
                    // UVR outputs: input_canonical_(Vocals)_model.mp3, input_canonical_(Instrumental)_model.mp3
                    const vocalFile = files.find(f => {
                        const lower = f.toLowerCase();
                        return lower.includes('vocal') &&
                            (lower.endsWith('.mp3') || lower.endsWith('.wav')) &&
                            lower !== 'input_canonical.wav';
                    });
                    const instrFile = files.find(f => {
                        const lower = f.toLowerCase();
                        return lower.includes('instrumental') &&
                            (lower.endsWith('.mp3') || lower.endsWith('.wav')) &&
                            lower !== 'input_canonical.wav';
                    });

                    if (vocalFile) {
                        result.files.vocals = path.join(outputRoot, vocalFile);
                        console.log(`[UVR-MDX-NET] Vocals: ${result.files.vocals}`);
                    }
                    if (instrFile) {
                        result.files.band = path.join(outputRoot, instrFile);
                        console.log(`[UVR-MDX-NET] Band/Instrumental: ${result.files.band}`);
                    }

                    if (!result.files.vocals && !result.files.band) {
                        console.error('[UVR-MDX-NET] No output files found in:', files);
                        return reject(new Error('[UVR-MDX-NET] No vocal or instrumental files produced'));
                    }

                    onProgress(1.0, 'Done');
                    resolve(result);
                } catch (e) {
                    console.error('[UVR-MDX-NET] Error reading output:', e);
                    reject(e);
                }
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                console.error('[UVR-MDX-NET] Spawn error:', err);
                reject(err);
            });

            // Timeout after 10 minutes (600 seconds) to prevent indefinite hanging
            const timeout = setTimeout(() => {
                console.error('[UVR-MDX-NET] Process timeout - killing child process');
                child.kill('SIGTERM');
                reject(new Error('[UVR-MDX-NET] Process timed out after 10 minutes'));
            }, 600000);
        });
    }
}
