---
type: community/narrative
community_id: 16
label: "Audio Error Boundary"
size: 6
cohesion: 0.00
character: code
---

# Audio Error Boundary

> **6 nodes** | **Cohesion: 0.00** | **Primary file:** `src/components/AudioErrorBoundary.jsx`

React error boundary that catches Web Audio API failures (missing codecs, permission denied, decode errors) and shows a user-friendly fallback instead of a white screen. Wrap any audio-playing component with this to prevent crashes from bubbling up.

### Key Nodes
- `AudioErrorBoundary` — catches audio errors in child component tree
- `.getDerivedStateFromError()` — updates state on error
- `.render()` — shows fallback UI when error caught

## For LLMs
- **ID:** 16 | **Size:** 6 nodes | **Cohesion:** 0.00
- **Key file:** `src/components/AudioErrorBoundary.jsx`
- **Related:** Community 17 (SimpleErrorBoundary) — generic error boundary for non-audio errors
