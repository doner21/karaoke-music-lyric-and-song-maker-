---
type: community/narrative
community_id: 4
label: "KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js"
size: 23
cohesion: 0.17
character: code
---

# Community 4: KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js

> **23 nodes** | **Cohesion: 0.17** (moderately connected) | **Character: code**

## For Humans

This community contains **23 functions** primarily in **karaokeDrawerGL.js**.

The most connected function is **drawKaraokeFrame()** with 10 connections.

## For LLMs

### Data

- **ID:** 4
- **Label:** KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js
- **Size:** 23 nodes
- **Cohesion:** 0.17
- **Character:** code
- **Primary file:** karaokeDrawerGL.js

### Top Nodes by Connectivity

- **drawKaraokeFrame()** -- 10 connections [code]
- **electronExport.js** -- 8 connections [code]
- **karaokeDrawerGL.js** -- 7 connections [code]
- **exportToMp4Electron()** -- 7 connections [code]
- **VerificationPanel.jsx** -- 7 connections [code]
- **karaokeDrawer.js** -- 6 connections [code]
- **initGL()** -- 6 connections [code]
- **drawKaraokeFrameGL()** -- 5 connections [code]
- **destroyGL()** -- 4 connections [code]
- **getGPUInfo()** -- 3 connections [code]

### Cross-Community Connections
- **TimelineBlockContent.jsx, karaokeHelpers.js** (C8) -- 1 edge(s)
  - karaokeDrawer.js -> clamp01() (imports)
