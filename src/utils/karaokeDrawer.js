import { clamp01, prettyTime } from './karaokeHelpers';

/**
 * Draws a single frame of the Karaoke video to the provided 2D context.
 * 
 * @param {CanvasRenderingContext2D} ctx2d 
 * @param {Object} params - The state to render
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.now
 * @param {boolean} params.showOutro
 * @param {Object} params.outroGap
 * @param {boolean} params.showInstrumental
 * @param {Object} params.instrumentalGap
 * @param {boolean} params.shouldShowLyrics
 * @param {Array} params.visibleSentences
 * @param {number} params.outroProgress
 * @param {number} params.instrumentalProgress
 * @param {string} params.highlightColor
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
    highlightColor,
    lineColors = {}
}) {
    // Helper function for rounded rectangles
    const drawRoundedRect = (x, y, w, h, radius) => {
        ctx2d.beginPath();
        ctx2d.moveTo(x + radius, y);
        ctx2d.lineTo(x + w - radius, y);
        ctx2d.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx2d.lineTo(x + w, y + h - radius);
        ctx2d.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx2d.lineTo(x + radius, y + h);
        ctx2d.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx2d.lineTo(x, y + radius);
        ctx2d.quadraticCurveTo(x, y, x + radius, y);
        ctx2d.closePath();
    };

    // Clear
    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, width, height);

    if (showOutro && outroGap) {
        ctx2d.fillStyle = '#ffffff'; ctx2d.font = 'bold 48px Arial'; ctx2d.textAlign = 'center'; ctx2d.fillText('OUTRO', width / 2, 300);
        ctx2d.font = 'bold 120px Arial'; ctx2d.fillText(prettyTime(outroGap.end - now), width / 2, 500);
        const barWidth = 800; const barHeight = 48; const barX = (width - barWidth) / 2; const barY = 600; const radius = 24;
        ctx2d.shadowColor = 'rgba(251, 146, 60, 0.4)'; ctx2d.shadowBlur = 20;
        drawRoundedRect(barX, barY, barWidth, barHeight, radius); ctx2d.fillStyle = 'rgba(124, 45, 18, 0.6)'; ctx2d.fill();
        ctx2d.shadowColor = 'transparent'; ctx2d.shadowBlur = 0;
        const progressWidth = Math.max(radius * 2, barWidth * outroProgress);
        drawRoundedRect(barX, barY, progressWidth, barHeight, radius); ctx2d.fillStyle = '#ea580c'; ctx2d.fill();
        ctx2d.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx2d.font = '20px Arial'; ctx2d.fillText('counting down to track end', width / 2, 680);
    } else if (showInstrumental && instrumentalGap) {
        ctx2d.fillStyle = '#ffffff'; ctx2d.font = 'bold 48px Arial'; ctx2d.textAlign = 'center'; ctx2d.fillText('INSTRUMENTAL', width / 2, 300);
        ctx2d.font = 'bold 120px Arial'; ctx2d.fillText(prettyTime(instrumentalGap.end - now), width / 2, 500);
        const barWidth = 800; const barHeight = 48; const barX = (width - barWidth) / 2; const barY = 600; const radius = 24;
        ctx2d.shadowColor = 'rgba(251, 146, 60, 0.4)'; ctx2d.shadowBlur = 20;
        drawRoundedRect(barX, barY, barWidth, barHeight, radius); ctx2d.fillStyle = 'rgba(124, 45, 18, 0.6)'; ctx2d.fill();
        ctx2d.shadowColor = 'transparent'; ctx2d.shadowBlur = 0;
        const progressWidth = Math.max(radius * 2, barWidth * instrumentalProgress);
        drawRoundedRect(barX, barY, progressWidth, barHeight, radius); ctx2d.fillStyle = '#ea580c'; ctx2d.fill();
        ctx2d.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx2d.font = '20px Arial'; ctx2d.fillText('instrumental break - lyrics preview in 3 seconds', width / 2, 680);
    } else if (shouldShowLyrics) {
        const totalLines = visibleSentences.length; const lineHeight = 200; const totalHeight = totalLines * lineHeight; const startY = (height - totalHeight) / 2 + 100;
        visibleSentences.forEach((s, lineIndex) => {
            const lineY = startY + (lineIndex * lineHeight);
            // MEASURE FONT SIZE TO FIT
            ctx2d.font = 'bold 80px Arial';
            let rawWidth = 0;
            s.words.forEach((w, i) => {
                rawWidth += ctx2d.measureText(w.text).width;
                if (i < s.words.length - 1) rawWidth += ctx2d.measureText(' ').width;
            });
            const MAX_WIDTH = 1800;
            let fontSize = 80;
            if (rawWidth > MAX_WIDTH) {
                fontSize = Math.floor(80 * (MAX_WIDTH / rawWidth));
            }
            ctx2d.font = `bold ${fontSize}px Arial`;
            ctx2d.textAlign = 'left';

            // Determine color for this line
            const activeColor = lineColors[s._si] || highlightColor;

            const wordData = []; let currentX = 0;
            s.words.forEach((w, i) => {
                const progress = clamp01((now - w.start) / Math.max(0.001, w.end - w.start));
                wordData.push({ text: w.text, x: currentX, progress: progress });
                const wordMetrics = ctx2d.measureText(w.text); currentX += wordMetrics.width;
                if (i < s.words.length - 1) currentX += ctx2d.measureText(' ').width;
            });
            const totalWidth = currentX; const startX = (width - totalWidth) / 2;
            wordData.forEach((wd) => {
                const wordX = startX + wd.x; const wordMetrics = ctx2d.measureText(wd.text); const wordWidth = wordMetrics.width;
                ctx2d.fillStyle = '#ffffff'; ctx2d.fillText(wd.text, wordX, lineY);
                if (wd.progress > 0) {
                    ctx2d.save(); const clipWidth = wordWidth * wd.progress;
                    ctx2d.beginPath(); ctx2d.rect(wordX, lineY - 80, clipWidth, 100); ctx2d.clip();
                    ctx2d.fillStyle = activeColor; ctx2d.fillText(wd.text, wordX, lineY); ctx2d.restore();
                }
            });
        });
    }
}
