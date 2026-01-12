import React from 'react';
import { clamp01 } from '../utils/karaokeHelpers';

const TimelineBlockContent = ({
    text,
    start,
    end,
    currentTime,
    highlightColor = '#10b981',
    isSelected,
    isMulti,
    isDrag
}) => {
    const duration = end - start;
    const rawProgress = (currentTime - start) / Math.max(0.001, duration);
    const progress = clamp01(rawProgress);

    // Style for the container which matches the Block Size
    const blockContainerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'visible', // Text can spill
    };

    const textStyle = {
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        padding: '0 4px',
        userSelect: 'none',
    };

    const bgTextStyle = {
        ...textStyle,
        color: 'rgba(255, 255, 255, 0.7)',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    };

    const fgTextStyle = {
        ...textStyle,
        color: highlightColor,
        textShadow: '0 0 10px rgba(255,255,255,0.4)',
    };

    // Solution for Centered Masking:
    // The FG Layer is a mask (overflow hidden) of width P%.
    // Inside it, we have a container of width 1/P %.
    // Inside THAT, we Flex Center the text.
    // This effectively keeps the text static relative to the Block, while the Mask reveals it.

    // Handle p=0 case to avoid infinity
    const safeProgress = Math.max(progress, 0.0001);
    const inverseWidth = 100 / safeProgress;

    return (
        <>
            {/* BG Layer (Visible everywhere) */}
            <div style={blockContainerStyle}>
                <span style={bgTextStyle}>{text}</span>
            </div>

            {/* FG Layer (Masked) */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progress * 100}%`,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 2,
            }}>
                <div style={{
                    width: `${inverseWidth}%`, // Counter-scale the width
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <span style={fgTextStyle}>{text}</span>
                </div>
            </div>
        </>
    );
};

export default TimelineBlockContent;
