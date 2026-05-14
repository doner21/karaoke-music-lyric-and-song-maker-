---
type: community/narrative
community_id: 15
label: "Debug Separator Script"
size: 6
cohesion: 0.60
character: code
---

# Debug Separator Script

> **6 nodes** | **Cohesion: 0.60** (tight) | **File:** `scripts/debug_separate.py`

## For Humans

**Real-world analogy:** This is the **diagnostic tool** — like a mechanic's OBD scanner. It runs the audio separation pipeline standalone (without the Node.js server) to isolate and debug splitter issues. Load a track, configure logging, run separation — all from one script.

```
┌──────────────────────────────────────┐
│        debug_separate.py             │
│  ┌────────────────────────────────┐  │
│  │ main()                         │  │
│  │  → log_config()                │  │
│  │  → load_track(path)            │  │
│  │  → separator.separate()        │  │
│  └────────────────────────────────┘  │
│                                      │
│  Tight cohesion: all functions      │
│  serve a single debug workflow      │
└──────────────────────────────────────┘
```

### Key Nodes
- **main()** → Entry point: configures logging, loads audio, runs separation
- **log_config()** → Sets up debug-level logging
- **load_track()** → Loads audio file for separation

### Cohesion: 0.60 (tight)
All functions serve a single script — the tightest community in the graph.

### Bridges
- **Splitter Service (C2):** Tests the same Python modules used by adapters
- **Test scripts:** `test_cpu_baseline.js`, `test_gpu_split.js`, `test_parity.js`

## For LLMs

- **ID:** 15 · **Size:** 6 · **Cohesion:** 0.60
- **File:** `scripts/debug_separate.py`
