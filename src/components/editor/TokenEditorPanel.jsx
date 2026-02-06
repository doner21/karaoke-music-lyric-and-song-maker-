/**
 * Token Editor Panel
 * 
 * Main editor panel component that replaces COL 2 content when in edit mode.
 * Provides token timeline, toolbar, and validation panel.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Undo2, Redo2, Save, X, Copy, Download, Upload,
    AlertTriangle, ChevronDown, ChevronUp, ZoomIn, ZoomOut,
    ToggleLeft, ToggleRight, Play, Pause, Square
} from 'lucide-react';
import { useTokenEditor } from '../../editor/useTokenEditor.js';
import TokenTimeline from './TokenTimeline.jsx';
import ValidationPanel from './ValidationPanel.jsx';
import TokenContextMenu from './TokenContextMenu.jsx';
import InlineTextEditor from './InlineTextEditor.jsx';
import KaraokeLyricsDisplay from '../lyrics/KaraokeLyricsDisplay';
import { tokensToExportJSON } from '../../editor/jsonAdapters.js';

/**
 * @param {Object} props
 * @param {Object} props.lyricsJson - The canonical lyrics JSON to edit
 * @param {number} props.trackDurationMs - Total track duration in milliseconds
 * @param {string|null} props.vocalUrl - URL to vocal stem
 * @param {Object} props.audioManagerRef - Ref to AudioStemManager
 * @param {Function} props.onApply - Called with updated JSON when user clicks Apply
 * @param {Function} props.onDiscard - Called when user clicks Discard
 */
export default function TokenEditorPanel({
    lyricsJson,
    trackDurationMs,
    vocalUrl,
    audioManagerRef,
    onApply,
    onDiscard
}) {
    // Default track duration if not provided
    const effectiveTrackDuration = trackDurationMs || 300000; // 5 minutes default

    // Initialize editor hook
    const editor = useTokenEditor(lyricsJson, effectiveTrackDuration);

    // UI State
    const [pxPerMs, setPxPerMs] = useState(0.169); // 169px per second
    const [scrollLeftMs, setScrollLeftMs] = useState(0);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, tokenId: null });
    const [editingTokenId, setEditingTokenId] = useState(null);
    const [wordLengthTokenId, setWordLengthTokenId] = useState(null);
    const [validationPanelOpen, setValidationPanelOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTimeMs, setCurrentTimeMs] = useState(0);
    const rafRef = useRef(null);

    const panelRef = useRef(null);

    // Derive canonical JSON for lyrics preview (only recomputes when tokens change)
    const previewJson = useMemo(() => {
        if (!editor.tokens || editor.tokens.length === 0) return null;
        return tokensToExportJSON(editor.tokens, {});
    }, [editor.tokens]);

    // --- Playback Logic ---

    // Sync play state with manager and start/stop loop
    useEffect(() => {
        if (isPlaying) {
            const loop = () => {
                if (audioManagerRef?.current) {
                    const time = audioManagerRef.current.getCurrentTime();
                    setCurrentTimeMs(time * 1000);
                }
                rafRef.current = requestAnimationFrame(loop);
            };
            rafRef.current = requestAnimationFrame(loop);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying, audioManagerRef]);

    const handlePlay = useCallback(async () => {
        if (audioManagerRef?.current && vocalUrl) {
            // Ensure audio is loaded if needed (though IntegratedOS should handle loading)
            // Assuming loaded for now
            await audioManagerRef.current.play(currentTimeMs / 1000);
            setIsPlaying(true);
        }
    }, [audioManagerRef, vocalUrl, currentTimeMs]);

    const handlePause = useCallback(() => {
        if (audioManagerRef?.current) {
            audioManagerRef.current.pause();
            setIsPlaying(false);
        }
    }, [audioManagerRef]);

    const handleStop = useCallback(() => {
        if (audioManagerRef?.current) {
            audioManagerRef.current.stop();
            setIsPlaying(false);
            setCurrentTimeMs(0);
        }
    }, [audioManagerRef]);

    // Handle timeline click to seek
    const handleTimelineClick = useCallback((ms) => {
        setCurrentTimeMs(ms);
        if (audioManagerRef?.current) {
            audioManagerRef.current.seekTo(ms / 1000);
        }
    }, [audioManagerRef]);

    // Handle Spacebar for Play/Pause
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only if panel focused or body focused (global shortcut if not editing text)
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (isPlaying) handlePause();
                else handlePlay();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, handlePlay, handlePause]);


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Word Length mode handles keys globally (focus may be on body after context menu)
            if (wordLengthTokenId) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const token = editor.tokens.find(t => t.id === wordLengthTokenId);
                    if (token) {
                        const step = e.shiftKey ? 100 : 10;
                        const delta = e.key === 'ArrowUp' ? step : -step;
                        const newEndMs = token.endMs + delta;
                        if (newEndMs > token.startMs + (editor.policy.minDurationMs || 50)) {
                            editor.resizeTokenEnd(wordLengthTokenId, newEndMs);
                        }
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setWordLengthTokenId(null);
                    return;
                }
            }

            // Only handle remaining shortcuts if panel is focused
            if (!panelRef.current?.contains(document.activeElement) && document.activeElement === document.body) {
                return;
            }

            const { selectedIds } = editor.selection;
            const hasSelection = selectedIds.size > 0;

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                editor.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                editor.redo();
                return;
            }

            // Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                editor.selectAll();
                return;
            }

            // Escape - clear selection or close context menu
            if (e.key === 'Escape') {
                e.preventDefault();
                if (contextMenu.visible) {
                    setContextMenu({ ...contextMenu, visible: false });
                } else if (editingTokenId) {
                    setEditingTokenId(null);
                } else {
                    editor.clearSelection();
                }
                return;
            }

            // Arrow keys - nudge
            if (hasSelection && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const step = e.shiftKey ? 100 : 10;
                const delta = e.key === 'ArrowLeft' ? -step : step;
                editor.nudgeTokens(selectedIds, delta);
                return;
            }

            // Delete/Backspace
            if (hasSelection && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault();
                editor.deleteTokens(selectedIds);
                return;
            }

            // Single selection shortcuts
            if (selectedIds.size === 1) {
                const tokenId = Array.from(selectedIds)[0];
                const token = editor.tokens.find(t => t.id === tokenId);

                // S - Split at midpoint
                if (e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    if (token) {
                        const midpoint = Math.round((token.startMs + token.endMs) / 2);
                        const textMid = Math.floor(token.text.length / 2);
                        editor.splitToken(tokenId, {
                            textLeft: token.text.slice(0, textMid) || token.text.charAt(0),
                            textRight: token.text.slice(textMid) || token.text.charAt(token.text.length - 1),
                            splitMs: midpoint,
                        });
                    }
                    return;
                }

                // E or F2 - Edit text
                if (e.key === 'e' || e.key === 'E' || e.key === 'F2') {
                    e.preventDefault();
                    setEditingTokenId(tokenId);
                    return;
                }
            }

            // M - Merge (multi-selection)
            if (selectedIds.size > 1 && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                const tokenIds = Array.from(selectedIds);
                editor.mergeTokens(tokenIds, 'space');
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, contextMenu, editingTokenId, wordLengthTokenId]);

    // Exit word-length mode if the token is deselected or selection changes
    useEffect(() => {
        if (wordLengthTokenId && !editor.selection.selectedIds.has(wordLengthTokenId)) {
            setWordLengthTokenId(null);
        }
    }, [editor.selection.selectedIds, wordLengthTokenId]);

    // Handle Apply
    const handleApply = useCallback(() => {
        const metadata = {
            title: lyricsJson?.title,
            artist: lyricsJson?.artist,
            method: lyricsJson?.method || 'edited',
        };
        const exportedJson = editor.exportJSON(metadata);
        onApply(exportedJson);
    }, [editor, lyricsJson, onApply]);

    // Handle Import
    const handleImport = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const json = JSON.parse(text);
                // Re-initialize with new data by reloading
                // For now, we'll just apply the imported data
                onApply(json);
            } catch (err) {
                console.error('Failed to import JSON:', err);
                alert('Failed to import JSON: ' + err.message);
            }
        };
        input.click();
    }, [onApply]);

    // Handle Export
    const handleExport = useCallback(() => {
        const metadata = {
            title: lyricsJson?.title,
            artist: lyricsJson?.artist,
            method: lyricsJson?.method || 'edited',
        };
        const exportedJson = editor.exportJSON(metadata);
        const blob = new Blob([JSON.stringify(exportedJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lyricsJson?.title || 'lyrics'}-timing.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [editor, lyricsJson]);

    // Handle Copy
    const handleCopy = useCallback(async () => {
        const metadata = {
            title: lyricsJson?.title,
            artist: lyricsJson?.artist,
            method: lyricsJson?.method || 'edited',
        };
        const exportedJson = editor.exportJSON(metadata);
        try {
            await navigator.clipboard.writeText(JSON.stringify(exportedJson, null, 2));
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [editor, lyricsJson]);

    // Zoom controls
    const handleZoomIn = useCallback(() => {
        setPxPerMs(prev => Math.min(0.5, prev * 1.5));
    }, []);

    const handleZoomOut = useCallback(() => {
        setPxPerMs(prev => Math.max(0.01, prev / 1.5));
    }, []);

    // Context menu handlers
    const handleContextMenu = useCallback((e, tokenId) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            tokenId,
        });
    }, []);

    const handleContextAction = useCallback((action) => {
        const { tokenId } = contextMenu;
        const { selectedIds } = editor.selection;

        switch (action) {
            case 'edit':
                setEditingTokenId(tokenId);
                break;
            case 'word-length':
                setWordLengthTokenId(tokenId);
                editor.selectToken(tokenId, 'replace');
                // Focus the panel so keyboard events (ArrowUp/Down) are captured
                setTimeout(() => panelRef.current?.focus(), 0);
                break;
            case 'split': {
                const token = editor.tokens.find(t => t.id === tokenId);
                if (token) {
                    const midpoint = Math.round((token.startMs + token.endMs) / 2);
                    const textMid = Math.floor(token.text.length / 2);
                    editor.splitToken(tokenId, {
                        textLeft: token.text.slice(0, textMid) || token.text.charAt(0),
                        textRight: token.text.slice(textMid) || token.text.charAt(token.text.length - 1),
                        splitMs: midpoint,
                    });
                }
                break;
            }
            case 'merge':
                if (selectedIds.size > 1) {
                    editor.mergeTokens(Array.from(selectedIds), 'space');
                }
                break;
            case 'insert-before':
                editor.insertToken(tokenId, 'before', 'new', 'zero_duration');
                break;
            case 'insert-after':
                editor.insertToken(tokenId, 'after', 'new', 'zero_duration');
                break;
            case 'delete':
                editor.deleteTokens(selectedIds.size > 0 ? selectedIds : new Set([tokenId]));
                break;
        }

        setContextMenu({ ...contextMenu, visible: false });
    }, [contextMenu, editor]);

    // Selection handlers
    const handleSelectToken = useCallback((tokenId, e) => {
        let mode = 'replace';
        if (e.ctrlKey || e.metaKey) mode = 'toggle';
        else if (e.shiftKey) mode = 'range';
        editor.selectToken(tokenId, mode);
    }, [editor]);

    // Text edit commit
    const handleTextCommit = useCallback((tokenId, newText) => {
        editor.editTokenText(tokenId, newText);
        setEditingTokenId(null);
    }, [editor]);

    // Go to token (from validation panel)
    const handleGoToToken = useCallback((tokenId) => {
        editor.selectToken(tokenId, 'replace');
        const token = editor.tokens.find(t => t.id === tokenId);
        if (token) {
            // Scroll to token
            setScrollLeftMs(Math.max(0, token.startMs - 5000)); // 5 second buffer
        }
    }, [editor]);

    // Format time for display
    const formatTime = (ms) => {
        const s = ms / 1000;
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const dec = Math.floor((s % 1) * 10);
        return `${m}:${sec.toString().padStart(2, '0')}.${dec}`;
    };

    return (
        <div
            ref={panelRef}
            className="flex flex-col h-full bg-gray-900 text-gray-100"
            tabIndex={0}
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 p-2 bg-gray-800 border-b border-gray-700">
                {/* Left: Playback + History */}
                <div className="flex items-center gap-2">
                    {/* Playback Controls */}
                    <div className="flex items-center gap-1 bg-gray-900/50 rounded p-1 mr-2">
                        <button
                            onClick={isPlaying ? handlePause : handlePlay}
                            className="p-1.5 rounded hover:bg-gray-700 text-emerald-400"
                            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button
                            onClick={handleStop}
                            className="p-1.5 rounded hover:bg-gray-700 text-rose-400"
                            title="Stop"
                        >
                            <Square size={16} fill="currentColor" />
                        </button>
                        <span className="font-mono text-xs text-gray-400 min-w-[60px] text-center">
                            {formatTime(currentTimeMs)}
                        </span>
                    </div>

                    <div className="h-4 w-px bg-gray-700 mx-1" />

                    <button
                        onClick={editor.undo}
                        disabled={!editor.canUndo}
                        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        onClick={editor.redo}
                        disabled={!editor.canRedo}
                        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={16} />
                    </button>

                    <div className="h-4 w-px bg-gray-700 mx-1" />

                    {/* Policy Toggles */}
                    <button
                        onClick={() => editor.setPolicy({ allowOverlaps: !editor.policy.allowOverlaps })}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editor.policy.allowOverlaps ? 'bg-amber-700/50 text-amber-300' : 'bg-gray-700 text-gray-400'
                            }`}
                        title="Allow Overlaps"
                    >
                        {editor.policy.allowOverlaps ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        Overlaps
                    </button>
                    <button
                        onClick={() => editor.setPolicy({ rippleEnabled: !editor.policy.rippleEnabled })}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editor.policy.rippleEnabled ? 'bg-cyan-700/50 text-cyan-300' : 'bg-gray-700 text-gray-400'
                            }`}
                        title="Enable Ripple"
                    >
                        {editor.policy.rippleEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        Ripple
                    </button>

                    <div className="h-4 w-px bg-gray-700 mx-1" />

                    {/* Import/Export */}
                    <button
                        onClick={handleImport}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
                        title="Import JSON"
                    >
                        <Upload size={16} />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
                        title="Export JSON"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={handleCopy}
                        className={`p-1.5 rounded hover:bg-gray-700 ${copyFeedback ? 'text-green-400' : 'text-gray-400'}`}
                        title="Copy JSON to Clipboard"
                    >
                        <Copy size={16} />
                    </button>

                    {/* Validation Badge */}
                    {editor.issues.length > 0 && (
                        <button
                            onClick={() => setValidationPanelOpen(!validationPanelOpen)}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-900/50 text-red-300"
                        >
                            <AlertTriangle size={12} />
                            {editor.issues.length}
                        </button>
                    )}
                </div>

                {/* Right: Apply/Discard */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onDiscard}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                    >
                        <X size={14} />
                        Discard
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-green-700 hover:bg-green-600 text-white font-semibold"
                    >
                        <Save size={14} />
                        Apply
                    </button>
                </div>
            </div>

            {/* Lyrics Preview - positioned prominently above timeline */}
            {previewJson && (
                <div
                    style={{ height: '280px', minHeight: '280px', flexShrink: 0 }}
                    className="bg-gray-950 border-b-2 border-emerald-700/50 relative"
                >
                    <div className="absolute top-2 left-3 text-[10px] font-semibold tracking-widest text-emerald-600 uppercase select-none z-10">
                        Lyrics Preview
                    </div>
                    <KaraokeLyricsDisplay
                        timingJson={previewJson}
                        audioRef={null}
                        currentTime={currentTimeMs / 1000}
                        highlightColor="#7CB87C"
                        fontSize={26}
                        linesPerPage={4}
                        trackDuration={effectiveTrackDuration / 1000}
                    />
                </div>
            )}

            {/* Timeline Area */}
            <div className="flex-1 overflow-hidden relative">
                <TokenTimeline
                    tokens={editor.tokens}
                    selection={editor.selection}
                    issues={editor.issues}
                    pxPerMs={pxPerMs}
                    scrollLeftMs={scrollLeftMs}
                    trackDurationMs={effectiveTrackDuration}
                    vocalUrl={vocalUrl}
                    editingTokenId={editingTokenId}
                    wordLengthTokenId={wordLengthTokenId}
                    currentTimeMs={currentTimeMs}
                    isPlaying={isPlaying}
                    onTimelineClick={handleTimelineClick}
                    onSelectToken={handleSelectToken}
                    onMoveTokens={(selectionIds, deltaMs) => editor.moveTokens(selectionIds, deltaMs)}
                    onResizeStart={(tokenId, newStartMs) => editor.resizeTokenStart(tokenId, newStartMs)}
                    onResizeEnd={(tokenId, newEndMs) => editor.resizeTokenEnd(tokenId, newEndMs)}
                    onContextMenu={handleContextMenu}
                    onEditText={(tokenId) => setEditingTokenId(tokenId)}
                    onTextCommit={handleTextCommit}
                    onTextCancel={() => setEditingTokenId(null)}
                    onScrollChange={setScrollLeftMs}
                />
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between p-2 bg-gray-800 border-t border-gray-700 text-xs">
                {/* Selection Info */}
                <div className="text-gray-400">
                    {wordLengthTokenId ? (
                        <span className="text-amber-300 font-semibold">Word Length mode — ↑ lengthen / ↓ shorten (Shift for 100ms) · Esc to exit</span>
                    ) : editor.selection.selectedIds.size > 0 ? (
                        <span>{editor.selection.selectedIds.size} selected</span>
                    ) : (
                        <span>{editor.tokens.length} tokens</span>
                    )}
                    {editor.isDirty && <span className="ml-2 text-amber-400">• Unsaved changes</span>}
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                    <button onClick={handleZoomOut} className="p-1 rounded hover:bg-gray-700">
                        <ZoomOut size={14} />
                    </button>
                    <span className="text-gray-500 w-16 text-center">
                        {Math.round(pxPerMs * 1000)}px/s
                    </span>
                    <button onClick={handleZoomIn} className="p-1 rounded hover:bg-gray-700">
                        <ZoomIn size={14} />
                    </button>
                </div>
            </div>

            {/* Validation Panel */}
            {validationPanelOpen && (
                <ValidationPanel
                    issues={editor.issues}
                    isOpen={validationPanelOpen}
                    onToggle={() => setValidationPanelOpen(!validationPanelOpen)}
                    onGoToToken={handleGoToToken}
                />
            )}

            {/* Context Menu */}
            <TokenContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                visible={contextMenu.visible}
                selectedCount={editor.selection.selectedIds.size}
                onAction={handleContextAction}
                onClose={() => setContextMenu({ ...contextMenu, visible: false })}
            />
        </div>
    );
}
