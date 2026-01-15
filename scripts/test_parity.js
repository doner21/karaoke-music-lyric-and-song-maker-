
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENV_PYTHON = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
const DEBUG_SCRIPT = path.join(process.cwd(), 'scripts', 'debug_separate.py');
const TEST_FILE = path.join(process.cwd(), 'test.mp3'); // Using existing test.mp3
const OUTPUT_DIR = path.join(process.cwd(), 'parity_test_output');

async function runSplit(device) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- Running on ${device.toUpperCase()} ---`);
        const args = [
            DEBUG_SCRIPT,
            '-n', 'htdemucs',
            '-d', device,
            TEST_FILE,
            '-o', OUTPUT_DIR,
            '--mp3'
        ];

        console.log(`Cmd: ${VENV_PYTHON} ${args.join(' ')}`);

        const child = spawn(VENV_PYTHON, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', d => {
            process.stdout.write(d);
            stdout += d.toString();
        });
        child.stderr.on('data', d => {
            process.stderr.write(d);
            stderr += d.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`Failed with code ${code}`);
                // resolve anyway to see what logs we got
            }
            resolve({ device, stdout, stderr });
        });
    });
}

function extractConfig(log) {
    return log.split('\n')
        .filter(l => l.includes('[CONFIG_DIFF]'))
        .sort()
        .join('\n');
}

async function main() {
    if (!fs.existsSync(TEST_FILE)) {
        console.error("Test file not found:", TEST_FILE);
        // Create a dummy mp3 if needed or fail? 
        // We see 'test.mp3' in file list, so should be fine.
    }

    const cpuRun = await runSplit('cpu');
    const gpuRun = await runSplit('cuda');

    const cpuConfig = extractConfig(cpuRun.stdout);
    const gpuConfig = extractConfig(gpuRun.stdout);

    console.log('\n\n====== CONFIGURATION DIFF REPORT ======');

    if (cpuConfig === gpuConfig) {
        console.log("SUCCESS: Configurations match exactly (excluding device specifics logged differently).");
    } else {
        console.log("WARNING: Configurations differ!");
        console.log("\n--- CPU CONFIG ---");
        console.log(cpuConfig);
        console.log("\n--- GPU CONFIG ---");
        console.log(gpuConfig);
    }

    fs.writeFileSync('parity_report.txt',
        `CPU RUN:\n${cpuRun.stdout}\n\nGPU RUN:\n${gpuRun.stdout}\n\nDIFF ANALYSIS:\nCPU_CONFIG:\n${cpuConfig}\n\nGPU_CONFIG:\n${gpuConfig}`
    );
}

main();
