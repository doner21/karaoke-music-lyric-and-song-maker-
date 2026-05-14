/**
 * Unit Test: Volume Coercion Logic in MP4 Export Handlers
 *
 * Verifies that ?? preserves 0 (silence), unlike || which coerces it to 1.
 * This replicates the logic from electron/main.js export-start and
 * export-start-streaming IPC handlers.
 */

// FIXED version (uses ??)
function resolveExportVolumes(bandVol, vocalVol) {
    return {
        bandVol: bandVol ?? 1,
        vocalVol: vocalVol ?? 1,
    };
}

// BROKEN version (uses ||)
function resolveExportVolumesBroken(bandVol, vocalVol) {
    return {
        bandVol: bandVol || 1,
        vocalVol: vocalVol || 1,
    };
}

let passed = 0, failed = 0;

// ----- Test the FIXED version -----
console.log('=== Tests: FIXED version (??) ===');
const cases = [
    [0, 0, 0, 0, 'Both silent → both 0'],
    [0, 1, 0, 1, 'Band silent, vocal full → band=0, vocal=1'],
    [1, 0, 1, 0, 'Band full, vocal silent → band=1, vocal=0'],
    [0.01, 1, 0.01, 1, 'Band near-silent preserved → band=0.01'],
    [0.5, 0.5, 0.5, 0.5, 'Half volume preserved → both 0.5'],
    [1, 1, 1, 1, 'Full volume preserved → both 1'],
    [undefined, undefined, 1, 1, 'Undefined defaults to 1'],
    [undefined, 0, 1, 0, 'Band undefined, vocal zero → band=1, vocal=0'],
    [0, undefined, 0, 1, 'Band zero, vocal undefined → band=0, vocal=1'],
];

let fixedPassed = 0, fixedFailed = 0;
for (const [bv, vv, eb, ev, desc] of cases) {
    const r = resolveExportVolumes(bv, vv);
    const ok = r.bandVol === eb && r.vocalVol === ev;
    if (ok) {
        console.log(`  ✅ PASS: ${desc}`);
        fixedPassed++;
    } else {
        console.log(`  ❌ FAIL: ${desc}`);
        console.log(`     Expected: band=${eb}, vocal=${ev}`);
        console.log(`     Got:      band=${r.bandVol}, vocal=${r.vocalVol}`);
        fixedFailed++;
    }
}

console.log(`\nFIXED: ${fixedPassed}/${cases.length} passed, ${fixedFailed} failed`);

// ----- Test the BROKEN version (prove the bug) -----
console.log('\n=== Tests: BROKEN version (||) — should fail on 0 values ===');
const brokenExpected = [
    // [input band, input vocal, expected band (broken), expected vocal (broken)]
    [0, 1, 1, 1, 'BUG: Band silent coerced to full — || turns 0→1'],   // THIS IS THE BUG
    [1, 0, 1, 1, 'BUG: Vocal silent coerced to full — || turns 0→1'],   // THIS IS THE BUG
    [0, 0, 1, 1, 'BUG: Both silent coerced to full — || turns 0→1'],    // THIS IS THE BUG
];

let brokenPassed = 0, brokenFailed = 0;
for (const [bv, vv, eb, ev, desc] of brokenExpected) {
    const r = resolveExportVolumesBroken(bv, vv);
    const ok = r.bandVol === eb && r.vocalVol === ev;
    if (ok) {
        console.log(`  ✅ CONFIRMED: ${desc}`);
        brokenPassed++;
    } else {
        console.log(`  ❌ UNEXPECTED: ${desc}`);
        brokenFailed++;
    }
}

console.log(`\nBROKEN: ${brokenPassed}/${brokenExpected.length} bug cases confirmed, ${brokenFailed} unexpected`);

// ----- Final verdict -----
const totalPassed = fixedPassed + brokenPassed;
const totalCases = cases.length + brokenExpected.length;

console.log(`\n${'='.repeat(50)}`);
console.log(`OVERALL: ${totalPassed}/${totalCases} assertions passed`);
if (fixedFailed > 0) {
    console.log('❌ FIXED version has failures — the fix is NOT working correctly');
    process.exit(1);
} else {
    console.log('✅ All FIXED version tests pass — ?? correctly preserves 0 volume');
    console.log('✅ All BROKEN version tests confirmed — || is the root cause');
    process.exit(0);
}
