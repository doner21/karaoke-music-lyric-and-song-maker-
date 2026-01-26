# Implementation Plan: Karaoke-Box UI Layout Fixes

## Overview
Fix three UI layout issues in the karaoke-box application to improve usability on smaller screens.

## Files to Modify
- `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` (primary)
- `src/index.css` (add scrollbar styles)

---

## Issue 1: FAB_PROCESSOR Right Column Scroll

**Problem:** Display Config settings at the bottom of the right panel are not accessible on smaller screens.

**Changes in IntegratedEcologicalOS.jsx:**

### Line 1254 - Add `overflow-hidden` to parent container
```jsx
// BEFORE:
<div className="flex flex-col bg-[#05080c]">

// AFTER:
<div className="flex flex-col bg-[#05080c] overflow-hidden">
```

### Line 1262 - Add `flex-1` and `custom-scrollbar` to scrollable content
```jsx
// BEFORE:
<div className="p-4 space-y-8 overflow-y-auto">

// AFTER:
<div className="flex-1 p-4 space-y-8 overflow-y-auto custom-scrollbar">
```

---

## Issue 2: YouTube Search Song List Overflow

**Problem:** Song titles may extend past the edge on smaller screens.

**Changes in IntegratedEcologicalOS.jsx:**

### Line 937 - Add `overflow-hidden` to the button
```jsx
// BEFORE:
<button key={i} onClick={() => handleSongSelect(r)} className={`w-full flex items-start gap-3 p-2 rounded border text-left transition-all ${selectedSong?.videoId === r.videoId ? 'bg-emerald-900/20 border-emerald-500/30' : 'border-transparent hover:bg-slate-900'}`}>

// AFTER:
<button key={i} onClick={() => handleSongSelect(r)} className={`w-full flex items-start gap-3 p-2 rounded border text-left transition-all overflow-hidden ${selectedSong?.videoId === r.videoId ? 'bg-emerald-900/20 border-emerald-500/30' : 'border-transparent hover:bg-slate-900'}`}>
```

### Line 942 - Add `flex-1` to text container
```jsx
// BEFORE:
<div className="min-w-0">

// AFTER:
<div className="min-w-0 flex-1">
```

---

## Issue 3: Volume Sliders Crossing Boundaries

**Problem:** Band stem slider crosses from YouTube video pane into audio splitter area on smaller screens.

**Changes in IntegratedEcologicalOS.jsx:**

### Line 1091 - Add `overflow-hidden` to parent controls container
```jsx
// BEFORE:
<div className="flex items-center gap-3">

// AFTER:
<div className="flex items-center gap-3 overflow-hidden">
```

### Line 1161 - Add `shrink` to vocal slider container
```jsx
// BEFORE:
<div className="flex items-center gap-1.5 group" title="Vocal Volume">

// AFTER:
<div className="flex items-center gap-1.5 group shrink" title="Vocal Volume">
```

### Line 1171 - Make vocal slider responsive
```jsx
// BEFORE:
className={`w-14 h-1 rounded-full cursor-pointer accent-rose-500 ${!useStems ? 'opacity-30' : ''}`}

// AFTER:
className={`min-w-8 max-w-14 w-full h-1 rounded-full cursor-pointer accent-rose-500 ${!useStems ? 'opacity-30' : ''}`}
```

### Line 1176 - Add `shrink` to band slider container
```jsx
// BEFORE:
<div className="flex items-center gap-1.5 group" title="Band Volume">

// AFTER:
<div className="flex items-center gap-1.5 group shrink" title="Band Volume">
```

### Line 1186 - Make band slider responsive
```jsx
// BEFORE:
className={`w-14 h-1 rounded-full cursor-pointer accent-cyan-500 ${!useStems ? 'opacity-30' : ''}`}

// AFTER:
className={`min-w-8 max-w-14 w-full h-1 rounded-full cursor-pointer accent-cyan-500 ${!useStems ? 'opacity-30' : ''}`}
```

---

## Issue 4: Custom Scrollbar Styling (Enhancement)

**Problem:** The `custom-scrollbar` class is used but not defined, falling back to browser defaults.

**Add to `src/index.css`:**
```css
/* Custom Scrollbar Styles */
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #475569;
}

/* Firefox */
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #334155 transparent;
}
```

---

## Summary of Changes

| Location | Line | Change |
|----------|------|--------|
| IntegratedEcologicalOS.jsx | 937 | Add `overflow-hidden` to song button |
| IntegratedEcologicalOS.jsx | 942 | Add `flex-1` to text container |
| IntegratedEcologicalOS.jsx | 1091 | Add `overflow-hidden` to volume controls |
| IntegratedEcologicalOS.jsx | 1161 | Add `shrink` to vocal slider container |
| IntegratedEcologicalOS.jsx | 1171 | Change `w-14` to `min-w-8 max-w-14 w-full` |
| IntegratedEcologicalOS.jsx | 1176 | Add `shrink` to band slider container |
| IntegratedEcologicalOS.jsx | 1186 | Change `w-14` to `min-w-8 max-w-14 w-full` |
| IntegratedEcologicalOS.jsx | 1254 | Add `overflow-hidden` to FAB_PROCESSOR container |
| IntegratedEcologicalOS.jsx | 1262 | Add `flex-1 custom-scrollbar` to content area |
| index.css | (new) | Add custom scrollbar CSS |

---

## Verification

1. **FAB_PROCESSOR Scroll:**
   - Resize browser to height < 800px
   - Verify all 5 sections (ACQUISITION, SPLITTING, ALIGNMENT, EXPORT, DISPLAY CONFIG) are scrollable
   - Confirm scrollbar appears and styling matches theme

2. **Song List Overflow:**
   - Search for songs with long titles
   - Verify titles truncate with ellipsis
   - Resize window to narrow width and confirm no horizontal overflow

3. **Volume Sliders:**
   - Resize browser to various widths
   - Verify sliders shrink proportionally (min 32px, max 56px)
   - Confirm no overlap with YouTube player or audio splitter boundaries
   - Test that sliders remain functional at minimum size
