/**
 * Alignment Router - AudioShake Integration
 * SEED 44019 | SSE Observability Persona
 * 
 * Endpoints:
 * - POST /align/submit
 * - GET /align/status/:jobId
 * - POST /align/cancel/:jobId
 * - GET /align/result/:jobId
 */

import express from 'express';
import path from 'path';
import { Queue } from './job-queue.js';
import { AudioShakeAdapter } from './audioshake-adapter.js';
import { Canonicalizer } from './canonicalizer.js';
import { Queue as SplitterQueue } from '../splitter/queue.js';

const router = express.Router();

// Initialize adapter and canonicalizer
export const initAlignmentService = () => {
    // Fallback included for debugging
    const apiKey = process.env.AUDIOSHAKE_API_KEY;

    if (!apiKey) {
        console.warn('[AlignmentService] AUDIOSHAKE_API_KEY not set - alignment will fail');
    }

    const adapter = new AudioShakeAdapter(apiKey);
    const canonicalizer = new Canonicalizer();

    Queue.setAdapter(adapter);
    Queue.setCanonicalizer(canonicalizer);

    Queue.setAdapter(adapter);
    Queue.setCanonicalizer(canonicalizer);

    console.log('[AlignmentService] Initialized with AudioShake adapter');
};

// initAlignmentService(); // Moved to server-proxy.js for correct env loading

// --- ENDPOINTS ---

/**
 * POST /align/submit
 * Submit a new alignment job
 */
router.post('/submit', async (req, res) => {
    console.log('========================================');
    console.log('[Alignment] >>> REQUEST RECEIVED <<<');
    console.log('[Alignment] Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
    console.log('========================================');

    try {
        const { vocalStemId, lyricsText, provider, videoId, stemIds, force } = req.body;

        console.log('[Alignment] Submit request:', {
            vocalStemId,
            lyricsTextLength: lyricsText?.length || 0,
            lyricsPreview: lyricsText?.substring(0, 80) || 'EMPTY',
            force
        });

        // Validate required fields
        if (!vocalStemId) {
            return res.status(400).json({
                error: { kind: 'validation', message: 'Missing vocalStemId' }
            });
        }

        // Resolve vocal stem path
        // vocalStemId can be:
        // 1. A split job ID (UUID format)
        // 2. A download URL like "http://localhost:3001/split/download/UUID/vocals"
        // 3. An artifact URL like "/artifacts/UUID/download"
        // 4. A direct file path
        let vocalStemPath = vocalStemId;
        let resolvedJobId = null;

        // Check if it's an artifact URL first
        const artifactMatch = vocalStemId.match(/\/artifacts\/([a-f0-9-]+)\/download/i);
        if (artifactMatch) {
            const artifactId = artifactMatch[1];
            console.log('[Alignment] Extracted artifact ID from URL:', artifactId);

            // Look up artifact from database to get actual file path
            const { SongRepo } = await import('../db/repo.js');
            const artifact = SongRepo.getArtifactById(artifactId);
            if (artifact && artifact.storage_ref) {
                vocalStemPath = artifact.storage_ref;
                console.log('[Alignment] Resolved vocal path from artifact:', vocalStemPath);
            } else {
                console.error('[Alignment] Artifact not found or missing storage_ref:', artifactId);
                return res.status(404).json({
                    error: { kind: 'artifact_not_found', message: `Artifact ${artifactId} not found` }
                });
            }
        } else {
            // Check if it's a split download URL
            const urlMatch = vocalStemId.match(/\/split\/download\/([a-f0-9-]{36})\/vocals/i);
            if (urlMatch) {
                resolvedJobId = urlMatch[1];
                console.log('[Alignment] Extracted jobId from URL:', resolvedJobId);
            } else if (vocalStemId.match(/^[0-9a-f-]{36}$/i)) {
                resolvedJobId = vocalStemId;
            }

            // Try to resolve from split job
            if (resolvedJobId) {
                const splitJobPath = await resolveSplitJobVocal(resolvedJobId);
                if (splitJobPath) {
                    vocalStemPath = splitJobPath;
                    console.log('[Alignment] Resolved vocal path:', vocalStemPath);
                } else {
                    console.log('[Alignment] Could not resolve split job, using raw ID');
                }
            }
        }

        // Submit job
        const jobId = await Queue.submit({
            vocalStemPath,
            lyricsText: lyricsText || '',
            provider: provider || 'audioshake',
            videoId,
            stemIds,
            force: force || false
        });

        res.status(202).json({ jobId });

    } catch (error) {
        console.error('[Alignment] Submit error:', error);
        res.status(500).json({
            error: { kind: 'internal', message: error.message }
        });
    }
});

/**
 * GET /align/status/:jobId
 * Get job status
 */
router.get('/status/:jobId', (req, res) => {
    const job = Queue.getJob(req.params.jobId);

    if (!job) {
        return res.status(404).json({
            error: { kind: 'not_found', message: 'Job not found' }
        });
    }

    const jobId = job.id; // DB uses 'id', not 'jobId'

    res.json({
        jobId: jobId,
        state: job.state,
        progress: job.progress,
        error: job.error,
        providerTaskId: job.params?.providerTaskId ? String(job.params.providerTaskId).substring(0, 8) + '...' : null,
        artifactId: job.state === 'done' ? jobId : null,
        logs: [] // Logs are not stored in DB for now
    });
});

/**
 * POST /align/cancel/:jobId
 * Cancel a running job
 */
router.post('/cancel/:jobId', async (req, res) => {
    const jobId = req.params.jobId;
    const success = await Queue.cancel(jobId);

    res.json({ ok: success });
});

/**
 * GET /align/result/:jobId
 * Get the canonical KaraokeTimingJSON_v1 result
 */
router.get('/result/:jobId', (req, res) => {
    const job = Queue.getJob(req.params.jobId);

    if (!job) {
        return res.status(404).json({
            error: { kind: 'not_found', message: 'Job not found' }
        });
    }

    if (job.state !== 'done') {
        return res.status(409).json({
            error: { kind: 'not_ready', message: `Job state: ${job.state}` }
        });
    }

    if (!job.result) {
        return res.status(500).json({
            error: { kind: 'internal', message: 'Result missing' }
        });
    }

    // Return the canonical JSON
    res.json(job.result);
});

/**
 * Helper: Resolve vocal stem path from split job
 */
function resolveSplitJobVocal(splitJobId) {
    try {
        const splitJob = SplitterQueue.getJob(splitJobId);
        console.log('[Alignment] Split job lookup:', splitJobId, splitJob?.state, splitJob?.result?.files);

        if (splitJob && splitJob.state === 'done' && splitJob.result?.files?.vocals) {
            return splitJob.result.files.vocals;
        }
    } catch (e) {
        console.log('[Alignment] Could not resolve split job:', e.message);
    }
    return null;
}

export default router;
