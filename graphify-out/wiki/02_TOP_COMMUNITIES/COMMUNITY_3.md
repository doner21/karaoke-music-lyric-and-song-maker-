---
type: community/narrative
community_id: 3
label: "index.js, migrate_add_logs.js, repo.js"
size: 31
cohesion: 0.08
character: code
---

# Community 3: index.js, migrate_add_logs.js, repo.js

> **31 nodes** | **Cohesion: 0.08** (loosely connected) | **Character: code**

## For Humans

This community contains **31 functions** primarily in **index.js**.

The most connected function is **JobManager** with 14 connections.

## For LLMs

### Data

- **ID:** 3
- **Label:** index.js, migrate_add_logs.js, repo.js
- **Size:** 31 nodes
- **Cohesion:** 0.08
- **Character:** code
- **Primary file:** index.js

### Top Nodes by Connectivity

- **JobManager** -- 14 connections [code]
- **SongRepository** -- 12 connections [code]
- **getDB()** -- 7 connections [code]
- **.processNext()** -- 4 connections [code]
- **initDB()** -- 3 connections [code]
- **repo.js** -- 2 connections [code]
- **index.js** -- 2 connections [code]
- **index.js** -- 2 connections [code]
- **.submit()** -- 2 connections [code]
- **.startPolling()** -- 2 connections [code]

### Cross-Community Connections
- **job-queue Module (10 functions)** (C12) -- 1 edge(s)
  - JobManager -> .updateProgress() (method)
