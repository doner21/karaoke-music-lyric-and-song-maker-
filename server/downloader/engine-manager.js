import { DownloadEngine } from './engine-interface.js';

export class EngineManager {
    constructor() {
        this.engines = new Map(); // name -> instance
        this.priorityList = []; // [name1, name2, ...]
    }

    register(name, instance, priority = 10) {
        if (!(instance instanceof DownloadEngine) && !instance.download) {
            console.warn(`[EngineManager] Warning: ${name} does not look like a DownloadEngine`);
        }
        this.engines.set(name, instance);
        this.priorityList = Array.from(this.engines.keys()); // Simple order for now, can perform sorting if needed
    }

    setPriority(names) {
        this.priorityList = names.filter(n => this.engines.has(n));
    }

    async getMetadata(videoId, preferredEngine = 'auto') {
        const enginesToTry = this.getExecutionOrder(preferredEngine);
        let lastError = null;

        for (const name of enginesToTry) {
            try {
                const engine = this.engines.get(name);
                return await engine.getMetadata(videoId);
            } catch (e) {
                console.warn(`[EngineManager] Metadata fetch failed on ${name}: ${e.message}`);
                lastError = e;
            }
        }
        throw lastError || new Error('All engines failed to fetch metadata');
    }

    /**
     * Download with Fallback
     */
    async download(jobId, request, storage, onProgress) {
        const preferredEngine = request.enginePreference || 'auto';
        const enginesToTry = this.getExecutionOrder(preferredEngine);

        console.log(`[EngineManager] Download Strategy: ${enginesToTry.join(' -> ')}`);

        const errors = [];

        for (const name of enginesToTry) {
            const engine = this.engines.get(name);
            console.log(`[EngineManager] Attempting download with: ${name}`);

            try {
                return await engine.download(jobId, request, storage, onProgress);
            } catch (e) {
                console.error(`[EngineManager] Engine ${name} failed:`, e.message);
                errors.push({ engine: name, error: e.message });

                // If user specified a valid engine and it fails, fail the job
                if (preferredEngine !== 'auto' && preferredEngine === name) {
                    throw e;
                }
            }
        }

        throw new Error(`All download attempts failed. Errors: ${JSON.stringify(errors)}`);
    }

    getExecutionOrder(preference) {
        if (preference && preference !== 'auto' && this.engines.has(preference)) {
            return [preference];
        }
        return this.priorityList; // Default order
    }

    getEngine(name) {
        return this.engines.get(name);
    }

    getAllEngines() {
        return this.engines;
    }
}
