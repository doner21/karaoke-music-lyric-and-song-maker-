import fs from 'fs-extra';
import { Storage } from '../downloader/storage.js';

export class MockSplitterAdapter {
    constructor() {
        this.name = 'mock-splitter';
    }

    async checkHealth() {
        return { available: true };
    }

    async separate(jobId, inputPath, options, onProgress) {
        // Output Dir: downloads/{jobId}/separated
        const outputRoot = Storage.getFilePath(jobId, 'separated');
        await fs.ensureDir(outputRoot);
        const modelId = options.modelId || 'mock';
        const stems = options.stems || 2;

        // Simulate structure: {outputRoot}/{modelId}/mock_track/...
        const trackDir = `${outputRoot}/${modelId}/mock_track`;
        await fs.ensureDir(trackDir);

        console.log(`[MockSplitter] Simulating separation for ${jobId}`);

        // Progress Simulation
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            await new Promise(r => setTimeout(r, 200));
            onProgress(i / steps, `Processing stem batch ${i}...`);
        }

        // Create Dummy Files
        const touch = async (name) => {
            const p = `${trackDir}/${name}`;
            await fs.writeFile(p, `MOCK_STEM_CONTENT_FOR_${name}`);
            return p;
        };

        const result = {
            modelUsed: modelId,
            files: {}
        };

        if (stems === 2) {
            result.files.vocals = await touch('vocals.mp3');
            result.files.band = await touch('no_vocals.mp3');
        } else {
            result.files.vocals = await touch('vocals.mp3');
            result.files.drums = await touch('drums.mp3');
            result.files.bass = await touch('bass.mp3');
            result.files.other = await touch('other.mp3');
            result.files.band = result.files.other;
        }

        onProgress(1.0, 'Done');
        return result;
    }
}
