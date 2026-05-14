---
type: community/narrative
community_id: 1
label: "Lyrics Token Editor"
size: 37
cohesion: 0.13
character: code
---

# Lyrics Token Editor

> **37 nodes** | **Cohesion: 0.13** (loose) | **Files:** `tokenTransforms.js`, `useTokenEditor.js`, `undoStack.js`, `jsonAdapters.js`, `TokenEditorPanel.jsx`, tests

## For Humans

**Real-world analogy:** This is the **word processor for karaoke**. Every sung word is a "token" with a precise start and end time. This editor lets you insert, delete, merge, and split words while tracking every change in an undo stack — like a Google Docs for timed lyrics.

### Architecture

```
┌─────────────────────────────────────────┐
│           useTokenEditor()              │
│           React Hook (state)            │
│  ┌───────────────────────────────────┐  │
│  │  tokens: Token[]                  │  │
│  │  dispatch(action) → new tokens    │  │
│  └──────────┬────────────────────────┘  │
│             │                           │
│    ┌────────┼────────┬──────────┐       │
│    ▼        ▼        ▼          ▼       │
│  ┌────┐  ┌────┐  ┌──────┐  ┌────────┐  │
│  │ins │  │del │  │merge │  │ split  │  │
│  │ert │  │ete │  │      │  │        │  │
│  └──┬─┘  └──┬─┘  └──┬───┘  └───┬────┘  │
│     │       │       │          │        │
│     └───────┴───┬───┴──────────┘        │
│                 ▼                        │
│        ┌──────────────┐                 │
│        │  undoStack   │                 │
│        │  push/undo/  │                 │
│        │  redo        │                 │
│        └──────┬───────┘                 │
│               ▼                         │
│        ┌──────────────┐                 │
│        │ jsonAdapters │                 │
│        │ parse/ser     │                 │
│        └──────────────┘                 │
└─────────────────────────────────────────┘

     ┌──────────────────┐
     │ ValidationPanel  │◀── reads tokens
     │ (sanity checks)  │
     └──────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **insertToken()** | Adds word at time position, redistributes durations |
| **deleteToken()** | Removes word, gives its time to neighbors |
| **mergeTokens()** | Combines adjacent words into one |
| **splitToken()** | Divides word at midpoint |
| **undoStack** | Command-pattern undo/redo with unlimited history |
| **jsonAdapters** | Serializes tokens to/from alignment JSON format |
| **ValidationPanel** | Checks no gaps, non-negative durations, valid structure |

### Cohesion: 0.13 (loose)
Transforms are pure functions — each operates independently on immutable token arrays. Loose cohesion is *expected* for a transform library.

### Bridges
- **Alignment (C5):** Consumes aligned JSON, editor fixes timing
- **Lyrics Display (C11):** Token data drives on-screen word rendering

## For LLMs

- **ID:** 1 · **Size:** 37 · **Cohesion:** 0.13
- **Files:** `src/editor/tokenTransforms.js`, `useTokenEditor.js`, `undoStack.js`, `jsonAdapters.js`, `TokenEditorPanel.jsx`, `__tests__/`
- **Top nodes:** tokenTransforms.js(11), useTokenEditor.js(8), insertToken()(5), deleteToken()(4), mergeTokens()(4)
