import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

/**
 * Vocal Waveform Visualization
 * 
 * Renders a waveform of the vocal stem on a canvas.
 * Fetches pre-computed waveform data from the server to avoid renderer crashes.
 * 
 * @param {Object} props
 * @param {string|null} props.vocalUrl - URL to the vocal stem audio file (used to derive path)
 * @param {number} props.pxPerMs - Zoom level (pixels per millisecond)
 * @param {number} props.trackDurationMs - Total duration in ms
 * @param {number} props.height - Height of the waveform canvas
 * @param {string} props.color - Waveform color
 */
export default function VocalWaveform({
    vocalUrl,
    pxPerMs,
    trackDurationMs,
    height = 100,
    color = '#4ade80', // green-400
    className
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [waveformData, setWaveformData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch waveform data from server
    useEffect(() => {
        if (!vocalUrl) {
            setWaveformData(null);
            return;
        }

        let isMounted = true;
        const abortController = new AbortController();

        const loadWaveform = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Construct API URL - passing the vocal URL as a query param
                // The server will need to decode this and map it to a file
                // Note: The vocalUrl often comes as a relative path like /download/... 
                // The server at localhost:3002 needs to know which file to process.
                // Our new server endpoint expects 'path' or 'url'. 
                // We are passing `url` and relying on the server (which we need to update to handle 'url' if it doesn't yet).
                // Wait, I only implemented 'path' in server-proxy.js.
                // I need to use 'path' parameter, but I only have 'vocalUrl' here.
                // However, in this app, vocalUrl usually contains the download path which maps to a file.
                // BUT, the server endpoint `generateWaveform` expects a file path on disk.
                // If I pass `http://localhost:3002/download/jobId/vocals`, that is NOT a file path.
                // I need the server to resolve it.

                // CRITICAL FIX: The server-side implementation I wrote expects a direct file path.
                // But the client doesn't know the absolute file path.
                // The client knows the *download URL*.
                // Therefore, I should update the server to accept a URL and resolve it to a path, OR
                // Update the server to accept the `jobId` or `songId` and look up the artifact.

                // Let's check how `vocalUrl` is passed. In `IntegratedEcologicalOS.jsx`:
                // `vocalUrl={splitResult?.vocalDownloadUrl ? `${API_URL}${splitResult.vocalDownloadUrl}` : null}`
                // It's the full URL.

                // Simplest fix: Just pass this URL to the server, and update the server-proxy to parse it?
                // OR: Update server-proxy to accept `url` and if it looks like a local download URL, extract the info.

                // But wait, `splitResult` contains other info?
                // Actually, `TokenEditorPanel` receives `vocalUrl`.

                // Let's pass the raw URL to the server as `url`. 
                // And I will update `server-proxy.js` to handle `url` parameter and resolve it.

                const apiUrl = `http://localhost:3002/api/audio/waveform?url=${encodeURIComponent(vocalUrl)}`;

                console.log('[VocalWaveform] Fetching:', apiUrl);
                const response = await fetch(apiUrl, { signal: abortController.signal });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || `Server error ${response.status}`);
                }

                const data = await response.json(); // Array of peaks [0.1, 0.5, ...]

                if (isMounted) {
                    console.log(`[VocalWaveform] Loaded ${data.length} peaks`);
                    setWaveformData(data);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted && err.name !== 'AbortError') {
                    console.error('[VocalWaveform] Load error:', err);
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        };

        loadWaveform();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [vocalUrl]);

    // Draw waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = Math.ceil(trackDurationMs * pxPerMs);

        // Resize canvas if needed
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);

        if (!waveformData) return;

        const data = waveformData;
        const len = data.length;
        if (len === 0) return;

        ctx.fillStyle = color;
        ctx.beginPath();

        // Draw logic
        for (let x = 0; x < width; x++) {
            // Nearest neighbor mapping
            const i = Math.floor((x / width) * len);
            const val = data[i] || 0;

            const barHeight = Math.max(1, val * height);
            const y = (height - barHeight) / 2;

            ctx.fillRect(x, y, 1, barHeight);
        }

    }, [waveformData, pxPerMs, trackDurationMs, height, color]);

    return (
        <div ref={containerRef} className={`relative select-none pointer-events-none ${className || ''}`} style={{ height }}>
            <canvas ref={canvasRef} height={height} />

            {/* Status Layer */}
            {(isLoading || error) && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full">
                            <Activity className="animate-spin text-emerald-500" size={12} />
                            <span className="text-[10px] text-slate-400">LOADING WAVEFORM...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-rose-900/50 rounded-full border border-rose-500/30" title={error}>
                            <AlertTriangle className="text-rose-400" size={12} />
                            <span className="text-[10px] text-rose-300 max-w-[200px] truncate">
                                {error || "WAVEFORM ERROR"}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
