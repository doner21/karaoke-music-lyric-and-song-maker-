# Skill: Codebase Reference for Cycle 002

## Purpose
Quick-reference guide to existing code patterns the Executor must follow for consistency.

---

## Project Structure

```
karaoke-box/
├── package.json                    # React 18 + Vite + Electron
├── vite.config.js                  # Vite bundler config
├── tailwind.config.js              # Tailwind CSS config
├── server-proxy.js                 # Express backend (port 3001)
├── src/
│   ├── main.jsx                    # React entry
│   ├── App.jsx                     # Root wrapper
│   ├── components/
│   │   ├── karaoke-designs/
│   │   │   └── IntegratedEcologicalOS.jsx  # MAIN UI (1743 lines)
│   │   ├── lyrics/                 # Lyrics rendering components
│   │   └── editor/                 # NEW — token editor components
│   ├── editor/                     # NEW — token model + logic
│   │   ├── tokenModel.js
│   │   ├── jsonAdapters.js
│   │   ├── tokenTransforms.js
│   │   ├── undoStack.js
│   │   ├── useTokenEditor.js
│   │   └── __tests__/
│   ├── hooks/
│   │   ├── usePlaybackTime.js      # Playback time hook
│   │   └── useKaraokeExport.js     # MP4 export hook
│   ├── utils/
│   │   ├── AudioStemManager.js     # Stem audio player (476 lines)
│   │   ├── karaokeHelpers.js       # Existing word editing helpers
│   │   ├── lyricsTimingNormalizer.js
│   │   └── ...
│   └── assets/
│       └── wildflower_demo.json    # Demo timing data (test fixture)
```

---

## Existing Code Conventions

### Imports
```js
// React
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Icons (lucide-react)
import { Play, Pause, Settings, Download, Pencil } from 'lucide-react';

// Internal
import { someHelper } from '../utils/karaokeHelpers';
```

### Component Pattern
```jsx
export default function ComponentName({ prop1, prop2 }) {
  const [state, setState] = useState(initialValue);

  return (
    <div className="tailwind-classes">
      {/* content */}
    </div>
  );
}
```

### Styling
- Tailwind utility classes everywhere
- Dark theme: `bg-gray-900`, `bg-gray-800`, `text-gray-100`, `text-gray-400`
- Accent colors: `cyan-400/500/600/700` (primary), `green` (success), `red` (danger)
- Borders: `border-gray-700`, `border-gray-600`
- Buttons: `px-2 py-1 rounded text-xs` or `px-3 py-1.5 rounded text-sm`
- Hover: `hover:bg-gray-700`

### State Management
- All state via `useState` hooks
- No Redux, no Context API, no Zustand
- State lifted to parent component and passed as props
- Callbacks passed down for child → parent communication

### Existing Canonical JSON Format
```json
{
  "title": "SONG TITLE",
  "artist": "Artist Name",
  "method": "audioshake",
  "lyrics": [
    {
      "sentence": { "start": 15.2, "end": 20.8, "text": "Full sentence text" },
      "words": [
        { "start": 15.2, "end": 15.6, "text": "Word1" },
        { "start": 15.8, "end": 16.0, "text": "Word2" }
      ]
    }
  ]
}
```

**Times are in SECONDS (float).** Internal token model uses MILLISECONDS (int).

### Existing Audio System
- `AudioStemManager.js` — HTMLAudioElement + Web Audio API gain nodes
- Methods: `loadStems()`, `play()`, `pause()`, `seekTo()`, `setVolume()`, `getCurrentTime()`, `getDuration()`
- The editor does NOT use AudioStemManager directly in Cycle 002

### Existing Helper Functions (karaokeHelpers.js)
- `wordKey(si, wi)` — creates "si:wi" key (legacy, replaced by token.id in new model)
- `indexLyrics(lyrics)` — adds _si/_wi indices to words
- `computeAdjustedSentences()` — applies deltas/edits to word timings (similar purpose to new transforms but mutable)
- `clamp01()`, `clamp()` — numeric clamping
- `prettyTime(sec)` — format seconds as "M:SS"

---

## Key Integration Point

The executor modifies `IntegratedEcologicalOS.jsx` at line ~1000+ where COL 2 (Studio panel) is rendered. The existing structure is roughly:

```jsx
{/* COL 2 - STUDIO */}
<div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
  {/* Player section - top 40% */}
  <div className="relative" style={{ height: '40%' }}>
    {/* YouTube player, transport, volume controls */}
  </div>

  {/* Lyrics section - bottom 60% */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Lyrics toolbar */}
    {/* KaraokeLyricsDisplay or textarea */}
  </div>
</div>
```

When `editorMode === true`, the ENTIRE COL 2 content should be replaced with `<TokenEditorPanel />`. When false, show the normal Studio content.

---

## File Size Guidelines

Based on existing patterns:
- `IntegratedEcologicalOS.jsx`: ~1743 lines (large orchestrator)
- `AudioStemManager.js`: ~476 lines (complex utility)
- `karaokeHelpers.js`: ~196 lines (utility functions)
- New files should aim for 100-400 lines each
- If a file exceeds 500 lines, consider splitting
