import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Play, Pause, Square, SkipBack, SkipForward, Cpu, Wifi, Activity,
    Disc, Layers, Zap, Info, Minimize2, Maximize2, X, Download, HardDrive, Package, RefreshCw,
    FileAudio, CheckCircle2, Lock, FileJson, Eye, EyeOff, AlertTriangle,
    Mic2, Music, Film, Edit3 // Added for Karaoke Icon, Stem controls, MP4 export, and Edit Timing
} from 'lucide-react';
import KaraokeLyricsDisplay from '../lyrics/KaraokeLyricsDisplay';
import { AudioStemManager } from '../../utils/AudioStemManager';
import ElectronYouTubePlayer from '../ElectronYouTubePlayer';
import { useKaraokeExport, RESOLUTION_MAP } from '../../hooks/useKaraokeExport';
import TokenEditorPanel from '../editor/TokenEditorPanel';

/* 
  ECOLOGICAL_OS_v5::[ResilienceTest, MockEngine, HighHeat]
  SEEDS: 9910 | HEAT: 0.85 | NOISE: 0.45 | COUPLING: 0.9
*/

const API_URL = 'http://localhost:3002';
const DEBOUNCE_MS = 300;
const fmtTime = (s) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function IntegratedEcologicalOS() {
    // --- STATE: INGEST (YT) ---
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('yt_api_key') || '');
    const [selectedSong, setSelectedSong] = useState(null);

    // --- STATE: STUDIO (Player) ---
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- STATE: FABRICATION (Jobs) ---
    // Job 1: Archivist (Downloader)
    const [archiveJob, setArchiveJob] = useState(null);
    const [localAsset, setLocalAsset] = useState(null); // Result from Archivist

    // Job 2: Splitter
    const [splitJob, setSplitJob] = useState(null);
    const [splitResult, setSplitResult] = useState(null);

    // Job 3: Alignment (AudioShake)
    const [alignJob, setAlignJob] = useState(null);
    const [alignResult, setAlignResult] = useState(null);
    const [lyricsText, setLyricsText] = useState('');
    const [isStale, setIsStale] = useState(false);
    const [showJsonPreview, setShowJsonPreview] = useState(false);

    // Error Modal State
    const [errorModal, setErrorModal] = useState(null); // { title, message }

    // Song Artifacts (for stable downloads)
    const [songArtifacts, setSongArtifacts] = useState([]);

    // Genius Integration
    const [geniusMatches, setGeniusMatches] = useState([]);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

    // Config (v5 Resilience Mode)
    const [enginePref, setEnginePref] = useState('yt-dlp');
    const [modelId, setModelId] = useState('htdemucs');
    const [splitterDevice, setSplitterDevice] = useState('cpu'); // 'cpu' | 'gpu'

    // yt-dlp Updater State
    const [ytdlpStatus, setYtdlpStatus] = useState(null); // { updateAvailable, currentVersion, latestVersion }
    const [isCheckingYtdlp, setIsCheckingYtdlp] = useState(false);
    const [isUpdatingYtdlp, setIsUpdatingYtdlp] = useState(false);
    const [ytdlpUpdateResult, setYtdlpUpdateResult] = useState(null);

    const [stems, setStems] = useState(2);

    // --- STATE: PRESENTATION ---
    const [viewMode, setViewMode] = useState('editor'); // 'editor' | 'preview'
    const [editorMode, setEditorMode] = useState(false); // Token timing editor modal
    const [exportResolution, setExportResolution] = useState('720p'); // Export resolution preset
    const [gpuAcceleration, setGpuAcceleration] = useState('auto'); // Renderer: 'auto' (GPU first) | 'force-cpu'

    // --- STATE: DISPLAY PREFS (Lifted from KaraokeLyricsDisplay) ---
    const [linesPerPage, setLinesPerPage] = useState(() => parseInt(localStorage.getItem('karaoke_linesPerPage') || '2'));
    const [highlightColor, setHighlightColor] = useState(() => localStorage.getItem('karaoke_highlightColor') || '#7CB87C');
    const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('karaoke_fontSize') || '32'));

    useEffect(() => { localStorage.setItem('karaoke_linesPerPage', linesPerPage); }, [linesPerPage]);
    useEffect(() => { localStorage.setItem('karaoke_highlightColor', highlightColor); }, [highlightColor]);
    useEffect(() => { localStorage.setItem('karaoke_fontSize', fontSize); }, [fontSize]);

    // --- STATE: STEM AUDIO (AudioStemManager) ---
    const [vocalVolume, setVocalVolume] = useState(1);
    const [bandVolume, setBandVolume] = useState(1);
    const [stemsLoaded, setStemsLoaded] = useState(false);
    const [stemError, setStemError] = useState(null);
    const [useStems, setUseStems] = useState(false); // Toggle between YT audio vs stem audio
    const [hoverProgress, setHoverProgress] = useState(null); // Seek bar hover position (0-1), null when not hovering
    const audioManagerRef = useRef(null);
    const useStemsRef = useRef(false); // Ref to avoid stale closure in callbacks
    const seekBarRef = useRef(null); // Ref for seek bar element to get accurate bounding rect

    // --- MP4 EXPORT HOOK (Canvas Frame + FFmpeg) ---
    const { isExporting, exportProgress, exportError, startExport } = useKaraokeExport({
        songId: selectedSong?.id,
        bandVolume,
        vocalVolume,
        timingJson: alignResult, // Raw timing data for lyrics rendering
        linesPerPage,
        highlightColor,
        trackDuration: duration,
        songTitle: selectedSong?.title || 'karaoke-export',
        exportResolution,
        gpuAcceleration
    });

    // Keep ref in sync with state
    useEffect(() => {
        useStemsRef.current = useStems;
    }, [useStems]);

    // Initialize AudioStemManager on mount
    useEffect(() => {
        audioManagerRef.current = new AudioStemManager({
            onError: (err) => {
                console.error('[IntegratedEcologicalOS] Stem audio error:', err);
                setStemError(err.message);
            },
            onStateChange: (state) => {
                // Use ref to avoid stale closure
                if (useStemsRef.current) {
                    setIsPlaying(state === 'playing');
                }
            },
            onTimeUpdate: (time) => {
                // Use ref to avoid stale closure
                if (useStemsRef.current) {
                    setCurrentTime(time);
                }
            }
        });

        return () => {
            audioManagerRef.current?.dispose();
        };
    }, []);

    // Sync volume changes to AudioStemManager
    useEffect(() => {
        audioManagerRef.current?.setVolume('vocal', vocalVolume);
    }, [vocalVolume]);

    useEffect(() => {
        audioManagerRef.current?.setVolume('band', bandVolume);
    }, [bandVolume]);

    // Detect if running in Electron (used to disable auto-loading which crashes)
    const isElectron = typeof window !== 'undefined' &&
        (window.process?.versions?.electron || navigator.userAgent.includes('Electron'));

    // DISABLED AUTO-LOADING: Decoding large audio files crashes Electron's renderer
    // Stems are now loaded explicitly when user clicks "Use Stems" button
    // See loadStemsManually() function below
    useEffect(() => {
        if (splitResult?.vocalDownloadUrl && splitResult?.bandDownloadUrl) {
            // In Electron: Do NOT auto-load stems - it crashes the renderer
            // User must click "Use Stems" button which calls loadStemsManually()
            if (isElectron) {
                console.log('[Stems] Auto-loading disabled in Electron to prevent crash. Click "Use Stems" to load.');
                return;
            }

            // In browser: Safe to auto-load
            const loadStems = async () => {
                try {
                    const vocalUrl = `${API_URL}${splitResult.vocalDownloadUrl}`;
                    const bandUrl = `${API_URL}${splitResult.bandDownloadUrl}`;
                    console.log('[Stems] Loading:', { vocalUrl, bandUrl });

                    const result = await audioManagerRef.current?.loadStems(bandUrl, vocalUrl);
                    if (result?.success) {
                        setStemsLoaded(true);
                        setStemError(null);
                        setDuration(audioManagerRef.current.getDuration());
                        // Sync initial volume values to newly created gain nodes
                        audioManagerRef.current?.setVolume('vocal', vocalVolume);
                        audioManagerRef.current?.setVolume('band', bandVolume);
                        console.log('[Stems] Loaded successfully, duration:', audioManagerRef.current.getDuration());
                    } else {
                        setStemError(result?.error || 'Failed to load stems');
                    }
                } catch (err) {
                    console.error('[Stems] Load error:', err);
                    setStemError(err.message);
                }
            };
            loadStems();
        } else {
            setStemsLoaded(false);
        }
    }, [splitResult?.vocalDownloadUrl, splitResult?.bandDownloadUrl, isElectron]);

    // Player ref for ElectronYouTubePlayer
    const playerRef = useRef(null);

    // --- EFFECTS ---
    // Note: YouTube IFrame API loading is now handled by ElectronYouTubePlayer component

    // Sync YouTube video to stem time periodically in Stem Mode (prevents drift)
    useEffect(() => {
        if (!useStems || !player || !isPlaying) return;

        const SYNC_TOLERANCE = 0.5; // Allow 0.5s drift before correcting
        const syncInterval = setInterval(() => {
            const ytTime = player.getCurrentTime?.() || 0;
            const stemTime = currentTime;

            if (Math.abs(ytTime - stemTime) > SYNC_TOLERANCE) {
                console.log(`[StemSync] Correcting drift: YT=${ytTime.toFixed(2)}s, Stem=${stemTime.toFixed(2)}s`);
                player.seekTo(stemTime, true);
            }
        }, 2000); // Check every 2 seconds

        return () => clearInterval(syncInterval);
    }, [useStems, player, isPlaying, currentTime]);

    // Mute/unmute YouTube when stem mode changes
    // Critical for web mode where the muted prop on ElectronYouTubePlayer only affects initialization
    useEffect(() => {
        if (!player) return;

        if (useStems) {
            // Stem mode ON: mute YouTube audio completely
            console.log('[StemMode] Muting YouTube audio');
            player.mute?.();
            player.setVolume?.(0);
        } else {
            // Stem mode OFF: restore YouTube audio
            console.log('[StemMode] Unmuting YouTube audio');
            player.unMute?.();
            player.setVolume?.(100);
        }
    }, [useStems, player]);

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) performSearch(query);
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query, apiKey]);

    // Poll Archivist (Spec v1.0)
    useEffect(() => {
        if (!archiveJob || archiveJob.state === 'done' || archiveJob.state === 'error') return;
        const i = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/v1/audio/status/${archiveJob.jobId}`);
                const data = await res.json(); // AcquireJob
                setArchiveJob(data);

                if (data.state === 'done' && data.result) {
                    setArchiveJob(data);
                    // result is now AudioAssetRef (includes 'files' via internal extension)
                    setLocalAsset(data.result);
                }
            } catch (e) { console.error(e); }
        }, 500);
        return () => clearInterval(i);
    }, [archiveJob]);

    // Poll Splitter
    useEffect(() => {
        if (!splitJob || !splitJob.jobId || splitJob.state === 'done' || splitJob.state === 'error') return;
        const jobId = splitJob.jobId; // Capture jobId at effect start
        const i = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/split/status/${jobId}`);
                const data = await res.json();
                // Preserve jobId during update (API might not return it)
                setSplitJob(prev => ({ ...prev, ...data, jobId }));
                if (data.state === 'done') {
                    setSplitResult(data.result);
                }
            } catch (e) { console.error(e); }
        }, 500);
        return () => clearInterval(i);
    }, [splitJob?.jobId, splitJob?.state]); // Only re-run when jobId or state changes

    // Poll Alignment (AudioShake)
    useEffect(() => {
        if (!alignJob || !alignJob.jobId || alignJob.state === 'done' || alignJob.state === 'error' || alignJob.state === 'canceled') return;
        const jobId = alignJob.jobId; // Capture jobId at effect start
        const i = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/align/status/${jobId}`);
                const data = await res.json();
                // Preserve jobId during update (API might not return it consistently)
                setAlignJob(prev => ({ ...prev, ...data, jobId }));
                if (data.state === 'done') {
                    // Fetch the actual result
                    const resultRes = await fetch(`${API_URL}/align/result/${jobId}`);
                    const resultData = await resultRes.json();
                    setAlignResult(resultData);
                    setIsStale(false);
                }
            } catch (e) { console.error(e); }
        }, 1000);
        return () => clearInterval(i);
    }, [alignJob?.jobId, alignJob?.state]); // Only re-run when jobId or state changes


    // --- ACTIONS ---
    // --- HYDRATION ---
    const hydrateSongState = async (song) => {
        if (!song) return;

        // Reset State first (but NOT lyrics - preserve user edits until we load existing)
        setArchiveJob(null);
        setLocalAsset(null);
        setSplitJob(null);
        setSplitResult(null);
        setAlignJob(null);
        setAlignResult(null);
        setIsStale(false);
        // Don't reset lyricsText here - we'll load from existing alignment below

        // If not local, we start fresh 
        if (!song.isLocal) {
            setLyricsText(''); // Only clear for non-local songs
            return;
        }

        console.log('[Hydration] Fetching state for:', song.id);

        let dbLyricsFound = false; // Flag to prevent overwriting with old job data

        try {
            // 0. FETCH SAVED LYRICS (New)
            try {
                const lyricsRes = await fetch(`${API_URL}/api/lyrics/${song.id}`);
                if (lyricsRes.ok) {
                    const lyricsData = await lyricsRes.json();
                    if (lyricsData && lyricsData.text) {
                        console.log('[Hydration] Found saved lyrics in DB');
                        setLyricsText(lyricsData.text);
                        dbLyricsFound = true;
                        // If we have saved lyrics, we don't want to overwrite them with old job params later
                        // unless we explicitly decide to. For now, let's assume DB is truth.
                    }
                }
            } catch (err) {
                console.warn('[Hydration] Failed to fetch saved lyrics:', err);
            }

            // 1. Fetch Artifacts via stable endpoint
            const artRes = await fetch(`${API_URL}/artifacts/check?videoId=${song.videoId}`);
            const artifacts = await artRes.json();
            setSongArtifacts(artifacts);

            // Map Artifacts to local state
            const dlArtifact = artifacts.find(a => a.kind === 'downloaded_media');
            if (dlArtifact) {
                setLocalAsset({ files: [{ path: dlArtifact.storage_ref, filename: dlArtifact.filename }] });
            }

            const vocalStem = artifacts.find(a => a.kind === 'vocal_stem');
            const bandStem = artifacts.find(a => a.kind === 'band_stem');

            if (vocalStem || bandStem) {
                // Use artifact-based download URLs (stable, job-independent)
                const vocalUrl = vocalStem ? `/artifacts/${vocalStem.id}/download` : null;
                const bandUrl = bandStem ? `/artifacts/${bandStem.id}/download` : null;

                setSplitResult({
                    vocalDownloadUrl: vocalUrl,
                    bandDownloadUrl: bandUrl
                });

                // AUTO-LOAD STEMS for database songs with both stems available
                // This is safe since stems are already processed/cached
                if (vocalUrl && bandUrl) {
                    console.log('[Hydration] Database song has stems, loading them now...');
                    // AWAIT the stem loading so hydration completes with stems ready
                    try {
                        const fullVocalUrl = `${API_URL}${vocalUrl}`;
                        const fullBandUrl = `${API_URL}${bandUrl}`;
                        console.log('[Stems] Loading for database song:', { fullVocalUrl, fullBandUrl });

                        const result = await audioManagerRef.current?.loadStems(fullBandUrl, fullVocalUrl);
                        if (result?.success) {
                            setStemsLoaded(true);
                            setStemError(null);
                            const stemDuration = audioManagerRef.current?.getDuration() || 0;
                            if (stemDuration > 0) {
                                setDuration(stemDuration);
                            }
                            audioManagerRef.current?.setVolume('vocal', vocalVolume);
                            audioManagerRef.current?.setVolume('band', bandVolume);
                            console.log('[Stems] Stems loaded - song is READY TO PLAY');

                            // Auto-enable stem mode for database songs with alignment
                            setUseStems(true);
                            setViewMode('preview');
                        } else {
                            console.warn('[Stems] Failed to load:', result?.error);
                            setStemError(result?.error || 'Failed to load stems');
                        }
                    } catch (err) {
                        console.error('[Stems] Load error:', err);
                        setStemError(err.message);
                    }
                }
            }

            const timings = artifacts.find(a => a.kind === 'timings_json');
            if (timings) {
                // We need to fetch the content? Or job result has it.
                // For now, let's look for the job first.
            }

            // 2. Fetch Jobs
            const jobsRes = await fetch(`${API_URL}/api/library/songs/${song.id}/jobs`);
            const jobs = await jobsRes.json();

            // Map Jobs to State
            const dlJob = jobs.find(j => j.kind === 'download');
            if (dlJob) setArchiveJob({ ...dlJob, jobId: dlJob.id }); // Map id -> jobId

            const spJob = jobs.find(j => j.kind === 'split');
            if (spJob) {
                setSplitJob({ ...spJob, jobId: spJob.id });
                if (spJob.state === 'done' && spJob.result) {
                    // Prefer job result if available as it has valid structure
                }
            }

            const alJob = jobs.find(j => j.kind === 'align');
            if (alJob) {
                setAlignJob({ ...alJob, jobId: alJob.id });
                if (alJob.state === 'done' && alJob.result) {
                    setAlignResult(alJob.result);

                    // LOAD EXISTING LYRICS from alignment result so user can edit them
                    if (!dbLyricsFound) {
                        // Check if result has lyrics in the expected format
                        if (alJob.result.lyrics && Array.isArray(alJob.result.lyrics)) {
                            // Extract text from lyrics array structure
                            const existingLyrics = alJob.result.lyrics.map(line =>
                                line.words ? line.words.map(w => w.text || w.word || '').join(' ') : (line.text || '')
                            ).join('\n');
                            if (existingLyrics.trim()) {
                                console.log('[Hydration] Loading existing lyrics:', existingLyrics.length, 'chars');
                                setLyricsText(existingLyrics);
                            }
                        } else if (alJob.params?.lyricsText) {
                            // Fallback: use the original lyrics from job params
                            console.log('[Hydration] Loading lyrics from job params:', alJob.params.lyricsText.length, 'chars');
                            setLyricsText(alJob.params.lyricsText);
                        } else {
                            setLyricsText(''); // No existing lyrics found
                        }
                    }
                } else {
                    if (!dbLyricsFound) setLyricsText(''); // Job not done, clear lyrics
                }
            } else {
                if (!dbLyricsFound) setLyricsText(''); // No alignment job, clear lyrics
            }

            // Staleness Check
            if (vocalStem && timings) {
                // If timings created BEFORE vocals, it's stale (e.g. we re-split but didn't re-align)
                if (timings.created_at < vocalStem.created_at) {
                    console.log('[hydrate] Timings are stale');
                    setIsStale(true);
                }
            }

        } catch (e) {
            console.error('[Hydration] Failed:', e);
            setLyricsText(''); // Clear lyrics on error
        }
    };

    // --- ACTIONS ---
    const performSearch = async (q) => {
        setIsSearching(true);
        try {
            const headers = apiKey ? { 'x-youtube-api-key': apiKey } : {};
            const res = await fetch(`${API_URL}/api/youtube/search?q=${encodeURIComponent(q)}`, { headers });
            const data = await res.json();
            setResults(data.items || []);
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    const handleFetchGeniusLyrics = async (match) => {
        setIsFetchingLyrics(true);
        try {
            const res = await fetch(`${API_URL}/api/lyrics/fetch?url=${encodeURIComponent(match.url)}`);
            const data = await res.json();
            if (data.lyrics) {
                setLyricsText(data.lyrics); // Update Lyrics Text
                setShowMatchModal(false);
                if (alignResult) setIsStale(true); // Mark alignment as stale

                // SAVE LYRICS TO DB IMMEDIATEY
                if (selectedSong && selectedSong.id) {
                    try {
                        await fetch(`${API_URL}/api/lyrics/save`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                songId: selectedSong.id,
                                text: data.lyrics,
                                source: 'Genius'
                            })
                        });
                        console.log('Genius lyrics saved to DB');
                    } catch (saveErr) {
                        console.error('Failed to save Genius lyrics to DB:', saveErr);
                    }
                }
            }
        } catch (e) {
            console.error("Lyrics fetch failed", e);
            setErrorModal({ title: 'Lyrics Error', message: 'Failed to fetch lyrics from Genius.' });
        } finally {
            setIsFetchingLyrics(false);
        }
    };

    // ACTIONS

    // HELPER: CENTRALIZED STOP ALL (Playback & State)
    const stopAllPlayback = () => {
        console.log('[Playback] Executing STOP ALL (Global Reset)');

        // 1. Audio Manager (Stems)
        if (audioManagerRef.current) {
            audioManagerRef.current.stop();
        }

        // 2. YouTube Player
        // Critical: Unmute and reset volume so next play is clean
        if (player) {
            try {
                player.pauseVideo?.();
                player.seekTo?.(0, true);
                player.unMute?.();
                player.setVolume?.(100);
            } catch (e) {
                console.warn('[Playback] Player stop error:', e);
            }
        }

        // 3. Reset React State
        setIsPlaying(false);
        setCurrentTime(0);
        // Note: Duration reset is context-dependent, handled by caller if needed
    };

    // Force clean state on mount
    useEffect(() => {
        console.log('[Mount] Initializing clean playback state...');
        stopAllPlayback();
        setStemsLoaded(false);
        setUseStems(false);
        setDuration(0);
    }, []);

    const handleSongSelect = async (song) => {
        // ATOMIC SONG SWITCH: Full stop of everything before switching
        console.log('[SongSelect] === FULL STOP before song switch ===');

        // 1. Stop everything using centralized helper
        stopAllPlayback();

        // 2. Clear song-specific state
        setDuration(0); // Reset duration (fixes scrub bar on new song)
        setStemsLoaded(false);
        setUseStems(false);
        setStemError(null);
        setViewMode('editor');

        console.log('[SongSelect] Baseline established. Loading:', song?.title);

        // 3. Select and Hydrate
        setSelectedSong(song);
        await hydrateSongState(song);

        // 4. Auto-Search Genius
        try {
            const cleanQuery = song.title
                .replace(/[\(\[].*?[\)\]]/g, '')
                .replace(/ft\.|feat\./i, '')
                .trim();
            const res = await fetch(`${API_URL}/api/lyrics/search?q=${encodeURIComponent(cleanQuery)}`);
            const data = await res.json();
            if (data.matches && data.matches.length > 0) {
                setGeniusMatches(data.matches);
                setShowMatchModal(true);
            }
        } catch (e) {
            console.error('Genius Auto-Search Failed:', e);
        }
    };

    const startArchive = async () => {
        if (!selectedSong) return;
        try {
            // Spec v1.0: /audio/acquire
            const res = await fetch(`${API_URL}/api/v1/audio/acquire`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedSong: selectedSong, // Spec: SelectedSongRef
                    enginePreference: enginePref, // Extension: Pass engine pref
                    options: { mediaType: 'audio' }
                })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('Acquire Failed:', data);
                setErrorModal({ title: 'Acquisition Failed', message: data.error || 'Unknown Error' });
                return;
            }

            // Start polling (which happens via useEffect on archiveJob)
            setArchiveJob({ jobId: data.jobId, state: 'queued', progress: 0 });

            // UPDATE SELECTED SONG WITH PERSISTENT ID
            if (data.songId && (!selectedSong.id || selectedSong.id !== data.songId)) {
                console.log('[Archive] Updating selectedSong with persistent ID:', data.songId);
                setSelectedSong(prev => ({ ...prev, id: data.songId }));
                // Note: This triggers useEffect checks dependent on selectedSong
            }

            // Clear downstream
            // setLocalAsset(null); // Keep old if re-downloading? No, clear.
            // setSplitJob(null);
            // setSplitResult(null);
        } catch (e) {
            console.error(e);
            setErrorModal({ title: 'Network Error', message: `Acquisition failed: ${e.message}` });
        }
    };

    const startSplit = async () => {
        // ... (Keep existing but ensure we send songId)
        if (!localAsset) return;

        // We need songId. selectedSong might be the YT object.
        // But if we just downloaded it, do we have the ID?
        // Hydration via polling updates archiveJob?
        // archiveJob status endpoint returns done.
        // We need to know the Persistent Song ID.
        // The Download Endpoint created it.
        // We can pass `selectedSong.videoId` and let backend lookup?
        // SplitterQueue.submit logic I wrote handles finding song by inputPath.
        // But better to pass songId if we have it.
        // `hydrateSongState` sets `selectedSong`? No, it takes it.
        // We should update `selectedSong` with the real ID from DB if we can.

        // For now, let's rely on InputPath resolution or pass videoId.
        // For now, let's rely on InputPath resolution or pass videoId.
        const inputPath = localAsset?.files?.[0]?.path;
        // RELAXED CHECK: If we have videoId, we can recover on backend.
        if (!inputPath && !selectedSong?.videoId) {
            setErrorModal({ title: 'Error', message: 'Asset path missing and no Video ID available for recovery.' });
            return;
        }

        try {
            const res = await fetch(`${API_URL}/split/start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: { inputPath },
                    songId: selectedSong.id || undefined, // Pass ID if hydated
                    videoId: selectedSong.videoId, // Pass videoId as fallback
                    modelId: modelId,
                    stems: stems,
                    device: splitterDevice, // Pass selected device
                    force: true // Always force a new job when manually requested
                })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('Split Failed:', data);
                setErrorModal({ title: 'Split Failed', message: `${data.error || 'Server Error'}\n\nTip: Try reloading the song from Search to refresh the ID.` });
                return;
            }

            setSplitJob({ jobId: data.jobId, state: 'queued', progress: 0, logs: [] });
        } catch (e) {
            console.error(e);
            setErrorModal({ title: 'Network Error', message: `Split failed: ${e.message}` });
        }
    };

    // Alignment Action
    const startAlignment = async () => {
        if (!splitResult?.vocalDownloadUrl) return;
        try {
            // AUTO-SAVE LYRICS before alignment
            if (selectedSong?.id && lyricsText) {
                await fetch(`${API_URL}/api/lyrics/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ songId: selectedSong.id, text: lyricsText, source: 'User Edit' })
                }).catch(e => console.warn('Failed to auto-save lyrics before align:', e));
            }

            const res = await fetch(`${API_URL}/align/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vocalStemId: splitJob?.jobId || splitResult.vocalDownloadUrl,
                    lyricsText: lyricsText,
                    provider: 'audioshake',
                    videoId: selectedSong?.videoId,
                    stemIds: { vocal: splitJob?.jobId, band: splitJob?.jobId }
                })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('Alignment Failed:', data);
                setErrorModal({ title: 'Alignment Failed', message: data.error || 'Unknown Error' });
                return;
            }

            setAlignJob({ jobId: data.jobId, state: 'queued', progress: 0 });
            setAlignResult(null);
        } catch (e) {
            console.error(e);
            setErrorModal({ title: 'Network Error', message: `Alignment failed: ${e.message}` });
        }
    };

    // Re-Alignment Action (for existing songs with edited lyrics)
    const startRealignment = async () => {
        console.log('========================================');
        console.log('[RE-ALIGN CLICKED]');
        console.log('splitResult:', splitResult);
        console.log('splitResult?.vocalDownloadUrl:', splitResult?.vocalDownloadUrl);
        console.log('lyricsText length:', lyricsText?.length);
        console.log('========================================');

        if (!splitResult?.vocalDownloadUrl) {
            console.error('[RE-ALIGN] BLOCKED: No vocalDownloadUrl');
            return;
        }
        try {
            // AUTO-SAVE LYRICS before re-alignment
            if (selectedSong?.id && lyricsText) {
                await fetch(`${API_URL}/api/lyrics/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ songId: selectedSong.id, text: lyricsText, source: 'User Edit' })
                }).catch(e => console.warn('Failed to auto-save lyrics before realign:', e));
            }

            console.log('[RE-ALIGN] Making fetch request to:', `${API_URL}/align/submit`);
            console.log('[RE-ALIGN] Request body:', JSON.stringify({
                vocalStemId: splitJob?.jobId || splitResult.vocalDownloadUrl,
                lyricsText: lyricsText?.substring(0, 50) + '...',
                force: true
            }));

            const res = await fetch(`${API_URL}/align/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vocalStemId: splitJob?.jobId || splitResult.vocalDownloadUrl,
                    lyricsText: lyricsText,
                    provider: 'audioshake',
                    videoId: selectedSong?.videoId,
                    stemIds: { vocal: splitJob?.jobId, band: splitJob?.jobId },
                    force: true  // Bypass idempotency to allow re-alignment
                })
            });

            console.log('[RE-ALIGN] Response status:', res.status);
            const data = await res.json();
            console.log('[RE-ALIGN] Response data:', data);

            if (!res.ok) {
                console.error('Re-Alignment Failed:', data);
                setErrorModal({ title: 'Re-Alignment Failed', message: data.error?.message || data.error || 'Unknown Error' });
                return;
            }

            setAlignJob({ jobId: data.jobId, state: 'queued', progress: 0 });
            setAlignResult(null);
            setIsStale(false);
        } catch (e) {
            console.error('[RE-ALIGN] CATCH ERROR:', e);
            setErrorModal({ title: 'Network Error', message: `Re-alignment failed: ${e.message}` });
        }
    };

    const stopAll = async () => {
        if (archiveJob && archiveJob.state !== 'done') {
            await fetch(`${API_URL}/download/cancel/${archiveJob.jobId}`, { method: 'POST' });
        }
        if (splitJob && splitJob.state !== 'done') {
            await fetch(`${API_URL}/split/cancel`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: splitJob.jobId })
            });
        }
        // Cancel alignment job
        if (alignJob && alignJob.state !== 'done' && alignJob.state !== 'error') {
            await fetch(`${API_URL}/align/cancel/${alignJob.jobId}`, { method: 'POST' });
        }
        setArchiveJob(null);
        setSplitJob(null);
        setAlignJob(null);

        // Stop stem audio
        audioManagerRef.current?.stop();

        // Stop YouTube player
        if (player) {
            player.pauseVideo();
            player.seekTo(0);
        }

        // Reset playback state
        setIsPlaying(false);
        setCurrentTime(0);
    };

    // Handle lyrics edit (mark stale)
    const handleLyricsChange = (e) => {
        setLyricsText(e.target.value);
        if (alignResult) {
            setIsStale(true);
        }
    };

    // Download JSON
    const downloadJson = () => {
        if (!alignResult) return;
        const blob = new Blob([JSON.stringify(alignResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Build canonical filename: "Artist - Song (Lyrics).json"
        let artist = 'Unknown Artist';
        let song = 'Unknown Song';

        if (selectedSong?.title) {
            // Parse "Artist - Song" from title
            const match = selectedSong.title.match(/^(.+?)\s*[-–]\s*(.+)$/);
            if (match) {
                artist = match[1].trim().replace(/[<>:"/\\|?*]/g, '');
                song = match[2].trim().replace(/\s*[\(\[].*?[\)\]]$/g, '').replace(/[<>:"/\\|?*]/g, '');
            } else {
                song = selectedSong.title.replace(/[<>:"/\\|?*]/g, '');
            }
        }

        a.download = `${artist} - ${song} (Lyrics).json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // yt-dlp Update Handlers
    const handleCheckYtdlpUpdate = async () => {
        setIsCheckingYtdlp(true);
        setYtdlpUpdateResult(null);
        try {
            const res = await fetch(`${API_URL}/ytdlp/status`);
            const data = await res.json();
            setYtdlpStatus(data);
        } catch (e) {
            console.error('Failed to check yt-dlp status:', e);
            setYtdlpStatus({ error: e.message });
        } finally {
            setIsCheckingYtdlp(false);
        }
    };

    const handleUpdateYtdlp = async () => {
        setIsUpdatingYtdlp(true);
        setYtdlpUpdateResult(null);
        try {
            const res = await fetch(`${API_URL}/ytdlp/update`, { method: 'POST' });
            const data = await res.json();
            setYtdlpUpdateResult(data);
            if (data.success) {
                await handleCheckYtdlpUpdate();
            }
        } catch (e) {
            console.error('Failed to update yt-dlp:', e);
            setYtdlpUpdateResult({ success: false, message: e.message });
        } finally {
            setIsUpdatingYtdlp(false);
        }
    };


    // Auto-update player when song changes
    useEffect(() => {
        if (playerRef.current && selectedSong) {
            playerRef.current.loadVideoById(selectedSong.videoId);
        }
    }, [selectedSong]);


    // --- ERROR MODAL COMPONENT ---
    const ErrorModal = () => {
        if (!errorModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                <div className="bg-slate-900 border border-rose-500/50 rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-rose-900/30 border-b border-rose-500/30">
                        <div className="flex items-center gap-2 text-rose-400">
                            <AlertTriangle size={16} />
                            <span className="font-bold text-sm">{errorModal.title}</span>
                        </div>
                        <button onClick={() => setErrorModal(null)} className="text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{errorModal.message}</p>
                    </div>
                    <div className="px-4 py-3 bg-slate-800/50 flex justify-end">
                        <button
                            onClick={() => setErrorModal(null)}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded"
                        >
                            DISMISS
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <ErrorModal />
            <div className="w-full h-screen bg-[#0a0f18] text-slate-300 font-sans grid grid-cols-[300px_1fr_320px] overflow-hidden divide-x divide-slate-800">

                {/* [COL 1] INGEST: PROXY SEARCH */}
                <div className="flex flex-col bg-[#05080c] overflow-hidden">
                    <div className="h-12 border-b border-slate-800 flex items-center px-4 bg-slate-900/50">
                        <span className="text-[10px] font-bold tracking-widest text-orange-500 flex items-center gap-2">
                            <Activity size={14} className="animate-pulse" /> RESILIENCE_NODE_v5 [MOCK]
                        </span>
                    </div>
                    <div className="p-3 border-b border-slate-800 space-y-2">
                        <div className="flex items-center gap-2 bg-[#0f1623] p-2 rounded border border-slate-700 focus-within:border-emerald-500/50 transition-colors">
                            <Search size={14} className="text-slate-500" />
                            <input
                                className="bg-transparent text-xs w-full outline-none placeholder-slate-600"
                                placeholder="SEARCH_INDEX..."
                                value={query} onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        {/* API Key */}
                        <input
                            type="password"
                            className="w-full bg-transparent text-[9px] text-slate-600 outline-none text-right px-1"
                            placeholder="[SECURE_KEY_SLOT]"
                            value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('yt_api_key', e.target.value); }}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {results.map((r, i) => (
                            <button key={i} onClick={() => handleSongSelect(r)} className={`w-full flex items-start gap-3 p-2 rounded border text-left transition-all overflow-hidden ${selectedSong?.videoId === r.videoId ? 'bg-emerald-900/20 border-emerald-500/30' : 'border-transparent hover:bg-slate-900'}`}>
                                <div className="relative w-16 h-10 shrink-0 bg-black rounded overflow-hidden">
                                    <img src={r.thumbnailUrl} className="w-full h-full object-cover opacity-80" />
                                    {r.isLocal && <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-bold px-1">DB</div>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-[11px] font-bold truncate ${selectedSong?.videoId === r.videoId ? 'text-emerald-400' : 'text-slate-300'}`}>{r.title}</div>
                                    <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                                        {r.channelTitle}
                                        {r.isLocal && <CheckCircle2 size={8} className="text-emerald-500" />}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* [COL 2] STUDIO: PLAYER + LYRICS */}
                <div className="flex flex-col relative bg-[#0a0f18] divide-y divide-slate-800">
                    {/* Player Surface */}
                    <div className="h-[40%] bg-black relative">
                        {selectedSong ? (
                            <ElectronYouTubePlayer
                                ref={playerRef}
                                videoId={selectedSong.videoId}
                                autoplay={false}
                                controls={false}
                                muted={useStems}
                                className="w-full h-full opacity-50 mix-blend-screen"
                                onReady={(e) => {
                                    setPlayer(playerRef.current);
                                    // Only set duration if NOT in stem mode (prevent overwriting stem duration)
                                    if (!useStemsRef.current) {
                                        setDuration(playerRef.current?.getDuration?.() || 0);
                                    }
                                    // Player is ready but stopped
                                }}
                                onStateChange={(e) => {
                                    if (!useStems) {
                                        setIsPlaying(e.data === 1);
                                    }
                                }}
                                onTimeUpdate={(time) => {
                                    if (!useStems) {
                                        setCurrentTime(time);
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs font-mono">WAITING_FOR_SELECTION</div>
                        )}
                        {/* Transport Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#0a0f18] to-transparent pointer-events-none">
                            {/* Main Transport Row */}
                            <div className="flex items-center justify-between gap-4 pointer-events-auto">
                                {/* Play/Pause/Stop Controls */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={async () => {
                                            if (useStems && stemsLoaded) {
                                                // Stem Mode: play stems + play YouTube (muted visual)
                                                await audioManagerRef.current?.play(currentTime);
                                                player?.playVideo();
                                            } else if (useStems && !stemsLoaded) {
                                                // Stems expected but not ready - log warning
                                                console.warn('[Play] Stem mode active but stems not loaded yet');
                                                // Fall back to YouTube while stems load
                                                player?.playVideo();
                                            } else {
                                                player?.playVideo();
                                            }
                                        }}
                                    >
                                        <Play className="text-emerald-500 hover:text-emerald-400" size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (useStems) {
                                                // Stem Mode: pause both stems and video
                                                audioManagerRef.current?.pause();
                                                player?.pauseVideo();
                                            } else {
                                                player?.pauseVideo();
                                            }
                                        }}
                                    >
                                        <Pause className="text-emerald-500 hover:text-emerald-400" size={20} />
                                    </button>
                                    <button onClick={stopAll}>
                                        <Square className="text-rose-500 hover:text-rose-400" size={20} />
                                    </button>
                                </div>

                                {/* Seek Bar */}
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-500 w-10 text-right">
                                        {fmtTime(currentTime)}
                                    </span>
                                    <div
                                        ref={seekBarRef}
                                        className="flex-1 relative h-1 bg-slate-800 rounded-full group cursor-pointer"
                                        onMouseMove={(e) => {
                                            // Calculate hover position directly from mouse coordinates
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const progress = Math.max(0, Math.min(1, x / rect.width));
                                            setHoverProgress(progress);
                                        }}
                                        onMouseLeave={() => setHoverProgress(null)}
                                    >
                                        {/* Playback position indicator (green) */}
                                        <div
                                            className="absolute h-full bg-emerald-500 rounded-full pointer-events-none"
                                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        />
                                        {/* Hover preview indicator (cyan, only when hovering) */}
                                        {hoverProgress !== null && (
                                            <div
                                                className="absolute h-full bg-cyan-400/50 rounded-full pointer-events-none"
                                                style={{ width: `${hoverProgress * 100}%` }}
                                            />
                                        )}
                                        {/* Hover position thumb (visible on hover) */}
                                        {hoverProgress !== null && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-cyan-400 rounded-full border-2 border-white shadow-lg pointer-events-none"
                                                style={{ left: `calc(${hoverProgress * 100}% - 6px)` }}
                                            />
                                        )}
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 1}
                                            step="0.1"
                                            value={currentTime}
                                            onChange={(e) => {
                                                const time = parseFloat(e.target.value);
                                                setCurrentTime(time);
                                                // ALWAYS seek both systems to maintain sync
                                                player?.seekTo(time, true);
                                                // Always seek stems if loaded (keeps them in sync even when not active)
                                                if (stemsLoaded) {
                                                    audioManagerRef.current?.seekTo(time);
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500 w-10">
                                        {fmtTime(duration)}
                                    </span>
                                </div>

                                {/* Stem Toggle + Volume Controls */}
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Stem/YT Toggle - also triggers stem loading in Electron */}
                                    <button
                                        onClick={async () => {
                                            // In Electron, stems might not be auto-loaded (to prevent crash)
                                            // Load them manually on first click
                                            if (!stemsLoaded && splitResult?.vocalDownloadUrl && splitResult?.bandDownloadUrl) {
                                                setStemError(null);
                                                console.log('[Stems] Manual load triggered...');
                                                try {
                                                    const vocalUrl = `${API_URL}${splitResult.vocalDownloadUrl}`;
                                                    const bandUrl = `${API_URL}${splitResult.bandDownloadUrl}`;
                                                    console.log('[Stems] Loading manually:', { vocalUrl, bandUrl });

                                                    const result = await audioManagerRef.current?.loadStems(bandUrl, vocalUrl);
                                                    if (result?.success) {
                                                        setStemsLoaded(true);
                                                        setStemError(null);
                                                        setDuration(audioManagerRef.current.getDuration());
                                                        audioManagerRef.current?.setVolume('vocal', vocalVolume);
                                                        audioManagerRef.current?.setVolume('band', bandVolume);
                                                        console.log('[Stems] Loaded successfully');
                                                        // Now enable stem mode
                                                        setUseStems(true);
                                                        player?.setVolume?.(0);
                                                        setViewMode('preview');
                                                    } else {
                                                        setStemError(result?.error || 'Failed to load stems');
                                                    }
                                                } catch (err) {
                                                    console.error('[Stems] Manual load error:', err);
                                                    setStemError(err.message);
                                                }
                                                return;
                                            }

                                            // Normal toggle logic (stems already loaded)
                                            const newUseStems = !useStems;
                                            setUseStems(newUseStems);

                                            if (newUseStems) {
                                                // Switching TO stems: mute YT audio but KEEP video playing
                                                player?.setVolume?.(0);
                                                // If currently playing, start stems at current position
                                                if (isPlaying && stemsLoaded) {
                                                    audioManagerRef.current?.play(currentTime);
                                                }
                                                setViewMode('preview'); // Auto-enable preview for lyrics
                                            } else {
                                                // Switching TO YouTube: stop stems, unmute YT
                                                audioManagerRef.current?.stop();
                                                player?.setVolume?.(100);
                                                setViewMode('editor'); // Back to editor mode
                                            }
                                        }}
                                        disabled={!splitResult?.vocalDownloadUrl}
                                        className={`px-2 py-1 text-[9px] font-bold rounded border transition-all ${useStems
                                            ? 'bg-cyan-900/50 text-cyan-400 border-cyan-500/50'
                                            : stemsLoaded
                                                ? 'bg-slate-800/50 text-slate-400 border-slate-700'
                                                : splitResult?.vocalDownloadUrl
                                                    ? 'bg-amber-900/30 text-amber-400 border-amber-500/30 animate-pulse'
                                                    : 'bg-slate-800/50 text-slate-500 border-slate-700'
                                            } ${!splitResult?.vocalDownloadUrl ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                                        title={stemsLoaded ? 'Toggle between YouTube and Stem audio' : splitResult?.vocalDownloadUrl ? 'Click to load and play stems' : 'Split stems first'}
                                    >
                                        {useStems ? 'STEMS' : stemsLoaded ? 'YT' : splitResult?.vocalDownloadUrl ? 'LOAD' : 'YT'}
                                    </button>

                                    {/* Vocal Volume */}
                                    <div className="flex items-center gap-1.5 group shrink" title="Vocal Volume">
                                        <Mic2 size={12} className={`${useStems ? 'text-rose-400' : 'text-slate-600'}`} />
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={vocalVolume}
                                            onChange={(e) => setVocalVolume(parseFloat(e.target.value))}
                                            disabled={!useStems}
                                            className={`min-w-8 max-w-14 w-full h-1 rounded-full cursor-pointer accent-rose-500 ${!useStems ? 'opacity-30' : ''}`}
                                        />
                                    </div>

                                    {/* Band Volume */}
                                    <div className="flex items-center gap-1.5 group shrink" title="Band Volume">
                                        <Music size={12} className={`${useStems ? 'text-cyan-400' : 'text-slate-600'}`} />
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={bandVolume}
                                            onChange={(e) => setBandVolume(parseFloat(e.target.value))}
                                            disabled={!useStems}
                                            className={`min-w-8 max-w-14 w-full h-1 rounded-full cursor-pointer accent-cyan-500 ${!useStems ? 'opacity-30' : ''}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stem Status Message */}
                            {stemError && (
                                <div className="mt-2 px-2 py-1 bg-rose-900/50 border border-rose-500/30 rounded text-[9px] text-rose-400">
                                    Stem Error: {stemError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lyrics Surface */}
                    <div className="flex-1 relative bg-[#0B1015] overflow-hidden">
                        {/* Toolbar */}
                        <div className="absolute top-2 right-8 z-20 flex items-center gap-2">
                            {alignResult && (
                                <button
                                    onClick={() => setEditorMode(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30"
                                >
                                    <Edit3 size={12} /> EDIT TIMING
                                </button>
                            )}
                            <button
                                onClick={() => setViewMode(m => m === 'editor' ? 'preview' : 'editor')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${viewMode === 'preview'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'
                                    }`}
                            >
                                {viewMode === 'preview' ? <Eye size={12} /> : <Mic2 size={12} />}
                                {viewMode === 'preview' ? 'PREVIEW MODE' : 'EDITOR MODE'}
                            </button>
                        </div>

                        {viewMode === 'preview' && alignResult ? (
                            <KaraokeLyricsDisplay
                                timingJson={alignResult}
                                audioRef={useStems ? null : player}
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                className="w-full h-full bg-black/40"
                                linesPerPage={linesPerPage}
                                highlightColor={highlightColor}
                                fontSize={fontSize}
                                trackDuration={duration}
                            />
                        ) : (
                            <textarea
                                className="w-full h-full bg-transparent p-6 text-sm font-mono text-slate-400 resize-none outline-none custom-scrollbar"
                                placeholder="// PASTE_LYRICS_HERE..."
                                spellCheck={false}
                                value={lyricsText}
                                onChange={handleLyricsChange}
                            />
                        )}

                        {isStale && viewMode === 'editor' && (
                            <div className="absolute top-2 right-36 px-2 py-1 bg-amber-900/80 border border-amber-500/50 rounded text-[9px] text-amber-300 flex items-center gap-1">
                                <AlertTriangle size={10} /> STALE - Re-align required
                            </div>
                        )}

                        {viewMode === 'preview' && !alignResult && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-slate-600 text-xs font-mono">NO_ALIGNMENT_DATA</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* [COL 3] FABRICATION: JOBS */}
                <div className="flex flex-col bg-[#05080c] overflow-hidden">
                    <div className="h-12 border-b border-slate-800 flex items-center px-4 bg-slate-900/50 justify-between">
                        <span className="text-[10px] font-bold tracking-widest text-emerald-500 flex items-center gap-2">
                            <Cpu size={14} /> FAB_PROCESSOR
                        </span>
                        <Activity size={12} className={archiveJob || splitJob ? "animate-pulse text-emerald-500" : "text-slate-700"} />
                    </div>

                    <div className="flex-1 p-4 pb-8 space-y-8 overflow-y-auto custom-scrollbar">
                        {/* SECTION A: ACQUISITION */}
                        <div className={`space-y-3 transition-opacity ${!selectedSong ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>1. ACQUISITION</span>
                                {archiveJob && <span className="text-emerald-400">{archiveJob.state}</span>}
                            </div>

                            {/* Engine Selector */}
                            <select value={enginePref} onChange={e => setEnginePref(e.target.value)} className="w-full bg-[#162032] text-xs text-slate-400 p-2 rounded border border-slate-700 outline-none mb-2">
                                <option value="yt-dlp">YouTube (yt-dlp)</option>
                            </select>

                            {/* yt-dlp Updater Section */}
                            <div className="p-2 bg-slate-900/50 border border-slate-800 rounded mb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Package size={10} /> yt-dlp
                                    </span>
                                    {ytdlpStatus && !ytdlpStatus.error && (
                                        <span className={`text-[9px] font-bold ${ytdlpStatus.updateAvailable ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {ytdlpStatus.updateAvailable ? 'UPDATE_AVAIL' : 'UP_TO_DATE'}
                                        </span>
                                    )}
                                </div>

                                {/* Version Info */}
                                {ytdlpStatus && !ytdlpStatus.error && (
                                    <div className="text-[9px] text-slate-500 mb-2 space-y-0.5">
                                        <div className="flex justify-between">
                                            <span>Current:</span>
                                            <span className="font-mono text-slate-400">{ytdlpStatus.currentVersion || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Latest:</span>
                                            <span className="font-mono text-slate-400">{ytdlpStatus.latestVersion || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Error Display */}
                                {ytdlpStatus?.error && (
                                    <div className="text-[9px] text-rose-400 mb-2">
                                        Error: {ytdlpStatus.error}
                                    </div>
                                )}

                                {/* Update Result */}
                                {ytdlpUpdateResult && (
                                    <div className={`text-[9px] mb-2 p-1.5 rounded ${ytdlpUpdateResult.success ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                                        {ytdlpUpdateResult.success ? '✓ ' : '✗ '}{ytdlpUpdateResult.message}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleCheckYtdlpUpdate}
                                        disabled={isCheckingYtdlp || isUpdatingYtdlp}
                                        className="flex-1 py-1.5 text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        {isCheckingYtdlp ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                        CHECK
                                    </button>
                                    {ytdlpStatus?.updateAvailable && (
                                        <button
                                            onClick={handleUpdateYtdlp}
                                            disabled={isCheckingYtdlp || isUpdatingYtdlp}
                                            className="flex-1 py-1.5 text-[9px] font-bold bg-amber-900/50 hover:bg-amber-800/50 text-amber-400 rounded border border-amber-500/30 flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {isUpdatingYtdlp ? <RefreshCw size={10} className="animate-spin" /> : <Download size={10} />}
                                            UPDATE
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!localAsset ? (
                                <button onClick={startArchive} disabled={!selectedSong || archiveJob} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 border border-slate-700">
                                    {archiveJob ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                                    {archiveJob ? 'STRESS_TESTING...' : (enginePref === 'mock' ? 'MOCK_INGEST_SEQ' : 'START INGESTION')}
                                </button>
                            ) : (
                                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded flex items-center gap-3">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <div className="text-[10px] text-emerald-300">
                                        <div className="font-bold">ASSET_SECURED</div>
                                        <div className="opacity-70 truncate max-w-[150px]">{localAsset?.files?.[0]?.filename}</div>
                                    </div>
                                </div>
                            )}

                            {archiveJob && !localAsset && (
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(archiveJob.progress || 0) * 100}%` }} />
                                </div>
                            )}
                        </div>

                        {/* SECTION B: SPLITTER */}
                        <div className={`space-y-3 transition-opacity ${!localAsset ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>2. SPLITTING</span>
                                {splitJob && <span className="text-cyan-400">{splitJob.state}</span>}
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => setStems(2)} className={`flex-1 py-1 text-[10px] border rounded ${stems === 2 ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50' : 'border-slate-800 text-slate-600'}`}>2-STEM</button>
                                <button
                                    onClick={() => modelId !== 'uvr-mdx-inst-main' && setStems(4)}
                                    disabled={modelId === 'uvr-mdx-inst-main'}
                                    className={`flex-1 py-1 text-[10px] border rounded ${stems === 4 ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50' : 'border-slate-800 text-slate-600'} ${modelId === 'uvr-mdx-inst-main' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title={modelId === 'uvr-mdx-inst-main' ? 'UVR MDX only supports 2-stem separation' : ''}
                                >4-STEM</button>
                            </div>

                            {/* Splitter Configuration Grid */}
                            <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
                                {/* Model Selector */}
                                <div>
                                    <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Model</label>
                                    <select
                                        value={modelId}
                                        onChange={e => {
                                            const newModel = e.target.value;
                                            setModelId(newModel);
                                            // UVR only supports 2-stem, auto-switch if needed
                                            if (newModel === 'uvr-mdx-inst-main' && stems !== 2) {
                                                setStems(2);
                                            }
                                        }}
                                        className="w-full bg-[#162032] text-xs text-slate-400 p-2 rounded border border-slate-700 outline-none"
                                    >
                                        <option value="htdemucs">Hybrid (Real)</option>
                                        <option value="uvr-mdx-inst-main">UVR MDX Inst Main</option>
                                    </select>
                                </div>
                                {/* Device Selector */}
                                <div>
                                    <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Device</label>
                                    <select value={splitterDevice} onChange={e => setSplitterDevice(e.target.value)} className="w-full bg-[#162032] text-xs text-slate-400 p-2 rounded border border-slate-700 outline-none">
                                        <option value="cpu">CPU (Baseline)</option>
                                        <option value="gpu">GPU (Experim.)</option>
                                    </select>
                                </div>
                            </div>

                            {/* GPU Warning */}
                            {splitterDevice === 'gpu' && (
                                <div className="mb-2 px-2 py-1 bg-amber-900/30 border border-amber-600/30 rounded text-[9px] text-amber-500 flex items-center gap-2">
                                    <AlertTriangle size={10} />
                                    <span>Warning: GPU may affect lyric alignment timing.</span>
                                </div>
                            )}

                            {!splitResult ? (
                                <button onClick={startSplit} disabled={!localAsset || splitJob} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 border border-slate-700">
                                    {splitJob ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                                    {splitJob ? 'PROCESSING...' : 'START SPLIT JOB'}
                                </button>
                            ) : (
                                <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-cyan-500" />
                                        <div className="text-[10px] text-cyan-300">
                                            <div className="font-bold">STEMS_READY</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSplitResult(null); setSplitJob(null); startSplit(); }}
                                        className="px-2 py-1 bg-cyan-800/50 hover:bg-cyan-700/50 text-cyan-300 text-[9px] font-bold rounded border border-cyan-500/30 flex items-center gap-1"
                                    >
                                        <RefreshCw size={10} /> RE-SPLIT
                                    </button>
                                </div>
                            )}

                            {splitJob && !splitResult && (
                                <div className="space-y-2">
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${(splitJob.progress || 0) * 100}%` }} />
                                    </div>
                                    <div className="text-[9px] font-mono text-cyan-500/70 h-10 overflow-hidden">
                                        {splitJob.logs?.slice(-2).map((l, i) => <div key={i}>{l}</div>)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION C: ALIGNMENT (AudioShake) */}
                        <div className={`space-y-3 transition-opacity ${!splitResult?.vocalDownloadUrl ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>3. ALIGNMENT</span>
                                <div className="flex items-center gap-2">
                                    {alignJob && <span className="text-violet-400">{alignJob.state}</span>}
                                    {isStale && <span className="text-amber-400">STALE</span>}
                                </div>
                            </div>

                            {!alignResult ? (
                                <button
                                    onClick={startAlignment}
                                    disabled={!splitResult?.vocalDownloadUrl || (alignJob && alignJob.state !== 'done' && alignJob.state !== 'error')}
                                    className="w-full py-3 bg-violet-900/30 hover:bg-violet-800/40 text-violet-300 text-xs font-bold rounded flex items-center justify-center gap-2 border border-violet-500/30 disabled:opacity-50"
                                >
                                    {alignJob && alignJob.state !== 'done' && alignJob.state !== 'error' ? (
                                        <><RefreshCw className="animate-spin" size={14} /> ALIGNING...</>
                                    ) : (
                                        <><Zap size={14} /> ALIGN WITH AUDIOSHAKE</>
                                    )}
                                </button>
                            ) : (
                                <div className="p-3 bg-violet-900/20 border border-violet-500/30 rounded flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-violet-500" />
                                        <div className="text-[10px] text-violet-300">
                                            <div className="font-bold">TIMINGS_READY</div>
                                            <div className="opacity-70">{alignResult?.tokens?.length || 0} tokens aligned</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={startRealignment}
                                        disabled={alignJob && alignJob.state !== 'done' && alignJob.state !== 'error'}
                                        className="px-2 py-1 bg-violet-800/50 hover:bg-violet-700/50 text-violet-300 text-[9px] font-bold rounded border border-violet-500/30 flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <RefreshCw size={10} /> RE-ALIGN
                                    </button>
                                </div>
                            )}

                            {/* Progress Bar */}
                            {alignJob && alignJob.state !== 'done' && alignJob.state !== 'error' && (
                                <div className="space-y-2">
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${(alignJob.progress || 0) * 100}%` }} />
                                    </div>
                                    <div className="text-[9px] font-mono text-violet-500/70">
                                        {alignJob.logs?.slice(-1).map((l, i) => <div key={i}>{l}</div>)}
                                    </div>
                                </div>
                            )}

                            {/* JSON Preview + Download */}
                            {alignResult && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowJsonPreview(!showJsonPreview)}
                                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded flex items-center justify-center gap-1 border border-slate-700"
                                        >
                                            {showJsonPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                                            {showJsonPreview ? 'HIDE' : 'PREVIEW'}
                                        </button>
                                        <button
                                            onClick={downloadJson}
                                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded flex items-center justify-center gap-1 border border-slate-700"
                                        >
                                            <FileJson size={12} /> DOWNLOAD
                                        </button>
                                    </div>
                                    {showJsonPreview && (
                                        <pre className="text-[8px] font-mono text-violet-300/70 bg-black/30 p-2 rounded max-h-32 overflow-auto border border-slate-800">
                                            {JSON.stringify(alignResult, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SECTION D: EXPORT */}
                        <div className={`space-y-3 transition-opacity ${!splitResult ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>4. EXPORT ARTIFACTS</span>
                                {isExporting && (
                                    <span className="text-rose-400 animate-pulse">EXPORTING {Math.round(exportProgress * 100)}%</span>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <a href={`${API_URL}${splitResult?.vocalDownloadUrl}`} download className="p-3 bg-slate-800 border border-slate-700 rounded flex flex-col items-center gap-1 hover:border-emerald-500/50 hover:bg-slate-800/80 group">
                                    <Download size={14} className="text-slate-500 group-hover:text-emerald-400" />
                                    <span className="text-[9px] font-bold text-slate-400">VOCALS</span>
                                </a>
                                <a href={`${API_URL}${splitResult?.bandDownloadUrl}`} download className="p-3 bg-slate-800 border border-slate-700 rounded flex flex-col items-center gap-1 hover:border-emerald-500/50 hover:bg-slate-800/80 group">
                                    <Download size={14} className="text-slate-500 group-hover:text-emerald-400" />
                                    <span className="text-[9px] font-bold text-slate-400">BAND</span>
                                </a>
                                <button
                                    onClick={downloadJson}
                                    disabled={!alignResult}
                                    className="p-3 bg-slate-800 border border-slate-700 rounded flex flex-col items-center gap-1 hover:border-violet-500/50 hover:bg-slate-800/80 group disabled:opacity-30"
                                >
                                    <FileJson size={14} className="text-slate-500 group-hover:text-violet-400" />
                                    <span className="text-[9px] font-bold text-slate-400">JSON</span>
                                </button>
                                <button
                                    onClick={startExport}
                                    disabled={!alignResult || !stemsLoaded || isPlaying || isExporting}
                                    className={`p-3 border rounded flex flex-col items-center gap-1 group disabled:opacity-30 ${isExporting
                                        ? 'bg-rose-900/30 border-rose-500/50'
                                        : 'bg-slate-800 border-slate-700 hover:border-rose-500/50 hover:bg-slate-800/80'
                                        }`}
                                    title={!alignResult ? 'Align lyrics first' : !stemsLoaded ? 'Load stems first' : isPlaying ? 'Stop playback first' : `Export karaoke MP4 at ${exportResolution}`}
                                >
                                    {isExporting ? (
                                        <RefreshCw size={14} className="text-rose-400 animate-spin" />
                                    ) : (
                                        <Film size={14} className="text-slate-500 group-hover:text-rose-400" />
                                    )}
                                    <span className="text-[9px] font-bold text-slate-400">MP4</span>
                                </button>
                                {/* Resolution Selector */}
                                <select
                                    value={exportResolution}
                                    onChange={(e) => setExportResolution(e.target.value)}
                                    disabled={isExporting}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 hover:border-slate-500 disabled:opacity-30 cursor-pointer"
                                    title="Export resolution"
                                >
                                    {Object.keys(RESOLUTION_MAP).map(key => (
                                        <option key={key} value={key}>{key.toUpperCase()}</option>
                                    ))}
                                </select>
                                {/* Renderer Selector */}
                                <select
                                    value={gpuAcceleration}
                                    onChange={(e) => setGpuAcceleration(e.target.value)}
                                    disabled={isExporting}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 hover:border-slate-500 disabled:opacity-30 cursor-pointer"
                                    title="Renderer: GPU (faster, auto-falls back to CPU) or CPU (always works)"
                                >
                                    <option value="auto">GPU</option>
                                    <option value="force-cpu">CPU</option>
                                </select>
                            </div>
                            {/* Export Progress Bar */}
                            {isExporting && (
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${exportProgress * 100}%` }} />
                                </div>
                            )}
                            {/* Export Error */}
                            {exportError && (
                                <div className="px-2 py-1 bg-rose-900/30 border border-rose-500/30 rounded text-[9px] text-rose-400">
                                    Export Error: {exportError}
                                </div>
                            )}
                        </div>

                        {/* SECTION E: DISPLAY CONFIG */}
                        <div className={`space-y-3 pt-4 border-t border-slate-800 ${viewMode !== 'preview' ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>5. DISPLAY CONFIG</span>
                                <Layers size={12} />
                            </div>

                            {/* Lines Per Page */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-600">LINES PER PAGE</label>
                                <div className="flex bg-slate-800 rounded p-1 gap-1">
                                    {[2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setLinesPerPage(n)}
                                            className={`flex-1 py-1 text-[10px] rounded ${linesPerPage === n ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Highlight Color */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-600">HIGHLIGHT COLOR</label>
                                <div className="flex gap-2">
                                    {[
                                        { name: 'Green', val: '#7CB87C', class: 'bg-[#7CB87C]' },
                                        { name: 'Purple', val: '#9B7CB8', class: 'bg-[#9B7CB8]' },
                                        { name: 'Yellow', val: '#C9B857', class: 'bg-[#C9B857]' },
                                        { name: 'Rose', val: '#f43f5e', class: 'bg-[#f43f5e]' },
                                        { name: 'Blue', val: '#3b82f6', class: 'bg-[#3b82f6]' }
                                    ].map(c => (
                                        <button
                                            key={c.name}
                                            onClick={() => setHighlightColor(c.val)}
                                            className={`w-6 h-6 rounded-full border-2 transition-all ${c.class} ${highlightColor === c.val ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-600">FONT SIZE</label>
                                <div className="flex bg-slate-800 rounded p-1 gap-1">
                                    {[
                                        { l: 'S', v: 24 },
                                        { l: 'M', v: 32 },
                                        { l: 'L', v: 40 },
                                        { l: 'XL', v: 48 }
                                    ].map(fs => (
                                        <button
                                            key={fs.l}
                                            onClick={() => setFontSize(fs.v)}
                                            className={`flex-1 py-1 text-[10px] rounded ${fontSize === fs.v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            {fs.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
            {/* GENIUS MATCH MODAL */}
            {showMatchModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                                <Zap size={14} /> SELECT LYRICS (GENIUS)
                            </h3>
                            <button onClick={() => setShowMatchModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-1">
                            {geniusMatches.map(match => (
                                <button
                                    key={match.id}
                                    onClick={() => handleFetchGeniusLyrics(match)}
                                    className="w-full text-left p-3 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 flex items-center gap-4 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-black rounded overflow-hidden shrink-0">
                                        <img src={match.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-xs text-slate-200 truncate group-hover:text-emerald-400">{match.title}</div>
                                        <div className="text-[10px] text-slate-500">{match.artist}</div>
                                    </div>
                                    {isFetchingLyrics && <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t border-slate-800 bg-slate-950/30">
                            <button
                                onClick={() => setShowMatchModal(false)}
                                className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold border border-slate-700"
                            >
                                USE MANUAL ENTRY
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOKEN EDITOR MODAL */}
            {editorMode && alignResult && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col">
                    <TokenEditorPanel
                        lyricsJson={alignResult}
                        trackDurationMs={duration * 1000}
                        vocalUrl={splitResult?.vocalDownloadUrl ? `${API_URL}${splitResult.vocalDownloadUrl}` : null}
                        audioManagerRef={audioManagerRef}
                        onApply={(updatedJson) => {
                            setAlignResult(updatedJson);
                            setEditorMode(false);
                        }}
                        onDiscard={() => setEditorMode(false)}
                    />
                </div>
            )}
        </>
    );
}
