---
type: community/narrative
community_id: 7
label: "Audio Utilities"
size: 17
cohesion: 0.16
character: code
---

# Audio Utilities

> **17 nodes** | **Cohesion: 0.16** | **Primary file:** `src/utils/karaokeHelpers.js`

Audio encoding/decoding helpers used across the app. Provides WAV encoding (`encodeWAV`, `audioBufferToWav`), audio level clamping (`clamp01`), and CDG color palette utilities. These are pure utility functions with no side effects — the "toolbox" that other components reach into.

### Key Nodes
- `encodeWAV()` — converts AudioBuffer to WAV byte array for ffmpeg
- `audioBufferToWav()` — AudioBuffer → Blob with WAV header
- `clamp01()` — clamps audio sample values to [-1, 1] range

## For LLMs
- **ID:** 7 | **Size:** 17 nodes | **Cohesion:** 0.16
- **Key file:** `src/utils/karaokeHelpers.js`
