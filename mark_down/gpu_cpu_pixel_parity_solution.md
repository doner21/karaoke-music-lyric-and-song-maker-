# Solving GPU vs CPU Rendering Parity for Lyric/Text Overlays

## The Problem

When rendering styled text (karaoke lyrics, subtitles, captions, etc.) to video frames, a common architecture uses two rendering paths:

- **CPU path**: Canvas 2D (`fillText`, `shadowBlur`, `clip`) for preview and fallback
- **GPU path**: WebGL2 (font atlas, shaders, FBOs) for fast export via `gl.readPixels()`

These two paths produce **visually different output** because they use fundamentally different algorithms:

| Source of Divergence | CPU (Canvas 2D) | GPU (WebGL) |
|---|---|---|
| **Text rendering** | Native `fillText` with browser sub-pixel AA | Pre-rendered glyph atlas with texture sampling |
| **Text baseline** | `textBaseline: 'alphabetic'` (native) | `textBaseline: 'top'` + manual ascent offset (`fontSize * 0.8`) |
| **Glow/shadow** | `shadowBlur` (browser-native Gaussian) | Multi-pass FBO Gaussian blur (custom kernel) |
| **Anti-aliasing** | Sub-pixel AA from OS/browser | Bilinear texture filtering on atlas lookups |
| **Compositing** | Per-draw-call compositing with `globalAlpha` | Per-line FBO composite that overwrites previous content |

These differences are **inherent to maintaining two separate rendering pipelines**. You cannot make them produce identical output without converging to a single pipeline.

## The Root Cause (Generalised)

Any time you have **two independent implementations** of the same visual output (one CPU, one GPU), you will hit pixel divergence from:

1. **Font rasterization differences** - Atlas-based text never matches native `fillText` exactly
2. **Blur algorithm differences** - Gaussian kernel approximations vs native shadow implementations
3. **Coordinate system mismatches** - Baseline handling, Y-axis direction, sub-pixel positioning
4. **Compositing order bugs** - FBO-based compositing can overwrite content from earlier draw calls
5. **Precision differences** - Float precision in shaders vs Canvas 2D internal math

## The Solution: Canvas2D-to-WebGL Texture Upload

**Use a single renderer (CPU) for both paths.** The GPU path becomes a thin bridge that uploads the CPU-rendered output as a WebGL texture.

### Why This Works

The real performance win in GPU export is **not** GPU rendering of text. It is:

1. **GPU video encoding** (NVENC h264_nvenc, QSV h264_qsv) - 10-50x faster than libx264
2. **Raw pixel streaming** (`gl.readPixels()` to FFmpeg stdin) - eliminates PNG encode/decode + disk I/O
3. **Zero-copy pipeline** - RGBA buffer goes straight from GPU memory to the encoder

Canvas 2D text rendering at 1080p takes ~20ms/frame. At 30fps that is well within budget. The bottleneck was never rendering - it was encoding and I/O.

### Architecture

```
BEFORE (two pipelines, ~98% pixel match):

  CPU: Canvas2D fillText + shadowBlur + clip    --> toDataURL(PNG) --> disk --> FFmpeg
  GPU: Font atlas + shaders + FBO blur          --> gl.readPixels  --> FFmpeg stdin

AFTER (single pipeline, 100% pixel match):

  Both: Canvas2D fillText + shadowBlur + clip
           |
           v
        gl.texImage2D(offscreenCanvas)    <-- upload CPU output to GPU texture
           |
           v
        Fullscreen quad blit              <-- simple passthrough shader
           |
           v
        gl.readPixels()                   <-- fast GPU readback for export
```

### Implementation Pattern

#### 1. Single Blit Shader (replaces all previous shaders)

```glsl
// Vertex
#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}

// Fragment
#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;
void main() {
    fragColor = texture(u_texture, v_texCoord);
}
```

#### 2. Init: Create WebGL context + offscreen Canvas2D

```javascript
export function initGL(canvas) {
    const gl = canvas.getContext('webgl2', {
        preserveDrawingBuffer: true,  // Required for readPixels
        antialias: false,             // Not needed - blitting a pre-rendered texture
        alpha: false,
        premultipliedAlpha: false
    });

    // Compile single blit shader, create fullscreen quad VAO, create texture
    // Create offscreen canvas + 2D context (same dimensions as WebGL canvas)

    return { gl, blitProgram, quadVAO, texture, offscreenCanvas, ctx2d, ... };
}
```

#### 3. Draw: CPU render, upload, blit

```javascript
export function drawFrameGL(renderer, params) {
    const { gl, blitProgram, quadVAO, texture, offscreenCanvas, ctx2d } = renderer;

    // Step 1: Render with the CPU renderer (THE SAME FUNCTION used by the CPU path)
    drawFrame(ctx2d, params);

    // Step 2: Upload to GPU texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreenCanvas);

    // Step 3: Blit to WebGL framebuffer
    gl.viewport(0, 0, params.width, params.height);
    gl.useProgram(blitProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(u_texture_loc, 0);
    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
```

#### 4. Cleanup

```javascript
export function destroyGL(renderer) {
    gl.deleteProgram(blitProgram);
    gl.deleteVertexArray(quadVAO);
    gl.deleteBuffer(quadVBO);
    gl.deleteTexture(texture);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
}
```

### Critical Details

| Detail | Why It Matters |
|---|---|
| **`gl.NEAREST` filtering** on the texture | Prevents bilinear interpolation from altering pixels during the blit. Must be NEAREST, not LINEAR. |
| **Y-flipped texcoords** on the quad | Canvas2D is top-down (Y=0 at top). WebGL is bottom-up (Y=0 at bottom). The quad's UV must flip Y. |
| **`antialias: false`** on context | We are blitting a pre-rendered image, not rendering geometry. AA would blur the output. |
| **`preserveDrawingBuffer: true`** | Required for `gl.readPixels()` to return valid data after the frame is drawn. |
| **`premultipliedAlpha: false`** | Prevents the browser from premultiplying alpha, which would alter RGB values. |
| **Offscreen canvas resize check** | If frame dimensions change between calls, resize the offscreen canvas to match. |

### Fullscreen Quad Vertex Data (with Y-flip)

```javascript
// position (clip space) + texCoord (flipped Y)
new Float32Array([
    -1, -1,   0, 1,   // bottom-left  screen -> top-left  canvas
     1, -1,   1, 1,   // bottom-right screen -> top-right canvas
    -1,  1,   0, 0,   // top-left     screen -> bottom-left  canvas
     1,  1,   1, 0,   // top-right    screen -> bottom-right canvas
])
```

## What This Approach Removes

- Font atlas generation and caching
- All text/glyph vertex building
- FBO-based Gaussian blur pipeline (multiple render passes)
- Composite shaders
- Scissor-test-based highlight clipping in WebGL
- ~900 lines of complex, hard-to-maintain shader code

## What This Approach Keeps

- GPU video encoding pipeline (NVENC, QSV, FFmpeg streaming)
- `gl.readPixels()` raw RGBA readback
- The entire CPU renderer (untouched - it IS the renderer for both paths now)
- The export pipeline (`electronExport.js`) - same API, no changes needed
- GPU capability detection (`gpuCapabilities.js`) - still needed for encoder selection

## When to Use This Pattern

Use this approach when **all** of these are true:

1. You need `gl.readPixels()` for fast pixel readback (e.g., streaming to FFmpeg)
2. The rendering is text/overlay-heavy (not 3D geometry or particle effects)
3. The CPU renderer already exists and produces the correct output
4. The performance bottleneck is encoding/I/O, not rendering
5. Pixel-perfect parity between preview and export is a requirement

## When NOT to Use This Pattern

- If rendering is the bottleneck (complex 3D scenes, millions of particles)
- If you don't need `gl.readPixels()` (pure display, no export)
- If Canvas 2D can't render the effect at all (custom shaders, GPU compute)
- If frame times exceed your budget (Canvas 2D at 4K may be too slow for 60fps)

## Performance Characteristics

| Operation | Typical Time (1080p) | Notes |
|---|---|---|
| Canvas 2D text render | ~15-25ms | Depends on line count and glow complexity |
| `gl.texImage2D` upload | ~1-3ms | Browser optimises canvas-to-texture path |
| Fullscreen quad blit | <1ms | Trivial GPU operation |
| `gl.readPixels` | ~2-5ms | Synchronous GPU readback |
| **Total per frame** | **~20-30ms** | Well within 33ms budget for 30fps |

The export speed improvement comes from the **encoding side** (NVENC vs libx264), not the rendering side. This approach trades ~0ms of GPU rendering time for ~20ms of CPU rendering time, but saves ~200ms+ per frame on the encode/IO path.
