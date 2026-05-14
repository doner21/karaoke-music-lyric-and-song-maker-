---
type: community/narrative
community_id: 3
label: "Orchestrator & Job Manager"
size: 31
cohesion: 0.08
character: code
---

# Orchestrator & Job Manager

> **31 nodes** | **Cohesion: 0.08** | **Primary files:** `orchestrator/index.js`, `db/repo.js`, `db/index.js`

## For Humans

This is the **central nervous system** of KaraokeBox — it coordinates all background jobs (download, split, align) with SQLite-backed persistence. Think of it as the project manager that never sleeps.

### How it works

```
POST /split/start → JobManager.submit(kind, songId, params)
                        ↓
                  SQLite INSERT → job record (pending)
                        ↓
                  JobManager.poll() → picks next pending job
                        ↓
                  JobManager.processNext() → dispatches to correct processor
                        ↓
                  Progress updates → /split/status/:jobId
                        ↓
                  Completion → job marked 'done', artifacts saved
```

**JobManager** handles: deduplication (same song + same params = skip), force re-queue (reset existing job), progress tracking, and background polling. **SongRepository** stores song metadata (artist, title, video ID) and artifacts (vocal stem, band stem, aligned JSON). **getDB()** initializes the SQLite connection with WAL mode for concurrent reads during writes.

### Key Nodes
- `JobManager.submit()` — queues a new job, deduplicates by songId+params hash
- `JobManager.processNext()` — FIFO job dispatch to the correct processor
- `JobManager.poll()` — background interval that checks for pending jobs
- `SongRepository.getArtifacts()` — retrieves output files (stems, JSON) by song
- `initDB()` — schema creation with foreign keys and indexes

## For LLMs

- **ID:** 3
- **Size:** 31 nodes
- **Cohesion:** 0.08 (loose — JobManager orchestrates independent processors)
- **Key files:** `server/orchestrator/index.js`, `server/db/repo.js`, `server/db/index.js`

### Cross-Community Connections
- **Download Engine (C0):** JobManager routes download jobs
- **Splitter Service (C2):** JobManager routes split jobs to Queue
- **Alignment (C4):** routes alignment jobs
- **Splitter Queue (C13):** Queue.submit() called by JobManager
