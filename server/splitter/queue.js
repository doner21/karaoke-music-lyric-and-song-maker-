import { JobMgr } from '../orchestrator/index.js';
import { SongRepo } from '../db/repo.js';

import fs from 'fs-extra';
import { Queue as DownloaderQueue } from '../downloader/job-queue.js';
import { Storage } from '../downloader/storage.js';
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

        // DEBUG LOG
        JobMgr.updateProgress(job.id, 0, `[Debug] Queue Params: ${JSON.stringify(params)}`);

        console.log(`[Splitter] Processing job ${job.id} for Song ${songId}`);

        let inputPath = params.inputPath;

        // --- HARDENING: Source Recovery ---
        const exists = inputPath ? fs.existsSync(inputPath) : false;

        if (!exists) {
            console.warn(`[Splitter] Input file missing at ${inputPath}. Attempting recovery via Re-Download...`);

            if (song && song.video_id) {
                try {
                    const downloadParams = {
                        url: `https://www.youtube.com/watch?v=${song.video_id}`,
                        videoId: song.video_id,
                        enginePreference: 'yt-dlp' // FORCE real download engine
                    };

                    console.log(`[Splitter] Re-downloading ${song.video_id} for Job ${job.id}...`);

                    // Initialize Storage for this Job ID
                    await Storage.initJob(job.id);
                    JobMgr.updateProgress(job.id, 0.05);

                    const files = await DownloaderQueue.engines.download(job.id, downloadParams, Storage, (p) => {
                        JobMgr.updateProgress(job.id, p * 0.2);
                    });

                    if (files && files.length > 0) {
                        inputPath = files[0].path;
                        console.log(`[Splitter] Recovery successful. New input path: ${inputPath}`);
                    } else {
                        console.error("[Splitter] Re-download produced NO files.");
                        throw new Error("Re-download produced no files.");
                    }

                } catch (e) {
                    console.error('[Splitter] Recovery failed:', e);
                    throw new Error(`Input missing and recovery failed: ${e.message}`);
                }
            } else {
                console.error(`[Splitter] No video_id found for song ${songId}`);
                throw new Error(`Input file missing at ${inputPath} and no Video ID available for recovery.`);
            }
        }
        // ----------------------------------

        const jobContext = {
            jobId: job.id,
            inputPath: inputPath, // Use potentially recovered path
            modelId: params.modelId,
            stems: params.stems,
            device: params.device || 'cpu' // Default to cpu
        };

        const onProgress = (p, msg) => {
            JobMgr.updateProgress(job.id, p, msg);
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
