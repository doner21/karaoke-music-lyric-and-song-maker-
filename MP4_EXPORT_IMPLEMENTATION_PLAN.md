# MP4 Export Implementation Plan

## Overview

**Project Location:** `C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box`
**Branch:** `completed_karaokemaker_adjustments_and_changes_0.0.1`
**Objective:** Add a button in the lyric pane to export the karaoke playback (band + vocal audio mixed with lyrics visualization) to an MP4 file.

---

## Good News: Core Infrastructure Exists

The codebase already has:
- `src/utils/fastExport.js` - Canvas + audio → MP4 pipeline using `mp4-muxer`
- `src/utils/karaokeDrawer.js` - Frame-by-frame karaoke rendering
- `src/utils/AudioStemManager.js` - Band/vocal stem management
- `mp4-muxer` already in dependencies

---

## Implementation Steps

### Step 1: Add Export Button to Lyric Pane

**File:** `src/components/lyrics/KaraokeLyricsDisplay.jsx`

**Changes:**
1. Import the `Download` icon from `lucide-react`
2. Add new props: `onExportMp4`, `isExporting`, `exportProgress`
3. Add an export button in the top-right corner of the lyric pane container
4. Show progress indicator when exporting

```jsx
// New props to add
{
  onExportMp4: PropTypes.func,      // Callback to trigger export
  isExporting: PropTypes.bool,      // Export in progress flag
  exportProgress: PropTypes.number  // 0-100 progress percentage
}

// Button placement: Top-right of the lyrics container
// When isExporting=true, show progress bar instead of button
```

---

### Step 2: Create Export Handler Hook

**New File:** `src/hooks/useKaraokeExport.js`

**Purpose:** Encapsulate export logic, manage state, handle Electron file dialogs

```javascript
// Hook interface
const {
  isExporting,
  exportProgress,
  exportError,
  startExport
} = useKaraokeExport({
  bandAudioUrl,      // URL to band stem audio file
  vocalAudioUrl,     // URL to vocal stem audio file
  bandVolume,        // Current band volume (0-2)
  vocalVolume,       // Current vocal volume (0-2)
  timingJson,        // Lyrics timing data
  linesPerPage,      // Display setting
  highlightColor,    // Display setting
  trackDuration      // Total duration in seconds
});
```

**Implementation Details:**
1. Fetch and decode audio buffers from stem URLs using `fetch()` + `AudioContext.decodeAudioData()`
2. Extract lyrics/words from `timingJson` using existing normalizer
3. Call `exportToMp4()` from `fastExport.js`
4. Use Electron's `dialog.showSaveDialog()` via IPC for file save location
5. Write the MP4 blob to disk using `fs.writeFile()` via IPC

---

### Step 3: Wire Up Export in Main Player Component

**File:** `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

**Changes:**
1. Import and use `useKaraokeExport` hook
2. Pass export handler and state to `KaraokeLyricsDisplay` component
3. Ensure export is only available when:
   - Stems are loaded (`splitResult` exists)
   - Alignment is complete (`alignResult`/`timingJson` exists)
   - Not currently playing (pause playback during export)

```javascript
// In the component where KaraokeLyricsDisplay is rendered
<KaraokeLyricsDisplay
  // ...existing props
  onExportMp4={handleExportMp4}
  isExporting={isExporting}
  exportProgress={exportProgress}
/>
```

---

### Step 4: Add Electron IPC for File Save

**File:** `electron/main.js` (or `electron/preload.js`)

**New IPC Handlers:**

```javascript
// In main process
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog({
    title: 'Export Karaoke MP4',
    defaultPath: options.defaultName || 'karaoke-export.mp4',
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
  });
  return result; // { canceled, filePath }
});

ipcMain.handle('write-file', async (event, { filePath, buffer }) => {
  await fs.promises.writeFile(filePath, Buffer.from(buffer));
  return { success: true };
});
```

**File:** `electron/preload.js`

```javascript
// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, buffer) => ipcRenderer.invoke('write-file', { filePath, buffer })
});
```

---

### Step 5: Modify fastExport.js for Stem URL Support

**File:** `src/utils/fastExport.js`

**Current:** Expects pre-decoded `AudioBuffer` objects
**Needed:** Accept audio URLs and decode internally (or add helper function)

**Add helper function:**
```javascript
export async function fetchAndDecodeAudio(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}
```

**Or create wrapper function:**
```javascript
export async function exportKaraokeToMp4({
  bandAudioUrl,
  vocalAudioUrl,
  bandVolume,
  vocalVolume,
  timingJson,
  linesPerPage,
  highlightColor,
  width = 1280,
  height = 720,
  fps = 30,
  onProgress
}) {
  // 1. Fetch and decode audio
  // 2. Extract lyrics/words from timingJson
  // 3. Call existing exportToMp4() internally
  // 4. Return MP4 blob
}
```

---

### Step 6: Add Export Progress UI Component

**New File:** `src/components/lyrics/ExportProgressOverlay.jsx`

**Purpose:** Show export progress as an overlay on the lyric pane

```jsx
// Visual design
- Semi-transparent overlay over lyrics
- Circular or linear progress indicator
- Percentage text (e.g., "Exporting... 45%")
- Cancel button (optional)
```

---

## File Structure Summary

```
src/
├── components/
│   └── lyrics/
│       ├── KaraokeLyricsDisplay.jsx    [MODIFY - add export button]
│       └── ExportProgressOverlay.jsx   [NEW - progress UI]
├── hooks/
│   └── useKaraokeExport.js             [NEW - export logic hook]
└── utils/
    └── fastExport.js                   [MODIFY - add URL support]

electron/
├── main.js                             [MODIFY - add IPC handlers]
└── preload.js                          [MODIFY - expose APIs]
```

---

## Key Implementation Notes

1. **Audio Buffer Handling:** The existing `AudioStemManager.js` uses streaming (`HTMLAudioElement`) which doesn't provide buffers. For export, you must fetch the audio files directly and decode them with `AudioContext.decodeAudioData()`.

2. **Export Settings:** Use these defaults matching existing fastExport:
   - Resolution: 1280×720 (720p)
   - FPS: 30
   - Video codec: AVC1 (H.264) @ 5 Mbps
   - Audio codec: AAC @ 128 kbps

3. **Lyrics Data Flow:**
   ```
   timingJson (alignResult)
     → normalizeLyrics()
     → extract sentences + words arrays
     → pass to exportToMp4()
   ```

4. **Button Visibility Logic:**
   ```javascript
   const canExport = splitResult && alignResult && !isPlaying && !isExporting;
   ```

5. **Error Handling:** Wrap export in try/catch, show toast/alert on failure with specific error message.

---

## Testing Checklist

- [ ] Export button appears only when stems + alignment are ready
- [ ] Clicking export opens file save dialog
- [ ] Progress updates smoothly from 0-100%
- [ ] Exported MP4 plays correctly in standard players (VLC, Windows Media Player)
- [ ] Audio levels match preview (band/vocal volumes applied)
- [ ] Lyrics highlighting timing matches preview exactly
- [ ] Large files (5+ minutes) export without crashing
- [ ] Cancel export works (if implemented)

---

## Summary

This plan leverages the existing `fastExport.js` infrastructure, requiring primarily UI integration work and IPC bridging for Electron file operations. The core encoding logic is already implemented and tested.
