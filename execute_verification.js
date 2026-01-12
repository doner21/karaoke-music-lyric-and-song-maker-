
const { spawn } = require('child_process');
const path = require('path');

// Start Server
console.log("Starting Server...");
const server = spawn('node', ['server-proxy.js'], { cwd: __dirname, stdio: 'pipe' });

server.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER] ${data}`);
});
server.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER ERR] ${data}`);
});

// Run Verification after delay
setTimeout(() => {
    console.log("Starting Verification...");
    const verify = spawn('node', ['verify_hardening.js'], { cwd: __dirname, stdio: 'inherit' });

    verify.on('close', (code) => {
        console.log(`Verification exited with code ${code}`);
        server.kill();
        process.exit(code);
    });
}, 5000);
