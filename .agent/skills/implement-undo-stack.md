# Skill: Implement Undo/Redo Stack

## Purpose
Create a simple, efficient undo/redo history manager for the token array state.

## Target File
`src/editor/undoStack.js` — NEW

## API

```js
export function createUndoStack(initialState, maxDepth = 500)
```

Returns:
```js
{
  getState()     → current token array
  push(newState) → void  (saves current to undo, clears redo, sets new state)
  undo()         → token array | null  (pops undo, pushes current to redo)
  redo()         → token array | null  (pops redo, pushes current to undo)
  canUndo()      → boolean
  canRedo()      → boolean
  clear()        → void  (resets both stacks, keeps current state)
}
```

## Implementation Notes

- Use simple array-based stacks (push/pop)
- Store **full snapshots** of the token array (not diffs) — simpler and fast enough for 5000 tokens
- When `push()` is called and undo stack exceeds `maxDepth`, remove the oldest entry (shift from front)
- `push()` always clears the redo stack (standard undo semantics)
- `undo()` returns null if nothing to undo (and does not modify state)
- `redo()` returns null if nothing to redo

## Why Not Use Diffs

Diffs are more memory-efficient but add complexity:
- Token arrays are relatively small (5000 tokens × ~50 bytes = ~250KB per snapshot)
- 500 snapshots = ~125MB worst case, acceptable for a desktop Electron app
- Full snapshots make debugging trivial
- Can optimize later if profiling shows memory issues

## Test File
`src/editor/__tests__/undoStack.test.js`

### Test Cases
1. Initial state is accessible via getState()
2. push() → getState() returns new state
3. push() then undo() → getState() returns previous state
4. push() then undo() then redo() → getState() returns pushed state
5. undo() with empty stack returns null
6. redo() with empty stack returns null
7. push() after undo() clears redo stack
8. Max depth eviction: push 501 items, undo stack has exactly 500
9. clear() empties both stacks, getState() still returns current
10. canUndo() and canRedo() return correct booleans
