import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

const LetterFillWord = ({
    text,
    progress = 0,
    state = 'future',
    highlightColor = '#7CB87C',
    fontSize = 32
}) => {
    // Styles for the base white text with neon glow
    // Using inline styles for dynamic sizing or could be CSS-in-JS/Tailwind
    const baseStyle = useMemo(() => ({
        color: 'white',
        textShadow: `0 0 10px rgba(255,255,255,0.8),
                 0 0 20px rgba(255,255,255,0.6),
                 0 0 30px rgba(255,255,255,0.4)`,
        position: 'relative',
        display: 'inline-block',
        whiteSpace: 'pre', // Preserve spaces
        zIndex: 1
    }), []);

    // Styles for the highlighted overlay
    const highlightStyle = useMemo(() => ({
        color: highlightColor,
        textShadow: 'none', // No glow for highlight
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`, // Revealed from left to right
        pointerEvents: 'none', // Allow clicks to pass through to base
        whiteSpace: 'pre'
    }), [progress, highlightColor]);

    const containerStyle = {
        position: 'relative',
        display: 'inline-block',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        fontFamily: '"Outfit", sans-serif', // Assuming generic modern font or project specific
        margin: '0 4px', // Space between words
        opacity: state === 'past' ? 0.5 : (state === 'future' ? 0.8 : 1),
        transition: 'opacity 0.2s ease-out'
    };

    return (
        <span style={containerStyle} className={`lyric-word lyric-word-${state}`}>
            {/* Base Layer */}
            <span style={baseStyle}>{text}</span>

            {/* Highlight Layer */}
            <span style={highlightStyle} aria-hidden="true">{text}</span>
        </span>
    );
};

LetterFillWord.propTypes = {
    text: PropTypes.string.isRequired,
    progress: PropTypes.number,
    state: PropTypes.oneOf(['past', 'current', 'future']),
    highlightColor: PropTypes.string,
    fontSize: PropTypes.number
};

export default LetterFillWord;
