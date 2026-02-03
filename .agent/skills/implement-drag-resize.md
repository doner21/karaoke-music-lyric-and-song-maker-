# Skill: Implement Drag & Resize Interaction Logic

## Purpose
Implement mouse-based drag-to-move and edge-resize interactions for token blocks on the timeline.

## Where This Logic Lives
Primarily in `TokenTimeline.jsx` with event delegation, NOT in individual `TokenBlock` components.

## Interaction Model

### State Machine

```
IDLE → (mousedown on token body) → DRAG_PENDING → (mousemove > 3px threshold) → DRAGGING → (mouseup) → IDLE
IDLE → (mousedown on token edge) → RESIZE_PENDING → (mousemove > 3px threshold) → RESIZING → (mouseup) → IDLE
IDLE → (mousedown on empty space) → MARQUEE_PENDING → (mousemove) → MARQUEE_SELECT → (mouseup) → IDLE
```

### Drag Threshold
A 3px movement threshold prevents accidental drags when clicking to select.

## Implementation Pattern

Use `useRef` for drag state (avoids re-renders during drag):

```js
const dragRef = useRef({
  mode: 'idle',          // 'idle' | 'dragging' | 'resizing'
  startX: 0,             // mouse X at drag start
  startMs: 0,            // token startMs at drag start
  tokenId: null,         // which token is being dragged
  edge: null,            // 'left' | 'right' | null
  originalTokens: null,  // snapshot for preview
});
```

### Mouse Down Handler
```
1. Determine which token was clicked (from event target data attributes)
2. Determine zone: body vs left-edge vs right-edge
3. If no token hit: start marquee select (or clear selection)
4. If token hit on body:
   - If not already selected: select it first (replace mode)
   - Set dragRef: mode='drag_pending', startX, startMs
5. If token hit on edge:
   - Set dragRef: mode='resize_pending', edge, startX
```

### Mouse Move Handler (on timeline container)
```
1. If mode is *_pending and delta > 3px: transition to dragging/resizing
2. If dragging:
   - deltaMs = (currentX - startX) / pxPerMs
   - Show ghost preview (CSS transform, NOT dispatching to state)
   - This is a visual-only preview; state updates on mouseup
3. If resizing:
   - newMs = startMs + (currentX - startX) / pxPerMs
   - Show edge preview (visual only)
```

### Mouse Up Handler
```
1. If dragging:
   - Calculate final deltaMs
   - Dispatch moveTokens(selectionIds, deltaMs) to state
   - Clear dragRef
2. If resizing:
   - Calculate final newStartMs or newEndMs
   - Dispatch resizeTokenStart or resizeTokenEnd
   - Clear dragRef
3. Reset mode to 'idle'
```

## Performance Notes

- During drag/resize, do NOT call `setTokens()` on every mousemove. Use CSS transforms for visual preview.
- Only dispatch the state update on mouseup (single undo entry per drag operation).
- Use `pointer-events: none` on non-dragged tokens during drag to prevent interference.
- Add `will-change: transform` to dragging token for GPU acceleration.

## Converting Pixels to Milliseconds

```js
const xToMs = (clientX) => {
  const rect = timelineRef.current.getBoundingClientRect();
  const relativeX = clientX - rect.left + scrollLeftPx;
  return relativeX / pxPerMs;
};

const msToX = (ms) => {
  return ms * pxPerMs - scrollLeftPx;
};
```

## Edge Detection

In `TokenBlock`, apply `data-token-id` and `data-zone` attributes:

```jsx
<div
  data-token-id={token.id}
  style={{ left, width, position: 'absolute', top: 0, height: '100%' }}
>
  <div data-zone="left-edge" className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize" />
  <div data-zone="body" className="absolute left-1.5 right-1.5 top-0 bottom-0 cursor-grab" />
  <div data-zone="right-edge" className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize" />
</div>
```

## CSS During Drag

```css
/* Applied to timeline container during drag */
.dragging { cursor: grabbing !important; user-select: none; }

/* Ghost preview on dragged tokens */
.token-dragging { opacity: 0.7; z-index: 10; }
```
