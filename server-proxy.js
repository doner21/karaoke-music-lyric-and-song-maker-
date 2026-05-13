import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import downloaderRouter from './server/downloader/index.js';
import splitterRouter, { initSplitterService } from './server/splitter/index.js';
import alignmentRouter, { initAlignmentService } from './server/alignment/index.js';
import artifactsRouter from './server/artifacts/index.js';
import path from 'path';
import fs from 'fs';
import { checkForUpdate, performUpdate, checkAndUpdateOnStartup } from './server/services/ytdlp-updater.js';

const app = express();
const PORT = process.env.PORT || 3002;
const DEFAULT_API_KEY = process.env.YOUTUBE_API_KEY;


app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());

// Mount Downloader Hat
app.use('/api/v1', downloaderRouter); // Spec v1.0: Base URL /api/v1
app.use('/download', downloaderRouter); // Backward compatibility
app.use('/split', splitterRouter); // Splitter Hat
app.use('/align', alignmentRouter); // Alignment Hat (AudioShake)
app.use('/artifacts', artifactsRouter); // Artifact Downloads (stable)

import { initDB } from './server/db/index.js';
import { JobMgr } from './server/orchestrator/index.js';

// Initialize Database logic
initDB();
// Start Job Manager (Orchestrator) Polling
JobMgr.startPolling();

// Initialize Services (after env load)
// Delay heavy splitter init to ensure server listens first
setTimeout(() => {
    initSplitterService().catch(e => console.error('[SplitterService] Init Validation Failed:', e));
}, 5000);

initAlignmentService();

// yt-dlp Auto-Update Check on Startup (delayed to not block server startup)
setTimeout(() => {
    checkAndUpdateOnStartup().catch(e => console.error('[ytdlp-updater] Startup check error:', e));
}, 10000);


// --- CACHE & STATE ---
const searchCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 2;

// JOB STORES (Local Service Layer)
const AudioJobs = new Map(); // jobId -> AcquireJob
const SplitJobs = new Map(); // jobId -> SplitJobStatus
const AudioAssets = new Map(); // assetId -> AudioAssetRef

// --- CONSTANTS ---
const MOCK_FALLBACK = [
    { videoId: 'fJ9rUzIMcZQ', title: 'Queen – Bohemian Rhapsody', thumbnailUrl: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg', channelTitle: 'Queen Official' },
    { videoId: 'YQHsXMglC9A', title: 'Adele - Hello', thumbnailUrl: 'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg', channelTitle: 'AdeleVEVO' },
];

const normalizeVideo = (item) => ({
    videoId: item.id?.videoId || item.id,
    title: item.snippet?.title || 'Unknown',
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
    channelTitle: item.snippet?.channelTitle || '',
    publishedAt: item.snippet?.publishedAt || ''
});


// --- ENDPOINTS: UNIFIED SEARCH ---
import { UnifiedSearch } from './server/library/search.js';
import { SongRepo } from './server/db/repo.js'; // For direct lookups if needed
import { searchSong, getLyrics } from './server/services/genius.js';

app.get('/api/lyrics/search', async (req, res) => {
    const { artist, title, q } = req.query;
    // Allow either q (general query) or artist+title
    const query = q || `${artist || ''} ${title || ''}`.trim();
    if (!query) return res.status(400).json({ error: 'Missing search query (q, or artist/title)' });

    try {
        console.log(`[Lyrics] Searching Genius for: ${query}`);
        const matches = await searchSong(query);
        res.json({ matches });
    } catch (e) {
        console.error('[Lyrics] Search failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lyrics/fetch', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    try {
        console.log(`[Lyrics] Fetching from: ${url}`);
        const result = await getLyrics(url);
        res.json(result);
    } catch (e) {
        console.error('[Lyrics] Fetch failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/lyrics/save', (req, res) => {
    const { songId, text, source, url } = req.body;
    if (!songId || !text) return res.status(400).json({ error: 'Missing songId or text' });

    try {
        const result = SongRepo.saveLyrics(songId, text, source || 'manual');
        res.json(result);
    } catch (e) {
        console.error('[Lyrics] Save failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lyrics/:songId', (req, res) => {
    try {
        const lyrics = SongRepo.getLyrics(req.params.songId);
        res.json(lyrics || null);
    } catch (e) {
        console.error('[Lyrics] Get failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/youtube/search', async (req, res) => {
    const { q, pageToken } = req.query;
    const clientKey = req.headers['x-youtube-api-key'];

    if (!q) return res.status(400).json({ error: 'INVALID' });

    try {
        console.log(`[UnifiedSearch] Query: '${q}'`);
        const result = await UnifiedSearch.search(q, clientKey, pageToken);
        res.json(result);
    } catch (e) {
        console.error('[UnifiedSearch] Error:', e);
        res.status(500).json({ items: [], error: e.message });
    }
});

// --- ENDPOINTS: LIBRARY (Phase 3) ---
app.get('/api/library/songs', (req, res) => {
    const songs = SongRepo.search(''); // List all (limited by repo default?)
    // Actually repo.search uses LIKE %query%, empty string returns all (limit 20).
    // We might want a better listAll method.
    // For now search('') acts as "recent/all".
    res.json({ items: songs });
});

app.get('/api/library/songs/:id/artifacts', (req, res) => {
    const artifacts = SongRepo.getArtifacts(req.params.id);
    // Map to include stable downloadUrl
    const mapped = artifacts.map(a => ({
        id: a.id,
        kind: a.kind,
        filename: a.filename,
        mimeType: a.mime_type,
        downloadUrl: `/artifacts/${a.id}/download`,
        createdAt: a.created_at,
        artistName: a.artist_name,
        trackTitle: a.track_title
    }));
    res.json(mapped);
});

app.get('/api/library/songs/:id/jobs', (req, res) => {
    const jobs = SongRepo.getJobs(req.params.id);
    res.json(jobs);
});

// API to get stem file storage paths for export
app.get('/api/library/songs/:id/stem-paths', (req, res) => {
    try {
        const artifacts = SongRepo.getArtifacts(req.params.id);
        const vocalArtifact = artifacts.find(a => a.kind === 'vocal_stem');
        const bandArtifact = artifacts.find(a => a.kind === 'band_stem');

        if (!vocalArtifact || !bandArtifact) {
            return res.status(404).json({ error: 'Stems not found' });
        }

        res.json({
            vocalPath: vocalArtifact.storage_ref,
            bandPath: bandArtifact.storage_ref
        });
    } catch (e) {
        console.error('[stem-paths] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- EXPORT ENDPOINT (Remotion-based MP4 Creation) ---
app.post('/export/mp4', async (req, res) => {
    const { songId, bandVolume = 1, vocalVolume = 1, lyricsData, highlightColor = '#6EE7B7', durationSec } = req.body;

    if (!songId) {
        return res.status(400).json({ error: 'Missing songId' });
    }

    try {
        console.log(`[Export] Starting Remotion export for song: ${songId}`);

        // Get artifacts for this song
        const artifacts = SongRepo.getArtifacts(songId);
        const vocalArtifact = artifacts.find(a => a.kind === 'vocal_stem');
        const bandArtifact = artifacts.find(a => a.kind === 'band_stem');

        if (!vocalArtifact || !bandArtifact) {
            return res.status(400).json({ error: 'Stems not available for this song' });
        }

        // Resolve paths
        const vocalPath = vocalArtifact.storage_ref;
        const bandPath = bandArtifact.storage_ref;

        if (!fs.existsSync(vocalPath) || !fs.existsSync(bandPath)) {
            return res.status(400).json({ error: 'Stem files not found on disk' });
        }

        // Get song info for filename
        const song = SongRepo.getById(songId);
        const safeName = (song?.track_title || 'karaoke-export').replace(/[<>:"/\\|?*]/g, '_');

        // Output to exports folder
        const exportsDir = path.resolve('./exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }
        const outputPath = path.join(exportsDir, `${safeName}_${Date.now()}.mp4`);

        // Import the correct export function
        const { exportKaraokeVideo } = await import('./server/services/exportService.js');

        // Run export with Remotion
        const result = await exportKaraokeVideo({
            bandStemPath: bandPath,
            vocalStemPath: vocalPath,
            bandVolume: parseFloat(bandVolume),
            vocalVolume: parseFloat(vocalVolume),
            lyricsData: lyricsData || { lyrics: [] },
            durationSec: parseFloat(durationSec) || 180,
            highlightColor,
            outputPath,
            onProgress: (p, msg) => console.log(`[Export] ${Math.round(p * 100)}%: ${msg}`)
        });

        console.log(`[Export] Complete: ${outputPath}`);

        // Return download URL
        res.json({
            success: true,
            downloadUrl: `/export/download/${path.basename(outputPath)}`,
            filename: path.basename(outputPath)
        });

    } catch (e) {
        console.error('[Export] Failed:', e);
        res.status(500).json({ error: e.message });
    }
});

// Serve exported files
app.get('/export/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.resolve('./exports', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
});

// --- ENDPOINTS: AUDIO ACQUISITION (Simulated) ---

// WAVEFORM CACHE (Simple In-Memory)
import { generateWaveform } from './server/utils/waveform.js';
const WaveformCache = new Map(); // path -> number[]

app.get('/api/audio/waveform', async (req, res) => {
    const { path: filePath, url } = req.query;

    let targetPath = filePath;

    // Resolve URL to path if needed
    if (!targetPath && url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `http://localhost:${PORT}${url}`);

            // Case 2: Splitter download /split/download/:jobId/:type
            const splitMatch = urlObj.pathname.match(/\/split\/download\/([^\/]+)\/(vocals|accompaniment)/);
            if (splitMatch) {
                const jobId = splitMatch[1];
                const type = splitMatch[2];

                // Use Queue to find the job and result
                const { Queue } = await import('./server/splitter/queue.js');
                const job = Queue.getJob(jobId);

                if (job && job.result && job.result.files) {
                    targetPath = job.result.files[type];
                }
            }

            // Case 3: Export download
            const exportMatch = urlObj.pathname.match(/\/export\/download\/([^\/]+)/);
            if (exportMatch) {
                targetPath = path.resolve('./exports', exportMatch[1]);
            }

            // Case 4: Artifact download
            const artifactMatch = urlObj.pathname.match(/\/artifacts\/([^\/]+)\/download/);
            if (artifactMatch) {
                const artifactId = artifactMatch[1];
                const artifact = SongRepo.getArtifactById(artifactId);
                if (artifact && artifact.storage_ref) {
                    targetPath = artifact.storage_ref;
                }
            }

        } catch (e) {
            console.error('[Waveform] URL resolution failed', e);
        }
    }

    if (!targetPath) return res.status(400).json({ error: 'Could not resolve path from URL' });
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'File not found' });

    try {
        // Check cache
        if (WaveformCache.has(targetPath)) {
            // console.log('[Waveform] Serving from cache');
            return res.json(WaveformCache.get(targetPath));
        }

        const peaks = await generateWaveform(targetPath);

        // Cache it
        WaveformCache.set(targetPath, peaks);

        res.json(peaks);
    } catch (e) {
        console.error('[Waveform] Generation failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/audio/status/:jobId', (req, res) => {
    const job = AudioJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

app.post('/audio/acquire', (req, res) => {
    const { videoId, title } = req.body;
    if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

    const jobId = crypto.randomUUID();
    const assetId = `asset_${videoId}`;

    // Initialize Job
    const job = {
        jobId,
        state: 'queued',
        stage: 'resolve',
        progress: 0,
        result: null
    };
    AudioJobs.set(jobId, job);
    res.json({ jobId });

    // Simulate Async Work
    setTimeout(() => { job.state = 'running'; job.progress = 0.1; }, 500);
    setTimeout(() => { job.stage = 'fetch'; job.progress = 0.4; }, 1500);
    setTimeout(() => { job.stage = 'transcode'; job.progress = 0.8; }, 3000);
    setTimeout(() => {
        // Validation: Ensure Asset Exists
        const asset = {
            kind: 'youtube_acquired',
            assetId,
            linkedVideoId: videoId,
            displayName: title || `Track ${videoId}`,
            mimeType: 'audio/wav',
            durationSec: 180, // Mock
            createdAt: Date.now()
        };
        AudioAssets.set(assetId, asset);

        // PERSISTENCE: Ensure Song exists in DB for Splitter FK
        const existing = SongRepo.getByVideoId(videoId);
        if (!existing) {
            try {
                const { artistName, trackTitle } = parseVideoTitle(title || '');

                SongRepo.create({
                    videoId: videoId,
                    sourceTitleRaw: title || `Track ${videoId}`,
                    artistName: artistName,
                    trackTitle: trackTitle,
                    canonicalDisplayName: `${artistName} - ${trackTitle}`,
                    sourceType: 'youtube'
                });
                console.log(`[Acquire] Auto-persisted Song for ${videoId}: ${artistName} - ${trackTitle}`);
            } catch (e) {
                console.error('[Acquire] Failed to persist song:', e);
            }
        }

        job.state = 'done';
        job.stage = 'finalize';
        job.progress = 1.0;
        job.result = AudioAssets.get(assetId);
    }, 4500);
});

app.post('/audio/cancel', (req, res) => {
    const { jobId } = req.body;
    const job = AudioJobs.get(jobId);
    if (job && job.state !== 'done') {
        job.state = 'canceled';
        job.progress = 0;
    }
    res.json({ ok: true });
});


// --- ENDPOINTS: yt-dlp Updater ---

app.get('/ytdlp/status', async (req, res) => {
    try {
        console.log('[ytdlp] Checking update status...');
        const status = await checkForUpdate();
        res.json(status);
    } catch (e) {
        console.error('[ytdlp] Status check failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/ytdlp/update', async (req, res) => {
    try {
        console.log('[ytdlp] Performing manual update...');
        const result = await performUpdate();
        res.json(result);
    } catch (e) {
        console.error('[ytdlp] Update failed:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});


// --- ENDPOINTS: SPLITTER (Simulated GPU) ---



// --- MOCK FILE SERVER (For Splitter Artifacts) ---






console.log('[ServerProxy] Attempting to listen on port', PORT);
app.listen(PORT, () => {
    console.log(`\nSplitter Hat OS v1.1 running on port ${PORT}`);
    console.log(`Signatures: 90117::EdgeLatencyHunter | 44201::ThroughputEngineer`);
});
