---
type: community/narrative
community_id: 13
label: "Splitter Job Queue"
size: 8
cohesion: 0.00
character: code
---

# Splitter Job Queue

> **8 nodes** | **Cohesion: 0.00** | **Primary file:** `server/splitter/queue.js`

Manages the lifecycle of vocal split jobs. Accepts submissions with deduplication, sets a processor function (the split adapter), and provides status polling. The processor is set once during init by the Smart Router and handles all incoming jobs.

### Key Nodes
- `SplitterQueue` — job queue for split operations
- `.submit()` — queues a split job (deprecated, JobMgr.submit is preferred)
- `.setProcessor()` — binds the smart router's processor function
- `.getJob()` — retrieves job status by ID

## For LLMs
- **ID:** 13 | **Size:** 8 nodes | **Cohesion:** 0.00
- **Key file:** `server/splitter/queue.js`

### Cross-Community Connections
- **Splitter Service (C2):** initSplitterService sets the processor
- **Orchestrator (C3):** JobManager calls Queue.submit for split jobs
