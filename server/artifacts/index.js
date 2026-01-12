import express from 'express';
import fs from 'fs-extra';
import { SongRepo } from '../db/repo.js';

const router = express.Router();

// Helper for structured log
const log = (context, msg, meta = {}) => console.log(JSON.stringify({ timestamp: new Date(), level: 'INFO', context, msg, ...meta }));
const logError = (context, msg, err) => console.error(JSON.stringify({ timestamp: new Date(), level: 'ERROR', context, msg, error: err?.message || err, stack: err?.stack }));

/**
 * GET /artifacts/check?videoId=...
 * Helper to resolve artifacts by Video ID (for Search/Feed integration)
 */
router.get('/check', (req, res) => {
    const { videoId } = req.query;
    if (!videoId) return res.status(400).json([]);

    // 1. Find song by Video ID
    const song = SongRepo.getByVideoId(videoId);
    if (!song) return res.json([]); // No song, no artifacts

    // 2. Get artifacts
    const artifacts = SongRepo.getArtifacts(song.id);

    // 3. Map to useful structure
    const mapped = artifacts.map(a => ({
        id: a.id,
        kind: a.kind,
        filename: a.filename,
        downloadUrl: `/artifacts/${a.id}/download`,
        createdAt: a.created_at
    }));

    res.json(mapped);
});

/**
 * GET /artifacts/:artifactId/download
 * Stable, job-independent download route.
 * Downloads artifact by its persistent ID.
 */
router.get('/:artifactId/download', (req, res) => {
    const { artifactId } = req.params;
    const ctx = 'ArtifactDownload';

    log(ctx, 'Download requested', { artifactId });

    // 1. Validate artifactId format (basic UUID check)
    if (!artifactId || artifactId === 'undefined' || artifactId === 'null') {
        logError(ctx, 'Invalid artifactId', { artifactId });
        return res.status(400).json({ code: 'INVALID_ID', message: 'Invalid artifact ID' });
    }

    // 2. Lookup artifact in DB
    const artifact = SongRepo.getArtifactById(artifactId);
    if (!artifact) {
        logError(ctx, 'Artifact not found in DB', { artifactId });
        return res.status(404).json({
            code: 'ARTIFACT_MISSING',
            artifactId,
            message: 'Artifact not found',
            suggestedAction: 'RUN_SPLIT'
        });
    }

    log(ctx, 'Artifact found', { artifactId, kind: artifact.kind, path: artifact.storage_ref });

    // 3. Check file exists on disk
    if (!artifact.storage_ref || !fs.existsSync(artifact.storage_ref)) {
        logError(ctx, 'File missing on disk', { artifactId, path: artifact.storage_ref });
        return res.status(404).json({
            code: 'FILE_MISSING',
            artifactId,
            kind: artifact.kind,
            message: 'Artifact file not found on disk',
            suggestedAction: 'RUN_SPLIT'
        });
    }

    // 4. Build canonical filename: "Artist - Song (Stem).ext"
    const artist = (artifact.artist_name || 'Unknown Artist').replace(/[<>:"/\\|?*]/g, '');
    const song = (artifact.track_title || 'Unknown Song').replace(/[<>:"/\\|?*]/g, '');

    let stemLabel = 'File';
    let ext = 'mp3';

    if (artifact.kind === 'vocal_stem') { stemLabel = 'Vocal'; ext = 'mp3'; }
    else if (artifact.kind === 'band_stem') { stemLabel = 'Band'; ext = 'mp3'; }
    else if (artifact.kind === 'stem_bass') { stemLabel = 'Bass'; ext = 'mp3'; }
    else if (artifact.kind === 'stem_drums') { stemLabel = 'Drums'; ext = 'mp3'; }
    else if (artifact.kind === 'timings_json' || artifact.kind === 'aligned_json') { stemLabel = 'Lyrics'; ext = 'json'; }

    // Always use canonical format for consistent naming
    const filename = `${artist} - ${song} (${stemLabel}).${ext}`;

    // 5. Stream file
    try {
        const stats = fs.statSync(artifact.storage_ref);
        log(ctx, 'Starting stream', { artifactId, filename, size: stats.size });

        res.download(artifact.storage_ref, filename, { dotfiles: 'allow' }, (err) => {
            if (err) {
                if (res.headersSent) {
                    logError(ctx, 'Stream failed after headers', err);
                } else {
                    logError(ctx, 'Download error', err);
                    res.status(500).json({ code: 'DOWNLOAD_FAILED', message: 'Download failed' });
                }
            } else {
                log(ctx, 'Stream completed', { artifactId });
            }
        });
    } catch (e) {
        logError(ctx, 'Unexpected exception', e);
        if (!res.headersSent) res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal Server Error' });
    }
});

export default router;
