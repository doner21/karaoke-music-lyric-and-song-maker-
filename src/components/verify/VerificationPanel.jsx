import React, { useState, useEffect, useRef, useCallback } from 'react';
import { drawKaraokeFrame } from '../../utils/karaokeDrawer';
import { drawKaraokeFrameGL, initGL, destroyGL } from '../../utils/karaokeDrawerGL';
import { computeInstrumentalGap, computeOutroGap } from '../../utils/karaokeHelpers';
import KaraokeLyricsDisplay from '../lyrics/KaraokeLyricsDisplay';

/**
 * VerificationPanel — Side-by-side comparison of CPU (Canvas 2D) vs GPU (WebGL2) rendering.
 *
 * Props:
 *   lyrics       — array of { sentence: { start, end }, words: [{text, start, end}] }
 *   allWords     — flat array of { text, start, end }
 *   totalDuration — song length in seconds
 *   linesPerPage — lines per page (default 4)
 *   highlightColor — highlight color string
 *   onResult     — callback({ matchPct, diffDataUrl }) after comparison
 */
const VerificationPanel = ({
    lyrics = [],
    allWords = [],
    totalDuration = 120,
    timingJson = null,
    linesPerPage = 4,
    highlightColor = '#7CB87C',
    onResult
}) => {
    const WIDTH = 1280;
    const HEIGHT = 720;

    const cpuCanvasRef = useRef(null);
    const gpuCanvasRef = useRef(null);
    const diffCanvasRef = useRef(null);
    const glRendererRef = useRef(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [matchPct, setMatchPct] = useState(null);
    const [autoPlaying, setAutoPlaying] = useState(false);
    const [glError, setGlError] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const rafRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Initialize WebGL renderer — with retry logic for React StrictMode
    // StrictMode causes mount/unmount/remount, which rapidly creates/destroys
    // GPU contexts. The GPU needs a brief delay to release resources before
    // a new context can be created successfully.
    useEffect(() => {
        const gpuCanvas = gpuCanvasRef.current;
        if (!gpuCanvas) return;
        gpuCanvas.width = WIDTH;
        gpuCanvas.height = HEIGHT;

        let cancelled = false;
        let retryTimeout = null;
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 200;

        const tryInit = (attempt) => {
            if (cancelled) return;
            try {
                glRendererRef.current = initGL(gpuCanvas);
                console.log(`[Verify] WebGL2 initialized (attempt ${attempt + 1})`);
                setGlError(null); // Clear any previous error
            } catch (err) {
                console.warn(`[Verify] WebGL2 init attempt ${attempt + 1} failed:`, err.message);
                if (attempt < MAX_RETRIES - 1) {
                    console.log(`[Verify] Retrying in ${RETRY_DELAY_MS}ms...`);
                    retryTimeout = setTimeout(() => tryInit(attempt + 1), RETRY_DELAY_MS);
                } else {
                    console.error('[Verify] WebGL2 init failed after all retries:', err);
                    setGlError(err.message);
                }
            }
        };

        // Delay the first attempt slightly to let any previous context fully release
        retryTimeout = setTimeout(() => tryInit(0), 50);

        return () => {
            cancelled = true;
            if (retryTimeout) clearTimeout(retryTimeout);
            if (glRendererRef.current) {
                destroyGL(glRendererRef.current);
                glRendererRef.current = null;
            }
        };
    }, []);

    // Compute karaoke state at time t (shared logic with electronExport.js)
    const getStateAt = useCallback((t) => {
        const instGap = computeInstrumentalGap(allWords, t, 8);
        const adjEnd = instGap ? Math.max(instGap.start, instGap.end - 3) : null;
        const showInst = !!(instGap && t >= instGap.start && t < (adjEnd ?? instGap.end));
        const instProg = showInst ? (t - instGap.start) / Math.max(instGap.duration - 3, 0.001) : 0;

        const outroGap = computeOutroGap(allWords, t, totalDuration, 0);
        const showOutro = !!outroGap;
        const outroProg = showOutro ? (t - outroGap.start) / Math.max(outroGap.duration, 0.001) : 0;

        let showLyrics = false;
        let visibleSentences = [];

        if (!showOutro && !showInst && allWords.length > 0 && lyrics.length > 0) {
            const pages = [];
            for (let i = 0; i < lyrics.length; i += linesPerPage) {
                pages.push(lyrics.slice(i, i + linesPerPage));
            }

            let pageIdx = pages.length - 1;
            for (let i = 0; i < pages.length; i++) {
                const pg = pages[i];
                const lastS = pg[pg.length - 1];
                if (lastS && lastS.sentence && t < lastS.sentence.end) {
                    pageIdx = i;
                    break;
                }
            }

            visibleSentences = pages[pageIdx] || [];

            const firstWord = allWords[0];
            if (firstWord && t < firstWord.start && (firstWord.start - t) >= 8) {
                showLyrics = false;
            } else {
                showLyrics = visibleSentences.length > 0;
            }
        }

        return {
            showOutro,
            outroGap,
            outroProgress: outroProg,
            showInstrumental: showInst,
            instrumentalGap: instGap,
            instrumentalProgress: instProg,
            shouldShowLyrics: showLyrics,
            visibleSentences
        };
    }, [allWords, lyrics, totalDuration, linesPerPage]);

    // Render both canvases at current time
    const renderFrame = useCallback((t) => {
        const state = getStateAt(t);
        const params = {
            width: WIDTH,
            height: HEIGHT,
            now: t,
            showOutro: state.showOutro,
            outroGap: state.outroGap,
            showInstrumental: state.showInstrumental,
            instrumentalGap: state.instrumentalGap,
            shouldShowLyrics: state.shouldShowLyrics,
            visibleSentences: state.visibleSentences,
            outroProgress: state.outroProgress,
            instrumentalProgress: state.instrumentalProgress,
            highlightColor
        };

        // CPU path
        const cpuCanvas = cpuCanvasRef.current;
        if (cpuCanvas) {
            cpuCanvas.width = WIDTH;
            cpuCanvas.height = HEIGHT;
            const ctx = cpuCanvas.getContext('2d');
            if (ctx) {
                drawKaraokeFrame(ctx, params);
            }
        }

        // GPU path
        if (glRendererRef.current) {
            drawKaraokeFrameGL(glRendererRef.current, params);
        }
    }, [getStateAt, highlightColor]);

    // Compare pixels between the two canvases
    const compareFrames = useCallback(() => {
        const cpuCanvas = cpuCanvasRef.current;
        const gpuCanvas = gpuCanvasRef.current;
        const diffCanvas = diffCanvasRef.current;
        if (!cpuCanvas || !gpuCanvas || !diffCanvas) return null;

        diffCanvas.width = WIDTH;
        diffCanvas.height = HEIGHT;

        const cpuCtx = cpuCanvas.getContext('2d');

        // Read GPU pixels — need to read from WebGL context
        const gl = glRendererRef.current?.gl;
        if (!gl) return null;

        // Get CPU pixels
        const cpuImageData = cpuCtx.getImageData(0, 0, WIDTH, HEIGHT);
        const cpuPixels = cpuImageData.data;

        // Get GPU pixels (readPixels gives bottom-up, flip it)
        const gpuRaw = new Uint8Array(WIDTH * HEIGHT * 4);
        gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, gpuRaw);

        // Flip vertically
        const gpuPixels = new Uint8Array(WIDTH * HEIGHT * 4);
        const rowSize = WIDTH * 4;
        for (let y = 0; y < HEIGHT; y++) {
            const srcOffset = (HEIGHT - y - 1) * rowSize;
            const dstOffset = y * rowSize;
            gpuPixels.set(gpuRaw.subarray(srcOffset, srcOffset + rowSize), dstOffset);
        }

        // Compute diff
        const diffCtx = diffCanvas.getContext('2d');
        const diffImageData = diffCtx.createImageData(WIDTH, HEIGHT);
        const diffPixels = diffImageData.data;

        let matchCount = 0;
        const totalPixels = WIDTH * HEIGHT;
        const THRESHOLD = 30; // tolerance per channel

        for (let i = 0; i < cpuPixels.length; i += 4) {
            const dr = Math.abs(cpuPixels[i] - gpuPixels[i]);
            const dg = Math.abs(cpuPixels[i + 1] - gpuPixels[i + 1]);
            const db = Math.abs(cpuPixels[i + 2] - gpuPixels[i + 2]);

            if (dr <= THRESHOLD && dg <= THRESHOLD && db <= THRESHOLD) {
                matchCount++;
                // Green for match
                diffPixels[i] = 0;
                diffPixels[i + 1] = 255;
                diffPixels[i + 2] = 0;
                diffPixels[i + 3] = 40;
            } else {
                // Red for mismatch — intensity shows severity
                const severity = Math.max(dr, dg, db);
                diffPixels[i] = 255;
                diffPixels[i + 1] = 0;
                diffPixels[i + 2] = 0;
                diffPixels[i + 3] = Math.min(255, severity * 3);
            }
        }

        diffCtx.putImageData(diffImageData, 0, 0);

        const pct = ((matchCount / totalPixels) * 100).toFixed(2);
        setMatchPct(pct);

        return { matchPct: pct, diffDataUrl: diffCanvas.toDataURL('image/png') };
    }, []);

    // Render + compare when time changes
    useEffect(() => {
        renderFrame(currentTime);
        const timer = setTimeout(() => compareFrames(), 50);
        return () => clearTimeout(timer);
    }, [currentTime, renderFrame, compareFrames]);

    // Auto-play simulation
    useEffect(() => {
        if (!autoPlaying) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            lastTimeRef.current = null;
            return;
        }

        const tick = (ts) => {
            if (lastTimeRef.current === null) lastTimeRef.current = ts;
            const delta = (ts - lastTimeRef.current) / 1000;
            lastTimeRef.current = ts;

            setCurrentTime(prev => {
                const next = prev + delta;
                if (next >= totalDuration) {
                    setAutoPlaying(false);
                    return totalDuration;
                }
                return next;
            });

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [autoPlaying, totalDuration]);

    // Take snapshot at current time
    const takeSnapshot = useCallback(() => {
        const result = compareFrames();
        if (result) {
            const cpuDataUrl = cpuCanvasRef.current?.toDataURL('image/png');
            const gpuDataUrl = gpuCanvasRef.current?.toDataURL('image/png');
            setSnapshots(prev => [...prev, {
                time: currentTime.toFixed(2),
                matchPct: result.matchPct,
                cpuDataUrl,
                gpuDataUrl,
                diffDataUrl: result.diffDataUrl
            }]);
            onResult?.(result);
        }
    }, [compareFrames, currentTime, onResult]);

    // Run full automated sweep
    const runAutomatedSweep = useCallback(async () => {
        const results = [];
        const step = totalDuration / 20; // 20 sample points
        for (let t = 0; t <= totalDuration; t += step) {
            setCurrentTime(t);
            renderFrame(t);
            // Give WebGL a tick to finish
            await new Promise(r => setTimeout(r, 100));
            const result = compareFrames();
            if (result) {
                results.push({ time: t.toFixed(2), ...result });
            }
        }

        const avgMatch = results.reduce((sum, r) => sum + parseFloat(r.matchPct), 0) / results.length;
        const worstFrame = results.reduce((worst, r) =>
            parseFloat(r.matchPct) < parseFloat(worst.matchPct) ? r : worst
            , results[0]);

        console.log(`[Verify] Sweep complete: avg=${avgMatch.toFixed(2)}%, worst=${worstFrame.matchPct}% at t=${worstFrame.time}s`);

        // Navigate to worst frame for inspection
        setCurrentTime(parseFloat(worstFrame.time));

        return { avgMatch, worstFrame, results };
    }, [totalDuration, renderFrame, compareFrames]);

    // Export results to console (for script-mode automation)
    useEffect(() => {
        // Expose verification API on window for automated testing
        window.__verifyRendering = {
            setTime: (t) => setCurrentTime(t),
            compare: () => compareFrames(),
            sweep: () => runAutomatedSweep(),
            getMatchPct: () => matchPct
        };
        return () => { delete window.__verifyRendering; };
    }, [compareFrames, matchPct, runAutomatedSweep]);

    const getMatchColor = (pct) => {
        if (pct === null) return '#888';
        const n = parseFloat(pct);
        if (n >= 95) return '#4ade80'; // green
        if (n >= 80) return '#facc15'; // yellow
        return '#ef4444'; // red
    };

    return (
        <div style={{
            background: '#111',
            color: '#fff',
            padding: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            minHeight: '100vh'
        }}>
            <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#7CB87C' }}>
                🔍 Rendering Verification Panel
            </h1>
            <p style={{ color: '#888', marginBottom: '20px', fontSize: '14px' }}>
                Compares CPU (Canvas 2D) vs GPU (WebGL2) rendering output pixel-by-pixel.
            </p>

            {glError && (
                <div style={{
                    background: '#3b1515',
                    border: '1px solid #ef4444',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ WebGL2 Error</div>
                    <div style={{ fontSize: '12px', color: '#fca5a5' }}>{glError}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                        GPU rendering is unavailable. CPU rendering and App Preview still work.
                    </div>
                </div>
            )}

            {/* Controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px',
                background: '#1a1a1a',
                padding: '12px 16px',
                borderRadius: '8px'
            }}>
                <button
                    onClick={() => setAutoPlaying(!autoPlaying)}
                    style={{
                        background: autoPlaying ? '#ef4444' : '#7CB87C',
                        color: '#000',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {autoPlaying ? '⏹ Stop' : '▶ Play'}
                </button>

                <input
                    type="range"
                    min={0}
                    max={totalDuration}
                    step={0.1}
                    value={currentTime}
                    onChange={e => setCurrentTime(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                />

                <span style={{ fontFamily: 'monospace', minWidth: '80px' }}>
                    {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
                </span>

                <button
                    onClick={takeSnapshot}
                    style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    📸 Snapshot
                </button>

                <button
                    onClick={runAutomatedSweep}
                    style={{
                        background: '#a855f7',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    🔄 Full Sweep
                </button>

                {/* Match percentage */}
                <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: getMatchColor(matchPct),
                    fontFamily: 'monospace',
                    minWidth: '100px',
                    textAlign: 'right'
                }}>
                    {matchPct !== null ? `${matchPct}%` : '—'}
                </div>
            </div>

            {/* Canvases — 4-column layout: App Preview | CPU | GPU | Diff */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '12px',
                marginBottom: '20px'
            }}>
                {/* App Preview (Live — same as main app preview mode) */}
                <div>
                    <div style={{ fontSize: '12px', color: '#7CB87C', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                        🎤 App Preview (Live)
                    </div>
                    <div style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        border: '2px solid #7CB87C44',
                        borderRadius: '4px',
                        background: '#000',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {timingJson ? (
                            <KaraokeLyricsDisplay
                                timingJson={timingJson}
                                audioRef={null}
                                currentTime={currentTime}
                                isPlaying={autoPlaying}
                                className="w-full h-full"
                                linesPerPage={linesPerPage}
                                highlightColor={highlightColor}
                                fontSize={32}
                                trackDuration={totalDuration}
                            />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#555',
                                fontSize: '11px'
                            }}>
                                No timing data
                            </div>
                        )}
                    </div>
                </div>

                {/* CPU Reference */}
                <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        CPU (Canvas 2D) — Reference
                    </div>
                    <canvas
                        ref={cpuCanvasRef}
                        width={WIDTH}
                        height={HEIGHT}
                        style={{
                            width: '100%',
                            border: '2px solid #333',
                            borderRadius: '4px',
                            background: '#000'
                        }}
                    />
                </div>

                {/* GPU Test */}
                <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        GPU (WebGL2) — Test
                    </div>
                    <canvas
                        ref={gpuCanvasRef}
                        width={WIDTH}
                        height={HEIGHT}
                        style={{
                            width: '100%',
                            border: `2px solid ${glError ? '#ef4444' : '#333'}`,
                            borderRadius: '4px',
                            background: '#000'
                        }}
                    />
                    {glError && (
                        <div style={{
                            position: 'absolute',
                            top: '24px',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: '8px',
                            background: 'rgba(0,0,0,0.8)',
                            borderRadius: '0 0 4px 4px',
                            padding: '12px'
                        }}>
                            <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>
                                GPU Unavailable
                            </div>
                            <div style={{ color: '#888', fontSize: '10px', textAlign: 'center', maxWidth: '90%' }}>
                                WebGL2 shader compilation failed.
                                Check console for GPU diagnostics.
                            </div>
                        </div>
                    )}
                </div>

                {/* Diff */}
                <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Diff (Green=Match, Red=Mismatch)
                    </div>
                    <canvas
                        ref={diffCanvasRef}
                        width={WIDTH}
                        height={HEIGHT}
                        style={{
                            width: '100%',
                            border: '2px solid #333',
                            borderRadius: '4px',
                            background: '#000'
                        }}
                    />
                </div>
            </div>

            {/* Snapshot history */}
            {snapshots.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
                        Snapshots ({snapshots.length})
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '8px'
                    }}>
                        {snapshots.map((snap, i) => (
                            <div key={i} style={{
                                background: '#1a1a1a',
                                padding: '8px',
                                borderRadius: '6px',
                                border: `1px solid ${getMatchColor(snap.matchPct)}`
                            }}>
                                <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                    t={snap.time}s  —  <span style={{ color: getMatchColor(snap.matchPct) }}>
                                        {snap.matchPct}%
                                    </span>
                                </div>
                                <img
                                    src={snap.diffDataUrl}
                                    alt={`diff at ${snap.time}s`}
                                    style={{ width: '100%', marginTop: '4px', borderRadius: '3px' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No data warning */}
            {allWords.length === 0 && (
                <div style={{
                    background: '#3b2e15',
                    border: '1px solid #facc15',
                    padding: '16px',
                    borderRadius: '8px',
                    marginTop: '20px'
                }}>
                    ⚠️ <strong>No lyrics data loaded.</strong> Load a song first, then navigate to this panel.
                    The canvases will only show black backgrounds without lyrics data.
                </div>
            )}
        </div>
    );
};

export default VerificationPanel;
