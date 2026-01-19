import React, { useMemo } from 'react';
import LyricLine from './LyricLine'; // Will be created in next phase
import { calculateBatchHighlights } from '../../utils/wordHighlightCalculator';

const PaginatedLyricsDisplay = ({
    page,
    playbackTime,
    highlightColor,
    fontSize
}) => {
    if (!page) return <div className="text-white">Waiting for lyrics...</div>;

    // Render the lines for the current page
    return (
        <div className="flex flex-col items-center justify-center w-full h-full p-8 transition-all duration-300">
            <div className="flex flex-col gap-8 w-full max-w-4xl text-center">
                {page.lines.map((line) => (
                    <LyricLine
                        key={line.lineIndex}
                        line={line}
                        playbackTime={playbackTime}
                        highlightColor={highlightColor}
                        fontSize={fontSize}
                    />
                ))}
            </div>
        </div>
    );
};

export default PaginatedLyricsDisplay;
