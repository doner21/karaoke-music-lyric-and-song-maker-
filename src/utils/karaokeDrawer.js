import { clamp01, prettyTime } from './karaokeHelpers';

/**
 * Draws a single frame of the Karaoke video to the provided 2D context.
 * 
 * AESTHETICS MATCHING RESILENCE_NODE_V5 [MOCK] PREVIEW:
 * - White text with neon glow shadow
 * - Highlight color fills from left to right (clip style)
 * - Past words: 50% opacity, Future words: 80% opacity, Current: 100%
 * - Bold font
 * - Centered lyrics
 * - Words must not extend outside viewable bounds (with word wrapping)
 * 
 * INTERVAL DISPLAY:
 * - Uppercase label (white)
 * - Timer in highlight color (large)
 * - Thin progress bar
 * 
 * @param {CanvasRenderingContext2D} ctx2d 
 * @param {Object} params
 */
export function drawKaraokeFrame(ctx2d, {
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
    // Clear to black
    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, width, height);

    // Constants matching preview
    const MARGIN = 60; // Margin on each side to prevent words going outside
    const MAX_TEXT_WIDTH = width - (MARGIN * 2);
    const LINE_SPACING = 1.8; // Relative line spacing

    // ========== OUTRO/INSTRUMENTAL DISPLAY ==========
    if (showOutro && outroGap) {
        drawIntervalDisplay(ctx2d, {
            width, height,
            label: 'OUTRO',
            remaining: Math.max(0, outroGap.end - now),
            progress: outroProgress,
            highlightColor
        });
    } else if (showInstrumental && instrumentalGap) {
        drawIntervalDisplay(ctx2d, {
            width, height,
            label: 'INSTRUMENTAL',
            remaining: Math.max(0, instrumentalGap.end - now),
            progress: instrumentalProgress,
            highlightColor
        });
    }
    // ========== LYRICS DISPLAY ==========
    else if (shouldShowLyrics && visibleSentences.length > 0) {
        drawLyricsPage(ctx2d, {
            width, height,
            sentences: visibleSentences,
            now,
            highlightColor,
            lineColors,
            maxWidth: MAX_TEXT_WIDTH,
            margin: MARGIN
        });
    }
}

/**
 * Draw interval display (Instrumental/Outro)
 * Matches NoLyricsIntervalDisplay.jsx aesthetic
 */
function drawIntervalDisplay(ctx2d, { width, height, label, remaining, progress, highlightColor }) {
    const centerX = width / 2;
    const centerY = height / 2;

    // Label (white, uppercase, smaller)
    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx2d.font = '600 18px Arial';
    ctx2d.textAlign = 'center';
    ctx2d.letterSpacing = '4px';
    ctx2d.fillText(label, centerX, centerY - 50);

    // Timer (highlight color, large, monospace)
    ctx2d.fillStyle = highlightColor;
    ctx2d.font = '300 48px monospace';

    // Format time as M:SS
    const totalSeconds = Math.ceil(remaining);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Add glow effect
    ctx2d.shadowColor = highlightColor;
    ctx2d.shadowBlur = 20;
    ctx2d.fillText(timeStr, centerX, centerY + 20);
    ctx2d.shadowBlur = 0;

    // Progress bar (thin, 6px height, 300px width)
    const barWidth = 300;
    const barHeight = 6;
    const barX = (width - barWidth) / 2;
    const barY = centerY + 60;

    // Background
    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.15)';
    roundRect(ctx2d, barX, barY, barWidth, barHeight, 3);
    ctx2d.fill();

    // Progress fill
    const fillWidth = Math.max(0, barWidth * progress);
    if (fillWidth > 0) {
        ctx2d.fillStyle = highlightColor;
        ctx2d.shadowColor = highlightColor;
        ctx2d.shadowBlur = 10;
        roundRect(ctx2d, barX, barY, fillWidth, barHeight, 3);
        ctx2d.fill();
        ctx2d.shadowBlur = 0;
    }
}

/**
 * Draw lyrics page with word-level highlighting
 * Matches LetterFillWord.jsx aesthetic
 */
function drawLyricsPage(ctx2d, { width, height, sentences, now, highlightColor, lineColors, maxWidth, margin }) {
    // Calculate available height and line count
    const totalLines = sentences.length;
    const fontSize = 32; // Base font size
    const lineHeight = fontSize * 1.8;
    const totalHeight = totalLines * lineHeight;
    const startY = (height - totalHeight) / 2 + fontSize;

    sentences.forEach((s, lineIndex) => {
        const lineY = startY + (lineIndex * lineHeight);
        const activeColor = lineColors[s._si] || highlightColor;

        // First pass: measure all words to determine if wrapping is needed
        ctx2d.font = `bold ${fontSize}px "Outfit", Arial, sans-serif`;

        let lineWords = [];
        let testWidth = 0;
        s.words.forEach((w, i) => {
            const wordWidth = ctx2d.measureText(w.text).width;
            const spaceWidth = i < s.words.length - 1 ? ctx2d.measureText(' ').width : 0;
            lineWords.push({
                ...w,
                width: wordWidth,
                spaceWidth,
                progress: clamp01((now - w.start) / Math.max(0.001, w.end - w.start))
            });
            testWidth += wordWidth + spaceWidth + 8; // 8 = margin between words (4px each side)
        });

        // Calculate total width
        let totalWidth = lineWords.reduce((sum, w) => sum + w.width + 8, 0);

        // Scale font if needed to fit
        let scaledFontSize = fontSize;
        if (totalWidth > maxWidth) {
            const scale = maxWidth / totalWidth;
            scaledFontSize = Math.max(18, Math.floor(fontSize * scale)); // Minimum 18px
            ctx2d.font = `bold ${scaledFontSize}px "Outfit", Arial, sans-serif`;

            // Recalculate widths with new font size
            totalWidth = 0;
            lineWords.forEach(w => {
                w.width = ctx2d.measureText(w.text).width;
                w.spaceWidth = ctx2d.measureText(' ').width;
                totalWidth += w.width + 8;
            });
        }

        // Ensure totalWidth doesn't exceed maxWidth
        totalWidth = Math.min(totalWidth, maxWidth);
        const startX = (width - totalWidth) / 2;

        // Draw each word
        let currentX = startX;
        lineWords.forEach((w) => {
            // Determine opacity based on state
            let opacity = 0.8; // future
            if (w.progress >= 1) opacity = 0.5; // past
            else if (w.progress > 0) opacity = 1.0; // current

            // Draw base white text with neon glow
            ctx2d.globalAlpha = opacity;
            ctx2d.fillStyle = '#ffffff';
            ctx2d.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx2d.shadowBlur = 10;
            ctx2d.textAlign = 'left';
            ctx2d.fillText(w.text, currentX, lineY);
            ctx2d.shadowBlur = 0;

            // Draw highlight overlay with clip (if progress > 0)
            if (w.progress > 0) {
                const clipWidth = w.width * w.progress;

                ctx2d.save();
                ctx2d.beginPath();
                ctx2d.rect(currentX, lineY - scaledFontSize, clipWidth, scaledFontSize * 1.5);
                ctx2d.clip();

                ctx2d.globalAlpha = 1.0;
                ctx2d.fillStyle = activeColor;
                ctx2d.shadowBlur = 0; // No glow for highlight
                ctx2d.fillText(w.text, currentX, lineY);

                ctx2d.restore();
            }

            ctx2d.globalAlpha = 1.0;
            currentX += w.width + 8; // 8px margin between words
        });
    });
}

/**
 * Draw a rounded rectangle
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
