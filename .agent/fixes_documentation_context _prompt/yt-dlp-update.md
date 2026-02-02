---
description: How to fix yt-dlp YouTube download errors by updating the package
---

# yt-dlp Update Workflow

## Problem
YouTube frequently changes their backend API and anti-bot measures. When yt-dlp becomes outdated, downloads fail with various errors such as:
- "Sign in to confirm you're not a bot"
- "Video unavailable"
- "Unable to extract video data"
- HTTP 403/429 errors
- Cipher/signature extraction failures

## Solution
Update yt-dlp to the latest version. The package is updated frequently (often weekly) to keep up with YouTube changes.

## Steps

### 1. Check Current Version
```bash
python -m yt_dlp --version
```

### 2. Update yt-dlp
```bash
// turbo
python -m pip install -U yt-dlp
```

### 3. Verify Update
```bash
// turbo
python -m yt_dlp --version
```

## Automation Notes for LLMs

### Detection
If a download job fails with any of these patterns in the error message, trigger this workflow:
- `"Sign in to confirm"`
- `"Unable to extract"`
- `"HTTP Error 403"`
- `"HTTP Error 429"`
- `"nsig extraction failed"`
- `"Video unavailable"`
- `"This video is not available"`

### Implementation Hint
Consider adding automatic update logic to the `YtDlpAdapter` class:

```javascript
// In server/downloader/adapters/yt-dlp.js
async autoUpdate() {
    const { execAsync } = require('child_process');
    console.log('[YtDlp] Updating yt-dlp...');
    await execAsync('python -m pip install -U yt-dlp');
    console.log('[YtDlp] Update complete');
}

// Call on repeated failures or periodically
```

### Retry Strategy
1. First failure: Retry once immediately
2. Second failure: Run update, then retry
3. Third failure: Report error to user

## Last Known Working Version
- `2026.01.29` (tested 2026-01-31)

## Maintenance
This package should be updated at minimum every 2 weeks, or immediately when download errors occur.
