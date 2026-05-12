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

export class DemucsAdapter {
    constructor() {
        this.name = 'demucs';
    }

    async checkHealth() {
        try {
            await execAsync(`"${VENV_PYTHON}" -m demucs --help`);
            return { available: true };
        } catch (e) {
            return { available: false, error: 'Demucs not available in venv' };
        }
    }

    /**
     * Run Separation
     * @param {string} jobId 
     * @param {string} inputPath - Absolute path to input audio
     * @param {object} options - { modelId: 'htdemucs'|'mdx_extra', stems: 2|4 }
     * @param {function} onProgress - (percent, logMsg) => void
     */
    async separate(jobId, inputPath, options, onProgress) {
        onProgress(0, `[Debug] Adapter Options: ${JSON.stringify(options)}`);
        let { modelId = 'htdemucs', stems = 2, device = 'cpu' } = options;

        // Normalize model names: Frontend uses hyphens, Demucs uses underscores
        const modelMap = {
            'mdx-extra': 'mdx_extra',
            'mdx-extra-q': 'mdx_extra_q',
            'mdx_extra': 'mdx_extra',
            'htdemucs': 'htdemucs',
            'htdemucs_ft': 'htdemucs_ft',
            'v3-sim': 'htdemucs',
        };
        modelId = modelMap[modelId] || modelId.replace(/-/g, '_');

        // Output Dir: downloads/{jobId}/separated
        const outputRoot = Storage.getFilePath(jobId, 'separated');
        await fs.ensureDir(outputRoot);

        const ffmpegDllsDir = path.join(process.cwd(), 'ffmpeg-dlls');
        const env = {
            ...process.env,
            PATH: `${ffmpegDllsDir};${FFMPEG_DIR};${process.env.PATH}`
        };

        // PRE-CONVERT: torchaudio can't load webm/opus. Convert to wav first.
        // UNIFY INPUT: Always convert to 44.1kHz WAV to ensure identical decoding on CPU/GPU
        // This eliminates torchaudio/ffmpeg backend differences and sample rate mismatches.
        const wavPath = path.join(outputRoot, 'input_canonical.wav');
        let actualInputPath = wavPath;

        // Verify file exists and has content
        const stat = await fs.stat(inputPath).catch(() => null);
        if (!stat || stat.size === 0) {
            throw new Error(`Input file invalid or empty: ${inputPath}`);
        }

        onProgress(0.02, 'Canonicalizing audio format (44.1kHz WAV)...');
        console.log(`[Demucs] Pre-converting ${inputPath} -> ${wavPath}`);

        try {
            await execAsync(`"${FFMPEG_PATH}" -y -i "${inputPath}" -ar 44100 -ac 2 "${wavPath}"`);
            console.log('[Demucs] Conversion successful');
        } catch (e) {
            console.error('[Demucs] Conversion failed:', e);
            throw new Error(`Audio conversion failed: ${e.message}`);
        }

        // Command Construction
        const deviceFlag = device === 'gpu' ? 'cuda' : 'cpu';
        if (device === 'gpu') {
            console.warn('[Demucs] GPU mode requested but CUDA may be unavailable on this machine.');
            onProgress(0.01, 'GPU mode requested (CUDA may be unavailable on this machine)');
        }
        const deviceMsg = `Active Device: ${deviceFlag.toUpperCase()}`;
        console.log(`[Demucs] ${deviceMsg}`);
        onProgress(0.01, deviceMsg);

        // Explicitly set shifts=1, overlap=0.25 to guarantee parity
        let cmd = `"${VENV_PYTHON}" -m demucs -n ${modelId} -d ${deviceFlag} --shifts 1 --overlap 0.25 "${actualInputPath}" -o "${outputRoot}" --mp3`;
        if (stems === 2) {
            cmd += ` --two-stems=vocals`;
        }

        console.log(`[Demucs] Cmd: ${cmd}`);
        onProgress(0.05, `Running Demucs (${modelId})...`);

        return new Promise((resolve, reject) => {
            // Spawn requires command and args array separated
            // cmd string was: "${VENV_PYTHON}" -m demucs -n ${modelId} "${actualInputPath}" -o "${outputRoot}" --mp3 ...

            const pythonExe = VENV_PYTHON;
            const args = [
                '-m', 'demucs',
                '-n', modelId,
                '-d', deviceFlag,
                '--shifts', '1',
                '--overlap', '0.25',
                actualInputPath,
                '-o', outputRoot,
                '--mp3'
            ];

            if (stems === 2) {
                args.push('--two-stems=vocals');
            }

            console.log(`[Demucs] Spawning: ${pythonExe} ${args.join(' ')}`);
            onProgress(0.05, `Running Demucs (${modelId})...`);

            const child = spawn(pythonExe, args, { env, cwd: process.cwd() });

            child.stdout.on('data', (d) => {
                const s = d.toString();
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) onProgress(parseInt(m[1]) / 100);
                }
            });

            let stderrOutput = '';

            child.stderr.on('data', (d) => {
                const s = d.toString();
                stderrOutput += s;
                // Demucs prints progress to stderr usually
                if (s.includes('%')) {
                    const m = s.match(/(\d+)%/);
                    if (m) onProgress(parseInt(m[1]) / 100);
                }
            });

            child.on('close', async (code) => {
                if (code !== 0) {
                    console.error('[Demucs] FULL STDERR:', stderrOutput);
                    return reject(new Error(`Demucs exited with code ${code}: ${stderrOutput.slice(-500)}`));
                }

                // Locate Files
                onProgress(0.95, 'Finalizing...');

                const modelsDir = path.join(outputRoot, modelId);
                const trackDirs = await fs.readdir(modelsDir).catch(() => []);
                if (trackDirs.length === 0) return reject(new Error('No output directory found'));

                const trackDir = path.join(modelsDir, trackDirs[0]);

                const mapPath = (name) => path.join(trackDir, name);

                const result = {
                    modelUsed: modelId,
                    files: {}
                };

                if (stems === 2) {
                    if (await fs.exists(mapPath('vocals.mp3'))) result.files.vocals = mapPath('vocals.mp3');
                    if (await fs.exists(mapPath('no_vocals.mp3'))) result.files.band = mapPath('no_vocals.mp3');
                } else {
                    if (await fs.exists(mapPath('vocals.mp3'))) result.files.vocals = mapPath('vocals.mp3');
                    if (await fs.exists(mapPath('drums.mp3'))) result.files.drums = mapPath('drums.mp3');
                    if (await fs.exists(mapPath('bass.mp3'))) result.files.bass = mapPath('bass.mp3');
                    if (await fs.exists(mapPath('other.mp3'))) result.files.other = mapPath('other.mp3');
                    result.files.band = result.files.other; // Fallback
                }

                onProgress(1.0, 'Done');
                resolve(result);
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}
