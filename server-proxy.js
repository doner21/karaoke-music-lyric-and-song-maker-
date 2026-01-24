import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import play from 'play-dl';
import downloaderRouter from './server/downloader/index.js';
import splitterRouter, { initSplitterService } from './server/splitter/index.js';
import alignmentRouter, { initAlignmentService } from './server/alignment/index.js';
import artifactsRouter from './server/artifacts/index.js';

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


// --- ENDPOINTS: AUDIO ACQUISITION (Simulated) ---

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
                // Parse "Artist - Song" from YouTube title
                let artistName = 'Unknown Artist';
                let trackTitle = title || `Track ${videoId}`;
                const rawTitle = title || '';

                // Common patterns: "Artist - Song", "Artist – Song" (en-dash)
                const delimiterMatch = rawTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
                if (delimiterMatch) {
                    artistName = delimiterMatch[1].trim();
                    trackTitle = delimiterMatch[2].trim();
                    // Remove common suffix patterns like "(Official Video)", "[Lyrics]"
                    trackTitle = trackTitle.replace(/\s*[\(\[].*?[\)\]]$/g, '').trim();
                }

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


// --- ENDPOINTS: SPLITTER (Simulated GPU) ---



// --- MOCK FILE SERVER (For Splitter Artifacts) ---






console.log('[ServerProxy] Attempting to listen on port', PORT);
app.listen(PORT, () => {
    console.log(`\nSplitter Hat OS v1.1 running on port ${PORT}`);
    console.log(`Signatures: 90117::EdgeLatencyHunter | 44201::ThroughputEngineer`);
});
