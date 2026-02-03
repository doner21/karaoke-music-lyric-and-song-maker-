/**
 * useTokenEditor React Hook
 * 
 * Central hook for token editing that wires together:
 * - Token model
 * - Transform functions
 * - Undo/redo stack
 * - Selection state
 * - Validation
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { DEFAULT_POLICY } from './tokenModel.js';
import { parseJSONToTokens, tokensToExportJSON } from './jsonAdapters.js';
import {
    moveTokens,
    resizeTokenStart,
    resizeTokenEnd,
    nudgeTokens,
    editTokenText,
    insertToken,
    deleteTokens,
    splitToken,
    mergeTokens,
    validateTokens,
    applyRipple,
} from './tokenTransforms.js';
import { createUndoStack } from './undoStack.js';

/**
 * @param {Object} initialLyricsJson - The canonical lyrics JSON to edit
 * @param {number} trackDurationMs - Total track duration in milliseconds
 * @returns {Object} - Editor state and actions
 */
export function useTokenEditor(initialLyricsJson, trackDurationMs = Infinity) {
    // 1. Parse initial tokens
    const initialTokens = useMemo(
        () => {
            try {
                return parseJSONToTokens(initialLyricsJson);
            } catch {
                return [];
            }
        },
        [initialLyricsJson]
    );

    // 2. Create undo stack (use useRef so it persists across renders)
    const undoStackRef = useRef(null);
    if (undoStackRef.current === null) {
        undoStackRef.current = createUndoStack(initialTokens);
    }

    // 3. Token state (driven by undo stack)
    const [tokens, setTokens] = useState(initialTokens);

    // 4. Selection state
    const [selection, setSelection] = useState({
        selectedIds: new Set(),
        lastClickedId: null,
    });

    // 5. Policy state
    const [policy, setPolicyState] = useState(DEFAULT_POLICY);

    // 6. Derived: validation issues
    const issues = useMemo(
        () => validateTokens(tokens, trackDurationMs, policy),
        [tokens, trackDurationMs, policy]
    );

    // 7. Derived: isDirty
    const isDirty = undoStackRef.current.canUndo();
    const canUndo = undoStackRef.current.canUndo();
    const canRedo = undoStackRef.current.canRedo();

    // 8. Action helper - applies a transform and updates state
    const applyTransform = useCallback((transformFn) => {
        const newTokens = transformFn(tokens);
        undoStackRef.current.push(newTokens);
        setTokens(newTokens);
    }, [tokens]);

    // ============================================================================
    // TOKEN ACTIONS (push to undo stack)
    // ============================================================================

    const moveTokensFn = useCallback((selectionIds, deltaMs) => {
        applyTransform(t => moveTokens(t, selectionIds, deltaMs, policy));
    }, [applyTransform, policy]);

    const resizeTokenStartFn = useCallback((tokenId, newStartMs) => {
        applyTransform(t => resizeTokenStart(t, tokenId, newStartMs, policy));
    }, [applyTransform, policy]);

    const resizeTokenEndFn = useCallback((tokenId, newEndMs) => {
        applyTransform(t => resizeTokenEnd(t, tokenId, newEndMs, policy));
    }, [applyTransform, policy]);

    const nudgeTokensFn = useCallback((selectionIds, stepMs) => {
        applyTransform(t => nudgeTokens(t, selectionIds, stepMs, policy));
    }, [applyTransform, policy]);

    const editTokenTextFn = useCallback((tokenId, newText) => {
        applyTransform(t => editTokenText(t, tokenId, newText));
    }, [applyTransform]);

    const insertTokenFn = useCallback((anchorTokenId, position, text, timingStrategy = 'zero_duration') => {
        applyTransform(t => insertToken(t, anchorTokenId, position, text, timingStrategy, policy));
    }, [applyTransform, policy]);

    const deleteTokensFn = useCallback((selectionIds) => {
        applyTransform(t => deleteTokens(t, selectionIds, policy));
        // Clear selection for deleted tokens
        setSelection(prev => ({
            ...prev,
            selectedIds: new Set([...prev.selectedIds].filter(id =>
                !selectionIds.has?.(id) && !selectionIds.includes?.(id)
            )),
        }));
    }, [applyTransform, policy]);

    const splitTokenFn = useCallback((tokenId, splitPoint) => {
        applyTransform(t => splitToken(t, tokenId, splitPoint, policy));
        // Clear selection (the original token no longer exists)
        setSelection(prev => ({
            ...prev,
            selectedIds: new Set([...prev.selectedIds].filter(id => id !== tokenId)),
        }));
    }, [applyTransform, policy]);

    const mergeTokensFn = useCallback((tokenIds, joinStrategy = 'space') => {
        applyTransform(t => mergeTokens(t, tokenIds, joinStrategy));
        // Clear selection (merged tokens no longer exist)
        const mergeSet = new Set(tokenIds);
        setSelection(prev => ({
            ...prev,
            selectedIds: new Set([...prev.selectedIds].filter(id => !mergeSet.has(id))),
        }));
    }, [applyTransform]);

    const applyRippleFn = useCallback((fromTokenId, deltaMs, direction) => {
        applyTransform(t => applyRipple(t, fromTokenId, deltaMs, direction));
    }, [applyTransform]);

    // ============================================================================
    // SELECTION ACTIONS (do NOT push to undo stack)
    // ============================================================================

    const selectToken = useCallback((tokenId, mode = 'replace') => {
        setSelection(prev => {
            const newSelectedIds = new Set(prev.selectedIds);

            if (mode === 'replace') {
                // Clear and select only this token
                newSelectedIds.clear();
                newSelectedIds.add(tokenId);
            } else if (mode === 'toggle') {
                // Toggle selection (Ctrl+click)
                if (newSelectedIds.has(tokenId)) {
                    newSelectedIds.delete(tokenId);
                } else {
                    newSelectedIds.add(tokenId);
                }
            } else if (mode === 'range') {
                // Range select (Shift+click)
                const lastId = prev.lastClickedId;
                if (!lastId) {
                    // No previous selection, just select this one
                    newSelectedIds.add(tokenId);
                } else {
                    // Find tokens between last clicked and current
                    const lastToken = tokens.find(t => t.id === lastId);
                    const currentToken = tokens.find(t => t.id === tokenId);

                    if (lastToken && currentToken && lastToken.lineIndex === currentToken.lineIndex) {
                        // Same line - select range
                        const lineTokens = tokens
                            .filter(t => t.lineIndex === lastToken.lineIndex)
                            .sort((a, b) => a.startMs - b.startMs);

                        const lastIdx = lineTokens.findIndex(t => t.id === lastId);
                        const currentIdx = lineTokens.findIndex(t => t.id === tokenId);

                        const startIdx = Math.min(lastIdx, currentIdx);
                        const endIdx = Math.max(lastIdx, currentIdx);

                        for (let i = startIdx; i <= endIdx; i++) {
                            newSelectedIds.add(lineTokens[i].id);
                        }
                    } else {
                        // Different lines - just toggle this one
                        newSelectedIds.add(tokenId);
                    }
                }
            }

            return {
                selectedIds: newSelectedIds,
                lastClickedId: tokenId,
            };
        });
    }, [tokens]);

    const selectAll = useCallback(() => {
        setSelection({
            selectedIds: new Set(tokens.map(t => t.id)),
            lastClickedId: null,
        });
    }, [tokens]);

    const clearSelection = useCallback(() => {
        setSelection({
            selectedIds: new Set(),
            lastClickedId: null,
        });
    }, []);

    // ============================================================================
    // POLICY ACTIONS
    // ============================================================================

    const setPolicy = useCallback((partialPolicy) => {
        setPolicyState(prev => ({ ...prev, ...partialPolicy }));
    }, []);

    // ============================================================================
    // HISTORY ACTIONS
    // ============================================================================

    const undo = useCallback(() => {
        const prev = undoStackRef.current.undo();
        if (prev) {
            setTokens(prev);
        }
    }, []);

    const redo = useCallback(() => {
        const next = undoStackRef.current.redo();
        if (next) {
            setTokens(next);
        }
    }, []);

    // ============================================================================
    // EXPORT ACTIONS
    // ============================================================================

    const exportJSON = useCallback((metadata = {}) => {
        return tokensToExportJSON(tokens, metadata);
    }, [tokens]);

    const getTokens = useCallback(() => {
        return tokens;
    }, [tokens]);

    // ============================================================================
    // RETURN INTERFACE
    // ============================================================================

    return {
        // State
        tokens,
        selection,
        policy,
        issues,
        isDirty,

        // Token Actions
        moveTokens: moveTokensFn,
        resizeTokenStart: resizeTokenStartFn,
        resizeTokenEnd: resizeTokenEndFn,
        nudgeTokens: nudgeTokensFn,
        editTokenText: editTokenTextFn,
        insertToken: insertTokenFn,
        deleteTokens: deleteTokensFn,
        splitToken: splitTokenFn,
        mergeTokens: mergeTokensFn,
        applyRipple: applyRippleFn,

        // Selection Actions
        selectToken,
        selectAll,
        clearSelection,

        // Policy
        setPolicy,

        // History
        undo,
        redo,
        canUndo,
        canRedo,

        // Export
        exportJSON,
        getTokens,
    };
}
