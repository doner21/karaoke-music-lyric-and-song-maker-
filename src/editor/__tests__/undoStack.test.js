/**
 * Unit Tests for Undo/Redo Stack
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createUndoStack } from '../undoStack.js';

describe('createUndoStack', () => {
    let stack;
    const initialState = [{ id: '1', text: 'initial' }];

    beforeEach(() => {
        stack = createUndoStack(initialState);
    });

    describe('getState', () => {
        it('should return initial state', () => {
            expect(stack.getState()).toBe(initialState);
        });

        it('should return current state after push', () => {
            const newState = [{ id: '2', text: 'new' }];
            stack.push(newState);

            expect(stack.getState()).toBe(newState);
        });
    });

    describe('push', () => {
        it('should update current state', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);

            expect(stack.getState()).toBe(state2);
        });

        it('should allow undoing after push', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);

            expect(stack.canUndo()).toBe(true);
        });

        it('should clear redo stack', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();
            expect(stack.canRedo()).toBe(true);

            stack.push([{ id: '3', text: 'third' }]);
            expect(stack.canRedo()).toBe(false);
        });
    });

    describe('undo', () => {
        it('should return previous state', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);

            const result = stack.undo();
            expect(result).toBe(initialState);
        });

        it('should update getState to previous', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();

            expect(stack.getState()).toBe(initialState);
        });

        it('should return null when nothing to undo', () => {
            expect(stack.undo()).toBeNull();
        });

        it('should allow redoing after undo', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();

            expect(stack.canRedo()).toBe(true);
        });
    });

    describe('redo', () => {
        it('should return undone state', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);
            stack.undo();

            const result = stack.redo();
            expect(result).toBe(state2);
        });

        it('should update getState after redo', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);
            stack.undo();
            stack.redo();

            expect(stack.getState()).toBe(state2);
        });

        it('should return null when nothing to redo', () => {
            expect(stack.redo()).toBeNull();
        });
    });

    describe('canUndo / canRedo', () => {
        it('canUndo should be false initially', () => {
            expect(stack.canUndo()).toBe(false);
        });

        it('canRedo should be false initially', () => {
            expect(stack.canRedo()).toBe(false);
        });

        it('canUndo should be true after push', () => {
            stack.push([{ id: '2', text: 'second' }]);
            expect(stack.canUndo()).toBe(true);
        });

        it('canRedo should be true after undo', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();
            expect(stack.canRedo()).toBe(true);
        });

        it('canUndo should be false after undoing all', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();
            expect(stack.canUndo()).toBe(false);
        });

        it('canRedo should be false after redoing all', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();
            stack.redo();
            expect(stack.canRedo()).toBe(false);
        });
    });

    describe('clear', () => {
        it('should clear undo stack', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.push([{ id: '3', text: 'third' }]);
            stack.clear();

            expect(stack.canUndo()).toBe(false);
        });

        it('should clear redo stack', () => {
            stack.push([{ id: '2', text: 'second' }]);
            stack.undo();
            stack.clear();

            expect(stack.canRedo()).toBe(false);
        });

        it('should preserve current state', () => {
            const state2 = [{ id: '2', text: 'second' }];
            stack.push(state2);
            stack.clear();

            expect(stack.getState()).toBe(state2);
        });
    });

    describe('max depth eviction', () => {
        it('should limit undo stack to maxDepth', () => {
            const smallStack = createUndoStack(initialState, 5);

            for (let i = 0; i < 10; i++) {
                smallStack.push([{ id: String(i), text: `state ${i}` }]);
            }

            expect(smallStack.getUndoStackSize()).toBe(5);
        });

        it('should remove oldest entries when exceeding maxDepth', () => {
            const smallStack = createUndoStack(initialState, 3);

            smallStack.push([{ id: '1', text: 'one' }]);
            smallStack.push([{ id: '2', text: 'two' }]);
            smallStack.push([{ id: '3', text: 'three' }]);
            smallStack.push([{ id: '4', text: 'four' }]);

            // Undo 3 times should get to state 'one', not the initial
            smallStack.undo(); // back to 'three'
            smallStack.undo(); // back to 'two'
            smallStack.undo(); // back to 'one'

            expect(smallStack.getState()[0].text).not.toBe('initial');
        });
    });

    describe('multiple undo/redo cycle', () => {
        it('should handle 5 edits then 5 undos correctly', () => {
            const states = [];
            for (let i = 1; i <= 5; i++) {
                const state = [{ id: String(i), text: `state ${i}` }];
                states.push(state);
                stack.push(state);
            }

            // Undo 5 times
            for (let i = 0; i < 5; i++) {
                stack.undo();
            }

            expect(stack.getState()).toBe(initialState);
        });

        it('should handle 5 edits, 5 undos, then 5 redos correctly', () => {
            const states = [];
            for (let i = 1; i <= 5; i++) {
                const state = [{ id: String(i), text: `state ${i}` }];
                states.push(state);
                stack.push(state);
            }

            // Undo 5 times
            for (let i = 0; i < 5; i++) {
                stack.undo();
            }

            // Redo 5 times
            for (let i = 0; i < 5; i++) {
                stack.redo();
            }

            expect(stack.getState()).toBe(states[4]); // Last pushed state
        });

        it('should handle interleaved undo/redo/push', () => {
            stack.push([{ id: '1', text: 'one' }]);
            stack.push([{ id: '2', text: 'two' }]);
            stack.undo();
            stack.undo();
            stack.redo();

            const branchState = [{ id: 'branch', text: 'branch' }];
            stack.push(branchState);

            expect(stack.getState()).toBe(branchState);
            expect(stack.canRedo()).toBe(false);
        });
    });
});
