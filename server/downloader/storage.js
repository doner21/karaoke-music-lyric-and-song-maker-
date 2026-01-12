import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root downloads folder: ./downloads (relative to project root)
const DOWNLOAD_ROOT = path.resolve(__dirname, '../../downloads');

// Ensure root exists
fs.ensureDirSync(DOWNLOAD_ROOT);

export const Storage = {
    // Initialize a job directory
    initJob: async (jobId) => {
        const jobDir = path.join(DOWNLOAD_ROOT, jobId);
        await fs.ensureDir(jobDir);
        return jobDir;
    },

    // Save metadata
    saveMetadata: async (jobId, metadata) => {
        const file = path.join(DOWNLOAD_ROOT, jobId, `${jobId}.meta.json`);
        await fs.writeJson(file, metadata, { spaces: 2 });
        return file;
    },

    // Get file path for a download
    getFilePath: (jobId, filename) => {
        return path.join(DOWNLOAD_ROOT, jobId, filename);
    },

    // Cleanup
    cleanupJob: async (jobId) => {
        const jobDir = path.join(DOWNLOAD_ROOT, jobId);
        if (await fs.pathExists(jobDir)) {
            await fs.remove(jobDir);
            return true;
        }
        return false;
    },

    // Helper: Sanitize filename
    sanitize: (name) => {
        return name.replace(/[^a-z0-9\.\-_]/gi, '_').replace(/_{2,}/g, '_');
    },

    // Stream for direct download
    getReadStream: (jobId, filename) => {
        return fs.createReadStream(path.join(DOWNLOAD_ROOT, jobId, filename));
    },

    // Resolve Absolute Path
    getAbsolutePath: (jobId, filename) => {
        return path.join(DOWNLOAD_ROOT, jobId, filename);
    },

    // Create Write Stream for downloads
    createWriteStream: async (jobId, filename) => {
        const filePath = path.join(DOWNLOAD_ROOT, jobId, filename);
        await fs.ensureFile(filePath);
        return fs.createWriteStream(filePath);
    },

    ROOT: DOWNLOAD_ROOT
};
