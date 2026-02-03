/**
 * Inline Text Editor Component
 * 
 * Text input overlay for editing token text directly on the timeline.
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * @param {Object} props
 * @param {Token} props.token
 * @param {number} props.pxPerMs
 * @param {Function} props.onCommit - (newText: string)
 * @param {Function} props.onCancel
 */
export default function InlineTextEditor({ token, pxPerMs, onCommit, onCancel }) {
    const [text, setText] = useState(token.text);
    const inputRef = useRef(null);

    const left = token.startMs * pxPerMs;
    const width = Math.max((token.endMs - token.startMs) * pxPerMs, 80); // Min width for editing

    useEffect(() => {
        // Focus and select all on mount
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(text);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
        // Stop propagation to prevent timeline shortcuts
        e.stopPropagation();
    };

    const handleBlur = () => {
        // Commit on blur (clicking away)
        if (text !== token.text) {
            onCommit(text);
        } else {
            onCancel();
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="absolute top-1 bottom-1 
        bg-white text-gray-900 
        text-[11px] font-medium 
        px-1 py-0 
        rounded-sm border-2 border-cyan-400
        outline-none
        z-20"
            style={{
                left: `${left}px`,
                width: `${width}px`,
            }}
        />
    );
}
