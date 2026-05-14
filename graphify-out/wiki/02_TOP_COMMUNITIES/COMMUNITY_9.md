---
type: community/narrative
community_id: 9
label: "index.js, server-proxy.js, titleParser.js"
size: 15
cohesion: 0.24
character: code
---

# Community 9: index.js, server-proxy.js, titleParser.js

> **15 nodes** | **Cohesion: 0.24** (moderately connected) | **Character: code**

## For Humans

This community contains **15 functions** primarily in **ytdlp-updater.js**.

The most connected function is **server-proxy.js** with 11 connections.

## For LLMs

### Data

- **ID:** 9
- **Label:** index.js, server-proxy.js, titleParser.js
- **Size:** 15 nodes
- **Cohesion:** 0.24
- **Character:** code
- **Primary file:** ytdlp-updater.js

### Top Nodes by Connectivity

- **server-proxy.js** -- 11 connections [code]
- **ytdlp-updater.js** -- 7 connections [code]
- **checkForUpdate()** -- 6 connections [code]
- **performUpdate()** -- 5 connections [code]
- **runCommand()** -- 4 connections [code]
- **getCurrentVersion()** -- 4 connections [code]
- **checkAndUpdateOnStartup()** -- 4 connections [code]
- **parseVideoTitle()** -- 3 connections [code]
- **getLatestVersion()** -- 3 connections [code]
- **isNewerVersion()** -- 2 connections [code]

### Cross-Community Connections
- **azlyrics.js, genius.js, lyricsParser.js** (C7) -- 2 edge(s)
  - server-proxy.js -> searchSong() (imports)
  - server-proxy.js -> getLyrics() (imports)
- **audio-separator-adapter.js, demucs-adapter.js, ffmpeg-splitter-adapter.js** (C2) -- 1 edge(s)
  - server-proxy.js -> initSplitterService() (imports)
- **audioshake-adapter.js, canonicalizer.js, index.js** (C5) -- 1 edge(s)
  - server-proxy.js -> initAlignmentService() (imports)
- **index.js, migrate_add_logs.js, repo.js** (C3) -- 1 edge(s)
  - server-proxy.js -> initDB() (imports)
