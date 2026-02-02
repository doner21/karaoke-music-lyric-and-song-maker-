/**
 * yt-dlp Updater Service
 * 
 * Provides automatic and manual yt-dlp version checking and updating
 * to ensure the downloader remains functional when YouTube changes its API policies.
 */

import { spawn } from 'child_process';

/**
 * Run a command and return its output as a string
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { shell: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Get the currently installed yt-dlp version
 * @returns {Promise<string|null>} Version string or null if not installed
 */
export async function getCurrentVersion() {
    try {
        const result = await runCommand('python', ['-m', 'yt_dlp', '--version']);
        if (result.exitCode === 0 && result.stdout) {
            return result.stdout.trim();
        }
        console.error('[ytdlp-updater] Failed to get current version:', result.stderr);
        return null;
    } catch (err) {
        console.error('[ytdlp-updater] Error getting current version:', err.message);
        return null;
    }
}

/**
 * Get the latest available yt-dlp version from PyPI
 * @returns {Promise<string|null>} Latest version string or null on failure
 */
export async function getLatestVersion() {
    try {
        // Try pip index versions first (faster)
        const result = await runCommand('python', ['-m', 'pip', 'index', 'versions', 'yt-dlp']);
        if (result.exitCode === 0 && result.stdout) {
            // Parse output like: "yt-dlp (2024.1.1)"
            // Output format: "yt-dlp (VERSION)" on first line
            const match = result.stdout.match(/yt-dlp\s*\(([^)]+)\)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // Fallback: Use pip show to get at least some version info
        // or fetch from GitHub API
        console.log('[ytdlp-updater] pip index failed, trying GitHub API...');
        const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
        if (response.ok) {
            const data = await response.json();
            // GitHub tag is like "2024.01.01"
            return data.tag_name || null;
        }

        console.error('[ytdlp-updater] Failed to get latest version from all sources');
        return null;
    } catch (err) {
        console.error('[ytdlp-updater] Error getting latest version:', err.message);
        return null;
    }
}

/**
 * Compare two version strings
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {boolean} True if latest is newer than current
 */
function isNewerVersion(current, latest) {
    if (!current || !latest) return false;

    // yt-dlp versions are date-based like "2024.01.01" or "2024.1.1"
    // Normalize and compare as dates or numerically
    const normalize = (v) => v.split('.').map(n => n.padStart(4, '0')).join('.');
    return normalize(latest) > normalize(current);
}

/**
 * Check if an update is available
 * @returns {Promise<{updateAvailable: boolean, currentVersion: string|null, latestVersion: string|null}>}
 */
export async function checkForUpdate() {
    console.log('[ytdlp-updater] Checking for updates...');

    const [currentVersion, latestVersion] = await Promise.all([
        getCurrentVersion(),
        getLatestVersion()
    ]);

    const updateAvailable = isNewerVersion(currentVersion, latestVersion);

    console.log(`[ytdlp-updater] Current: ${currentVersion}, Latest: ${latestVersion}, Update available: ${updateAvailable}`);

    return {
        updateAvailable,
        currentVersion,
        latestVersion
    };
}

/**
 * Perform yt-dlp update via pip
 * @returns {Promise<{success: boolean, message: string, output: string}>}
 */
export async function performUpdate() {
    console.log('[ytdlp-updater] Performing update...');

    try {
        const result = await runCommand('python', ['-m', 'pip', 'install', '--upgrade', 'yt-dlp']);

        const success = result.exitCode === 0;
        const output = result.stdout + '\n' + result.stderr;

        if (success) {
            const newVersion = await getCurrentVersion();
            console.log(`[ytdlp-updater] Update successful. New version: ${newVersion}`);
            return {
                success: true,
                message: `Successfully updated to version ${newVersion}`,
                output: output.trim()
            };
        } else {
            console.error('[ytdlp-updater] Update failed:', result.stderr);
            return {
                success: false,
                message: 'Update failed',
                output: output.trim()
            };
        }
    } catch (err) {
        console.error('[ytdlp-updater] Error during update:', err.message);
        return {
            success: false,
            message: `Error during update: ${err.message}`,
            output: ''
        };
    }
}

/**
 * Check for updates on startup and auto-update if available
 * This function is non-blocking and logs results
 */
export async function checkAndUpdateOnStartup() {
    console.log('[ytdlp-updater] Running startup check...');

    try {
        const status = await checkForUpdate();

        if (!status.currentVersion) {
            console.warn('[ytdlp-updater] yt-dlp not installed or not accessible');
            return;
        }

        if (status.updateAvailable) {
            console.log('[ytdlp-updater] Update available! Auto-updating...');
            const result = await performUpdate();
            if (result.success) {
                console.log('[ytdlp-updater] Startup auto-update completed:', result.message);
            } else {
                console.error('[ytdlp-updater] Startup auto-update failed:', result.message);
            }
        } else {
            console.log(`[ytdlp-updater] yt-dlp is up to date (${status.currentVersion})`);
        }
    } catch (err) {
        console.error('[ytdlp-updater] Startup check failed:', err.message);
    }
}
