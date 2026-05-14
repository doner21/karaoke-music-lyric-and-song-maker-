---
type: community/narrative
community_id: 15
label: "Debug Separator Script"
size: 6
cohesion: 0.60
character: code
---

# Debug Separator Script

> **6 nodes** | **Cohesion: 0.60** | **Primary file:** `scripts/debug_separate.py`

## For Humans

A standalone Python debugging script for testing the audio separation pipeline independently of the Node.js server. Loads a track, configures logging, and runs a separation directly. Used for troubleshooting splitter issues without needing to start the full server.

### Key Nodes
- `main()` — entry point, sets up logging, loads track, runs separation
- `log_config()` — configures debug-level logging
- `load_track()` — loads audio file for separation

## For LLMs
- **ID:** 15 | **Size:** 6 nodes | **Cohesion:** 0.60 (tight — all functions serve a single script)
- **Key file:** `scripts/debug_separate.py`
- **Related:** `scripts/test_cpu_baseline.js`, `scripts/test_gpu_split.js`, `scripts/test_parity.js`
