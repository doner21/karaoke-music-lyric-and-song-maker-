# GPU Shader Fix Implementation Plan

## Goal
Fix the `[ElectronExport] WebGL2 init failed` error during MP4 export caused by a shader compilation failure.

## Problem Description
The current GPU rendering implementation fails to initialize WebGL2 because the fragment shader uses the variable name `sample`. 
`sample` is a reserved keyword in GLSL ES 3.00 (the shading language used by WebGL2), causing the shader compiler to throw:
`ERROR: 0:16: 'sample' : Illegal use of reserved word`

This forces the application to fall back to the slower Canvas 2D CPU rendering path, or fail entirely if the fallback logic is insufficient.

## Root Cause
In `src/utils/karaokeDrawerGL.js`, the `FRAGMENT_SHADER_TEXT` source code contains:
```glsl
vec4 sample = texture(u_atlas, v_texCoord);
float alpha = max(sample.r, max(sample.g, sample.b));
```
The variable name `sample` clashes with the GLSL reserved keyword.

## Proposed Changes

### 1. Rename Reserved Keyword in `src/utils/karaokeDrawerGL.js`

**File:** `src/utils/karaokeDrawerGL.js`

**Change:** Rename local variable `sample` to `texColor` (or a similar non-reserved name) in `FRAGMENT_SHADER_TEXT`.

```diff
-    vec4 sample = texture(u_atlas, v_texCoord);
-    float alpha = max(sample.r, max(sample.g, sample.b));
+    vec4 texColor = texture(u_atlas, v_texCoord);
+    float alpha = max(texColor.r, max(texColor.g, texColor.b));
```

## Verification Plan

### Manual Verification
1.  Run the application.
2.  Attempt to export a karaoke video (which triggers the GPU export path).
3.  Monitor the console logs.
4.  **Success Condition:** The error `[ElectronExport] WebGL2 init failed` causing fallback to Canvas 2D should no longer appear. The export should proceed using the GPU path.

### Automated Verification (if applicable)
Since this requires a WebGL2 context (which is difficult to mock in a headless node environment without headless-gl), manual verification via the Electron app is the most reliable method.
