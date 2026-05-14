---
type: community/narrative
community_id: 3
label: "Orchestrator & Job Manager"
size: 31
cohesion: 0.08
character: code
---

# Orchestrator & Job Manager

> **31 nodes** | **Cohesion: 0.08** (loose) | **Files:** `orchestrator/index.js`, `db/repo.js`, `db/index.js`

## For Humans

**Real-world analogy:** This is the **project manager with a photographic memory**. It keeps track of every background job (download, split, align) in a SQLite database. It knows which jobs are pending, which are running, and which are done — and it prevents duplicate work. Like a good PM, it checks in periodically (polling) to see if anything needs attention.

### Architecture

```
┌──────────────────────────────────────────────┐
│                JobManager                     │
│  ┌────────────────────────────────────────┐  │
│  │  submit(kind, songId, params)          │  │
│  │    → SQLite INSERT (if not duplicate)  │  │
│  └────────────┬───────────────────────────┘  │
│               ▼                               │
│  ┌────────────────────────────────────────┐  │
│  │  poll() — background interval          │  │
│  │    → processNext()                     │  │
│  │    → FIFO: oldest pending job first    │  │
│  └────────────┬───────────────────────────┘  │
│               ▼                               │
│  ┌────────────────────────────────────────┐  │
│  │  processNext()                         │  │
│  │    → routes to kind-specific processor │  │
│  │    → download → EngineManager          │  │
│  │    → split    → SplitterQueue          │  │
│  │    → align    → AlignmentJobQueue      │  │
│  └────────────┬───────────────────────────┘  │
│               ▼                               │
│  ┌────────────────────────────────────────┐  │
│  │  updateProgress() / fail() / complete()│  │
│  │    → SQLite UPDATE                     │  │
│  │    → SongRepository.saveArtifact()     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────┐
│        SongRepository        │
│  ┌────────────────────────┐  │
│  │ getById()              │  │
│  │ getByVideoId()         │  │
│  │ getArtifacts()         │  │
│  │   → vocal_stem         │  │
│  │   → band_stem          │  │
│  │   → aligned_json       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **JobManager** | Central coordinator: submit, poll, process, track |
| **SongRepository** | SQLite CRUD for songs, artifacts, metadata |
| **getDB()** | WAL-mode SQLite connection with FK constraints |
| **.submit()** | Deduplicates by hash(songId + params), supports force re-queue |
| **.processNext()** | FIFO dispatch to the correct kind processor |

### Cohesion: 0.08 (loose)
JobManager orchestrates independent subsystems — each processor is an external dependency. Loose cohesion is *by design*.

### Bridges
- **Download (C0):** Routes download jobs to EngineManager
- **Splitter (C2):** Routes split jobs to SplitterQueue
- **Alignment (C5):** Routes alignment jobs to AlignmentJobQueue

## For LLMs

- **ID:** 3 · **Size:** 31 · **Cohesion:** 0.08 · **Pattern:** Job Queue (SQLite-backed)
- **Files:** `server/orchestrator/index.js`, `server/db/repo.js`, `server/db/index.js`
- **Top nodes:** JobManager(14), SongRepository(12), getDB()(7), .processNext()(4)
- **Cross-community:** C12 Alignment Queue (1 edge), C13 Splitter Queue (via submit)
