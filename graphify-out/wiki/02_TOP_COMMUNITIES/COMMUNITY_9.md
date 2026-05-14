---
type: community/narrative
community_id: 9
label: "yt-dlp Updater"
size: 15
cohesion: 0.24
character: code
---

# yt-dlp Updater

> **15 nodes** | **Cohesion: 0.24** | **Primary files:** `server/services/ytdlp-updater.js`, `server-proxy.js`

## For Humans

Keeps yt-dlp (the YouTube download CLI) up to date. Runs on server startup, checks the installed version against PyPI, and updates if behind. Uses `server-proxy.js` for CLI access.

### Key Nodes
- `checkForUpdate()` — compares local version with latest PyPI release
- `performUpdate()` — runs `pip install --upgrade yt-dlp` in venv
- `server-proxy.js` — Node.js proxy for Python CLI commands

## For LLMs
- **ID:** 9 | **Size:** 15 nodes | **Cohesion:** 0.24
- **Key files:** `server/services/ytdlp-updater.js`, `server-proxy.js`
