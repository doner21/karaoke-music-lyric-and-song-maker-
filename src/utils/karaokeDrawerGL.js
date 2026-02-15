/**
 * WebGL2 Karaoke Frame Renderer — Canvas2D-to-WebGL Texture Upload
 *
 * Uses the CPU renderer (drawKaraokeFrame) for pixel-perfect rendering,
 * then uploads the result as a WebGL texture for fast GPU readback.
 *
 * This guarantees 100% pixel parity with the CPU path while preserving
 * the gl.readPixels() → raw RGBA → FFmpeg stdin streaming pipeline
 * that makes GPU export fast (via NVENC/QSV encoding, not GPU rendering).
 *
 * Architecture:
 *   drawKaraokeFrame(offscreenCtx2d, params)  ← same CPU renderer
 *           ↓
 *   gl.texImage2D(offscreenCanvas)             ← upload to GPU texture
 *           ↓
 *   Fullscreen quad blit                       ← draw texture to screen
 *           ↓
 *   gl.readPixels()                            ← fast GPU readback for export
 *
 * Usage:
 *   const glRenderer = initGL(canvas);
 *   drawKaraokeFrameGL(glRenderer, { width, height, now, ... });
 *   destroyGL(glRenderer);
 */

import { drawKaraokeFrame } from './karaokeDrawer';

// ============================================================
// SHADER SOURCES — minimal fullscreen texture blit
// ============================================================

const VERTEX_SHADER_BLIT = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_BLIT = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
    fragColor = texture(u_texture, v_texCoord);
}
`;

// ============================================================
// GPU DIAGNOSTICS
// ============================================================

function getGPUInfo(gl) {
    try {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
            return {
                vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || 'unknown',
                renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown'
            };
        }
    } catch (e) { /* extension not available */ }
    return { vendor: 'unknown', renderer: 'unknown' };
}

// ============================================================
// SHADER COMPILATION HELPERS
// ============================================================

function compileShader(gl, type, source) {
    if (gl.isContextLost()) {
        const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        throw new Error(`[GL] Cannot compile ${typeName} shader — WebGL context is lost`);
    }

    const shader = gl.createShader(type);
    if (!shader) {
        const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        const gpuInfo = getGPUInfo(gl);
        throw new Error(
            `gl.createShader(${typeName}) returned null — ` +
            `WebGL context may be lost or GPU unavailable. GPU=${gpuInfo.renderer}`
        );
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        gl.deleteShader(shader);
        throw new Error(`${typeName} shader compile error: ${info || 'unknown'}`);
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program link error: ${info}`);
    }

    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize WebGL2 renderer with Canvas2D-to-texture upload pipeline.
 *
 * @param {HTMLCanvasElement} canvas — Must have width/height set
 * @returns {Object} GL renderer state (pass to drawKaraokeFrameGL / destroyGL)
 */
export function initGL(canvas) {
    const gl = canvas.getContext('webgl2', {
        preserveDrawingBuffer: true, // Required for readPixels
        antialias: false,
        alpha: false,
        premultipliedAlpha: false
    });

    if (!gl) {
        throw new Error('[GL] WebGL2 context creation failed — browser may not support WebGL2 or GPU is unavailable');
    }

    const gpuInfo = getGPUInfo(gl);
    console.log(`[GL] Context created: ${canvas.width}x${canvas.height}, GPU=${gpuInfo.renderer}`);

    // Listen for context loss
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.error('[GL] WebGL context lost! GPU resources freed.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        console.log('[GL] WebGL context restored.');
    });

    // Compile the single blit shader program
    console.log('[GL] Compiling blit shader...');
    const blitProgram = createProgram(gl, VERTEX_SHADER_BLIT, FRAGMENT_SHADER_BLIT);
    console.log('[GL] Blit shader compiled');

    const locs = {
        a_position: gl.getAttribLocation(blitProgram, 'a_position'),
        a_texCoord: gl.getAttribLocation(blitProgram, 'a_texCoord'),
        u_texture: gl.getUniformLocation(blitProgram, 'u_texture')
    };

    // Create fullscreen quad VAO
    const quadVAO = gl.createVertexArray();
    const quadVBO = gl.createBuffer();
    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    // Fullscreen quad: position (clip space) + texCoord (flipped Y for Canvas2D top-down)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        // position    // texCoord
        -1, -1,        0, 1,   // bottom-left  → top-left of canvas
         1, -1,        1, 1,   // bottom-right → top-right of canvas
        -1,  1,        0, 0,   // top-left     → bottom-left of canvas
         1,  1,        1, 0,   // top-right    → bottom-right of canvas
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(locs.a_position);
    gl.vertexAttribPointer(locs.a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locs.a_texCoord);
    gl.vertexAttribPointer(locs.a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    // Create the texture that will receive Canvas2D output
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Create offscreen Canvas2D for CPU rendering
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const ctx2d = offscreenCanvas.getContext('2d');
    if (!ctx2d) {
        throw new Error('[GL] Failed to create offscreen Canvas 2D context');
    }

    console.log('[GL] Canvas2D-to-WebGL pipeline initialized');

    return {
        gl,
        canvas,
        blitProgram,
        locs,
        quadVAO,
        quadVBO,
        texture,
        offscreenCanvas,
        ctx2d,
        width: canvas.width,
        height: canvas.height
    };
}

// ============================================================
// MAIN DRAW FUNCTION
// ============================================================

/**
 * Draw a single karaoke frame using Canvas2D → WebGL texture upload.
 * Produces pixel-identical output to drawKaraokeFrame() (CPU path).
 *
 * @param {Object} renderer — from initGL()
 * @param {Object} params — same params as drawKaraokeFrame()
 */
export function drawKaraokeFrameGL(renderer, params) {
    const { gl, blitProgram, locs, quadVAO, texture, offscreenCanvas, ctx2d, width, height } = renderer;

    // Resize offscreen canvas if dimensions changed
    if (offscreenCanvas.width !== params.width || offscreenCanvas.height !== params.height) {
        offscreenCanvas.width = params.width;
        offscreenCanvas.height = params.height;
    }

    // Step 1: Render using the CPU renderer (identical to Canvas 2D path)
    drawKaraokeFrame(ctx2d, params);

    // Step 2: Upload Canvas2D output to WebGL texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreenCanvas);

    // Step 3: Blit the texture to the WebGL framebuffer
    gl.viewport(0, 0, params.width, params.height);
    gl.useProgram(blitProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(locs.u_texture, 0);

    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Destroy WebGL renderer and free GPU resources.
 *
 * @param {Object} renderer — from initGL()
 */
export function destroyGL(renderer) {
    if (!renderer) return;

    const { gl, blitProgram, quadVAO, quadVBO, texture } = renderer;

    gl.deleteProgram(blitProgram);
    gl.deleteVertexArray(quadVAO);
    gl.deleteBuffer(quadVBO);
    gl.deleteTexture(texture);

    // Lose context to free GPU resources
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();

    console.log('[GL] Renderer destroyed');
}
