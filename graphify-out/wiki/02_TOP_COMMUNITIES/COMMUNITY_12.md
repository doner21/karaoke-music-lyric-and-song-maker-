---
type: community/narrative
community_id: 12
label: "Alignment Job Queue"
size: 10
cohesion: 0.00
character: code
---

# Alignment Job Queue

> **10 nodes** | **Cohesion: 0.00** | **Primary file:** `server/alignment/job-queue.js`

Manages the lifecycle of AudioShake alignment jobs. Submits lyrics+audio, polls for completion, updates progress, and stores the resulting word-timing JSON. Simple FIFO queue with progress callbacks.

### Key Nodes
- `AlignmentJobQueue` — queue manager for alignment jobs
- `.updateProgress()` — progress callback during alignment
- `.processAlign()` — submits to AudioShake, polls until done

## For LLMs
- **ID:** 12 | **Size:** 10 nodes | **Cohesion:** 0.00
- **Key file:** `server/alignment/job-queue.js`

### Cross-Community Connections
- **Alignment Service (C4):** AudioShakeAdapter processes jobs from this queue
- **Orchestrator (C3):** JobManager submits alignment jobs here
