---
type: community/narrative
community_id: 1
label: "Lyrics Token Editor"
size: 37
cohesion: 0.13
character: code
---

# Lyrics Token Editor

> **37 nodes** | **Cohesion: 0.13** | **Primary files:** `tokenTransforms.js`, `useTokenEditor.js`, `undoStack.js`, `jsonAdapters.js`

## For Humans

This is the **lyrics editing engine** — like a word processor purpose-built for karaoke timing. Every word in a song is a "token" with a start time and end time. This system lets you insert, delete, merge, and split tokens while maintaining valid timing data.

### How it works

```
Raw lyrics JSON → jsonAdapters.parse()
                      ↓
              Token[] (array of timed words)
                      ↓
              useTokenEditor() → React hook with undo/redo
                      ↓
              tokenTransforms → insert, delete, merge, split tokens
                      ↓
              undoStack → Ctrl+Z / Ctrl+Y support
                      ↓
              ValidationPanel → sanity checks (no gaps, non-negative durations)
```

**tokenTransforms** is the core — pure functions that transform token arrays immutably. **undoStack** provides unlimited undo/redo with a command pattern. **jsonAdapters** handles serialization to/from the alignment JSON format. Tests in `__tests__/` verify edge cases.

### Key Nodes
- `insertToken()` — adds a new word at a specific time position
- `deleteToken()` — removes a word and redistributes its duration
- `mergeTokens()` — combines adjacent words into one
- `splitToken()` — divides a word at a midpoint
- `undoStack.push()` / `.undo()` / `.redo()` — full history management

## For LLMs

- **ID:** 1
- **Size:** 37 nodes
- **Cohesion:** 0.13 (moderate — transforms are tightly related through shared token model)
- **Key files:** `src/editor/tokenTransforms.js`, `useTokenEditor.js`, `undoStack.js`, `jsonAdapters.js`
- **Tests:** `src/editor/__tests__/tokenTransforms.test.js`, `undoStack.test.js`, `jsonAdapters.test.js`
