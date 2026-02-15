# GPU-CPU Rendering Parity — Implementation Plan

## Goal
Achieve 100% visual match between the GPU (`drawKaraokeFrameGL`) and CPU (`drawKaraokeFrame`) export renderers. Currently at 98% — the remaining 2% is caused by fundamental differences in how glow, text, and highlights are rendered.

## Root Causes (5 Issues)

### 1. Composite Shader Overwrites Framebuffer (Critical)
The `drawWithGlow` function composites a full-screen quad back to the default framebuffer using `FRAGMENT_SHADER_COMPOSITE`. This quad covers **all** pixels, including areas where other content was already rendered (e.g., previously drawn lines). The composite shader's alpha output formula also doesn't match the CPU's `shadowBlur` behavior.

**CPU**: `shadowBlur`/`shadowColor` is per-`fillText()` call — each word gets its own isolated glow.
**GPU**: `drawWithGlow` renders ALL words in a line to an FBO, blurs, then composites the ENTIRE FBO as a full-screen quad.

### 2. Glyph Width Measurement Mismatch (Moderate)  
The atlas uses `Math.ceil(metrics.width)` for `advance`, but the CPU uses `ctx.measureText(w.text).width` directly (full floating-point precision). Over a line of many words, these rounding errors accumulate, shifting word positions.

### 3. Text Baseline/Position Mismatch (Moderate)
The atlas renders with `textBaseline = 'top'` and positions quads at `y - atlas.fontSize`. The CPU renders with the default baseline. This creates a vertical offset between CPU and GPU text.

### 4. Scissor Y-Coordinate Precision (Minor)
Scissor uses integer `Math.floor`/`Math.ceil` for the clip rect — this can include/exclude 1-2 extra pixels compared to the CPU's `ctx.clip()` which uses sub-pixel precision.

### 5. `pixelWidth` vs Actual Glyph Width (Minor)
`glyph.pixelWidth` stores `Math.ceil(metrics.width)` but the atlas texture actually contains the full rendered character including any fractional pixel anti-aliasing. The scissor clip uses word width from `measureTextGL` which sums integer `advance` values — misaligned from actual rendered glyph edges.

## Proposed Changes

### [MODIFY] [karaokeDrawerGL.js](file:///c:/Users/donald%20clark/.gemini/antigravity/scratch/karaoke-box/src/utils/karaokeDrawerGL.js)

#### Fix 1: Don't use glow composite for lyrics — match CPU's shadowBlur approach
Instead of the multi-pass FBO glow, **draw text twice** on the default framebuffer:
1. First pass (glow): draw text with low opacity and slightly larger/offset — simulates `shadowBlur`
2. Second pass (crisp): draw text at normal position and opacity
This eliminates the full-screen composite that overwrites the framebuffer.

> [!IMPORTANT]
> This is the biggest change — replaces `drawWithGlow` for lyrics only. The interval display can keep its FBO glow since it doesn't have highlight overlays.

#### Fix 2: Use floating-point glyph advance
Change `advance: Math.ceil(metrics.width)` → `advance: metrics.width` in `generateFontAtlas()` to preserve sub-pixel precision, matching the CPU's `measureText`.

#### Fix 3: Align text baseline
Set `ctx.textBaseline = 'alphabetic'` in the atlas (matching the CPU's default), and adjust the quad Y-position in `buildTextVertices` accordingly.

#### Fix 4: Use floating-point scissor approximation
Since `gl.scissor` requires integers, use `gl.BLEND` with a clip-mask approach instead, or accept the 1px precision difference by using `Math.round` consistently.

#### Fix 5: Consistent glyph metrics
Store unrounded `pixelWidth: metrics.width` in the atlas for metrics-based calculations.

## Verification Plan

### Automated
1. Run `#/verify` in the browser with a song that has alignment data
2. Scrub to an active lyrics frame and take a snapshot  
3. Target: **99%+** pixel match (minor anti-aliasing allowed)

### Manual
1. Run Full Sweep across the entire song
2. Compare App Preview | CPU | GPU columns visually
3. Check highlights, word positions, and glow consistency
