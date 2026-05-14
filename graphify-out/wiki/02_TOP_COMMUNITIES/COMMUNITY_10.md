---
type: community/narrative
community_id: 10
label: "GPU Capabilities & Karaoke Export UI"
size: 13
cohesion: 0.19
character: code
---

# GPU Capabilities & Karaoke Export UI

> **13 nodes** | **Cohesion: 0.19** (moderate) | **Files:** `gpuCapabilities.js`, `useKaraokeExport.js`, `IntegratedEcologicalOS.jsx`

## For Humans

**Real-world analogy:** This is the **control room** — the main UI where you configure your karaoke video. It detects whether your machine has GPU acceleration, sets up the export pipeline, and provides the full karaoke maker interface with timeline, lyrics editor, and styling controls.

### Architecture

```
┌──────────────────────────────────────────┐
│       IntegratedEcologicalOS.jsx         │
│       (Main Karaoke Maker UI)            │
│  ┌────────────────────────────────────┐  │
│  │  useKaraokeExport()  React Hook    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ stems → frames → ffmpeg → MP4│  │  │
│  │  │ progress tracking            │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  gpuCapabilities.js               │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ WebGL ✓ / ✗                  │  │  │
│  │  │ Texture limits               │  │  │
│  │  │ Render performance           │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **useKaraokeExport()** | React hook: orchestrates full export pipeline |
| **gpuCapabilities.js** | WebGL feature detection and benchmarking |
| **IntegratedEcologicalOS** | Main karaoke design system UI component |

### Cohesion: 0.19 (moderate)
GPU detection feeds into export decisions; UI orchestrates both.

### Bridges
- **Karaoke Renderer (C4):** useKaraokeExport drives the render pipeline
- **Splitter (C2):** Split model selection UI

## For LLMs

- **ID:** 10 · **Size:** 13 · **Cohesion:** 0.19
- **Files:** `src/utils/gpuCapabilities.js`, `src/hooks/useKaraokeExport.js`, `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`
