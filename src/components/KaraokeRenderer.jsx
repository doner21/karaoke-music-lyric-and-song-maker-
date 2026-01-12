import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { drawKaraokeFrame } from '../utils/karaokeDrawer';

const KaraokeRenderer = forwardRef(({
    width,
    height,
    now,
    showOutro,
    outroGap,
    showInstrumental,
    instrumentalGap,
    shouldShowLyrics,
    visibleSentences,
    outroProgress,
    instrumentalProgress,
    highlightColor,
    lineColors
}, ref) => {
    const localRef = useRef(null);

    // Check if ref is a function or object ref, or null
    // We want to ensure we have a ref to use internally as well.
    // Actually, we can just use the forwarded ref if provided, but we need to guarantee it exists for our useEffect.
    // Standard pattern: useImperativeHandle or just assign to both?
    // Easiest: use a local ref and expose it via useImperativeHandle, OR just assume ref is object.
    // Let's use simple approach: internal ref, and sync to forwarded ref? 
    // Better: useImperativeHandle to expose the canvas node.

    useImperativeHandle(ref, () => localRef.current);

    useEffect(() => {
        const canvas = localRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;

        // Set dimensions
        canvas.width = width;
        canvas.height = height;

        drawKaraokeFrame(ctx2d, {
            width,
            height,
            now,
            showOutro,
            outroGap,
            showInstrumental,
            instrumentalGap,
            shouldShowLyrics,
            visibleSentences,
            outroProgress,
            instrumentalProgress,
            highlightColor,
            lineColors
        });
    }, [now, width, height, showOutro, outroGap, showInstrumental, instrumentalGap, shouldShowLyrics, visibleSentences, outroProgress, instrumentalProgress, highlightColor, lineColors]);

    return (
        <canvas
            ref={localRef}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
    );
});

KaraokeRenderer.displayName = 'KaraokeRenderer';

export default KaraokeRenderer;
