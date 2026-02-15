import React, { useState, useEffect } from 'react';
import VerificationPanel from './VerificationPanel';

const API_URL = 'http://localhost:3002';

/**
 * VerificationLoader — fetches song data from the API and feeds it to VerificationPanel.
 * Uses the actual server endpoints:
 *   GET /api/library/songs          → { items: [...] }
 *   GET /api/library/songs/:id/jobs → [...] (find kind==='align', state==='done')
 */
const VerificationLoader = () => {
    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [lyrics, setLyrics] = useState([]);
    const [allWords, setAllWords] = useState([]);
    const [totalDuration, setTotalDuration] = useState(120);
    const [timingJson, setTimingJson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load song list
    useEffect(() => {
        fetch(`${API_URL}/api/library/songs`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                const songList = data.items || [];
                setSongs(songList);
                setLoading(false);
            })
            .catch(err => {
                setError(`Failed to load songs: ${err.message}`);
                setLoading(false);
            });
    }, []);

    // When a song is selected, fetch its alignment jobs to get timing data
    useEffect(() => {
        if (!selectedSong) return;
        setLoading(true);
        setError(null);

        fetch(`${API_URL}/api/library/songs/${selectedSong.id}/jobs`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(jobs => {
                // Find the completed alignment job
                const alignJob = jobs.find(j => j.kind === 'align' && j.state === 'done' && j.result);
                if (!alignJob || !alignJob.result?.lyrics) {
                    setError('No alignment data found for this song. Run alignment first.');
                    setLoading(false);
                    return;
                }

                const timingData = alignJob.result;

                // Build indexed lyrics array (matching KaraokeLyricsDisplay format)
                const indexedLyrics = timingData.lyrics.map((s, si) => ({
                    _si: si,
                    sentence: s.sentence ? { ...s.sentence } : { start: s.words?.[0]?.start || 0, end: s.words?.[s.words.length - 1]?.end || 0 },
                    words: (s.words || []).map((w, wi) => ({ ...w, _si: si, _wi: wi }))
                }));
                setLyrics(indexedLyrics);

                // Store raw timing JSON for KaraokeLyricsDisplay
                setTimingJson(timingData);

                // Build flat word list
                const words = timingData.lyrics.flatMap(s => (s.words || []).map(w => ({ ...w })));
                setAllWords(words);

                // Estimate total duration from last word end
                if (words.length > 0) {
                    const lastEnd = Math.max(...words.map(w => w.end || 0));
                    setTotalDuration(lastEnd + 5);
                }

                setLoading(false);
            })
            .catch(err => {
                setError(`Failed to load timing data: ${err.message}`);
                setLoading(false);
            });
    }, [selectedSong]);

    if (loading) {
        return (
            <div style={{
                background: '#111',
                color: '#fff',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
            }}>
                Loading...
            </div>
        );
    }

    if (!selectedSong) {
        return (
            <div style={{
                background: '#111',
                color: '#fff',
                padding: '40px',
                fontFamily: 'system-ui',
                minHeight: '100vh'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', color: '#7CB87C', margin: 0 }}>
                        🔍 Select a Song to Verify
                    </h1>
                    <a
                        href="#/"
                        style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}
                    >
                        ← Back to App
                    </a>
                </div>

                {error && (
                    <div style={{
                        color: '#ef4444',
                        marginBottom: '16px',
                        background: '#3b1515',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ef4444'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '12px'
                }}>
                    {songs.map(song => (
                        <button
                            key={song.id}
                            onClick={() => setSelectedSong(song)}
                            style={{
                                background: '#1a1a1a',
                                color: '#fff',
                                border: '1px solid #333',
                                padding: '16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'border-color 0.2s'
                            }}
                            onMouseEnter={e => e.target.style.borderColor = '#7CB87C'}
                            onMouseLeave={e => e.target.style.borderColor = '#333'}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                {song.track_title || song.title || `Song ${song.id}`}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>
                                {song.artist_name || song.artist || 'Unknown Artist'}
                            </div>
                        </button>
                    ))}
                </div>

                {songs.length === 0 && !error && (
                    <div style={{ color: '#888', marginTop: '20px' }}>
                        No songs found. Make sure your server is running at {API_URL}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div style={{
                background: '#1a1a1a',
                padding: '8px 20px',
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <button
                    onClick={() => { setSelectedSong(null); setLyrics([]); setAllWords([]); setError(null); }}
                    style={{
                        background: '#333',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    ← Back
                </button>
                <span style={{ color: '#888' }}>
                    Verifying: <strong style={{ color: '#fff' }}>
                        {selectedSong.track_title || selectedSong.title || selectedSong.canonical_display_name}
                    </strong>
                </span>
                <a
                    href="#/"
                    style={{ color: '#555', fontSize: '12px', textDecoration: 'none', marginLeft: 'auto' }}
                >
                    Exit to App
                </a>
            </div>

            {error ? (
                <div style={{
                    background: '#111',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#ef4444',
                    minHeight: '50vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ fontSize: '18px' }}>⚠️ {error}</div>
                    <button
                        onClick={() => { setSelectedSong(null); setError(null); }}
                        style={{
                            background: '#333',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Pick Another Song
                    </button>
                </div>
            ) : (
                <VerificationPanel
                    lyrics={lyrics}
                    allWords={allWords}
                    totalDuration={totalDuration}
                    timingJson={timingJson}
                    linesPerPage={4}
                    highlightColor='#7CB87C'
                    onResult={(result) => console.log('[Verify] Result:', result)}
                />
            )}
        </div>
    );
};

export default VerificationLoader;
