import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import KaraokeRenderer from '../components/KaraokeRenderer';
// import { Audio } from 'remotion'; // Will use if we handle audio here

export const KaraokeComposition = ({
    lyricsData,
    settings = {}
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    const now = frame / fps;

    // Derived props from lyricsData and settings
    // We assume lyricsData is the "adjusted" object exported from App
    const visibleSentences = lyricsData?.lyrics || [];

    // Logic for outro/instrumental gaps would need to be re-calculated or passed in.
    // For now, let's keep it simple and just render lyrics.
    // Ideally, we should share the logic for "computeInstrumentalGap" etc. 
    // We can import them from utils/karaokeHelpers.
    // But those need the FULL list of sentences and analyzing gaps.

    const shouldShowLyrics = true; // Simplified for now

    // TODO: Re-implement gap detection or pass pre-calculated gaps in input props.

    return (
        <div style={{ flex: 1, backgroundColor: '#000000' }}>
            <KaraokeRenderer
                width={width}
                height={height}
                now={now}
                shouldShowLyrics={shouldShowLyrics}
                visibleSentences={visibleSentences}
                highlightColor={settings.highlightColor || '#6EE7B7'}
                // Optional props defaults
                showOutro={false}
                showInstrumental={false}
                outroGap={null}
                instrumentalGap={null}
                outroProgress={0}
                instrumentalProgress={0}
            />
        </div>
    );
};
