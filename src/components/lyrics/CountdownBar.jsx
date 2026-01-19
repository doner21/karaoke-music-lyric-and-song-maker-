import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

const CountdownBar = ({
    gap,
    playbackTime,
    highlightColor = '#7CB87C'
}) => {
    if (!gap) return null;

    // Gap definition:
    // Starts at gap.startTime
    // Ends at gap.endTime (which is start of next word)
    // Countdown should effectively end 3s before gap.endTime to give user prep time.

    const countdownDuration = gap.duration - 3.0;
    const countdownEndTime = gap.startTime + countdownDuration;

    // If we are past the countdown end (into the 3s buffer), hide or show full?
    // Plan says: "Countdown ends 3.0s early". implies it fills up then disappears?
    // Or stays full? Let's hide it or fade it out.

    // Let's implement logic:
    // If time > countdownEndTime, maybe don't render?
    if (playbackTime > countdownEndTime) return null; // Hide during the 3s prep buffer

    // Calculate progress
    // progress = (currentTime - startTime) / duration
    const progress = Math.min(Math.max((playbackTime - gap.startTime) / countdownDuration, 0), 1);

    // Styles
    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        marginTop: '20px',
        opacity: 0.8
    };

    const labelStyle = {
        color: 'white',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontSize: '14px',
        fontWeight: '600'
    };

    const barContainerStyle = {
        width: '200px',
        height: '4px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '2px',
        overflow: 'hidden'
    };

    const barFillStyle = {
        height: '100%',
        width: `${progress * 100}%`,
        backgroundColor: highlightColor,
        transition: 'width 0.1s linear'
    };

    return (
        <div style={containerStyle}>
            <div style={labelStyle}>
                {gap.type === 'outro' ? 'Outro' : 'Instrumental'}
            </div>
            <div style={barContainerStyle}>
                <div style={barFillStyle} />
            </div>
        </div>
    );
};

CountdownBar.propTypes = {
    gap: PropTypes.shape({
        type: PropTypes.oneOf(['instrumental', 'outro']).isRequired,
        startTime: PropTypes.number.isRequired,
        endTime: PropTypes.number.isRequired,
        duration: PropTypes.number.isRequired
    }),
    playbackTime: PropTypes.number.isRequired,
    highlightColor: PropTypes.string
};

export default CountdownBar;
