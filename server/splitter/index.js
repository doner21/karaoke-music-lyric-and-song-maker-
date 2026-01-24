import express from 'express';
import fs from 'fs-extra';
import { Queue } from './queue.js';
import { DemucsAdapter } from './demucs-adapter.js';
import { FFmpegSplitterAdapter } from './ffmpeg-splitter-adapter.js';
import { AudioSeparatorAdapter } from './audio-separator-adapter.js';
import { UVRMDXNetAdapter } from './uvr-mdx-net-adapter.js';
import { MockSplitterAdapter } from './mock-adapter.js';
import { SongRepo } from '../db/repo.js';
import path from 'path';

const router = express.Router();

// Auto-Detection with Fallback Chain: Demucs AI -> FFmpeg -> AudioSeparator -> Mock
export const initSplitterService = async () => {
    const demucs = new DemucsAdapter();
    const uvrMdxNet = new UVRMDXNetAdapter();
    const ffmpegSplit = new FFmpegSplitterAdapter();
    const audioSep = new AudioSeparatorAdapter();
    const mock = new MockSplitterAdapter();

    // Health checks
    const demucsHealth = await demucs.checkHealth();
    const uvrHealth = await uvrMdxNet.checkHealth();

    console.log(`[SplitterService] Adapter Availability:`);
    console.log(`  - Demucs: ${demucsHealth.available}`);
    console.log(`  - UVR-MDX-NET: ${uvrHealth.available}`);

    // Helper to check if model should use UVR adapter
    const isUVRModel = (modelId) => {
        if (!modelId) return false;
        const id = modelId.toLowerCase();
        return id.includes('uvr-mdx') || id.includes('uvr_mdx') || id === 'uvr-mdx-inst-main';
    };

    // Smart processor that routes based on modelId
    if (demucsHealth.available || uvrHealth.available) {
        console.log(`[SplitterService] Active Adapter: Smart Router (Demucs + UVR-MDX-NET)`);
        Queue.setProcessor(async (job, onProgress) => {
            // Route to UVR adapter if UVR model selected AND available
            if (isUVRModel(job.modelId) && uvrHealth.available) {
                console.log(`[SplitterService] Routing to UVR-MDX-NET for model: ${job.modelId}`);
                return await uvrMdxNet.separate(job.jobId, job.inputPath, {
                    modelId: job.modelId,
                    stems: job.stems
                }, onProgress);
            }
            // Default to Demucs for other models
            if (demucsHealth.available) {
                console.log(`[SplitterService] Routing to Demucs for model: ${job.modelId}`);
                return await demucs.separate(job.jobId, job.inputPath, {
                    modelId: job.modelId,
                    stems: job.stems,
                    device: job.device
                }, onProgress);
            }
            // Fallback to UVR if only it's available
            if (uvrHealth.available) {
                console.log(`[SplitterService] Fallback to UVR-MDX-NET for model: ${job.modelId}`);
                return await uvrMdxNet.separate(job.jobId, job.inputPath, {
                    modelId: job.modelId,
                    stems: job.stems
                }, onProgress);
            }
            throw new Error('No AI splitter available');
        });
        return;
    }

    // Fallback to FFmpeg (phase inversion)
    health = await ffmpegSplit.checkHealth();
    if (health.available) {
        console.log(`[SplitterService] Active Adapter: ${ffmpegSplit.name} (Phase Inversion)`);
        Queue.setProcessor(async (job, onProgress) => {
            return await ffmpegSplit.separate(job.jobId, job.inputPath, {
                modelId: job.modelId,
                stems: job.stems
            }, onProgress);
        });
        return;
    }

    // Try audio-separator
    health = await audioSep.checkHealth();
    if (health.available) {
        console.log(`[SplitterService] Active Adapter: ${audioSep.name}`);
        Queue.setProcessor(async (job, onProgress) => {
            return await audioSep.separate(job.jobId, job.inputPath, {
                modelId: job.modelId,
                stems: job.stems
            }, onProgress);
        });
        return;
    }

    // Final Fallback: Mock
    console.log(`[SplitterService] Active Adapter: ${mock.name} (Real engines unavailable)`);
    Queue.setProcessor(async (job, onProgress) => {
        return await mock.separate(job.jobId, job.inputPath, {
            modelId: job.modelId,
            stems: job.stems
        }, onProgress);
    });
};

// initProcessor(); // Moved to explicit init

// GET /split/status/:jobId
router.get('/status/:jobId', (req, res) => {
    const job = Queue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // robustly resolve ID
    const jobId = job.id || req.params.jobId;

    const response = {
        jobId: jobId,
        state: job.state,
        progress: job.progress,
        logs: job.logs || [],
        result: null
    };

    if (job.state === 'done' && job.result) {
        const baseUrl = `/split/download/${jobId}`;
        // Debug URL gen
        console.log(`[Splitter] Status: Generating URLs for ${jobId}. Base: ${baseUrl}`);

        // Check for JSON artifact (Alignment) for this song
        // We can do this efficiently via SongRepo if we have songId
        let jsonUrl = null;
        if (job.song_id) {
            const artifacts = SongRepo.getArtifacts(job.song_id);
            const jsonArtifact = artifacts.find(a => a.kind === 'timings_json' || a.kind === 'aligned_json');
            if (jsonArtifact) {
                jsonUrl = `/split/download/${jobId}/json`;
                // Note: We need to handle 'json' stem in the download route too!
            }
        }

        response.result = {
            vocalDownloadUrl: job.result.files?.vocals ? `${baseUrl}/vocals` : null,
            bandDownloadUrl: job.result.files?.band ? `${baseUrl}/band` : null,
            bassDownloadUrl: job.result.files?.bass ? `${baseUrl}/bass` : null,
            drumsDownloadUrl: job.result.files?.drums ? `${baseUrl}/drums` : null,
            otherDownloadUrl: job.result.files?.other ? `${baseUrl}/other` : null,
            jsonDownloadUrl: jsonUrl
        };
    }

    res.json(response);
});

// POST /split/start
router.post('/start', async (req, res) => {
    const { source, modelId, stems, songId } = req.body;

    // Validation: Require inputPath OR videoId for recovery
    if ((!source || !source.inputPath) && !req.body.videoId && !songId) {
        return res.status(400).json({ error: 'Missing inputPath and no videoId/songId provided for recovery.' });
    }

    try {
        let finalSongId = songId || source.songId;

        // Fallback: Look up by videoId if provided and we don't have a valid songId
        if (!finalSongId && req.body.videoId) {
            const song = SongRepo.getByVideoId(req.body.videoId);
            if (song) {
                finalSongId = song.id;
                console.log(`[Splitter] Resolved songId ${finalSongId} from videoId ${req.body.videoId}`);
            }
        }

        if (!finalSongId) {
            // Still no ID? This will likely fail FK constraint, but let's try or return error.
            // Returning error is better.
            console.warn('[Splitter] No songId provided or found. Job may fail if song not in DB.');
        }

        const jobId = await Queue.submit({
            inputPath: source.inputPath,
            modelId: modelId || 'htdemucs',
            stems: parseInt(stems) || 2,
            songId: finalSongId, // Use resolved ID
            device: req.body.device || 'cpu', // Default to CPU (Safe Baseline)
            force: req.body.force || false // Allow forcing re-run
        });

        res.json({ jobId });
    } catch (e) {
        console.error('[Splitter] Failed to start job:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /split/cancel
router.post('/cancel', (req, res) => {
    const { jobId } = req.body;
    Queue.cancel(jobId);
    res.json({ ok: true });
});

// GET /split/download/:jobId/:stem
router.get('/download/:jobId/:stem', (req, res) => {
    const { jobId, stem } = req.params;

    // Helper for structured log
    const log = (msg, meta = {}) => console.log(JSON.stringify({ timestamp: new Date(), level: 'INFO', context: 'Download', jobId, stem, msg, ...meta }));
    const logError = (msg, err) => console.error(JSON.stringify({ timestamp: new Date(), level: 'ERROR', context: 'Download', jobId, stem, msg, error: err?.message || err, stack: err?.stack }));

    // 1. Try to find Job in Memory
    let job = Queue.getJob(jobId);
    let songId = job?.song_id;

    // 2. If not in memory, try DB (Resilience for restart/expiry)
    if (!job) {
        // We need to look up the songId from the job history if possible
        // Ideally SongRepo should support getJobById, or we iterate (expensive)
        // For now, if we can't find the job, we can't recover the songId easily unless we added a JobRepo.
        // But wait, we have SongRepo.getJobs(songId).
        // Let's assume we can't easily recover songId from just jobId without a new DB query.
        // However, we can try to rely on the Frontend sending us the right request.

        // If the Frontend is using this route, it's likely expecting the Job to support it.
        // If we want to support "Lazy" recovery, we'd need to query the DB.

        // Optimization: For now, if we fail to find the job, we proceed to checking if the 'jobId' is actually an 'artifactId' (misuse?)
        // Or simply fail.

        // Let's keep the memory check as primary.
    }

    // 3. Explicitly handle legacy/invalid job IDs
    if (jobId === 'legacy' || jobId === 'undefined' || jobId === 'null') {
        // Don't error immediately if we can somehow guess, but we can't.
        logError('Legacy job requested');
        return res.status(410).json({ error: 'Legacy job expired. Please re-run the split job or use the Artifacts API.' });
    }

    let filePath = null;
    let filename = `${stem === 'json' ? 'lyrics' : stem}.${stem === 'json' ? 'json' : 'mp3'}`; // Default

    // 4. Try to find via Artifacts (Source of Truth) if we have a Song ID
    if (songId) {
        const artifacts = SongRepo.getArtifacts(songId); // Returns array
        let targetKind = '';
        if (stem === 'vocals') targetKind = 'vocal_stem';
        else if (stem === 'band') targetKind = 'band_stem';
        else if (stem === 'json') targetKind = 'aligned_json';
        else targetKind = `stem_${stem}`;

        // If stem is json, we might check for multiple kinds
        if (stem === 'json') {
            const artifact = artifacts.find(a => a.kind === 'aligned_json' || a.kind === 'timings_json');
            if (artifact) {
                targetKind = artifact.kind; // Lock to found kind
            }
        }

        const artifact = artifacts.find(a => a.kind === targetKind);
        if (artifact) {
            filePath = artifact.storage_ref;
            log('Artifact resolved from DB', { artifactId: artifact.id, path: filePath });

            // Construct Canonical Filename: "Artist - Song (Stem).ext"
            const artist = artifact.artist_name || 'Unknown Artist';
            const song = artifact.track_title || 'Unknown Song';
            const safeArtist = artist.replace(/[<>:"/\\|?*]/g, '');
            const safeSong = song.replace(/[<>:"/\\|?*]/g, '');

            let stemLabel = stem.charAt(0).toUpperCase() + stem.slice(1);
            let ext = 'mp3';

            if (stem === 'json') {
                stemLabel = 'Lyrics';
                ext = 'json';
            }

            filename = `${safeArtist} - ${safeSong} (${stemLabel}).${ext}`;
        } else {
            log('Artifact not found in DB', { targetKind });
        }
    }

    // 5. Fallback: Job Result (Memory/Legacy)
    if (!filePath) {
        if (!job || !job.result || !job.result.files) {
            const existState = { jobExists: !!job, resultExists: !!(job && job.result) };
            logError('Job check failed (Fallback)', existState);
            return res.status(404).json({ error: 'File not found. Job may have expired and no artifact was persisted.' });
        }
        filePath = job.result.files[stem];
        log('Resolved from Job Result (Fallback)', { path: filePath });

        // Build canonical filename from song metadata (fallback case)
        if (songId) {
            const song = SongRepo.getById(songId);
            if (song) {
                const artist = (song.artist_name || 'Unknown Artist').replace(/[<>:"/\\|?*]/g, '');
                const trackTitle = (song.track_title || 'Unknown Song').replace(/[<>:"/\\|?*]/g, '');
                let stemLabel = stem.charAt(0).toUpperCase() + stem.slice(1);
                let ext = 'mp3';
                if (stem === 'json') { stemLabel = 'Lyrics'; ext = 'json'; }
                filename = `${artist} - ${trackTitle} (${stemLabel}).${ext}`;
            }
        }
    }

    // 6. Final Validation & Send
    if (!filePath) {
        logError('Stem not found after lookup strategies');
        return res.status(404).json({ error: 'Stem not found' });
    }

    try {
        if (!fs.existsSync(filePath)) {
            logError('File not found on disk', { path: filePath });
            return res.status(404).json({ error: 'File not found on disk' });
        }

        log('Starting stream', { filename, size: fs.statSync(filePath).size });
        res.download(filePath, filename, { dotfiles: 'allow' }, (err) => {
            if (err) {
                if (res.headersSent) {
                    logError('Download failed after headers sent', err);
                } else {
                    logError('Download error', err);
                    res.status(500).json({ error: 'Download failed' });
                }
            } else {
                log('Stream completed');
            }
        });
    } catch (e) {
        logError('Unexpected exception', e);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
