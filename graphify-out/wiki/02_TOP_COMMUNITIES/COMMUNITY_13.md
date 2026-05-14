---
type: community/narrative
community_id: 13
label: "Splitter Job Queue"
size: 8
cohesion: 0.00
character: code
---

# Splitter Job Queue

> **8 nodes** | **Cohesion: 0.00** (single class) | **File:** `server/splitter/queue.js`

## For Humans

**Real-world analogy:** This is the **mixing engineer's appointment book**. It accepts split job requests, avoids scheduling the same song twice (deduplication), assigns the right engineer (processor function), and lets you check the status of any job. Simple FIFO with progress tracking.

```
┌────────────────────────────────────┐
│         SplitterQueue              │
│  ┌──────────────────────────────┐  │
│  │ .submit(songId, params)      │  │
│  │  → dedup: same song = skip   │  │
│  │  → force: re-queue if needed │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ .setProcessor(fn)            │  │
│  │  → Smart Router binds here   │  │
│  │  → all jobs use this fn      │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ .getJob(jobId) → status      │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Key Nodes
- **SplitterQueue** → Job queue for split operations
- **.submit()** → Queues with deduplication (deprecated, use JobMgr)
- **.setProcessor()** → Binds the Smart Router's processor

### Cohesion: 0.00 (single class)
All methods serve the SplitterQueue object.

### Bridges
- **Splitter Service (C2):** initSplitterService() sets processor
- **Orchestrator (C3):** JobManager calls .submit() for split jobs

## For LLMs

- **ID:** 13 · **Size:** 8 · **Cohesion:** 0.00
- **File:** `server/splitter/queue.js`
