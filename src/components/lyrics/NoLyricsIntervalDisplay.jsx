import React from 'react';
import PropTypes from 'prop-types';

// Buffer time before next lyrics where countdown hides and lyrics become visible
const PREP_BUFFER_SECONDS = 3.0;

/**
 * Displays a no-lyrics interval (Instrumental or Outro) with countdown timer and progress bar.
 * Replaces lyrics display during the countdown portion of the gap.
 * Returns null during the 3-second prep buffer (when lyrics should be visible).
 */
const NoLyricsIntervalDisplay = ({
    gap,
    playbackTime,
    highlightColor = '#7CB87C'
}) => {
    if (!gap) return null;

    // Calculate countdown parameters
    // countdownDuration = max(0, gapDuration - 3.0s)
    const countdownDuration = Math.max(0, gap.duration - PREP_BUFFER_SECONDS);
    const countdownEndTime = gap.startTime + countdownDuration;

    // If we're past the countdown end (in 3s prep buffer), don't render
    if (playbackTime >= countdownEndTime) return null;

    // If countdown duration is 0 or negative (gap too short), don't render
    if (countdownDuration <= 0) return null;

    // Calculate progress (0 to 1) and remaining time
    const elapsed = Math.max(0, playbackTime - gap.startTime);
    const progress = Math.min(elapsed / countdownDuration, 1);
    const remaining = Math.max(0, countdownEndTime - playbackTime);

    // Format remaining time as M:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Styles
    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        width: '100%',
        height: '100%',
        minHeight: '200px'
    };

    const labelStyle = {
        color: 'white',
        textTransform: 'uppercase',
        letterSpacing: '4px',
        fontSize: '18px',
        fontWeight: '600',
        opacity: 0.9
    };

    const timerStyle = {
        color: highlightColor,
        fontSize: '48px',
        fontWeight: '300',
        fontFamily: 'monospace',
        textShadow: `0 0 20px ${highlightColor}40`
    };

    const barContainerStyle = {
        width: '300px',
        maxWidth: '80%',
        height: '6px',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: '3px',
        overflow: 'hidden'
    };

    const barFillStyle = {
        height: '100%',
        width: `${progress * 100}%`,
        backgroundColor: highlightColor,
        borderRadius: '3px',
        transition: 'width 0.1s linear',
        boxShadow: `0 0 10px ${highlightColor}60`
    };

    return (
        <div style={containerStyle}>
            <div style={labelStyle}>
                {gap.type === 'outro' ? 'Outro' : 'Instrumental'}
            </div>
            <div style={timerStyle}>
                {formatTime(remaining)}
            </div>
            <div style={barContainerStyle}>
                <div style={barFillStyle} />
            </div>
        </div>
    );
};

NoLyricsIntervalDisplay.propTypes = {
    gap: PropTypes.shape({
        type: PropTypes.oneOf(['instrumental', 'outro']).isRequired,
        startTime: PropTypes.number.isRequired,
        endTime: PropTypes.number.isRequired,
        duration: PropTypes.number.isRequired
    }),
    playbackTime: PropTypes.number.isRequired,
    highlightColor: PropTypes.string
};

export default NoLyricsIntervalDisplay;
