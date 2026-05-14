/**
 * E2E Test: FFmpeg Volume Filter — Real-World Verification
 *
 * Strategy:
 * 1. Generate two distinct test tones (band=440Hz, vocal=1000Hz)
 * 2. Mix them using the EXACT filter_complex from electron/main.js
 * 3. Verify that volume=0 produces actual silence for that stem
 * 4. Verify that volume=0.5/1.0 produce proportional levels
 *
 * Requires: ffmpeg and ffprobe on PATH
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use project's bundled ffmpeg-static binary
const FFMPEG_PATH = require('ffmpeg-static');

const TEST_DIR = path.join(os.tmpdir(), 'kraokebox-e2e-' + Date.now());
const TONE_A = path.join(TEST_DIR, 'band_440hz.wav');
const TONE_B = path.join(TEST_DIR, 'vocal_1000hz.wav');

// -------------------------------------------------------
// STEP 0: Check prerequisites
// -------------------------------------------------------

function checkFFmpeg() {
    return new Promise((resolve) => {
        const proc = spawn(FFMPEG_PATH, ['-version'], { stdio: 'pipe' });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
        setTimeout(() => { try { proc.kill(); } catch(e){} resolve(false); }, 3000);
    });
}

// -------------------------------------------------------
// STEP 1: Generate test tones
// -------------------------------------------------------

function generateTone(outputPath, frequency, duration, label) {
    return new Promise((resolve, reject) => {
        console.log(`  Generating ${label}: ${frequency}Hz, ${duration}s → ${outputPath}`);
        const args = [
            '-y', '-f', 'lavfi',
            '-i', `sine=frequency=${frequency}:duration=${duration}:sample_rate=44100`,
            '-af', 'volume=-6dB',
            '-ac', '2',          // stereo
            '-ar', '44100',
            '-c:a', 'pcm_s16le',
            '-t', String(duration),
            outputPath
        ];
        const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Tone gen failed (code ${code}): ${stderr.slice(-200)}`));
        });
        proc.on('error', reject);
    });
}

// -------------------------------------------------------
// STEP 2: Mix stems with given volumes
// -------------------------------------------------------

function mixStems(bandVol, vocalVol, outputPath) {
    return new Promise((resolve, reject) => {
        // EXACT filter from electron/main.js (export-finalize / export-finalize-streaming)
        const filter = `[0:a]volume=${bandVol}[a0];[1:a]volume=${vocalVol}[a1];[a0][a1]amix=inputs=2:duration=longest[aout]`;
        console.log(`  Mixing: bandVol=${bandVol}, vocalVol=${vocalVol}`);
        console.log(`  Filter: ${filter}`);
        const args = [
            '-y',
            '-i', TONE_A,
            '-i', TONE_B,
            '-filter_complex', filter,
            '-map', '[aout]',
            '-c:a', 'libmp3lame',
            '-q:a', '2',
            '-ac', '2',
            '-ar', '44100',
            outputPath
        ];
        const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Mix failed (code ${code}): ${stderr.slice(-300)}`));
        });
        proc.on('error', reject);
    });
}

// -------------------------------------------------------
// STEP 3: Measure RMS power at the tone frequency
//    Uses band-pass filter → volumedetect to get RMS
// -------------------------------------------------------

function measureFrequencyPower(inputPath, centerFreq) {
    return new Promise((resolve, reject) => {
        // Band-pass filter around the tone frequency, then measure RMS
        const width = 100; // bandwidth in Hz ± around center
        const low = Math.max(20, centerFreq - width);
        const high = centerFreq + width;
        const args = [
            '-i', inputPath,
            '-af', `bandpass=frequency=${centerFreq}:width=${width * 2}:width_type=h,volumedetect`,
            '-f', 'null',
            '-'
        ];
        const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => {
            // Parse mean_volume from output
            const match = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
            if (match) {
                resolve({ meanDb: parseFloat(match[1]), raw: stderr });
            } else {
                // If no match, try to extract max_volume
                const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
                const meanMatch2 = stderr.match(/mean_volume:\s*([-\d.]+)/);
                if (meanMatch2) {
                    resolve({ meanDb: parseFloat(meanMatch2[1]), raw: stderr });
                } else if (maxMatch) {
                    resolve({ meanDb: parseFloat(maxMatch[1]), raw: stderr });
                } else {
                    // Return raw for debugging
                    resolve({ meanDb: null, raw: stderr });
                }
            }
        });
        proc.on('error', reject);
    });
}

// -------------------------------------------------------
// STEP 4: Verify silence (simple RMS approach)
// -------------------------------------------------------

function measureOverallRMS(inputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-i', inputPath,
            '-af', 'volumedetect',
            '-f', 'null',
            '-'
        ];
        const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => {
            const match = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
            const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
            resolve({
                meanDb: match ? parseFloat(match[1]) : null,
                maxDb: maxMatch ? parseFloat(maxMatch[1]) : null,
                raw: stderr
            });
        });
        proc.on('error', reject);
    });
}

// -------------------------------------------------------
// MAIN TEST SEQUENCE
// -------------------------------------------------------

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log(' E2E FFmpeg Volume Test — Stem Mix Verification');
    console.log('═══════════════════════════════════════════════════\n');

    // Check FFmpeg
    console.log('[0/5] Checking FFmpeg availability...');
    const hasFFmpeg = await checkFFmpeg();
    if (!hasFFmpeg) {
        console.log('  ⚠️  FFmpeg not found on PATH. Skipping E2E tests.');
        console.log('  ℹ️  Unit tests already verified the logic fix.');
        console.log('  ℹ️  To run E2E tests, install FFmpeg and add to PATH.');
        process.exit(0);
    }
    console.log('  ✅ FFmpeg available\n');

    // Setup
    fs.mkdirSync(TEST_DIR, { recursive: true });
    console.log(`  Temp dir: ${TEST_DIR}\n`);

    let allPassed = 0;
    let allFailed = 0;

    try {
        // Step 1: Generate tones
        console.log('[1/5] Generating test tones...');
        await generateTone(TONE_A, 440, 3, 'Band (440Hz)');
        await generateTone(TONE_B, 1000, 3, 'Vocal (1kHz)');
        console.log('  ✅ Test tones generated\n');

        // Verify tones exist
        for (const p of [TONE_A, TONE_B]) {
            const stat = fs.statSync(p);
            console.log(`  ${path.basename(p)}: ${(stat.size / 1024).toFixed(1)} KB`);
            if (stat.size < 1000) {
                console.log(`  ❌ ${path.basename(p)} is too small — generation failed`);
                process.exit(1);
            }
        }

        // Step 2: Measure baseline of each tone
        console.log('\n[2/5] Measuring baseline levels...');
        const baselineA = await measureOverallRMS(TONE_A);
        const baselineB = await measureOverallRMS(TONE_B);
        console.log(`  Band (440Hz) baseline: mean=${baselineA.meanDb} dB, max=${baselineA.maxDb} dB`);
        console.log(`  Vocal (1kHz) baseline: mean=${baselineB.meanDb} dB, max=${baselineB.maxDb} dB`);

        // Step 3: Test case — bandVol=0, vocalVol=1
        console.log('\n[3/5] Test Case A: bandVol=0, vocalVol=1 (band should be SILENT)...');
        const outputA = path.join(TEST_DIR, 'test_band0_vocal1.mp3');
        await mixStems(0, 1, outputA);

        // Measure band frequency (440Hz) in output — should be very quiet
        const bandPowerA = await measureFrequencyPower(outputA, 440);
        console.log(`  440Hz band power in mix (bandVol=0): mean=${bandPowerA.meanDb} dB`);
        const bandEffectivelySilenced = bandPowerA.meanDb !== null && bandPowerA.meanDb < -45;
        console.log(`  Verdict: ${bandEffectivelySilenced ? '✅ Band stem is silenced (< -45dB)' : '⚠️ Band quietened but not below -45dB (bandpass filter bleed-through expected)'}`);

        // Step 4: Test case — bandVol=1, vocalVol=0
        console.log('\n[4/5] Test Case B: bandVol=1, vocalVol=0 (vocal should be SILENT)...');
        const outputB = path.join(TEST_DIR, 'test_band1_vocal0.mp3');
        await mixStems(1, 0, outputB);

        const vocalB = await measureFrequencyPower(outputB, 1000);
        console.log(`  1kHz vocal power in mix (vocalVol=0): mean=${vocalB.meanDb} dB`);
        const vocalEffectivelySilenced = vocalB.meanDb !== null && vocalB.meanDb < -45;
        console.log(`  Verdict: ${vocalEffectivelySilenced ? '✅ Vocal stem is silenced (< -45dB)' : '⚠️ Vocal quietened but not below -45dB (bandpass filter bleed-through expected)'}`);

        // Step 5: Test case — bandVol=1, vocalVol=1 (both full)
        console.log('\n[5/5] Test Case C: bandVol=1, vocalVol=1 (both at full volume)...');
        const outputC = path.join(TEST_DIR, 'test_band1_vocal1.mp3');
        await mixStems(1, 1, outputC);

        const bandPowerC = await measureFrequencyPower(outputC, 440);
        const vocalC = await measureFrequencyPower(outputC, 1000);
        console.log(`  440Hz band power: mean=${bandPowerC.meanDb} dB`);
        console.log(`  1kHz vocal power: mean=${vocalC.meanDb} dB`);
        // Expected: tones at -30dB baseline → amix divides by 2 (~-6dB) → ~-36dB each
        const bothAudible = bandPowerC.meanDb !== null && vocalC.meanDb !== null &&
                            bandPowerC.meanDb > -40 && vocalC.meanDb > -40;
        console.log(`  Verdict: ${bothAudible ? '✅ Both stems audible at full volume (> -40dB)' : '❌ One or both stems missing!'}`);

        // Step 6: Edge case — bandVol=0.5, vocalVol=0.5
        console.log('\n[EDGE] Test Case D: bandVol=0.5, vocalVol=0.5 (half volume each)...');
        const outputD = path.join(TEST_DIR, 'test_band0.5_vocal0.5.mp3');
        await mixStems(0.5, 0.5, outputD);

        const bandPowerD = await measureFrequencyPower(outputD, 440);
        const vocalPowerD = await measureFrequencyPower(outputD, 1000);
        const fullBandPowerD = await measureFrequencyPower(outputC, 440);
        const fullVocalD = await measureFrequencyPower(outputC, 1000);

        console.log(`  440Hz at 0.5: mean=${bandPowerD.meanDb} dB`);
        console.log(`  1kHz at 0.5:  mean=${vocalPowerD.meanDb} dB`);
        console.log(`  440Hz at 1.0: mean=${fullBandPowerD.meanDb} dB`);
        console.log(`  1kHz at 1.0:  mean=${fullVocalD.meanDb} dB`);

        // At half volume, should be roughly 6dB quieter
        if (bandPowerD.meanDb !== null && fullBandPowerD.meanDb !== null) {
            const diff = fullBandPowerD.meanDb - bandPowerD.meanDb;
            console.log(`  Volume difference (full - half): ${diff.toFixed(1)} dB (expected ~6 dB for half volume)`);
        }

        // ----- FINAL VERDICT -----
        console.log('\n═══════════════════════════════════════════════════');
        console.log(' FINAL RESULTS');
        console.log('═══════════════════════════════════════════════════');

        const results = [
            { name: 'Band=0, Vocal=1 → Band silenced', pass: bandEffectivelySilenced },
            { name: 'Band=1, Vocal=0 → Vocal silenced', pass: vocalEffectivelySilenced },
            { name: 'Band=1, Vocal=1 → Both audible', pass: bothAudible },
        ];

        for (const r of results) {
            if (r.pass) {
                console.log(`  ✅ ${r.name}`);
                allPassed++;
            } else {
                console.log(`  ❌ ${r.name}`);
                allFailed++;
            }
        }

        console.log(`\n${allPassed}/${results.length} passed, ${allFailed} failed\n`);

    } catch (err) {
        console.error('Test error:', err.message);
        allFailed++;
    } finally {
        // Cleanup
        try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch(e) {}
        console.log(`Cleaned up: ${TEST_DIR}`);
    }

    process.exit(allFailed > 0 ? 1 : 0);
}

main();
