/**
 * Undo/Redo Stack for Karaoke Lyrics Editor
 * 
 * Stores full snapshots of token arrays for simple and reliable undo/redo.
 * Maximum stack depth of 500 entries to prevent memory issues.
 */

/**
 * Create an undo/redo stack
 * @param {Token[]} initialState - Initial token array
 * @param {number} maxDepth - Maximum stack depth (default: 500)
 * @returns {Object} - Stack interface
 */
export function createUndoStack(initialState, maxDepth = 500) {
    let currentState = initialState;
    const undoStack = [];
    const redoStack = [];

    return {
        /**
         * Get current state
         * @returns {Token[]}
         */
        getState() {
            return currentState;
        },

        /**
         * Push a new state onto the stack
         * Saves current state to undo stack and clears redo stack
         * @param {Token[]} newState
         */
        push(newState) {
            // Save current to undo
            undoStack.push(currentState);

            // Enforce max depth by removing oldest entry
            while (undoStack.length > maxDepth) {
                undoStack.shift();
            }

            // Clear redo (new timeline)
            redoStack.length = 0;

            // Set new current
            currentState = newState;
        },

        /**
         * Undo the last change
         * @returns {Token[]|null} - Previous state, or null if nothing to undo
         */
        undo() {
            if (undoStack.length === 0) {
                return null;
            }

            // Save current to redo
            redoStack.push(currentState);

            // Pop from undo
            currentState = undoStack.pop();

            return currentState;
        },

        /**
         * Redo the last undone change
         * @returns {Token[]|null} - Redone state, or null if nothing to redo
         */
        redo() {
            if (redoStack.length === 0) {
                return null;
            }

            // Save current to undo
            undoStack.push(currentState);

            // Pop from redo
            currentState = redoStack.pop();

            return currentState;
        },

        /**
         * Check if undo is possible
         * @returns {boolean}
         */
        canUndo() {
            return undoStack.length > 0;
        },

        /**
         * Check if redo is possible
         * @returns {boolean}
         */
        canRedo() {
            return redoStack.length > 0;
        },

        /**
         * Clear both stacks (keeps current state)
         */
        clear() {
            undoStack.length = 0;
            redoStack.length = 0;
        },

        /**
         * Get undo stack size (for testing)
         * @returns {number}
         */
        getUndoStackSize() {
            return undoStack.length;
        },

        /**
         * Get redo stack size (for testing)
         * @returns {number}
         */
        getRedoStackSize() {
            return redoStack.length;
        },
    };
}
