
import { JobMgr, JOB_STATES } from '../orchestrator/index.js';
import { Library } from '../library/repository.js';
import { Storage } from './storage.js';
import { EngineManager } from './engine-manager.js';

class JobQueue {
    constructor() {
        this.engines = new EngineManager();
        this.engines.register('yt-dlp', null); // Actual adapter loaded in EngineManager or elsewhere? 
        // Note: EngineManager implementation (viewed earlier) seemed to handle loading.
        // But checking previous view of job-queue.js:
        // this.engines.register(name, adapter) called by index.js?
        // Let's keep registerEngine method.

        // Register processor
        JobMgr.registerProcessor('download', this.processDownload.bind(this));
    }

    registerEngine(name, adapter) {
        this.engines.register(name, adapter);
        this.engines.setPriority(['yt-dlp', 'ytdl-core', 'play-dl', 'mock']);
    }

    get activeEngines() {
        return this.engines.getAllEngines();
    }

    async submit(request) {
        // 1. Resolve Song ID
        const videoId = request.video.videoId;
        let song = Library.findSongByVideoId(videoId);

        if (!song) {
            // Create Song if missing
            song = Library.createSong({
                videoId: videoId,
                title: request.video.title || 'Unknown Title',
                artist: 'Unknown Artist', // Resolver can update this later
                track: 'Unknown Track',
                source: 'youtube'
            });
        }

        // 2. Submit Job
        const result = await JobMgr.submit({
            songId: song.id,
            kind: 'download',
            params: request, // Store full request as params
            force: request.force || false
        });

        return result.jobId;
    }

    async processDownload(job) {
        // Reconstruct context
        // Job has song_id. We might need metadata from Song?
        // Actually job.inputs_hash was derived from params.
        // We need to fetch the params (request).
        // Wait, DB schema doesn't have 'params' column?
        // I checked schema: jobs table has `inputs_hash`. 
        // It DOES NOT store the full params JSON in `jobs` table in the design!
        // Design Doc: "inputsSnapshot (vocalStemHash, lyricsHash...)"
        // But where is the actual input data needed to run?
        // Ah, I missed adding a `params` JSON column to `jobs` table in the implementation plan schema.
        // Or I assumed it's in `inputs_hash`? No, hash is for uniqueness.
        // I need to add `params_json` to `jobs` table or `arguments` table.
        // FIX: I will add `params_json` to `jobs` table now in a migration step or logic update.

        // TEMPORARY FIX: For now, I'll update JobManager to store `params` in a new column or reuse `inputs_hash`? No.
        // I must update the schema.

        throw new Error("Missing params storage in Jobs table - Migration needed");
    }

    // Wrapper for legacy compatibility?
    getJob(jobId) {
        return JobMgr.getJob(jobId);
    }
}

// Export singleton
export const Queue = new JobQueue();
