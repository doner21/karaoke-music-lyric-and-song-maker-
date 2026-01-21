import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { usePlaybackTime } from '../../hooks/usePlaybackTime';
import { normalizeLyrics } from '../../utils/lyricsTimingNormalizer';
import { calculatePages, getCurrentPage } from '../../utils/lyricsPagination';
import { getActiveGap } from '../../utils/gapDetector';
import PaginatedLyricsDisplay from './PaginatedLyricsDisplay';
import NoLyricsIntervalDisplay from './NoLyricsIntervalDisplay';

// Buffer time before next lyrics where countdown hides
const PREP_BUFFER_SECONDS = 3.0;


const KaraokeLyricsDisplay = ({
    timingJson,
    audioRef,
    isPlaying = null,
    className = "",
    // New Props for Controlled State
    linesPerPage = 2,
    highlightColor = '#7CB87C',
    fontSize = 32,
    trackDuration = null, // Total track duration for outro detection
    currentTime = null // External time override for stem mode
}) => {
    // Note: State lifted to parent (IntegratedEcologicalOS)

    // --- Core Processing ---

    // 1. Playback Time (from hook or external override)
    const { playbackTime: hookPlaybackTime } = usePlaybackTime(audioRef, isPlaying);
    const playbackTime = currentTime !== null ? currentTime : hookPlaybackTime;

    // 2. Data Normalization (with track duration for outro detection)
    const normalizedLyrics = useMemo(() => {
        return normalizeLyrics(timingJson, trackDuration);
    }, [timingJson, trackDuration]);

    // 3. Pagination
    const pages = useMemo(() => {
        return calculatePages(normalizedLyrics, linesPerPage);
    }, [normalizedLyrics, linesPerPage]);

    // 4. Current State Determination
    const activeGap = getActiveGap(normalizedLyrics.gaps, playbackTime);

    // 5. Determine if we should show interval display vs lyrics
    // Show interval display during countdown portion, show lyrics during 3s prep buffer
    const shouldShowIntervalDisplay = useMemo(() => {
        if (!activeGap) return false;
        const countdownDuration = Math.max(0, activeGap.duration - PREP_BUFFER_SECONDS);
        const countdownEndTime = activeGap.startTime + countdownDuration;
        // Show interval display only during countdown, not during prep buffer
        return playbackTime < countdownEndTime && countdownDuration > 0;
    }, [activeGap, playbackTime]);

    // 6. Get current page (word-anchor-based: page derived from next highlightable word)
    const { currentPage } = getCurrentPage(pages, playbackTime, normalizedLyrics.gaps, normalizedLyrics);

    // --- Render ---
    return (
        <div className={`relative flex flex-col items-center justify-center w-full h-full overflow-hidden ${className}`}>
            {/* Main Content Area - Either Interval Display or Lyrics */}
            <div className="flex-1 w-full flex items-center justify-center relative">
                {shouldShowIntervalDisplay ? (
                    // Show no-lyrics interval display (Instrumental/Outro)
                    <NoLyricsIntervalDisplay
                        gap={activeGap}
                        playbackTime={playbackTime}
                        highlightColor={highlightColor}
                    />
                ) : (
                    // Show lyrics (including during 3s prep buffer)
                    <PaginatedLyricsDisplay
                        page={currentPage}
                        playbackTime={playbackTime}
                        highlightColor={highlightColor}
                        fontSize={fontSize}
                    />
                )}
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
    className: PropTypes.string,
    linesPerPage: PropTypes.number,
    highlightColor: PropTypes.string,
    fontSize: PropTypes.number,
    trackDuration: PropTypes.number, // Total track duration for outro detection
    currentTime: PropTypes.number // External time override for stem mode
};

export default KaraokeLyricsDisplay;
