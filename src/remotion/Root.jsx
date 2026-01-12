import React from 'react';
import { Composition } from 'remotion';
import { KaraokeComposition } from './KaraokeComposition';

export const RemotionRoot = () => {
    return (
        <>
            <Composition
                id="KaraokeVideo"
                component={KaraokeComposition}
                durationInFrames={30 * 60} // Default 30s
                fps={60}
                width={1920}
                height={1080}
                defaultProps={{
                    lyricsData: { lyrics: [] },
                    settings: { highlightColor: '#6EE7B7' }
                }}
            />
        </>
    );
};
