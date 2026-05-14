---
type: community/narrative
community_id: 8
label: "Audio Utilities"
size: 16
cohesion: 0.17
character: code
---

# Audio Utilities

> **16 nodes** | **Cohesion: 0.17** (moderate) | **Files:** `karaokeHelpers.js`, `TimelineBlockContent.jsx`

## For Humans

**Real-world analogy:** This is the **toolbox hanging on the studio wall** — a collection of pure utility functions that every other component reaches for. Need to convert an audio buffer to WAV? There's a function for that. Need to clamp sample values? Right here. No side effects, no state — just reliable tools.

### Architecture

```
┌────────────────────────────────────┐
│        Audio Utility Toolbox       │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ encodeWAV()                  │  │
│  │ AudioBuffer → WAV byte[]     │  │
│  │ → writes RIFF header + PCM   │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ audioBufferToWav()           │  │
│  │ AudioBuffer → Blob (.wav)    │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ clamp01()                    │  │
│  │ sample → clamped to [-1, 1]  │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ CDG Color Palette Utils      │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Key Nodes
- **encodeWAV()** → AudioBuffer to WAV bytes for ffmpeg muxing
- **audioBufferToWav()** → AudioBuffer to downloadable Blob
- **clamp01()** → Prevents audio clipping distortion

### Cohesion: 0.17 (moderate)
All functions operate on audio data — shared domain, independent implementations.

### Bridges
- **Karaoke Renderer (C4):** encodeWAV() used in export pipeline

## For LLMs

- **ID:** 8 · **Size:** 16 · **Cohesion:** 0.17
- **Files:** `src/utils/karaokeHelpers.js`, `src/components/TimelineBlockContent.jsx`
