---
type: community/narrative
community_id: 5
label: "Karaoke Renderer & Export"
size: 22
cohesion: 0.18
character: code
---

# Karaoke Renderer & Export

> **22 nodes** | **Cohesion: 0.18** | **Primary files:** `karaokeDrawerGL.js`, `electronExport.js`, `fastExport.js`, `remotion/`

## For Humans

This is the **video rendering pipeline** — it draws animated karaoke frames with WebGL and exports them to MP4. Think of it as a real-time video production studio running in your browser.

```
Lyrics tokens + styling config
        ↓
karaokeDrawerGL.drawKaraokeFrame() → WebGL canvas
        ↓                              ↓
  Canvas2D fallback              ffmpeg pipe (raw frames)
  (karaokeDrawer.js)                  ↓
                                exportToMp4Electron()
                                        ↓
                                  Starman.mp4
```

Two export paths exist:
1. **Electron export** (full quality): WebGL frames → raw video pipe → ffmpeg → MP4
2. **Fast export** (preview): simulates rendering without full GPU pipeline

The **Remotion** integration (`src/remotion/`) provides React-based composable karaoke video rendering for programmatic export.

### Key Nodes
- `drawKaraokeFrame()` — renders a single frame with lyrics, background, effects
- `exportToMp4Electron()` — spawns ffmpeg, pipes WebGL frames as raw video
- `encodeWAV()` — renders audio stems to WAV for ffmpeg muxing
- `KaraokeComposition` — Remotion component for declarative video assembly

## For LLMs
- **ID:** 5 | **Size:** 22 nodes | **Cohesion:** 0.18
- **Key files:** `src/utils/karaokeDrawerGL.js`, `karaokeDrawer.js`, `electronExport.js`, `fastExport.js`
- **Remotion:** `src/remotion/KaraokeComposition.jsx`, `Root.jsx`
