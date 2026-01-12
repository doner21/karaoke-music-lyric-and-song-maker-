import { JobMgr } from '../orchestrator/index.js';
import { SongRepo } from '../db/repo.js';
import { Storage } from './storage.js';
import { EngineManager } from './engine-manager.js';
import { YtDlpAdapter } from './adapters/yt-dlp.js';
import { LocalArchiveAdapter } from './adapters/local-archive.js';
import { YtdlCoreAdapter } from './adapters/ytdl-core.js';
import { MockReliableAdapter } from './adapters/mock-reliable.js';
import { PlayDlAdapter } from './adapters/play-dl.js';

class JobQueue {
    constructor() {
        this.engines = new EngineManager();
        // Register engines (keep consistent with index.js logic)
        this.engines.register('local-archive', new LocalArchiveAdapter());
        this.engines.register('yt-dlp', new YtDlpAdapter());
        this.engines.register('ytdl-core', new YtdlCoreAdapter(console));
        this.engines.register('play-dl', new PlayDlAdapter());
        this.engines.register('mock', new MockReliableAdapter());

        // Register processor
        JobMgr.registerProcessor('download', this.processDownload.bind(this));
        console.log('[Downloader] Registered JobMgr processor: download');
    }

    registerEngine(name, adapter) {
        this.engines.register(name, adapter);
    }

    get activeEngines() {
        return this.engines.getAllEngines();
    }

    // Submit is now just a wrapper for legacy calls if any, but index.js calls JobMgr directly.
    // We can keep this for backward compat if anyone calls Queue.submit directly.
    async submit(request) {
        console.warn('[Downloader] Queue.submit is deprecated. Use JobMgr.submit.');
        // ... (Legacy logic omitted for brevity, assuming index.js is updated)
        return null;
    }

    async processDownload(job) {
        const { params, song_id, id: jobId } = job;
        console.log(`[Downloader] Processing job ${jobId} for song ${song_id}`);

        const song = SongRepo.getById(song_id);
        if (!song) throw new Error(`Song ${song_id} not found`);

        const onProgress = (p) => {
            JobMgr.updateProgress(jobId, p);
        };

        // Initialize storage
        await Storage.initJob(jobId);

        // Execute Download
        // engines.download expects (jobId, request, Storage, onProgress)
        // Ensure params matches the 'request' shape engines expect
        const files = await this.engines.download(jobId, params, Storage, onProgress);

        console.log(`[Downloader] Download complete. Files: ${files.length}`);

        // Save Artifacts to SongRepo
        const results = [];
        for (const file of files) {
            console.log('[Downloader] Saving artifact for file:', file.filename);
            const artifact = SongRepo.addArtifact({
                song_id: song_id,
                kind: 'downloaded_media', // Generic kind
                storage_ref: file.path,   // Absolute path
                filename: file.filename,
                mime_type: 'audio/mpeg',  // TODO: Detect
                hash: null,
                params_hash: job.inputs_hash,
                version_tag: 'v1.0',
                artist_name: song.artist_name,
                track_title: song.track_title,
                canonical_display_name: song.canonical_display_name
            });
            results.push(artifact);
        }

        // Return result for JobMgr
        return {
            files: files.map(f => ({ path: f.path, filename: f.filename })), // Return paths
            videoId: song.video_id,
            metadata: { title: song.source_title_raw }
        };
    }

    getJob(jobId) {
        return JobMgr.getJob(jobId);
    }
}

export const Queue = new JobQueue();

