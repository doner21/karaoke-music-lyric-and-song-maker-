---
type: community/narrative
community_id: 4
label: "Karaoke Renderer & Export"
size: 23
cohesion: 0.17
character: code
---

# Karaoke Renderer & Export

> **23 nodes** | **Cohesion: 0.17** (moderate) | **Files:** `karaokeDrawerGL.js`, `karaokeDrawer.js`, `electronExport.js`, `fastExport.js`, `remotion/`

## For Humans

**Real-world analogy:** This is the **video production studio's rendering farm**. It takes timed lyrics, audio stems, and visual styling — then renders thousands of video frames with WebGL, pipes them through ffmpeg, and outputs a finished MP4. Like a render farm, it has a fast preview mode (fastExport) and a full-quality mode (Electron export).

### Architecture

```
┌──────────────────────────────────────────┐
│          drawKaraokeFrame()              │
│  ┌────────────────────────────────────┐  │
│  │  WebGL Canvas                      │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ Background + Lyrics + FX     │  │  │
│  │  │ → rendered at 60fps         │  │  │
│  │  └──────────┬───────────────────┘  │  │
│  └─────────────┼──────────────────────┘  │
│                │                          │
│       ┌────────┴────────┐                 │
│       ▼                 ▼                 │
│  ┌──────────┐    ┌──────────────┐        │
│  │fastExport│    │electronExport│        │
│  │(preview) │    │   (MP4)      │        │
│  │          │    │              │        │
│  │Canvas2D  │    │WebGL frames  │        │
│  │fallback  │    │→ raw pipe    │        │
│  │          │    │→ ffmpeg      │        │
│  │          │    │→ Starman.mp4 │        │
│  └──────────┘    └──────┬───────┘        │
│                         │                │
│                         ▼                │
│                  ┌────────────┐          │
│                  │ encodeWAV()│          │
│                  │ (audio to  │          │
│                  │  ffmpeg)   │          │
│                  └────────────┘          │
└──────────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **drawKaraokeFrame()** | Renders one video frame: background, lyrics, effects |
| **exportToMp4Electron()** | Pipes WebGL frames → ffmpeg → MP4 |
| **encodeWAV()** | Converts AudioBuffer to WAV for ffmpeg muxing |
| **KaraokeComposition** | Remotion React component for declarative video assembly |

### Cohesion: 0.17 (moderate)
Render functions share the WebGL context and frame pipeline. Moderately coupled by the render loop.

### Bridges
- **Audio Utils (C8):** encodeWAV() used for audio muxing
- **GPU & Export (C10):** useKaraokeExport() orchestrates the export workflow
- **Lyrics Display (C11):** Rendered lyrics overlay on video frames

## For LLMs

- **ID:** 4 · **Size:** 23 · **Cohesion:** 0.17
- **Files:** `src/utils/karaokeDrawerGL.js`, `electronExport.js`, `fastExport.js`, `src/remotion/`
- **Top nodes:** drawKaraokeFrame()(7), electronExport.js(6), karaokeDrawerGL.js(5), exportToMp4Electron()(4)
