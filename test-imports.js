
console.log('Testing imports...');
try {
    await import('./server/db/index.js');
    console.log('DB loaded');
} catch (e) { console.error('DB failed:', e); }

try {
    await import('./server/downloader/index.js');
    console.log('Downloader loaded');
} catch (e) { console.error('Downloader failed:', e); }

try {
    await import('./server/splitter/index.js');
    console.log('Splitter loaded');
} catch (e) { console.error('Splitter failed:', e); }

try {
    await import('./server/alignment/index.js');
    console.log('Alignment loaded');
} catch (e) { console.error('Alignment failed:', e); }

try {
    await import('./server/orchestrator/index.js');
    console.log('Orchestrator loaded');
} catch (e) { console.error('Orchestrator failed:', e); }

try {
    await import('./server/library/search.js');
    console.log('UnifiedSearch loaded');
} catch (e) { console.error('UnifiedSearch failed:', e); }
