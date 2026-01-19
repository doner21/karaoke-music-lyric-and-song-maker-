import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { usePlaybackTime } from '../../hooks/usePlaybackTime';
import { normalizeLyrics } from '../../utils/lyricsTimingNormalizer';
import { calculatePages, getCurrentPage } from '../../utils/lyricsPagination';
import { getActiveGap } from '../../utils/gapDetector';
import PaginatedLyricsDisplay from './PaginatedLyricsDisplay';
import CountdownBar from './CountdownBar';
import LyricsControls from './LyricsControls';

const KaraokeLyricsDisplay = ({
    timingJson,
    audioRef,
    isPlaying = null,
    className = ""
}) => {
    // --- State: User Preferences (with localStorage persistence) ---
    const [linesPerPage, setLinesPerPage] = useState(() => {
        const saved = localStorage.getItem('karaoke_linesPerPage');
        return saved ? parseInt(saved, 10) : 2;
    });

    const [highlightColor, setHighlightColor] = useState(() => {
        return localStorage.getItem('karaoke_highlightColor') || '#7CB87C';
    });

    const [fontSize, setFontSize] = useState(() => {
        const saved = localStorage.getItem('karaoke_fontSize');
        return saved ? parseInt(saved, 10) : 32;
    });

    // Persist preferences
    useEffect(() => { localStorage.setItem('karaoke_linesPerPage', linesPerPage); }, [linesPerPage]);
    useEffect(() => { localStorage.setItem('karaoke_highlightColor', highlightColor); }, [highlightColor]);
    useEffect(() => { localStorage.setItem('karaoke_fontSize', fontSize); }, [fontSize]);

    // --- Core Processing ---

    // 1. Playback Time
    const { playbackTime } = usePlaybackTime(audioRef, isPlaying);

    // 2. Data Normalization
    const normalizedLyrics = useMemo(() => {
        return normalizeLyrics(timingJson);
    }, [timingJson]);

    // 3. Pagination
    const pages = useMemo(() => {
        return calculatePages(normalizedLyrics, linesPerPage);
    }, [normalizedLyrics, linesPerPage]);

    // 4. Current State Determination
    const { currentPage } = getCurrentPage(pages, playbackTime);
    const activeGap = getActiveGap(normalizedLyrics.gaps, playbackTime);

    // --- Render ---
    return (
        <div className={`relative flex flex-col items-center justify-center w-full h-full overflow-hidden ${className}`}>
            {/* Main Lyrics Area */}
            <div className="flex-1 w-full flex items-center justify-center relative">
                <PaginatedLyricsDisplay
                    page={currentPage}
                    playbackTime={playbackTime}
                    highlightColor={highlightColor}
                    fontSize={fontSize}
                />

                {/* Instrumental/Countdown overlay */}
                {activeGap && (
                    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
                        <CountdownBar
                            gap={activeGap}
                            playbackTime={playbackTime}
                            highlightColor={highlightColor}
                        />
                    </div>
                )}
            </div>

            {/* Controls Overlay (Top Right or Bottom Right) */}
            <div className="absolute top-4 right-4 z-50">
                <LyricsControls
                    linesPerPage={linesPerPage}
                    setLinesPerPage={setLinesPerPage}
                    highlightColor={highlightColor}
                    setHighlightColor={setHighlightColor}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                />
            </div>
        </div>
    );
};

KaraokeLyricsDisplay.propTypes = {
    timingJson: PropTypes.object,
    audioRef: PropTypes.oneOfType([
        PropTypes.shape({ current: PropTypes.any }),
        PropTypes.object // For YT Player instance
    ]),
    isPlaying: PropTypes.bool,
    className: PropTypes.string
};

export default KaraokeLyricsDisplay;
