---
type: community
cohesion: 0.20
members: 10
---

# index.js, job-queue.js

**Cohesion:** 0.20 - loosely connected
**Members:** 10 nodes

## Members
- [[.cancel()_1]] - code - server/alignment/job-queue.js
- [[.constructor()_2]] - code - server/alignment/job-queue.js
- [[.getJob()]] - code - server/alignment/job-queue.js
- [[.processAlign()]] - code - server/alignment/job-queue.js
- [[.setAdapter()]] - code - server/alignment/job-queue.js
- [[.setCanonicalizer()]] - code - server/alignment/job-queue.js
- [[.submit()]] - code - server/alignment/job-queue.js
- [[.updateProgress()]] - code - server/orchestrator/index.js
- [[AlignmentJobQueue]] - code - server/alignment/job-queue.js
- [[job-queue.js]] - code - server/alignment/job-queue.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/indexjs_job-queuejs
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_index.js, migrate_add_logs.js, repo.js]]

## Top bridge nodes
- [[.updateProgress()]] - degree 2, connects to 1 community