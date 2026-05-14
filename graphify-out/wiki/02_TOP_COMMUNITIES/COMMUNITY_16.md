---
type: community/narrative
community_id: 16
label: "Audio Error Boundary"
size: 6
cohesion: 0.00
character: code
---

# Audio Error Boundary

> **6 nodes** | **Cohesion: 0.00** (single component) | **File:** `src/components/AudioErrorBoundary.jsx`

## For Humans

**Real-world analogy:** This is the **circuit breaker** for audio components. If the Web Audio API fails (missing codec, permission denied, decode error), this catches the crash and shows a friendly message instead of a white screen. Wrap any audio component with this.

```
┌──────────────────────────────────────┐
│      AudioErrorBoundary              │
│  ┌────────────────────────────────┐  │
│  │ componentDidCatch(error)       │  │
│  │  → setState({ hasError })      │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ render()                       │  │
│  │  hasError? → fallback UI       │  │
│  │  else     → this.props.children│  │
│  └────────────────────────────────┘  │
│                                      │
│  Catches:                            │
│  • NotAllowedError (permission)      │
│  • NotSupportedError (codec)         │
│  • EncodingError (decode failure)    │
└──────────────────────────────────────┘
```

### Key Nodes
- **AudioErrorBoundary** → React error boundary for Web Audio failures
- **.getDerivedStateFromError()** → Captures error details
- **.render()** → Shows fallback UI or children

### Cohesion: 0.00 (single component)

### Bridges
- **Simple Error Boundary (C17):** Sibling error boundary for non-audio errors

## For LLMs

- **ID:** 16 · **Size:** 6 · **Cohesion:** 0.00
- **File:** `src/components/AudioErrorBoundary.jsx`
