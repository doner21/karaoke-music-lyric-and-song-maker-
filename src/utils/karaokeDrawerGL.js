/**
 * WebGL2 Karaoke Frame Renderer — GPU-Accelerated Export Path
 * 
 * Implements the same visual output as drawKaraokeFrame() (Canvas 2D) but using
 * WebGL2 for GPU-accelerated rendering. This eliminates CPU bottleneck during
 * frame rendering at high resolutions (1080p+).
 * 
 * Architecture:
 * - Font Atlas: Pre-renders glyphs to a 2D canvas, uploads as WebGL texture
 * - Text Rendering: Each character = 1 textured quad, positioned using glyph metrics
 * - Highlight: Fragment shader clips text color based on word progress uniform
 * - Glow: Multi-pass Gaussian blur via FBO (framebuffer objects)
 * - Interval Display: Simple quads for progress bar + text
 * 
 * Resolution Scaling: All dimensions use scaleFactor = height / 720 (matches CPU path)
 * 
 * Usage:
 *   const glRenderer = initGL(canvas);
 *   drawKaraokeFrameGL(glRenderer, { width, height, now, ... });
 *   destroyGL(glRenderer);
 */

import { clamp01, prettyTime } from './karaokeHelpers';

// ============================================================
// SHADER SOURCES
// ============================================================

const VERTEX_SHADER_TEXT = `#version 300 es
precision highp float;

// Per-vertex attributes
in vec2 a_position;   // Quad vertex position (clip space)
in vec2 a_texCoord;   // UV into font atlas

// Per-instance uniforms
uniform mat4 u_projection;

out vec2 v_texCoord;

void main() {
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_TEXT = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_atlas;
uniform vec3 u_color;
uniform float u_opacity;

out vec4 fragColor;

void main() {
    // Use max of RGB channels for alpha — avoids premultiplied alpha issues
    // White text on transparent canvas: R=G=B=A at opaque pixels,
    // but some browsers premultiply alpha differently
    vec4 sample = texture(u_atlas, v_texCoord);
    float alpha = max(sample.r, max(sample.g, sample.b));
    fragColor = vec4(u_color, alpha * u_opacity);
}
`;

const VERTEX_SHADER_QUAD = `#version 300 es
precision highp float;

in vec2 a_position;

uniform mat4 u_projection;

void main() {
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_QUAD = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 fragColor;

void main() {
    fragColor = u_color;
}
`;

// Gaussian blur shaders for glow effect
const VERTEX_SHADER_BLUR = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_BLUR = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_direction; // (1/w, 0) for horizontal, (0, 1/h) for vertical
uniform float u_blurSize;

out vec4 fragColor;

void main() {
    vec4 color = vec4(0.0);
    
    // 9-tap Gaussian kernel
    float weights[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    
    color += texture(u_texture, v_texCoord) * weights[0];
    
    for (int i = 1; i < 5; i++) {
        vec2 offset = u_direction * float(i) * u_blurSize;
        color += texture(u_texture, v_texCoord + offset) * weights[i];
        color += texture(u_texture, v_texCoord - offset) * weights[i];
    }
    
    fragColor = color;
}
`;

// Composite shader — blends glow behind text
const FRAGMENT_SHADER_COMPOSITE = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_textTexture;
uniform sampler2D u_glowTexture;
uniform vec3 u_glowColor;
uniform float u_glowIntensity;

out vec4 fragColor;

void main() {
    vec4 textColor = texture(u_textTexture, v_texCoord);
    vec4 glowColor = texture(u_glowTexture, v_texCoord);
    
    // Glow behind text
    vec3 glow = u_glowColor * glowColor.a * u_glowIntensity;
    vec3 combined = glow * (1.0 - textColor.a) + textColor.rgb * textColor.a;
    float alpha = max(textColor.a, glowColor.a * u_glowIntensity);
    
    fragColor = vec4(combined, alpha);
}
`;

// ============================================================
// SHADER COMPILATION HELPERS
// ============================================================

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compile error: ${info}`);
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

    // Detach and delete shaders after linking
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
}

// ============================================================
// FONT ATLAS
// ============================================================

/**
 * Generate a font texture atlas using Canvas 2D.
 * Renders all printable ASCII + common Unicode characters to a 2D canvas,
 * uploads as a WebGL texture, and returns glyph metrics.
 */
function generateFontAtlas(gl, fontFamily, fontSize) {
    const ATLAS_SIZE = 2048;
    const PADDING = 4; // Padding between glyphs in atlas

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ATLAS_SIZE;
    tempCanvas.height = ATLAS_SIZE;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Clear to transparent
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Set font
    ctx.font = `bold ${fontSize}px "${fontFamily}", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';

    // Character set — printable ASCII + common accented/unicode ranges
    const chars = [];
    // Basic ASCII printable
    for (let i = 32; i <= 126; i++) chars.push(String.fromCharCode(i));
    // Extended Latin (accented characters)
    for (let i = 192; i <= 255; i++) chars.push(String.fromCharCode(i));
    // Common punctuation and symbols
    const extraChars = '\u00A1\u00BF\u2026\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u20AC\u00A3\u00A5\u00A9\u00AE\u2122\u00B0\u00B1\u00D7\u00F7';
    extraChars.split('').forEach(c => chars.push(c));

    const glyphs = {};
    let cursorX = PADDING;
    let cursorY = PADDING;
    let rowHeight = 0;

    for (const char of chars) {
        const metrics = ctx.measureText(char);
        const charWidth = Math.ceil(metrics.width) + PADDING;
        const charHeight = fontSize + PADDING * 2;

        // Advance to next row if needed
        if (cursorX + charWidth + PADDING > ATLAS_SIZE) {
            cursorX = PADDING;
            cursorY += rowHeight + PADDING;
            rowHeight = 0;
        }

        // Check if atlas is full
        if (cursorY + charHeight > ATLAS_SIZE) {
            console.warn(`[GL Atlas] Atlas full at char '${char}', stopping at ${Object.keys(glyphs).length} glyphs`);
            break;
        }

        // Draw the character
        ctx.fillText(char, cursorX, cursorY);

        // Store glyph metrics (UV coords normalized to 0-1)
        glyphs[char] = {
            x: cursorX / ATLAS_SIZE,
            y: cursorY / ATLAS_SIZE,
            w: charWidth / ATLAS_SIZE,
            h: charHeight / ATLAS_SIZE,
            pixelWidth: Math.ceil(metrics.width),
            pixelHeight: charHeight,
            advance: Math.ceil(metrics.width)
        };

        cursorX += charWidth + PADDING;
        rowHeight = Math.max(rowHeight, charHeight);
    }

    // Upload to WebGL texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);

    // Linear filtering for smooth text
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    console.log(`[GL Atlas] Generated: ${Object.keys(glyphs).length} glyphs, fontSize=${fontSize}, atlas=${ATLAS_SIZE}x${ATLAS_SIZE}`);

    return { texture, glyphs, atlasSize: ATLAS_SIZE, fontSize };
}

// ============================================================
// FRAMEBUFFER OBJECTS (for glow effect)
// ============================================================

function createFBO(gl, width, height) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture, width, height };
}

function destroyFBO(gl, fboObj) {
    if (fboObj) {
        gl.deleteTexture(fboObj.texture);
        gl.deleteFramebuffer(fboObj.fbo);
    }
}

// ============================================================
// ORTHOGRAPHIC PROJECTION MATRIX
// ============================================================

function ortho(left, right, bottom, top, near, far) {
    return new Float32Array([
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, -2 / (far - near), 0,
        -(right + left) / (right - left),
        -(top + bottom) / (top - bottom),
        -(far + near) / (far - near),
        1
    ]);
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize WebGL2 renderer.
 * 
 * @param {HTMLCanvasElement} canvas — Must have width/height set
 * @returns {Object} GL renderer state (pass to drawKaraokeFrameGL / destroyGL)
 */
export function initGL(canvas) {
    const gl = canvas.getContext('webgl2', {
        preserveDrawingBuffer: true, // Required for readPixels
        antialias: true,
        alpha: false,
        premultipliedAlpha: false
    });

    if (!gl) {
        throw new Error('[GL] WebGL2 context creation failed');
    }

    console.log(`[GL] Context created: ${canvas.width}x${canvas.height}`);

    // Enable blending for transparent text
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Compile shader programs
    const textProgram = createProgram(gl, VERTEX_SHADER_TEXT, FRAGMENT_SHADER_TEXT);
    const quadProgram = createProgram(gl, VERTEX_SHADER_QUAD, FRAGMENT_SHADER_QUAD);
    const blurProgram = createProgram(gl, VERTEX_SHADER_BLUR, FRAGMENT_SHADER_BLUR);
    const compositeProgram = createProgram(gl, VERTEX_SHADER_BLUR, FRAGMENT_SHADER_COMPOSITE);

    // Get uniform/attribute locations
    const textLocs = {
        a_position: gl.getAttribLocation(textProgram, 'a_position'),
        a_texCoord: gl.getAttribLocation(textProgram, 'a_texCoord'),
        u_projection: gl.getUniformLocation(textProgram, 'u_projection'),
        u_atlas: gl.getUniformLocation(textProgram, 'u_atlas'),
        u_color: gl.getUniformLocation(textProgram, 'u_color'),
        u_opacity: gl.getUniformLocation(textProgram, 'u_opacity')
    };

    const quadLocs = {
        a_position: gl.getAttribLocation(quadProgram, 'a_position'),
        u_projection: gl.getUniformLocation(quadProgram, 'u_projection'),
        u_color: gl.getUniformLocation(quadProgram, 'u_color')
    };

    const blurLocs = {
        a_position: gl.getAttribLocation(blurProgram, 'a_position'),
        a_texCoord: gl.getAttribLocation(blurProgram, 'a_texCoord'),
        u_texture: gl.getUniformLocation(blurProgram, 'u_texture'),
        u_direction: gl.getUniformLocation(blurProgram, 'u_direction'),
        u_blurSize: gl.getUniformLocation(blurProgram, 'u_blurSize')
    };

    const compositeLocs = {
        a_position: gl.getAttribLocation(compositeProgram, 'a_position'),
        a_texCoord: gl.getAttribLocation(compositeProgram, 'a_texCoord'),
        u_textTexture: gl.getUniformLocation(compositeProgram, 'u_textTexture'),
        u_glowTexture: gl.getUniformLocation(compositeProgram, 'u_glowTexture'),
        u_glowColor: gl.getUniformLocation(compositeProgram, 'u_glowColor'),
        u_glowIntensity: gl.getUniformLocation(compositeProgram, 'u_glowIntensity')
    };

    // Create reusable quad VAO for full-screen passes
    const quadVAO = gl.createVertexArray();
    const quadVBO = gl.createBuffer();
    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        // position    // texCoord
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    // Dynamic text VBO/VAO (rebuilt each frame)
    const textVAO = gl.createVertexArray();
    const textVBO = gl.createBuffer();

    // Create FBOs for glow effect (will be resized as needed)
    const width = canvas.width;
    const height = canvas.height;
    const textFBO = createFBO(gl, width, height);
    const blurFBO1 = createFBO(gl, width, height);
    const blurFBO2 = createFBO(gl, width, height);

    // Atlas cache — keyed by font size
    const atlasCache = new Map();

    return {
        gl,
        canvas,
        programs: { textProgram, quadProgram, blurProgram, compositeProgram },
        locations: { text: textLocs, quad: quadLocs, blur: blurLocs, composite: compositeLocs },
        buffers: { quadVAO, quadVBO, textVAO, textVBO },
        fbos: { textFBO, blurFBO1, blurFBO2 },
        atlasCache,
        width,
        height
    };
}

// ============================================================
// ATLAS CACHE MANAGEMENT
// ============================================================

function getAtlas(renderer, fontSize) {
    const key = fontSize;
    if (renderer.atlasCache.has(key)) {
        return renderer.atlasCache.get(key);
    }
    const atlas = generateFontAtlas(renderer.gl, 'Outfit', fontSize);
    renderer.atlasCache.set(key, atlas);
    return atlas;
}

// ============================================================
// TEXT DRAWING HELPERS
// ============================================================

function parseColor(color) {
    if (typeof color !== 'string') return color; // already [r,g,b] array
    if (color.startsWith('#')) {
        return [
            parseInt(color.slice(1, 3), 16) / 255,
            parseInt(color.slice(3, 5), 16) / 255,
            parseInt(color.slice(5, 7), 16) / 255
        ];
    }
    const match = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return [parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255];
    }
    return [1, 1, 1]; // fallback white
}

/**
 * Measure text width using the atlas glyph metrics.
 */
function measureTextGL(atlas, text) {
    let width = 0;
    for (const char of text) {
        const glyph = atlas.glyphs[char];
        if (glyph) {
            width += glyph.advance;
        } else {
            // Fallback: estimate width from a similar glyph
            width += atlas.fontSize * 0.6;
        }
    }
    return width;
}

/**
 * Build vertex data for a string of text positioned at (x, y).
 * Returns Float32Array of interleaved position + texCoord.
 */
function buildTextVertices(atlas, text, x, y, canvasWidth, canvasHeight) {
    const vertices = [];
    let cursorX = x;

    for (const char of text) {
        const glyph = atlas.glyphs[char];
        if (!glyph) {
            cursorX += atlas.fontSize * 0.6; // skip missing glyphs
            continue;
        }

        // Quad corners in pixel coordinates
        const x0 = cursorX;
        const y0 = y - atlas.fontSize; // top of glyph (text baseline aligned)
        const x1 = cursorX + glyph.pixelWidth;
        const y1 = y0 + glyph.pixelHeight;

        // UV coordinates from atlas
        const u0 = glyph.x;
        const v0 = glyph.y;
        const u1 = glyph.x + glyph.w;
        const v1 = glyph.y + glyph.h;

        // Two triangles per quad (6 vertices)
        vertices.push(
            x0, y0, u0, v0,
            x1, y0, u1, v0,
            x0, y1, u0, v1,

            x1, y0, u1, v0,
            x1, y1, u1, v1,
            x0, y1, u0, v1
        );

        cursorX += glyph.advance;
    }

    return new Float32Array(vertices);
}

/**
 * Draw text using the GL text program.
 */
function drawTextGL(renderer, atlas, text, x, y, color, opacity) {
    const { gl, programs, locations, buffers, width, height } = renderer;

    if (!text || text.length === 0) return;

    const vertices = buildTextVertices(atlas, text, x, y, width, height);
    if (vertices.length === 0) return;

    gl.useProgram(programs.textProgram);

    // Projection: orthographic (pixel coords → clip space)
    const proj = ortho(0, width, height, 0, -1, 1);
    gl.uniformMatrix4fv(locations.text.u_projection, false, proj);

    // Set atlas texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
    gl.uniform1i(locations.text.u_atlas, 0);

    // Set color and opacity
    const rgb = parseColor(color);
    gl.uniform3fv(locations.text.u_color, rgb);
    gl.uniform1f(locations.text.u_opacity, opacity);

    // Upload vertex data
    gl.bindVertexArray(buffers.textVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Setup attributes
    gl.enableVertexAttribArray(locations.text.a_position);
    gl.vertexAttribPointer(locations.text.a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locations.text.a_texCoord);
    gl.vertexAttribPointer(locations.text.a_texCoord, 2, gl.FLOAT, false, 16, 8);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);

    gl.bindVertexArray(null);
}

/**
 * Draw a filled rectangle using the quad program.
 */
function drawRectGL(renderer, x, y, w, h, color, opacity) {
    const { gl, programs, locations, buffers, width, height } = renderer;

    gl.useProgram(programs.quadProgram);

    const proj = ortho(0, width, height, 0, -1, 1);
    gl.uniformMatrix4fv(locations.quad.u_projection, false, proj);

    const rgb = parseColor(color);
    gl.uniform4fv(locations.quad.u_color, [...rgb, opacity]);

    const rectVertices = new Float32Array([
        x, y,
        x + w, y,
        x, y + h,
        x + w, y,
        x + w, y + h,
        x, y + h
    ]);

    gl.bindVertexArray(buffers.textVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textVBO);
    gl.bufferData(gl.ARRAY_BUFFER, rectVertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.quad.a_position);
    gl.vertexAttribPointer(locations.quad.a_position, 2, gl.FLOAT, false, 0, 0);
    // Disable texcoord attribute for quad program
    gl.disableVertexAttribArray(1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindVertexArray(null);
}

// ============================================================
// GLOW EFFECT (multi-pass Gaussian blur)
// ============================================================

/**
 * Apply glow by rendering text to FBO, blurring, then compositing.
 * 
 * @param {Function} drawFn — function that draws the content to glow
 * @param {string} glowColor — hex color for the glow
 * @param {number} blurSize — blur radius in pixels
 * @param {number} intensity — glow intensity (0-1+)
 */
function drawWithGlow(renderer, drawFn, glowColor, blurSize, intensity) {
    const { gl, programs, locations, buffers, fbos, width, height } = renderer;

    // Pass 1: Render content to text FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.textFBO.fbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawFn();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Pass 2: Horizontal blur → blurFBO1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.blurFBO1.fbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programs.blurProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbos.textFBO.texture);
    gl.uniform1i(locations.blur.u_texture, 0);
    gl.uniform2fv(locations.blur.u_direction, [1 / width, 0]);
    gl.uniform1f(locations.blur.u_blurSize, blurSize);

    gl.bindVertexArray(buffers.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Pass 3: Vertical blur → blurFBO2
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.blurFBO2.fbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, fbos.blurFBO1.texture);
    gl.uniform2fv(locations.blur.u_direction, [0, 1 / height]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Pass 4: Composite — glow (blurred) behind sharp text onto main framebuffer
    gl.viewport(0, 0, width, height);
    gl.useProgram(programs.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbos.textFBO.texture);
    gl.uniform1i(locations.composite.u_textTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fbos.blurFBO2.texture);
    gl.uniform1i(locations.composite.u_glowTexture, 1);

    const rgbGlow = parseColor(glowColor);
    gl.uniform3fv(locations.composite.u_glowColor, rgbGlow);
    gl.uniform1f(locations.composite.u_glowIntensity, intensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
}

// ============================================================
// INTERVAL DISPLAY (Instrumental/Outro)
// ============================================================

function drawIntervalDisplayGL(renderer, { width, height, scaleFactor, label, remaining, progress, highlightColor }) {
    const centerX = width / 2;
    const centerY = height / 2;

    const labelFontSize = Math.round(18 * scaleFactor);
    const timerFontSize = Math.round(48 * scaleFactor);
    const labelOffsetY = Math.round(50 * scaleFactor);
    const timerOffsetY = Math.round(20 * scaleFactor);
    const barOffsetY = Math.round(60 * scaleFactor);
    const glowBlur = Math.round(20 * scaleFactor);
    const progressGlowBlur = Math.round(10 * scaleFactor);

    const labelAtlas = getAtlas(renderer, labelFontSize);
    const timerAtlas = getAtlas(renderer, timerFontSize);

    // Label text (white, centered)
    const labelWidth = measureTextGL(labelAtlas, label);
    drawTextGL(renderer, labelAtlas, label, centerX - labelWidth / 2, centerY - labelOffsetY, '#ffffff', 0.9);

    // Timer (highlight color, large)
    const totalSeconds = Math.ceil(remaining);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const timerWidth = measureTextGL(timerAtlas, timeStr);

    // Draw timer with glow
    drawWithGlow(
        renderer,
        () => drawTextGL(renderer, timerAtlas, timeStr, centerX - timerWidth / 2, centerY + timerOffsetY, highlightColor, 1.0),
        highlightColor,
        glowBlur,
        0.8
    );

    // Progress bar
    const barWidth = Math.round(300 * scaleFactor);
    const barHeight = Math.round(6 * scaleFactor);
    const barX = (width - barWidth) / 2;
    const barY = centerY + barOffsetY;

    // Background
    drawRectGL(renderer, barX, barY, barWidth, barHeight, '#ffffff', 0.15);

    // Progress fill
    const fillWidth = Math.max(0, barWidth * progress);
    if (fillWidth > 0) {
        drawRectGL(renderer, barX, barY, fillWidth, barHeight, highlightColor, 1.0);
    }
}

// ============================================================
// LYRICS PAGE
// ============================================================

function drawLyricsPageGL(renderer, { width, height, scaleFactor, sentences, now, highlightColor, lineColors, maxWidth, margin }) {
    // Collect per-line layout data for two-pass rendering
    const lineLayouts = [];

    const totalLines = sentences.length;
    const fontSize = Math.round(32 * scaleFactor);
    const wordGap = Math.round(8 * scaleFactor);
    const glowBlur = Math.round(10 * scaleFactor);
    const minFontSize = Math.max(Math.round(18 * scaleFactor), 12);
    const lineHeight = fontSize * 1.8;
    const totalHeight = totalLines * lineHeight;
    const startY = (height - totalHeight) / 2 + fontSize;

    sentences.forEach((s, lineIndex) => {
        const lineY = startY + (lineIndex * lineHeight);
        const activeColor = (lineColors && lineColors[s._si]) || highlightColor;

        let currentFontSize = fontSize;
        let atlas = getAtlas(renderer, currentFontSize);

        // Measure all words
        let lineWords = [];
        s.words.forEach((w) => {
            const wordWidth = measureTextGL(atlas, w.text);
            const spaceWidth = measureTextGL(atlas, ' ');
            lineWords.push({
                ...w,
                width: wordWidth,
                spaceWidth,
                progress: clamp01((now - w.start) / Math.max(0.001, w.end - w.start))
            });
        });

        // Calculate total width
        let totalWidth = lineWords.reduce((sum, w) => sum + w.width + wordGap, 0);

        // Scale font if needed to fit
        if (totalWidth > maxWidth) {
            const scale = maxWidth / totalWidth;
            currentFontSize = Math.max(minFontSize, Math.floor(fontSize * scale));
            atlas = getAtlas(renderer, currentFontSize);

            totalWidth = 0;
            lineWords.forEach(w => {
                w.width = measureTextGL(atlas, w.text);
                w.spaceWidth = measureTextGL(atlas, ' ');
                totalWidth += w.width + wordGap;
            });
        }

        totalWidth = Math.min(totalWidth, maxWidth);
        const startX = (width - totalWidth) / 2;

        // Store layout for two-pass rendering
        lineLayouts.push({ lineY, activeColor, atlas, currentFontSize, lineWords, startX, wordGap: wordGap });
    });

    // ===== PASS 1: Draw all base white text with glow =====
    lineLayouts.forEach(({ lineY, atlas, lineWords, startX, wordGap: gap }) => {
        drawWithGlow(
            renderer,
            () => {
                let x = startX;
                lineWords.forEach((w) => {
                    let opacity = 0.8; // future
                    if (w.progress >= 1) opacity = 0.5; // past
                    else if (w.progress > 0) opacity = 1.0; // current
                    drawTextGL(renderer, atlas, w.text, x, lineY, '#ffffff', opacity);
                    x += w.width + gap;
                });
            },
            'rgba(255, 255, 255, 0.8)',
            glowBlur,
            0.6
        );
    });

    // ===== PASS 2: Draw highlight overlays with scissor clipping =====
    const { gl } = renderer;
    lineLayouts.forEach(({ lineY, activeColor, atlas, lineWords, startX, wordGap: gap }) => {
        let currentX = startX;
        lineWords.forEach((w) => {
            if (w.progress > 0) {
                const clipWidth = w.width * w.progress;
                gl.enable(gl.SCISSOR_TEST);
                // Use atlas.fontSize for Y calculation to match buildTextVertices()
                const glyphTop = lineY - atlas.fontSize;
                const glyphHeight = atlas.fontSize + 8;
                const scissorY = height - glyphTop - glyphHeight;
                gl.scissor(
                    Math.floor(currentX),
                    Math.floor(scissorY),
                    Math.ceil(clipWidth),
                    Math.ceil(glyphHeight)
                );
                drawTextGL(renderer, atlas, w.text, currentX, lineY, activeColor, 1.0);
                gl.disable(gl.SCISSOR_TEST);
            }
            currentX += w.width + gap;
        });
    });
}

// ============================================================
// MAIN DRAW FUNCTION
// ============================================================

/**
 * Draw a single karaoke frame using WebGL2.
 * Visual output matches drawKaraokeFrame() from karaokeDrawer.js.
 * 
 * @param {Object} renderer — from initGL()
 * @param {Object} params — same params as drawKaraokeFrame()
 */
export function drawKaraokeFrameGL(renderer, {
    width,
    height,
    now,
    showOutro,
    outroGap,
    showInstrumental,
    instrumentalGap,
    shouldShowLyrics,
    visibleSentences,
    outroProgress,
    instrumentalProgress,
    highlightColor = '#7CB87C',
    lineColors = {}
}) {
    const { gl } = renderer;

    // Set viewport
    gl.viewport(0, 0, width, height);

    // Clear to black
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Resolution scale factor — same as CPU path
    const scaleFactor = height / 720;
    const MARGIN = Math.round(60 * scaleFactor);
    const MAX_TEXT_WIDTH = width - (MARGIN * 2);

    // ========== OUTRO/INSTRUMENTAL DISPLAY ==========
    if (showOutro && outroGap) {
        drawIntervalDisplayGL(renderer, {
            width, height, scaleFactor,
            label: 'OUTRO',
            remaining: Math.max(0, outroGap.end - now),
            progress: outroProgress,
            highlightColor
        });
    } else if (showInstrumental && instrumentalGap) {
        drawIntervalDisplayGL(renderer, {
            width, height, scaleFactor,
            label: 'INSTRUMENTAL',
            remaining: Math.max(0, instrumentalGap.end - now),
            progress: instrumentalProgress,
            highlightColor
        });
    }
    // ========== LYRICS DISPLAY ==========
    else if (shouldShowLyrics && visibleSentences.length > 0) {
        drawLyricsPageGL(renderer, {
            width, height, scaleFactor,
            sentences: visibleSentences,
            now,
            highlightColor,
            lineColors,
            maxWidth: MAX_TEXT_WIDTH,
            margin: MARGIN
        });
    }
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

    const { gl, programs, buffers, fbos, atlasCache } = renderer;

    // Delete programs
    gl.deleteProgram(programs.textProgram);
    gl.deleteProgram(programs.quadProgram);
    gl.deleteProgram(programs.blurProgram);
    gl.deleteProgram(programs.compositeProgram);

    // Delete buffers
    gl.deleteVertexArray(buffers.quadVAO);
    gl.deleteBuffer(buffers.quadVBO);
    gl.deleteVertexArray(buffers.textVAO);
    gl.deleteBuffer(buffers.textVBO);

    // Delete FBOs
    destroyFBO(gl, fbos.textFBO);
    destroyFBO(gl, fbos.blurFBO1);
    destroyFBO(gl, fbos.blurFBO2);

    // Delete atlas textures
    for (const atlas of atlasCache.values()) {
        gl.deleteTexture(atlas.texture);
    }
    atlasCache.clear();

    // Lose context
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();

    console.log('[GL] Renderer destroyed');
}
