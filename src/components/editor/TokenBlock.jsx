/**
 * Token Block Component
 * 
 * Renders a single token as a visual block on the timeline.
 * Provides edge resize handles and selection styling.
 */

import React, { useRef, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {Token} props.token
 * @param {boolean} props.isSelected
 * @param {boolean} props.hasIssue
 * @param {number} props.pxPerMs
 * @param {Function} props.onMouseDown - (e, zone: 'body' | 'left-edge' | 'right-edge')
 * @param {Function} props.onClick
 * @param {Function} props.onDoubleClick
 * @param {Function} props.onContextMenu
 */
export default function TokenBlock({
    token,
    isSelected,
    hasIssue,
    isWordLengthActive,
    isActive, // True when playhead is within this token's time range
    pxPerMs,
    onMouseDown,
    onClick,
    onDoubleClick,
    onContextMenu,
}) {
    const blockRef = useRef(null);

    const width = (token.endMs - token.startMs) * pxPerMs;
    const left = token.startMs * pxPerMs;
    const minWidth = 20; // Minimum visual width

    const displayWidth = Math.max(width, minWidth);

    // Edge detection zones (in px from edge)
    const EDGE_ZONE = 6;

    const handleMouseDown = useCallback((e) => {
        if (!blockRef.current) return;

        const rect = blockRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        let zone = 'body';
        if (x < EDGE_ZONE) {
            zone = 'left-edge';
        } else if (x > rect.width - EDGE_ZONE) {
            zone = 'right-edge';
        }

        onMouseDown(e, zone);
    }, [onMouseDown]);

    // Visual styles based on state
    const getBackgroundClass = () => {
        if (isWordLengthActive) {
            return 'bg-amber-600/80 border-amber-300 ring-2 ring-amber-400 shadow-lg shadow-amber-500/50';
        }

        // Active glow when playhead is on this token
        const activeGlow = isActive
            ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/60'
            : '';

        if (hasIssue) {
            return isSelected
                ? `bg-red-700/80 border-red-400 ${activeGlow}`
                : `bg-red-900/60 border-red-600/50 ${activeGlow}`;
        }

        if (isActive) {
            return isSelected
                ? 'bg-emerald-600/90 border-emerald-300 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/60'
                : 'bg-emerald-700/80 border-emerald-400 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/60';
        }

        return isSelected
            ? 'bg-cyan-600/80 border-cyan-400'
            : 'bg-slate-700/80 border-slate-600/50';
    };

    // Cursor based on hover position (handled via CSS)
    const getCursor = () => {
        return 'cursor-grab';
    };

    return (
        <div
            ref={blockRef}
            className={`
        absolute top-1 bottom-1 
        rounded-sm border
        flex items-center justify-center
        overflow-hidden select-none
        ${getBackgroundClass()}
        ${getCursor()}
        group
        transition-colors duration-100
      `}
            style={{
                left: `${left}px`,
                width: `${displayWidth}px`,
            }}
            onMouseDown={handleMouseDown}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {/* Left resize handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-white/30 transition-colors"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e, 'left-edge');
                }}
            />

            {/* Token text */}
            <span
                className={`
          text-[10px] font-medium px-1 truncate
          ${isSelected ? 'text-white' : 'text-slate-200'}
        `}
                title={token.text}
            >
                {token.text}
            </span>

            {/* Right resize handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-white/30 transition-colors"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e, 'right-edge');
                }}
            />

            {/* Issue indicator */}
            {hasIssue && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-red-300" />
            )}
        </div>
    );
}
