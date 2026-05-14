---
type: community/narrative
community_id: 10
label: "IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js"
size: 13
cohesion: 0.19
character: code
---

# Community 10: IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js

> **13 nodes** | **Cohesion: 0.19** (moderately connected) | **Character: code**

## For Humans

This community contains **13 functions** primarily in **gpuCapabilities.js**.

The most connected function is **gpuCapabilities.js** with 7 connections.

## For LLMs

### Data

- **ID:** 10
- **Label:** IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js
- **Size:** 13 nodes
- **Cohesion:** 0.19
- **Character:** code
- **Primary file:** gpuCapabilities.js

### Top Nodes by Connectivity

- **gpuCapabilities.js** -- 7 connections [code]
- **useKaraokeExport.js** -- 5 connections [code]
- **IntegratedEcologicalOS.jsx** -- 4 connections [code]
- **useKaraokeExport()** -- 3 connections [code]
- **IntegratedEcologicalOS()** -- 3 connections [code]
- **resolveGpuConfig()** -- 2 connections [code]
- **fmtTime()** -- 2 connections [code]
- **detectGpuCapabilities()** -- 2 connections [code]
- **resetGpuCapabilities()** -- 1 connections [code]
- **probeWebGL2()** -- 1 connections [code]

### Cross-Community Connections
- **AudioStemManager Module (21 functions)** (C6) -- 1 edge(s)
  - IntegratedEcologicalOS.jsx -> AudioStemManager (imports)
- **KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js** (C4) -- 1 edge(s)
  - useKaraokeExport.js -> exportToMp4Electron() (imports)
- **KaraokeLyricsDisplay.jsx, gapDetector.js, lyricsPagination.js** (C11) -- 1 edge(s)
  - useKaraokeExport.js -> normalizeLyrics() (imports)
