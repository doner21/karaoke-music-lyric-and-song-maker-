---
type: community/narrative
community_id: 12
label: "Alignment Job Queue"
size: 10
cohesion: 0.00
character: code
---

# Alignment Job Queue

> **10 nodes** | **Cohesion: 0.00** (single class) | **File:** `server/alignment/job-queue.js`

## For Humans

**Real-world analogy:** This is the **clipboard on the transcriptionist's desk** — a simple FIFO queue that holds alignment jobs waiting to be processed. Submit lyrics+audio, wait for AudioShake to finish, get back word timings. One job at a time.

```
┌────────────────────────────────────┐
│       AlignmentJobQueue           │
│  ┌──────────────────────────────┐  │
│  │ .processAlign()              │  │
│  │  → submit to AudioShake      │  │
│  │  → poll status until done    │  │
│  │  → save aligned JSON         │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ .updateProgress()            │  │
│  │  → callback during alignment │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Key Nodes
- **AlignmentJobQueue** → FIFO queue for alignment operations
- **.processAlign()** → Submit to AudioShake, poll, store result
- **.updateProgress()** → Progress callback during processing

### Cohesion: 0.00 (single class)
All methods serve the AlignmentJobQueue object.

### Bridges
- **Alignment Service (C5):** AudioShakeAdapter processes jobs from this queue
- **Orchestrator (C3):** JobManager submits alignment jobs here

## For LLMs

- **ID:** 12 · **Size:** 10 · **Cohesion:** 0.00
- **File:** `server/alignment/job-queue.js`
