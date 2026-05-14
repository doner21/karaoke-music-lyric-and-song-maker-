---
type: community/narrative
community_id: 10
label: "GPU Capabilities & Karaoke Export"
size: 13
cohesion: 0.19
character: code
---

# GPU Capabilities & Karaoke Export

> **13 nodes** | **Cohesion: 0.19** | **Primary files:** `src/utils/gpuCapabilities.js`, `src/hooks/useKaraokeExport.js`, `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

Detects WebGL/GPU capabilities and manages the karaoke export workflow. `gpuCapabilities.js` probes the browser for WebGL support, texture limits, and rendering performance. `useKaraokeExport` is a React hook that orchestrates the full export pipeline — stem mixing, frame rendering, ffmpeg encoding. `IntegratedEcologicalOS` is the main karaoke design system UI component.

### Key Nodes
- `gpuCapabilities.js` — WebGL feature detection
- `useKaraokeExport()` — React hook: stems → frames → MP4
- `IntegratedEcologicalOS` — full karaoke maker UI with timeline, lyrics, styling

## For LLMs
- **ID:** 10 | **Size:** 13 nodes | **Cohesion:** 0.19
- **Key files:** `src/utils/gpuCapabilities.js`, `src/hooks/useKaraokeExport.js`, `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`
