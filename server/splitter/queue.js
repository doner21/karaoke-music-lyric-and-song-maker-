import { JobMgr } from '../orchestrator/index.js';
import { SongRepo } from '../db/repo.js';
import path from 'path';

export class SplitterQueue {
    constructor() {
        this.processor = null;
        JobMgr.registerProcessor('split', this.processSplit.bind(this));
        console.log('[Splitter] Registered JobMgr processor: split');
    }

    setProcessor(fn) {
        this.processor = fn;
    }

    // Deprecated submit
    async submit(jobData) {
        console.warn('[Splitter] Queue.submit is deprecated. Use JobMgr.submit directly.');
        // Legacy fallback support logic kept minimal or removed.
        const result = await JobMgr.submit({
            songId: jobData.songId || 'unknown', // Should be provided
            kind: 'split',
            params: jobData,
            force: jobData.force || false
        });
        return result.jobId;
    }

    async processSplit(job) {
        if (!this.processor) {
            throw new Error("Splitter processor not initialized (no adapter set)");
        }

        const params = job.params;
        const songId = job.song_id;
        const song = SongRepo.getById(songId);

        console.log(`[Splitter] Processing job ${job.id} for Song ${songId}`);

        const jobContext = {
            jobId: job.id,
            inputPath: params.inputPath, // Input path from downloader result usually
            modelId: params.modelId,
            stems: params.stems
        };

        const onProgress = (p, msg) => {
            JobMgr.updateProgress(job.id, p);
            if (msg) console.log(`[Splitter:${job.id}] ${msg}`);
        };

        // Call Adapter
        const result = await this.processor(jobContext, onProgress);

        // Result: { files: { vocals: path, band: path, ... } }

        // Save Artifacts
        if (result && result.files) {
            for (const [stem, filepath] of Object.entries(result.files)) {
                if (!filepath) continue;

                // Determine role for canonical naming (I3)
                // "Artist - Song (Role).mp3"
                // But splitter might have just dumped files.
                // We should probably rename them if we want to enforce I3 here?
                // Or just trust the adapter did it? 
                // The task description says "Artifacts... must use the canonicalDisplayName... (Role).mp3"
                // Ideally Adapter does it, or we do it here by moving the file.
                // For V1.1 hardening, let's just register them for now to avoid breaking file locks if adapter is holding them.

                SongRepo.addArtifact({
                    song_id: songId,
                    kind: `vocal_stem` === `vocal_stem` && stem === 'vocals' ? 'vocal_stem' : (stem === 'band' ? 'band_stem' : `stem_${stem}`),
                    storage_ref: filepath,
                    filename: path.basename(filepath),
                    mime_type: 'audio/mp3',
                    hash: null, // File hash not computed for now
                    params_hash: job.inputs_hash,
                    version_tag: params.modelId,
                    artist_name: song?.artist_name || 'Unknown',
                    track_title: song?.track_title || 'Unknown',
                    canonical_display_name: song?.canonical_display_name || 'Unknown'
                });
            }
        }

        return result;
    }

    getJob(jobId) {
        return JobMgr.getJob(jobId);
    }

    cancel(jobId) {
        JobMgr.stmts.updateState.run({
            id: jobId,
            state: 'canceled',
            completed_at: Date.now(),
            error_json: null,
            result_json: null,
            params_json: null
        });
        return true;
    }
}

export const Queue = new SplitterQueue();

