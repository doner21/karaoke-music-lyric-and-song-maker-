import express from 'express';
import { JobMgr } from '../orchestrator/index.js';
import { SongRepo } from '../db/repo.js'; // Use Repo
import { Queue } from './job-queue.js'; // Keep for engine registry access
import { parseVideoTitle } from '../utils/titleParser.js';
import { Storage } from './storage.js';

const router = express.Router();

// ...

// Health Check (Internal)
router.get('/download/health', async (req, res) => {
    const status = [];
    const enginesMap = Queue.activeEngines; // Accessor in new JobQueue
    for (const [name, adapter] of enginesMap.entries()) {
        try {
            const h = await adapter.checkHealth();
            status.push({ name, available: h.available, error: h.error });
        } catch (e) {
            status.push({ name, available: false, error: e.message });
        }
    }
    res.json({ engines: status });
});

// --- PARENT CONTRACT ENDPOINTS (Spec v1.0) ---

// FR-002: Acquire Audio
router.post('/audio/acquire', async (req, res) => {
    try {
        const { selectedSong, options } = req.body;
        const enginePref = req.body.enginePreference || 'auto';

        // 1. Ensure Song Existence (Persist or Get)
        let songId = selectedSong.videoId; // Start with videoId as generic ID

        // Use Repo to lookup or create
        let song = SongRepo.getByVideoId(selectedSong.videoId);
        if (!song) {
            const rawTitle = selectedSong.title || '';
            const { artistName, trackTitle } = parseVideoTitle(rawTitle);
            const canonicalDisplayName = `${artistName} - ${trackTitle}`;
            console.log(`[Downloader] Parsed title: "${rawTitle}" -> Artist: "${artistName}", Track: "${trackTitle}"`);

            song = SongRepo.create({
                videoId: selectedSong.videoId,
                sourceTitleRaw: rawTitle,
                artistName: artistName,
                trackTitle: trackTitle,
                canonicalDisplayName: canonicalDisplayName,
                thumbnailUrl: selectedSong.thumbnailUrl,
                sourceType: 'youtube'
            });
        }

        // Update Timestamp
        SongRepo.stmts.updateTimestamp.run(Date.now(), song.id);

        // 2. Submit Job via Orchestrator
        // Params needed for the downloader adapter
        const params = {
            videoId: selectedSong.videoId,
            enginePreference: enginePref,
            ...options
        };

        const result = await JobMgr.submit({
            songId: song.id,
            kind: 'download',
            params,
            force: false // TODO: Support force flag from UI
        });

        res.status(202).json({ jobId: result.jobId, existing: result.existing, songId: song.id });
    } catch (e) {
        console.error("Acquire Error:", e);
        res.status(400).json({ error: { kind: 'unknown', message: e.message } });
    }
});

// FR-002: Job Status
router.get('/audio/status/:jobId', (req, res) => {
    const job = JobMgr.getJob(req.params.jobId); // Persistent Job
    if (!job) return res.status(404).json({ error: { kind: 'unknown', message: 'Job not found' } });

    // Spec Compliance: Map internal state to parent contract
    // JobMgr states: queued, processing, done, error, canceled
    const response = {
        jobId: job.id,
        state: job.state === 'processing' ? 'running' : job.state, // Map 'processing' to 'running' for UI compat
        stage: 'work', // Simplified
        progress: job.progress || 0,
        error: job.error_json ? JSON.parse(job.error_json) : null,
        result: job.result_json ? JSON.parse(job.result_json) : null
    };

    if (response.state === 'done' && response.result) {
        // Ensure result has the shape the UI expects
        // The processor should have saved a result compatible with the UI
    }

    res.json(response);
});

// FR-002: Cancel Job
router.post('/audio/cancel', async (req, res) => {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ ok: false });

    // Simplistic cancel: just mark as canceled in DB
    // Real cancel needs signal propagation to the running process
    // For now, Orchestrator checks state.
    JobMgr.stmts.updateState.run({
        id: jobId,
        state: 'canceled',
        completed_at: Date.now(),
        error_json: null,
        result_json: null,
        params_json: null
    });

    res.json({ ok: true });
});



// --- INTERNAL ENDPOINTS (Extensions) ---

// File Access (Internal/Splitter consumption)
router.get('/download/file/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;
    if (filename.includes('..')) return res.status(400).end();
    const filePath = Storage.getFilePath(jobId, filename);
    res.download(filePath, filename);
});

// Legacy/Internal result fetch for Splitter Service
router.get('/download/result/:jobId', (req, res) => {
    const job = Queue.getJob(req.params.jobId);
    if (!job || job.state !== 'done') return res.status(404).json({ error: 'Job not ready' });
    res.json(job.result);
});

export default router;
