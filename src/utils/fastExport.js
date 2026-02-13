import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { drawKaraokeFrame } from './karaokeDrawer';

export async function exportToMp4({
    width,
    height,
    fps,
    totalDuration,
    bandBuffer,
    vocalBuffer,
    bandVol,
    vocalVol,
    lyrics, // sentences
    allWords,
    linesPerPage = 4, // Default to 4 if not provided
    computeInstrumentalGap,
    computeOutroGap,
    color,
    onProgress
}) {
    if (!bandBuffer && !vocalBuffer) throw new Error("No audio loaded");

    // 1. Setup Audio Mixing
    // We use OfflineAudioContext to mix audio faster than real-time
    const renderDuration = totalDuration;
    const sampleRate = 44100;
    const audioContext = new OfflineAudioContext(2, Math.ceil(sampleRate * renderDuration), sampleRate);

    // Mix band
    if (bandBuffer) {
        const src = audioContext.createBufferSource();
        src.buffer = bandBuffer;
        const gain = audioContext.createGain();
        gain.gain.value = bandVol;
        src.connect(gain);
        gain.connect(audioContext.destination);
        src.start(0);
    }

    // Mix vocal
    if (vocalBuffer) {
        const src = audioContext.createBufferSource();
        src.buffer = vocalBuffer;
        const gain = audioContext.createGain();
        gain.gain.value = vocalVol;
        src.connect(gain);
        gain.connect(audioContext.destination);
        src.start(0);
    }

    // Render Audio
    const renderedAudioBuffer = await audioContext.startRendering();

    // Wrap in promise to handle errors during async encoding
    return new Promise(async (resolve, reject) => {
        try {
            // 2. Setup Video Encoding
            const muxer = new Muxer({
                target: new ArrayBufferTarget(),
                fastStart: 'in-memory',
                video: {
                    codec: 'avc',
                    width,
                    height
                },
                audio: {
                    codec: 'aac',
                    numberOfChannels: 2,
                    sampleRate
                }
            });

            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => { console.error("Video Encode Error", e); reject(e); }
            });

            // Bitrate scales with pixel count for consistent quality across resolutions
            // 720p → 5Mbps, 1080p → ~11Mbps, 1440p → ~20Mbps, 4K → ~45Mbps
            const baseBitrate = 5_000_000;
            const pixelRatio = (width * height) / (1280 * 720);
            const bitrate = Math.round(baseBitrate * pixelRatio);

            videoEncoder.configure({
                codec: 'avc1.4d002a', // Main Profile, Level 4.2 (Succficient for 1080p30 or 1080p60)
                width,
                height,
                bitrate,
                framerate: fps
            });

            const audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: (e) => { console.error("Audio Encode Error", e); reject(e); }
            });

            audioEncoder.configure({
                codec: 'mp4a.40.2', // AAC LC
                numberOfChannels: 2,
                sampleRate,
                bitrate: 128000
            });

            // 3. Encode Audio
            const numberOfChannels = renderedAudioBuffer.numberOfChannels; // 2
            const length = renderedAudioBuffer.length;

            // Interleave the audio data (Float32)
            const interleaved = new Float32Array(length * numberOfChannels);
            const channelData = [];
            for (let i = 0; i < numberOfChannels; i++) channelData.push(renderedAudioBuffer.getChannelData(i));

            for (let i = 0; i < length; i++) {
                for (let ch = 0; ch < numberOfChannels; ch++) {
                    interleaved[i * numberOfChannels + ch] = channelData[ch][i];
                }
            }

            // Create AudioData
            const chunkSize = 44100;
            let audioTimestamp = 0;

            for (let i = 0; i < length; i += chunkSize) {
                const remaining = length - i;
                const size = Math.min(chunkSize, remaining);

                // Extract chunk
                const chunkData = interleaved.slice(i * numberOfChannels, (i + size) * numberOfChannels);

                const audioData = new AudioData({
                    format: 'f32', // float 32 linear pcm
                    sampleRate: sampleRate,
                    numberOfFrames: size,
                    numberOfChannels: numberOfChannels,
                    timestamp: audioTimestamp * 1_000_000, // microsec
                    data: chunkData
                });

                audioEncoder.encode(audioData);
                audioData.close();

                audioTimestamp += size / sampleRate;
            }

            // 4. Render and Encode Video
            console.log(`[FastExport] Starting video render. Width: ${width}, Height: ${height}, FPS: ${fps}`);
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            console.log(`[FastExport] Canvas created. Width: ${canvas.width}, Height: ${canvas.height}`);

            const frameDuration = 1 / fps;
            const totalFrames = Math.ceil(renderDuration * fps);

            // Helper to get state at time t
            const getStateAt = (t) => {
                // instrumental
                const instGap = computeInstrumentalGap(allWords, t, 8);
                const adjEnd = instGap ? Math.max(instGap.start, instGap.end - 3) : null;
                const showInst = !!(instGap && t >= instGap.start && t < (adjEnd ?? instGap.end));
                const instProg = showInst ? (t - instGap.start) / Math.max(instGap.duration - 3, 0.001) : 0;

                // outro
                const trackEnd = renderDuration;
                const outroGap = computeOutroGap(allWords, t, trackEnd, 0);
                const showOutro = !!outroGap;
                const outroProg = showOutro ? (t - outroGap.start) / Math.max(outroGap.duration, 0.001) : 0;

                // lyrics
                let showLyrics = false;
                let visibleSentences = [];

                if (!showOutro && !showInst && allWords.length > 0) {
                    const pages = [];
                    for (let i = 0; i < lyrics.length; i += linesPerPage) {
                        pages.push(lyrics.slice(i, i + linesPerPage));
                    }

                    let pageIdx = pages.length - 1;
                    for (let i = 0; i < pages.length; i++) {
                        const pg = pages[i];
                        const lastS = pg[pg.length - 1];
                        if (t < lastS.sentence.end) {
                            pageIdx = i;
                            break;
                        }
                    }

                    visibleSentences = pages[pageIdx] || [];

                    const firstWord = allWords[0];
                    const during = visibleSentences.length > 0;
                    if (firstWord && t < firstWord.start && (firstWord.start - t) >= 8) showLyrics = false;
                    else showLyrics = during;
                }

                return {
                    showOutro, outroGap, outroProgress: outroProg,
                    showInstrumental: showInst, instrumentalGap: instGap, instrumentalProgress: instProg,
                    shouldShowLyrics: showLyrics, visibleSentences: visibleSentences || []
                };
            };

            for (let i = 0; i < totalFrames; i++) {
                if (onProgress) onProgress(i / totalFrames);

                // Backpressure: wait if queue is full to avoid OOM crash
                if (videoEncoder.encodeQueueSize > 30) {
                    await new Promise(r => setTimeout(r, 10));
                    // Re-check after small wait, fast check loop
                    while (videoEncoder.encodeQueueSize > 30) {
                        await new Promise(r => setTimeout(r, 10));
                    }
                }
                const t = i * frameDuration;

                const state = getStateAt(t);

                drawKaraokeFrame(ctx, {
                    width, height, now: t,
                    showOutro: state.showOutro,
                    outroGap: state.outroGap,
                    showInstrumental: state.showInstrumental,
                    instrumentalGap: state.instrumentalGap,
                    shouldShowLyrics: state.shouldShowLyrics,
                    visibleSentences: state.visibleSentences,
                    outroProgress: state.outroProgress,
                    instrumentalProgress: state.instrumentalProgress,
                    highlightColor: color
                });

                const frame = new VideoFrame(canvas, { timestamp: t * 1_000_000 });
                videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
                frame.close();
            }

            // Finish
            await videoEncoder.flush();
            await audioEncoder.flush();
            muxer.finalize();

            resolve(muxer.target.buffer);
        } catch (e) {
            reject(e);
        }
    });
}
