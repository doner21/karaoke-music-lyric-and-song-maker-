export function clamp01(n) { return Math.min(1, Math.max(0, n)); }
export function clamp(n, min = -Infinity, max = Infinity) { return Math.min(max, Math.max(min, n)); }

export function prettyTime(sec) {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
}

export function cleanFilename(filename) {
    if (!filename) return "KaraokeBox";
    let name = filename.replace(/\.[^/.]+$/, "");
    name = name.replace(/\s*\([^)]*\)/g, ""); // remove parens content
    name = name.replace(/\s*\[[^\]]*\]/g, ""); // remove square brackets content
    name = name.replace(/band/gi, ""); // remove "band"
    name = name.replace(/\s+/g, " ").trim();
    name = name.replace(/[\s-]+$/, ""); // remove trailing hyphens and spaces
    return name;
}

export function byStart(a, b) { return a.start - b.start; }

export function computeInstrumentalGap(words, now, thresholdSec = 8) {
    if (!Number.isFinite(now) || now < 0) return null;
    const ws = [...words].sort(byStart);
    if (ws.length === 0) return null;
    const active = ws.find(w => now >= w.start && now <= w.end);
    if (active) return null;
    const firstStart = ws[0].start;
    const lastEnd = ws[ws.length - 1].end;
    if (now < firstStart) {
        const dur = firstStart - 0;
        if (dur >= thresholdSec) return { start: 0, end: firstStart, duration: dur };
        return null;
    }
    if (now > lastEnd) return null;
    let prevEnd = null; let nextStart = null;
    for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        if (w.end <= now) prevEnd = w.end;
        if (w.start >= now) { nextStart = w.start; break; }
    }
    if (prevEnd == null || nextStart == null) return null;
    const gap = nextStart - prevEnd;
    if (gap >= thresholdSec && now >= prevEnd && now < nextStart) {
        return { start: prevEnd, end: nextStart, duration: gap };
    }
    return null;
}

export function computeOutroGap(words, now, trackEnd, minTailSec = 0) {
    if (!Number.isFinite(now) || now < 0) return null;
    if (trackEnd == null || !Number.isFinite(trackEnd)) return null;
    const ws = [...words].sort(byStart);
    if (ws.length === 0) return null;
    const lastEnd = ws[ws.length - 1].end;
    if (now >= lastEnd && now < trackEnd) {
        const tail = trackEnd - lastEnd;
        if (tail >= minTailSec) return { start: lastEnd, end: trackEnd, duration: tail };
    }
    return null;
}

export function wordKey(si, wi) { return `${si}:${wi} `; }

export function indexLyrics(lyrics) {
    if (!lyrics) return [];
    return lyrics.lyrics.map((s, si) => ({
        _si: si,
        sentence: { ...s.sentence },
        words: s.words.map((w, wi) => ({ ...w, _si: si, _wi: wi })),
    }));
}

export function computeAdjustedSentences(indexed, deltas, deletedWords, editedWords, neighborPad = 0.01, clampNeighbors = true) {
    return indexed.map((s) => {
        const words = s.words
            .filter((w) => !deletedWords.has(wordKey(w._si, w._wi)))
            .map((w, i, arr) => {
                const key = wordKey(w._si, w._wi);
                const d = deltas.get(key);
                let ns = w.start + (d?.dStart ?? 0);
                let ne = w.end + (d?.dEnd ?? 0);
                const prev = arr[i - 1];
                const next = arr[i + 1];
                if (clampNeighbors && prev) {
                    const prevKey = wordKey(prev._si, prev._wi);
                    const dp = deltas.get(prevKey);
                    const prevEnd = prev.end + (dp?.dEnd ?? 0);
                    ns = Math.max(ns, prevEnd + neighborPad);
                }
                if (clampNeighbors && next) {
                    const nextKey = wordKey(next._si, next._wi);
                    const dn = deltas.get(nextKey);
                    const nextStart = next.start + (dn?.dStart ?? 0);
                    ne = Math.min(ne, nextStart - neighborPad);
                }
                if (ne <= ns) ne = ns + 0.01;
                const editedText = editedWords.get(key);
                const text = editedText !== undefined ? editedText : w.text;
                const row = d?.row ?? w.row ?? 0;
                return { ...w, start: ns, end: ne, text, row };
            });
        const sStart = words.length ? words[0].start : s.sentence.start;
        const sEnd = words.length ? words[words.length - 1].end : s.sentence.end;
        return { _si: s._si, sentence: { ...s.sentence, start: sStart, end: sEnd }, words };
    });
}

export function audioBufferToWav(buffer, opt) {
    opt = opt || {};
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = opt.float32 ? 3 : 1;
    var bitDepth = format === 3 ? 32 : 16;
    var result;
    if (numChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }
    return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
    var bytesPerSample = bitDepth / 8;
    var blockAlign = numChannels * bytesPerSample;
    var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    var view = new DataView(buffer);
    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * blockAlign, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, blockAlign, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * bytesPerSample, true);
    if (format === 1) { // Raw PCM
        floatTo16BitPCM(view, 44, samples);
    } else {
        writeFloat32(view, 44, samples);
    }
    return buffer;
}

function interleave(inputL, inputR) {
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);
    var index = 0;
    var inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset += 2) {
        var s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeFloat32(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset += 4) {
        output.setFloat32(offset, input[i], true);
    }
}
