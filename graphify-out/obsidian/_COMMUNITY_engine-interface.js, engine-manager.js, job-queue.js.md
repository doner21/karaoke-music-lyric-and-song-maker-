---
type: community
cohesion: 0.06
members: 39
---

# engine-interface.js, engine-manager.js, job-queue.js

**Cohesion:** 0.06 - loosely connected
**Members:** 39 nodes

## Members
- [[.activeEngines()]] - code - server/downloader/job-queue.js
- [[.cancel()_3]] - code - server/downloader/adapters/mock-reliable.js
- [[.cancel()_2]] - code - server/downloader/engine-interface.js
- [[.checkHealth()_2]] - code - server/downloader/adapters/mock-reliable.js
- [[.checkHealth()_3]] - code - server/downloader/adapters/yt-dlp.js
- [[.checkHealth()_1]] - code - server/downloader/engine-interface.js
- [[.constructor()_7]] - code - server/downloader/adapters/mock-reliable.js
- [[.constructor()_8]] - code - server/downloader/adapters/yt-dlp.js
- [[.constructor()_4]] - code - server/downloader/engine-interface.js
- [[.constructor()_5]] - code - server/downloader/engine-manager.js
- [[.constructor()_6]] - code - server/downloader/job-queue.js
- [[.download()_2]] - code - server/downloader/adapters/mock-reliable.js
- [[.download()_3]] - code - server/downloader/adapters/yt-dlp.js
- [[.download()]] - code - server/downloader/engine-interface.js
- [[.download()_1]] - code - server/downloader/engine-manager.js
- [[.download_fixed()]] - code - server/downloader/adapters/yt-dlp.js
- [[.getAllEngines()]] - code - server/downloader/engine-manager.js
- [[.getEngine()]] - code - server/downloader/engine-manager.js
- [[.getExecutionOrder()]] - code - server/downloader/engine-manager.js
- [[.getJob()_1]] - code - server/downloader/job-queue.js
- [[.getMetadata()_2]] - code - server/downloader/adapters/mock-reliable.js
- [[.getMetadata()_3]] - code - server/downloader/adapters/yt-dlp.js
- [[.getMetadata()]] - code - server/downloader/engine-interface.js
- [[.getMetadata()_1]] - code - server/downloader/engine-manager.js
- [[.processDownload()]] - code - server/downloader/job-queue.js
- [[.register()]] - code - server/downloader/engine-manager.js
- [[.registerEngine()]] - code - server/downloader/job-queue.js
- [[.setPriority()]] - code - server/downloader/engine-manager.js
- [[.submit()_1]] - code - server/downloader/job-queue.js
- [[DownloadEngine]] - code - server/downloader/engine-interface.js
- [[EngineManager]] - code - server/downloader/engine-manager.js
- [[JobQueue]] - code - server/downloader/job-queue.js
- [[MockReliableAdapter]] - code - server/downloader/adapters/mock-reliable.js
- [[YtDlpAdapter]] - code - server/downloader/adapters/yt-dlp.js
- [[engine-interface.js]] - code - server/downloader/engine-interface.js
- [[engine-manager.js]] - code - server/downloader/engine-manager.js
- [[job-queue.js_1]] - code - server/downloader/job-queue.js
- [[mock-reliable.js]] - code - server/downloader/adapters/mock-reliable.js
- [[yt-dlp.js]] - code - server/downloader/adapters/yt-dlp.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/engine-interfacejs_engine-managerjs_job-queuejs
SORT file.name ASC
```
