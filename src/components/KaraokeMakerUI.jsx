import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Pause, Square, Download, Music, Mic, Search,
    LayoutGrid, List, Settings, RefreshCw, Layers,
    Save, Wand2, ChevronRight, AlertCircle, CheckCircle2,
    MoreVertical, FileJson, Clock, TrendingUp, X, Minimize2, Maximize2
} from 'lucide-react';
import {
    indexLyrics,
    computeAdjustedSentences,
    wordKey,
    computeInstrumentalGap,
    computeOutroGap,
    prettyTime
} from '../utils/karaokeHelpers';
import KaraokeRenderer from './KaraokeRenderer';
import { exportToMp4 } from '../utils/fastExport';
import { AudioStemManager } from '../utils/AudioStemManager';
import AudioErrorBoundary from './AudioErrorBoundary';

// --- MOCK DATA ---

const MOCK_RESULTS = [
    { id: 'vid_001', title: 'Neon Lights - Synthwave Mix', artist: 'RetroWave', thumbnail: 'https://placehold.co/150x100/18181b/f43f5e?text=Neon' },
    { id: 'vid_002', title: 'Acoustic Morning - LoFi Beats', artist: 'ChillHop', thumbnail: 'https://placehold.co/150x100/18181b/10b981?text=LoFi' },
    { id: 'vid_003', title: 'Heavy Metal Thunder', artist: 'Iron Force', thumbnail: 'https://placehold.co/150x100/18181b/6366f1?text=Metal' },
    { id: 'vid_004', title: 'Piano Ballad No. 1', artist: 'Classical Vibes', thumbnail: 'https://placehold.co/150x100/18181b/8b5cf6?text=Piano' },
    { id: 'vid_005', title: 'Dubstep Drop 2024', artist: 'Bass Cannon', thumbnail: 'https://placehold.co/150x100/18181b/eab308?text=Bass' },
    { id: 'vid_006', title: 'Jazz Cafe', artist: 'Blue Note', thumbnail: 'https://placehold.co/150x100/18181b/ec4899?text=Jazz' },
];

const RECENT_HISTORY = [
    { id: 'hist_1', title: 'Neon Lights', time: '2 mins ago' },
    { id: 'hist_2', title: 'Piano Ballad No. 1', time: '1 hour ago' },
    { id: 'hist_3', title: 'Jazz Cafe', time: 'Yesterday' },
];

const INITIAL_LYRICS = `(Instrumental Intro)
Neon lights are calling home
In the city we allow to roam
Echoes of the past remain
Driving through the midnight rain`;

const SPLITTER_MODELS = ['Spleeter-2stems', 'Demucs-v4', 'MDX-Net'];
const TRANSCRIPTION_MODELS = ['AudioShake', 'Music.ai', 'Whisper-Large'];

// Mock pipeline generator
const generateMockTimings = (text) => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return words.map((word, i) => ({
        word,
        start: i * 0.8,
        end: i * 0.8 + 0.6
    }));
};

export default function KaraokeMakerUI() {
    // --- STATE ---

    // Navigation
    const [activeTab, setActiveTab] = useState('source'); // source | studio | preview | export

    // Source Tab
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [viewMode, setViewMode] = useState('grid');

    // Data
    const [selectedSong, setSelectedSong] = useState(null);
    const [lyrics, setLyrics] = useState('');
    const [indexedLyrics, setIndexedLyrics] = useState([]);
    const [deltas, setDeltas] = useState(new Map());
    const [deletedWords, setDeletedWords] = useState(new Set());
    const [editedWords, setEditedWords] = useState(new Map());

    // Studio Tab (Config Popover)
    const [showConfig, setShowConfig] = useState(false);
    const [splitterModel, setSplitterModel] = useState(SPLITTER_MODELS[0]);
    const [transcriptionModel, setTranscriptionModel] = useState(TRANSCRIPTION_MODELS[0]);

    // Pipeline
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStage, setProcessStage] = useState(0); // 0:Idle, 4:Done
    const [isSyncing, setIsSyncing] = useState(false);

    // Floating Player State (M11)
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(30);
    const [volVocal, setVolVocal] = useState(1);
    const [volBand, setVolBand] = useState(1);
    const [playerExpanded, setPlayerExpanded] = useState(true);
    const [audioError, setAudioError] = useState(null);
    const [stemsLoaded, setStemsLoaded] = useState(false);

    // Genius Integration
    const [geniusMatches, setGeniusMatches] = useState([]);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [isSearchingGenius, setIsSearchingGenius] = useState(false);
    const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

    // AudioStemManager - crash-safe audio engine
    const audioManagerRef = useRef(null);

    // Initialize AudioStemManager on mount
    useEffect(() => {
        audioManagerRef.current = new AudioStemManager({
            onError: (err) => {
                console.error('[KaraokeMakerUI] Audio error:', err);
                setAudioError(err.message);
            },
            onStateChange: (state) => {
                setIsPlaying(state === 'playing');
            },
            onTimeUpdate: (time) => {
                setCurrentTime(time);
            }
        });

        return () => {
            audioManagerRef.current?.dispose();
        };
    }, []);

    // Sync volume changes to AudioStemManager
    useEffect(() => {
        audioManagerRef.current?.setVolume('vocal', volVocal);
    }, [volVocal]);

    useEffect(() => {
        audioManagerRef.current?.setVolume('band', volBand);
    }, [volBand]);

    // --- LOGIC ---

    // Search
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (val.length > 2) {
            setResults(MOCK_RESULTS);
        } else {
            setResults([]);
        }
    };

    const handleSelectSong = async (song) => {
        setSelectedSong(song);
        setLyrics(''); // Clear initially
        setProcessStage(0);
        setCurrentTime(0);
        setIsPlaying(false);
        setActiveTab('studio');

        // Auto-search Genius
        setIsSearchingGenius(true);
        try {
            // Simple cleanup of title for better search
            const cleanQuery = song.title
                .replace(/[\(\[].*?[\)\]]/g, '') // Remove (Official Video) etc
                .replace(/ft\.|feat\./i, '')
                .trim();

            const res = await fetch(`http://localhost:3002/api/lyrics/search?artist=&title=${encodeURIComponent(cleanQuery)}`);
            const data = await res.json();

            if (data.matches && data.matches.length > 0) {
                setGeniusMatches(data.matches);
                setShowMatchModal(true);
            } else {
                setLyrics(INITIAL_LYRICS); // Fallback
            }
        } catch (e) {
            console.error("Genius search failed", e);
            setLyrics(INITIAL_LYRICS); // Fallback
        } finally {
            setIsSearchingGenius(false);
        }

        setTimeout(() => setShowConfig(true), 500);
    };

    const handleFetchGeniusLyrics = async (match) => {
        setIsFetchingLyrics(true);
        try {
            const res = await fetch(`http://localhost:3002/api/lyrics/fetch?url=${encodeURIComponent(match.url)}`);
            const data = await res.json();
            if (data.lyrics) {
                setLyrics(data.lyrics);
                setShowMatchModal(false);
            }
        } catch (e) {
            console.error("Lyrics fetch failed", e);
            alert("Failed to fetch lyrics");
        } finally {
            setIsFetchingLyrics(false);
        }
    };

    // Process Lyrics into Indexed format
    const handleProcess = () => {
        if (!selectedSong) return;
        setIsProcessing(true);
        setProcessStage(1);
        setShowConfig(false);

        // Simulate Pipeline
        setTimeout(() => setProcessStage(2), 1000);
        setTimeout(() => setProcessStage(3), 2000);
        setTimeout(() => {
            setProcessStage(4);
            const rawStructure = {
                lyrics: lyrics.split('\n').filter(l => l.trim()).map((line, si) => ({
                    sentence: { text: line, start: si * 4, end: si * 4 + 3.5 },
                    words: line.split(' ').map((w, wi) => ({
                        text: w,
                        start: si * 4 + (wi * 0.5),
                        end: si * 4 + (wi * 0.5) + 0.4,
                        row: 0
                    }))
                }))
            };
            setIndexedLyrics(indexLyrics(rawStructure));
            // TODO: In production, stems would be loaded via:
            // audioManagerRef.current.loadStems(bandUrl, vocalUrl)
            // For demo/mock purposes, we set duration directly
            setDuration(30);
            setStemsLoaded(true);
            setIsProcessing(false);
        }, 3000);
    };

    // Transport Handlers (using AudioStemManager)
    const handlePlayPause = () => {
        if (!audioManagerRef.current) return;

        if (isPlaying) {
            audioManagerRef.current.pause();
        } else {
            // Clear any previous error on play attempt
            setAudioError(null);
            audioManagerRef.current.play(currentTime);
        }
    };

    const handleStop = () => {
        if (audioManagerRef.current) {
            audioManagerRef.current.stop();
        }
        setCurrentTime(0);
    };

    const handleSeek = (timeSeconds) => {
        if (audioManagerRef.current) {
            audioManagerRef.current.seekTo(timeSeconds);
        }
        setCurrentTime(timeSeconds);
    };

    // Auto-stop at end of track
    useEffect(() => {
        if (duration > 0 && currentTime >= duration) {
            handleStop();
        }
    }, [currentTime, duration]);

    // Downloads / Export
    const handleDownload = async (type) => {
        if (processStage < 4) return;

        const vid = selectedSong.id;
        const adj = computeAdjustedSentences(indexedLyrics, deltas, deletedWords, editedWords);
        const allWords = adj.flatMap(s => s.words);

        if (type === 'json') {
            const content = JSON.stringify(adj, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vid}_timings.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (type === 'vocal' || type === 'band') {
            // Mock download for now as we don't have the audio buffers usually
            alert('Audio asset download not fully implemented for mock buffers.');
        } else if (type === 'video') {
            setIsProcessing(true);
            try {
                const buffer = await exportToMp4({
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    totalDuration: duration,
                    bandBuffer: audioBuffers.band,
                    vocalBuffer: audioBuffers.vocal,
                    bandVol: volBand,
                    vocalVol: volVocal,
                    lyrics: adj,
                    allWords,
                    computeInstrumentalGap,
                    computeOutroGap,
                    color: '#f43f5e',
                    onProgress: (p) => {
                        // We could show a progress bar here
                        console.log(`Export progress: ${Math.round(p * 100)}%`);
                    }
                });

                const blob = new Blob([buffer], { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${vid}_karaoke.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error("Export failed", err);
                alert("Export failed: " + err.message);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const getWordClass = (t) => {
        if (currentTime >= t.start && currentTime <= t.end) return 'text-rose-500 scale-110 blur-0 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]';
        if (currentTime > t.end) return 'text-zinc-600 blur-[1px] opacity-70';
        return 'text-zinc-400 blur-0';
    };

    // --- RENDERERS ---

    const renderSourceTab = () => (
        <div className="flex h-full animate-in fade-in slide-in-from-left-4">
            {/* M15: Sidebar for Recent/History */}
            <div className="w-64 border-r border-zinc-800/50 p-6 hidden lg:block bg-zinc-900/20">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Recent Activity
                </h3>
                <div className="space-y-1">
                    {RECENT_HISTORY.map(item => (
                        <div key={item.id} className="p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer group">
                            <div className="text-sm font-medium text-zinc-300 group-hover:text-rose-400 transition-colors">{item.title}</div>
                            <div className="text-xs text-zinc-600">{item.time}</div>
                        </div>
                    ))}
                </div>

                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-8 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> Trending Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                    {['Synthwave', 'LoFi', 'Rock', 'K-Pop', 'Jazz'].map(tag => (
                        <span key={tag} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 hover:text-rose-400 hover:bg-zinc-700 cursor-pointer transition-colors">#{tag}</span>
                    ))}
                </div>
            </div>

            {/* Main Search Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col md:flex-row items-center gap-6 mb-12 max-w-5xl mx-auto">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-5 top-4 w-5 h-5 text-zinc-500" />
                        <input
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-14 pr-6 text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all shadow-lg text-lg"
                            placeholder="Search YouTube or paste URL..."
                            value={query}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <div className="flex bg-zinc-900/50 rounded-xl p-1.5 border border-zinc-800 shrink-0">
                        <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-zinc-800 text-rose-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-rose-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {results.length > 0 ? (
                    <div className={`max-w-5xl mx-auto ${viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-6' : 'space-y-3'}`}>
                        {results.map(res => (
                            <div
                                key={res.id}
                                onClick={() => handleSelectSong(res)}
                                className={`group cursor-pointer bg-zinc-900/40 border border-zinc-800/50 hover:border-rose-500/50 hover:bg-zinc-900/80 transition-all overflow-hidden relative
                  ${viewMode === 'grid' ? 'rounded-2xl flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-900/10' : 'rounded-xl flex items-center gap-6 p-3'}
                `}
                            >
                                <div className={viewMode === 'grid' ? 'w-full aspect-video overflow-hidden' : 'w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden'}>
                                    <img src={res.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                                </div>
                                <div className={viewMode === 'grid' ? 'p-5 flex-1 relative' : 'flex-1'}>
                                    <h3 className="font-bold text-zinc-200 truncate group-hover:text-rose-400 transition-colors text-lg">{res.title}</h3>
                                    <p className="text-sm text-zinc-500">{res.artist}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-32 text-zinc-700">
                        <Search className="w-20 h-20 mx-auto mb-6 opacity-20" />
                        <p className="text-xl font-light">Enter a keyword to discover songs</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderStudioTab = () => {
        const exportOptions = [
            { id: 'json', label: 'Timings JSON', icon: FileJson },
            { id: 'video', label: 'MP4 Video', icon: Save },
            { id: 'vocal', label: 'Vocal Stem', icon: Mic },
            { id: 'band', label: 'Band Stem', icon: Music },
        ];

        return (
            <div className="flex w-full h-full animate-in fade-in">
                {/* CENTER: MAIN EDITOR (Fill remaining space) */}
                <div className="flex-1 flex flex-col p-8 min-w-0 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-zinc-200">{selectedSong ? selectedSong.title : 'Studio'}</h2>
                            {isSyncing && (
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Live Sync
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-1 relative overflow-hidden group focus-within:ring-1 focus-within:ring-rose-500/50 transition-all min-h-[500px]">
                        {processStage === 0 && !selectedSong && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <span className="text-zinc-700 font-medium">Select a song to enable studio</span>
                            </div>
                        )}
                        <textarea
                            className="w-full h-full bg-transparent border-none p-8 text-xl text-zinc-300 outline-none resize-none placeholder:text-zinc-700 leading-relaxed font-mono"
                            placeholder={selectedSong ? "Paste lyrics here to begin..." : ""}
                            value={lyrics}
                            onChange={e => setLyrics(e.target.value)}
                            disabled={!selectedSong}
                        />
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            {processStage > 0 && (
                                <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center gap-2 text-xs font-mono text-zinc-400">
                                    {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin text-rose-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                    {processStage === 1 ? 'Splitting...' : processStage === 2 ? 'Transcribing...' : processStage === 3 ? 'Aligning...' : 'Synced'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR: CONTROLS & EXPORTS */}
                <div className="w-80 border-l border-zinc-800 bg-zinc-950/50 p-6 flex flex-col gap-8 overflow-y-auto z-10">

                    {/* SECTION 1: EXPORT ARTIFACTS (Top Right) */}
                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Download className="w-3 h-3" /> Export Artifacts
                        </h3>
                        <div className="space-y-2">
                            {exportOptions.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleDownload(item.id)}
                                    disabled={processStage < 4 || isProcessing}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/30 hover:bg-zinc-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-zinc-500 group-hover:text-rose-500 transition-colors">
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white">{item.label}</span>
                                    </div>
                                    <Settings className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800/50" />

                    {/* SECTION 2: PIPELINE CONFIGURATION (Underneath Export) */}
                    <div className="opacity-100 transition-opacity">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Wand2 className="w-3 h-3" /> Pipeline Config
                        </h3>
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-400">Splitter Model</label>
                                <select
                                    value={splitterModel} onChange={e => setSplitterModel(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-300 focus:border-rose-500 outline-none transition-colors"
                                    disabled={isProcessing}
                                >
                                    {SPLITTER_MODELS.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-400">Alignment Model</label>
                                <select
                                    value={transcriptionModel} onChange={e => setTranscriptionModel(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-300 focus:border-rose-500 outline-none transition-colors"
                                    disabled={isProcessing}
                                >
                                    {TRANSCRIPTION_MODELS.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={isProcessing || !selectedSong}
                                className={`
                                    w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-lg
                                    ${isProcessing
                                        ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                                        : !selectedSong
                                            ? 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-rose-900/20'
                                    }
                                `}
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4" />
                                        <span>{processStage === 4 ? 'Re-Run Pipeline' : 'Run Pipeline'}</span>
                                    </>
                                )}
                            </button>

                            {/* Status Indicator in Sidebar */}
                            {processStage > 0 && (
                                <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span>Status</span>
                                        <span className={processStage === 4 ? "text-emerald-500" : "text-rose-500"}>
                                            {processStage === 1 ? 'Splitting...' : processStage === 2 ? 'Transcribing...' : processStage === 3 ? 'Aligning...' : 'Complete'}
                                        </span>
                                    </div>
                                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-rose-500 transition-all duration-1000 ease-out"
                                            style={{ width: `${(processStage / 4) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderPreviewTab = () => {
        const adj = computeAdjustedSentences(indexedLyrics, deltas, deletedWords, editedWords);
        const allWords = adj.flatMap(s => s.words);
        const instGap = computeInstrumentalGap(allWords, currentTime, 8);
        const outroGap = computeOutroGap(allWords, currentTime, duration, 0);

        // Simple paging logic for preview
        const linesPerPage = 4;
        const pages = [];
        for (let i = 0; i < adj.length; i += linesPerPage) {
            pages.push(adj.slice(i, i + linesPerPage));
        }
        let pageIdx = pages.length - 1;
        for (let i = 0; i < pages.length; i++) {
            const pg = pages[i];
            const lastS = pg[pg.length - 1];
            if (currentTime < lastS.sentence.end) {
                pageIdx = i;
                break;
            }
        }
        const visibleSentences = pages[pageIdx] || [];
        const isInstrumental = !!instGap;
        const isOutro = !!outroGap;

        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black relative animate-in zoom-in-95 duration-300">
                {processStage === 4 ? (
                    <div className="w-full aspect-video max-h-full max-w-7xl border border-zinc-800 rounded-lg overflow-hidden shadow-2xl relative">
                        <KaraokeRenderer
                            width={1920}
                            height={1080}
                            now={currentTime}
                            showOutro={isOutro}
                            outroGap={outroGap}
                            showInstrumental={isInstrumental}
                            instrumentalGap={instGap}
                            shouldShowLyrics={!isInstrumental && !isOutro && visibleSentences.length > 0}
                            visibleSentences={visibleSentences}
                            highlightColor="#f43f5e"
                        />
                        {/* Overlay for player meta */}
                        <div className="absolute top-6 left-8">
                            <h2 className="text-zinc-500 font-bold uppercase tracking-widest text-sm opacity-50">{selectedSong.title}</h2>
                        </div>
                    </div>
                ) : (
                    <div className="text-zinc-600 flex flex-col items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Layers className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-xl font-medium">Pipeline Incomplete</p>
                        <button onClick={() => setActiveTab('studio')} className="px-6 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">Go to Studio</button>
                    </div>
                )}
            </div>
        );
    };

    const renderExportTab = () => (
        <div className="max-w-4xl mx-auto w-full p-12 animate-in slide-in-from-bottom-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Save className="w-6 h-6 text-rose-500" />
                    <h2 className="text-2xl font-bold text-zinc-200">Export Assets</h2>
                </div>
                {isProcessing && (
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Encoding Video...
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { id: 'json', label: 'Timings JSON', desc: 'Syllable-level sync data', icon: FileJson },
                    { id: 'video', label: 'MP4 Video', desc: 'High quality karaoke video', icon: Save },
                    { id: 'vocal', label: 'Vocal Stem', desc: 'Isolated vocal track (MP3)', icon: Mic },
                    { id: 'band', label: 'Band Stem', desc: 'Instrumental track (MP3)', icon: Music },
                ].map(item => (
                    <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-rose-500/30 transition-all group">
                        <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex items-center justify-center mb-6 text-zinc-500 group-hover:text-rose-500 group-hover:bg-rose-500/10 transition-colors">
                            <item.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-200 mb-2">{item.label}</h3>
                        <p className="text-sm text-zinc-500 mb-8 leading-relaxed min-h-[40px]">{item.desc}</p>
                        <button
                            onClick={() => handleDownload(item.id)}
                            disabled={processStage < 4 || isProcessing}
                            className="w-full py-3 bg-zinc-800 hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Download
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-200 font-sans overflow-hidden selection:bg-rose-500/30 selection:text-white relative">

            {/* 1. TOP TAB BAR */}
            <header className="h-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-8 shrink-0 z-[100]">
                <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
                    <div className="w-9 h-9 bg-gradient-to-tr from-rose-600 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-900/20">
                        <Music className="w-5 h-5 fill-current" />
                    </div>
                    <span className="text-zinc-100">Karaoke<span className="text-rose-500">Maker</span></span>
                </div>

                <nav className="flex items-center bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50">
                    {['source', 'studio', 'preview', 'export'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize
                 ${activeTab === tab ? 'bg-zinc-800 text-rose-400 shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
               `}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <div className="w-40 flex justify-end gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">
                        JS
                    </div>
                </div>
            </header>

            {/* 2. MAIN CONTENT AREA */}
            <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-zinc-950 pb-32">
                {activeTab === 'source' && renderSourceTab()}
                {activeTab === 'studio' && renderStudioTab()}
                {activeTab === 'preview' && renderPreviewTab()}
                {activeTab === 'export' && renderExportTab()}
            </main>

            {/* 3. M11: FLOATING CAPSULE PLAYER */}
            {selectedSong && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8">
                    <div className={`
             bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-full transition-all duration-500 ease-spring
             ${playerExpanded ? 'w-[600px] h-20 px-6' : 'w-20 h-20 flex items-center justify-center cursor-pointer hover:scale-110'}
           `}>

                        {/* Collapsed View */}
                        {!playerExpanded && (
                            <button onClick={() => setPlayerExpanded(true)} className="w-full h-full flex items-center justify-center text-rose-500">
                                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                            </button>
                        )}

                        {/* Expanded View */}
                        {playerExpanded && (
                            <div className="flex items-center justify-between h-full w-full gap-6">
                                <div className="flex items-center gap-4 shrink-0">
                                    <button
                                        onClick={() => setPlayerExpanded(false)}
                                        className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                                    >
                                        <Minimize2 className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-3">
                                        <button onClick={handleStop} className="p-2 text-zinc-500 hover:text-rose-500"><Square className="w-4 h-4 fill-current" /></button>
                                        <button onClick={handlePlayPause} className="w-10 h-10 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
                                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 px-1">
                                        <span>{selectedSong.title}</span>
                                        <span>{prettyTime(currentTime)} / {prettyTime(duration)}</span>
                                    </div>
                                    <div className="relative w-full h-1 bg-zinc-800 rounded-full group cursor-pointer overflow-hidden">
                                        <div className="absolute top-0 left-0 h-full bg-rose-500 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                                        <input
                                            type="range" min="0" max={duration} step="0.1"
                                            value={currentTime}
                                            onChange={e => handleSeek(parseFloat(e.target.value))}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 group">
                                    <Mic className="w-3 h-3 text-zinc-500 group-hover:text-rose-500" />
                                    <input type="range" min="0" max="1" step="0.01" className="w-16 h-1 bg-zinc-800 rounded-full accent-rose-500 cursor-pointer" value={volVocal} onChange={e => setVolVocal(parseFloat(e.target.value))} />
                                </div>
                                <div className="flex items-center gap-2 group">
                                    <Music className="w-3 h-3 text-zinc-500 group-hover:text-blue-500" />
                                    <input type="range" min="0" max="1" step="0.01" className="w-16 h-1 bg-zinc-800 rounded-full accent-blue-500 cursor-pointer" value={volBand} onChange={e => setVolBand(parseFloat(e.target.value))} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* GENIUS MATCH MODAL */}
            {showMatchModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">Select Lyrics</h3>
                            <button onClick={() => setShowMatchModal(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto">
                            {geniusMatches.map(match => (
                                <button
                                    key={match.id}
                                    onClick={() => handleFetchGeniusLyrics(match)}
                                    className="w-full text-left p-3 hover:bg-zinc-800 rounded-xl flex items-center gap-4 transition-colors group"
                                >
                                    <img src={match.thumbnail} className="w-12 h-12 rounded-lg object-cover bg-zinc-800" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-zinc-200 truncate group-hover:text-rose-400">{match.title}</div>
                                        <div className="text-xs text-zinc-500">{match.artist}</div>
                                    </div>
                                    {isFetchingLyrics && <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50">
                            <button
                                onClick={() => { setShowMatchModal(false); setLyrics(''); }}
                                className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-sm font-medium"
                            >
                                Enter Manually
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
