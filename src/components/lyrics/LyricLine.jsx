import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import LetterFillWord from './LetterFillWord';
import { calculateBatchHighlights } from '../../utils/wordHighlightCalculator';

const LyricLine = ({
    line,
    playbackTime,
    highlightColor,
    fontSize
}) => {
    // Calculate states for all words in this line
    const wordStates = useMemo(() => {
        return calculateBatchHighlights(line.words, playbackTime);
    }, [line.words, playbackTime]);

    // Determine overall line state (optional, for potential container styling)
    // If all words are past, line is past.
    // If ANY word is current, line is current.
    // If all words are future, line is future.

    return (
        <div className="flex flex-wrap justify-center items-center w-full leading-relaxed transition-opacity duration-300">
            {line.words.map((word, index) => {
                const { state, progress } = wordStates[index];
                return (
                    <LetterFillWord
                        key={word.wordIndex}
                        text={word.text}
                        progress={progress}
                        state={state}
                        highlightColor={highlightColor}
                        fontSize={fontSize}
                    />
                );
            })}
        </div>
    );
};

LyricLine.propTypes = {
    line: PropTypes.shape({
        words: PropTypes.array.isRequired,
        lineIndex: PropTypes.number.isRequired
    }).isRequired,
    playbackTime: PropTypes.number.isRequired,
    highlightColor: PropTypes.string,
    fontSize: PropTypes.number
};

export default LyricLine;
