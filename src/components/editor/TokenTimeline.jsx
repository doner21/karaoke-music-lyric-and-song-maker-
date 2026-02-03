/**
 * Token Timeline View
 * 
 * Renders tokens as horizontal blocks on a time axis.
 * Supports selection, drag-to-move, edge resize, and scrolling.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import TokenBlock from './TokenBlock.jsx';
import InlineTextEditor from './InlineTextEditor.jsx';
import VocalWaveform from './VocalWaveform.jsx';

/**
 * @param {Object} props
 * @param {Token[]} props.tokens
 * @param {Object} props.selection - { selectedIds: Set, lastClickedId }
 * @param {ValidationIssue[]} props.issues
 * @param {number} props.pxPerMs - Zoom level
 * @param {number} props.scrollLeftMs - Scroll position
 * @param {number} props.trackDurationMs
 * @param {string|null} props.editingTokenId
 * @param {Function} props.onSelectToken
 * @param {Function} props.onMoveTokens
 * @param {Function} props.onResizeStart
 * @param {Function} props.onResizeEnd
 * @param {Function} props.onContextMenu
 * @param {Function} props.onEditText
 * @param {Function} props.onTextCommit
 * @param {Function} props.onTextCancel
 * @param {Function} props.onScrollChange
 */
export default function TokenTimeline({
    tokens,
    selection,
    issues,
    pxPerMs,
    scrollLeftMs,
    trackDurationMs,
    vocalUrl,
    editingTokenId,
    currentTimeMs, // New prop
    onTimelineClick, // New prop
    onSelectToken,
    onMoveTokens,
    onResizeStart,
    onResizeEnd,
    onContextMenu,
    onEditText,
    onTextCommit,
    onTextCancel,
    onScrollChange,
}) {
    const containerRef = useRef(null);
    const [dragState, setDragState] = useState(null);
    // { type: 'move' | 'resize-start' | 'resize-end', tokenId, initialX, initialMs }

    // Sort tokens by startMs for single-lane display
    const sortedTokens = useMemo(() => {
        return [...tokens].sort((a, b) => a.startMs - b.startMs);
    }, [tokens]);

    // Create issue lookup
    const issuesByToken = useMemo(() => {
        const map = new Map();
        for (const issue of issues) {
            if (!map.has(issue.tokenId)) {
                map.set(issue.tokenId, []);
            }
            map.get(issue.tokenId).push(issue);
        }
        return map;
    }, [issues]);

    // Total timeline width
    const timelineWidth = trackDurationMs * pxPerMs;

    // Handle scroll
    const handleScroll = useCallback((e) => {
        const newScrollMs = e.target.scrollLeft / pxPerMs;
        onScrollChange(newScrollMs);
    }, [pxPerMs, onScrollChange]);

    // Handle click on timeline background (seek)
    const handleTimelineClick = useCallback((e) => {
        // Only handle if click is directly on the scroll container or track area
        // (Bubbled events from tokens should be handled by token handlers)
        if (e.target === containerRef.current || e.target.closest('.timeline-track-area')) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const ms = x / pxPerMs;
            if (onTimelineClick) {
                onTimelineClick(ms);
            }
        }
    }, [pxPerMs, onTimelineClick]);

    // Mouse handlers for drag operations
    const handleMouseDown = useCallback((e, tokenId, zone) => {
        if (zone === 'body') {
            e.preventDefault();
            e.stopPropagation(); // Prevent timeline seek click
            const token = tokens.find(t => t.id === tokenId);
            if (!token) return;

            setDragState({
                type: 'move',
                tokenId,
                initialX: e.clientX,
                initialStartMs: token.startMs,
            });
        } else if (zone === 'left-edge') {
            e.preventDefault();
            e.stopPropagation();
            const token = tokens.find(t => t.id === tokenId);
            if (!token) return;

            setDragState({
                type: 'resize-start',
                tokenId,
                initialX: e.clientX,
                initialStartMs: token.startMs,
            });
        } else if (zone === 'right-edge') {
            e.preventDefault();
            e.stopPropagation();
            const token = tokens.find(t => t.id === tokenId);
            if (!token) return;

            setDragState({
                type: 'resize-end',
                tokenId,
                initialX: e.clientX,
                initialEndMs: token.endMs,
            });
        }
    }, [tokens]);

    const handleMouseMove = useCallback((e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.initialX;
        const deltaMs = deltaX / pxPerMs;

        // We don't commit during move - just preview
        // Actual commit happens on mouseup
    }, [dragState, pxPerMs]);

    const handleMouseUp = useCallback((e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.initialX;
        const deltaMs = Math.round(deltaX / pxPerMs);

        if (dragState.type === 'move') {
            if (Math.abs(deltaMs) > 0) {
                onMoveTokens(selection.selectedIds.size > 0 ? selection.selectedIds : new Set([dragState.tokenId]), deltaMs);
            }
        } else if (dragState.type === 'resize-start') {
            const newStartMs = dragState.initialStartMs + deltaMs;
            onResizeStart(dragState.tokenId, newStartMs);
        } else if (dragState.type === 'resize-end') {
            const newEndMs = dragState.initialEndMs + deltaMs;
            onResizeEnd(dragState.tokenId, newEndMs);
        }

        setDragState(null);
    }, [dragState, pxPerMs, selection.selectedIds, onMoveTokens, onResizeStart, onResizeEnd]);

    // Generate time axis ticks
    const timeTicks = useMemo(() => {
        const ticks = [];
        const secondsVisible = trackDurationMs / 1000;

        // Major ticks every 10 seconds
        for (let s = 0; s <= secondsVisible; s += 10) {
            const minutes = Math.floor(s / 60);
            const secs = s % 60;
            ticks.push({
                ms: s * 1000,
                label: `${minutes}:${secs.toString().padStart(2, '0')}`,
                major: true,
            });
        }

        // Minor ticks every second (if zoomed in enough)
        if (pxPerMs >= 0.02) {
            for (let s = 0; s <= secondsVisible; s += 1) {
                if (s % 10 !== 0) {
                    ticks.push({
                        ms: s * 1000,
                        label: null,
                        major: false,
                    });
                }
            }
        }

        return ticks.sort((a, b) => a.ms - b.ms);
    }, [trackDurationMs, pxPerMs]);

    const LANE_HEIGHT = 50; // Taller for single lane
    const AXIS_HEIGHT = 24;

    return (
        <div
            className="h-full overflow-auto bg-gray-950 relative select-none"
            ref={containerRef}
            onScroll={handleScroll}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setDragState(null)}
            onClick={handleTimelineClick}
        >
            {/* Scrollable timeline area */}
            <div
                className="timeline-track-area relative flex flex-col"
                style={{ width: timelineWidth, minHeight: '100%' }}
            >
                {/* Time Axis */}
                <div className="sticky top-0 z-30 h-6 bg-gray-900 border-b border-gray-800 shrink-0">
                    {timeTicks.map((tick, i) => (
                        <div
                            key={i}
                            className="absolute"
                            style={{ left: tick.ms * pxPerMs }}
                        >
                            <div
                                className={`w-px ${tick.major ? 'h-4 bg-gray-600' : 'h-2 bg-gray-700'}`}
                            />
                            {tick.label && (
                                <span className="absolute top-4 text-[9px] text-gray-500 font-mono -translate-x-1/2">
                                    {tick.label}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Main Content Area - Stacked vertically */}

                {/* Lane 1: Tokens */}
                <div className="relative z-10 shrink-0 border-b border-gray-800/50" style={{ height: LANE_HEIGHT + 20 }}>
                    {sortedTokens.map(token => (
                        <React.Fragment key={token.id}>
                            <TokenBlock
                                token={token}
                                isSelected={selection.selectedIds.has(token.id)}
                                hasIssue={issuesByToken.has(token.id)}
                                pxPerMs={pxPerMs}
                                onMouseDown={(e, zone) => handleMouseDown(e, token.id, zone)}
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent seek
                                    onSelectToken(token.id, e);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    onEditText(token.id);
                                }}
                                onContextMenu={(e) => onContextMenu(e, token.id)}
                            />

                            {/* Inline Editor */}
                            {editingTokenId === token.id && (
                                <InlineTextEditor
                                    token={token}
                                    pxPerMs={pxPerMs}
                                    onCommit={(newText) => onTextCommit(token.id, newText)}
                                    onCancel={onTextCancel}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Lane 2: Waveform (Below) */}
                <div className="relative shrink-0 border-b border-gray-900 bg-gray-950/50">
                    <VocalWaveform
                        vocalUrl={vocalUrl}
                        pxPerMs={pxPerMs}
                        trackDurationMs={trackDurationMs}
                        height={300} // Much taller
                        color="#10b981" // emerald-500
                        className="opacity-90"
                    />
                </div>

                {/* Playhead Overlay */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    style={{ left: currentTimeMs * pxPerMs }}
                >
                    <div className="w-2.5 h-2.5 -ml-1 bg-red-500 transform rotate-45 -mt-1" />
                </div>
            </div>
        </div >
    );
}
