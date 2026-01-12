import crypto from 'crypto';
import { JobMgr } from '../orchestrator/index.js';
import { SongRepo } from '../db/repo.js';
import fs from 'fs';
import path from 'path';

export class AlignmentJobQueue {
    constructor() {
        this.adapter = null;
        this.canonicalizer = null;
        JobMgr.registerProcessor('align', this.processAlign.bind(this));
        console.log('[Alignment] Registered JobMgr processor: align');
    }

    setAdapter(adapter) {
        this.adapter = adapter;
    }

    setCanonicalizer(canonicalizer) {
        this.canonicalizer = canonicalizer;
    }

    async submit(request) {
        // request: { vocalStemId, lyricsText, videoId, songId }

        let songId = request.songId;

        // Resolve Song ID if missing
        if (!songId && request.videoId) {
            const song = SongRepo.getByVideoId(request.videoId);
            if (song) songId = song.id;
        }

        if (!songId) {
            // Try to resolve from vocalStemId if it's a file path?
            // Hard without artifact lookup.
            // If we can't find song, we can't submit to DB.
            throw new Error("Alignment requires a valid Song (provide videoId that exists in DB)");
        }

        const result = await JobMgr.submit({
            songId: songId,
            kind: 'align',
            params: request,
            force: request.force || false
        });

        return result.jobId;
    }

    async processAlign(job) {
        if (!this.adapter || !this.canonicalizer) {
            throw new Error("Alignment components not initialized");
        }

        const request = job.params;
        const jobId = job.id;
        const songId = job.song_id;
        const song = SongRepo.getById(songId);

        console.log(`[Alignment] Processing job ${jobId}`);

        // DEBUG: Log the lyrics from job params
        const lyricsPreview = request.lyricsText?.substring(0, 100)?.replace(/\n/g, ' ') || 'EMPTY';
        console.log(`[Alignment] JOB PARAMS LYRICS: "${lyricsPreview}..." (${request.lyricsText?.length || 0} chars)`);

        // Update Progress Helper
        const updateProgress = (p, msg) => {
            JobMgr.updateProgress(jobId, p);
            if (msg) console.log(`[Align:${jobId}] ${msg}`);
        };

        // 1. Submit to AudioShake
        updateProgress(0.1, "Submitting to AudioShake...");

        const providerTaskId = await this.adapter.submitAlignment({
            audioPath: request.vocalStemPath, // JobMgr wrapper resolved this path before submit? 
            // Wait, index.js (router) resolved 'vocalStemId' to 'vocalStemPath' before calling submit.
            // So params has 'vocalStemPath'.
            lyricsText: request.lyricsText || null
        });

        // 2. Poll
        updateProgress(0.1, `Provider task: ${providerTaskId}`);

        let complete = false;
        let attempts = 0;
        const maxAttempts = 300;

        let result = null;

        while (!complete && attempts < maxAttempts) {
            // Check cancellation (could check DB via JobMgr.getJob(jobId).state if we want)
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            const status = await this.adapter.poll(providerTaskId);

            if (status.progress) {
                updateProgress(Math.max(0.1, status.progress));
            }

            if (status.state === 'completed') {
                complete = true;
                result = status.result;
            } else if (status.state === 'failed' || status.state === 'error') {
                throw new Error(status.error || 'Provider alignment failed');
            }
        }

        if (!complete) {
            throw new Error('Alignment timeout');
        }

        updateProgress(0.9, "Canonicalizing result...");

        // 3. Canonicalize
        const canonicalResult = this.canonicalizer.transform(
            result,
            request.lyricsText,
            {
                videoId: request.videoId,
                title: song?.track_title || 'Unknown Title',
                artist: song?.artist_name || 'Unknown Artist'
            }
        );

        // 4. Save Artifact
        const alignDir = path.resolve(process.cwd(), 'downloads', 'alignments');
        if (!fs.existsSync(alignDir)) fs.mkdirSync(alignDir, { recursive: true });

        // Build canonical filename: "Artist - Song (Lyrics).json"
        const safeName = (song?.canonical_display_name || jobId).replace(/[<>:"/\\|?*]/g, '');
        const filename = `${safeName} (Lyrics).json`;
        const filePath = path.join(alignDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(canonicalResult, null, 2));

        SongRepo.addArtifact({
            song_id: songId,
            kind: 'timings_json',
            storage_ref: filePath,
            filename: filename,
            mime_type: 'application/json',
            hash: null, // File hash not computed for now
            params_hash: job.inputs_hash,
            version_tag: 'audioshake-v1',
            artist_name: song?.artist_name || 'Unknown',
            track_title: song?.track_title || 'Unknown',
            canonical_display_name: song?.canonical_display_name || 'Unknown'
        });

        updateProgress(1.0, "Alignment complete");
        return canonicalResult;
    }

    getJob(jobId) {
        return JobMgr.getJob(jobId);
    }

    // cancel...
    cancel(jobId) {
        JobMgr.stmts.updateState.run({ id: jobId, state: 'canceled', completed_at: Date.now(), error_json: null, result_json: null, params_json: null });
        return true;
    }
}

export const Queue = new AlignmentJobQueue();

