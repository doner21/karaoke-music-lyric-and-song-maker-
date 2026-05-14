---
type: community
cohesion: 0.08
members: 31
---

# index.js, migrate_add_logs.js, repo.js

**Cohesion:** 0.08 - loosely connected
**Members:** 31 nodes

## Members
- [[.addArtifact()]] - code - server/db/repo.js
- [[.complete()]] - code - server/orchestrator/index.js
- [[.constructor()_3]] - code - server/db/repo.js
- [[.constructor()_9]] - code - server/orchestrator/index.js
- [[.create()]] - code - server/db/repo.js
- [[.fail()]] - code - server/orchestrator/index.js
- [[.getArtifactById()]] - code - server/db/repo.js
- [[.getArtifacts()]] - code - server/db/repo.js
- [[.getById()]] - code - server/db/repo.js
- [[.getByVideoId()]] - code - server/db/repo.js
- [[.getJob()_2]] - code - server/orchestrator/index.js
- [[.getJobs()]] - code - server/db/repo.js
- [[.getLyrics()]] - code - server/db/repo.js
- [[.hashInputs()]] - code - server/orchestrator/index.js
- [[.poll()_1]] - code - server/orchestrator/index.js
- [[.processNext()]] - code - server/orchestrator/index.js
- [[.recoverStuckJobs()]] - code - server/orchestrator/index.js
- [[.registerProcessor()]] - code - server/orchestrator/index.js
- [[.saveLyrics()]] - code - server/db/repo.js
- [[.search()]] - code - server/db/repo.js
- [[.startPolling()]] - code - server/orchestrator/index.js
- [[.stopPolling()]] - code - server/orchestrator/index.js
- [[.submit()_2]] - code - server/orchestrator/index.js
- [[JobManager]] - code - server/orchestrator/index.js
- [[SongRepository]] - code - server/db/repo.js
- [[getDB()]] - code - server/db/index.js
- [[index.js_2]] - code - server/db/index.js
- [[index.js_4]] - code - server/orchestrator/index.js
- [[initDB()]] - code - server/db/index.js
- [[migrate_add_logs.js]] - code - scripts/migrate_add_logs.js
- [[repo.js]] - code - server/db/repo.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/indexjs_migrate_add_logsjs_repojs
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_index.js, server-proxy.js, titleParser.js]]
- 1 edge to [[_COMMUNITY_index.js, job-queue.js]]

## Top bridge nodes
- [[JobManager]] - degree 14, connects to 1 community
- [[initDB()]] - degree 3, connects to 1 community