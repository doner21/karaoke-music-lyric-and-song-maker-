# Cleanup & Refactor Plan — kraokebox_song_generator

**Branch**: `cleanup-refactor`  
**Created**: 2026-05-13

---

## ✅ Phase 0: Critical Fixes (DONE)

- [x] Restore `server/orchestrator/index.js` (was truncated to 0 bytes)

---

## 🔴 Phase 1: HIGH Priority (4 items)

### 1.1 Convert `azlyrics.js` from CommonJS to ESM
**File**: `server/services/azlyrics.js`  
**Issue**: Uses `require()`/`module.exports` but project is `"type": "module"` → runtime crash  
**Fix**: Convert to `import`/`export default`

### 1.2 Remove 3 redundant download adapters
**Files**: `server/downloader/adapters/{ytdl-core,play-dl,local-archive}.js`  
**Issue**: Only `yt-dlp.js` does real work; `ytdl-core` and `play-dl` are broken; `local-archive` is mock  
**Fix**: Delete adapters, update `engine-manager.js` and `index.js` registration

### 1.3 Split `IntegratedEcologicalOS.jsx` (1792 lines)
**File**: `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`  
**Issue**: Monolithic component with 30+ useState, intertwined useEffect polling loops  
**Fix**: Extract hooks to `hooks/useJobPolling.js`, `hooks/useSearch.js`, `hooks/useStemAudio.js`; keep component as thin orchestrator

### 1.4 Add server-side test scaffolding
**Priority area**: `server/db/repo.js`, `server/utils/lyricsParser.js`, splitter status routes  
**Fix**: Add vitest tests for critical server paths

---

## 🟠 Phase 2: MEDIUM Priority (10 items)

### 2.1 Dead code deletions
- [ ] Delete `server/library/repository.js` (duplicate of `db/repo.js`)
- [ ] Delete `server/library/identity.js` (unused IdentityResolver)
- [ ] Delete `server/downloader/contract-adapter.js` (never wired in)
- [ ] Delete `server/downloader/asset-registry.js` (never populated)

### 2.2 Demucs GPU failure → CPU retry
**File**: `server/splitter/demucs-adapter.js`  
**Fix**: Catch non-zero exit when device='cuda', retry with device='cpu'

### 2.3 Waveform FFmpeg timeout
**File**: `server/utils/waveform.js`  
**Fix**: Add 30-second timeout on FFmpeg spawn

### 2.4 Content-aware error for Genius scraper
**File**: `server/services/genius.js`  
**Fix**: Throw error when no lyrics containers found (instead of silent empty string)

### 2.5 Remove `ContractAdapter` usage in downloader/index.js
**File**: `server/downloader/index.js`  
**Fix**: Remove import and instantiation of unused ContractAdapter

### 2.6 Clean up commented-out/yanked code in `electron/main.js`
**Fix**: Remove commented-out `app.disableHardwareAcceleration()` calls (lines 14-17)

### 2.7 Remove `import play from 'play-dl'` in `server-proxy.js`
**File**: `server-proxy.js:5`  
**Fix**: Remove unused import

### 2.8 Fix title parsing duplication
**Files**: `server/downloader/index.js:45-70`, `server-proxy.js:280-300`  
**Fix**: Extract shared title parsing utility

### 2.9 Fix duplicate adapter registration
**Files**: `server/downloader/index.js` and `server/downloader/job-queue.js`  
**Fix**: Register engines in only one place (keep in job-queue.js)

### 2.10 Resolve TODO/FIXME/DEBUG comments
Resolve or remove 9 TODO/FIXME/DEBUG markers across the codebase

---

## 🟡 Phase 3: LOW Priority (5 items)

### 3.1 Split `electron/main.js` (711 lines) into modules
Extract IPC handlers into separate files

### 3.2 Split `server-proxy.js` (493 lines) route groups
Move route groups into `server/routes/` directory

### 3.3 Extract token helper functions
Move `findToken`, `findIndex`, `lineNeighbors`, etc. from `tokenTransforms.js` to `tokenHelpers.js`

### 3.4 Remove `DownloadEngine` base class or enforce it
**File**: `server/downloader/engine-interface.js`

### 3.5 Console.log cleanup
Replace ~180 console.log statements with structured logger

---

## Execution Strategy

Phase 1 done by `coder` subagent (critical runtime-breaking fixes)  
Phase 2 done by `coder` subagent (dead code deletion + small fixes)  
Phase 3 deferred to future pass (cosmetic improvements)
