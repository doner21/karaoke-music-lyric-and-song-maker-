# 🎤 KaraokeBox — Audio, Music, Lyric & Song Maker

Welcome to **KaraokeBox**, an advanced desktop application built with **Electron**, **Vite**, and **React** that empowers you to transform any YouTube track or MP3 file into a fully-separated karaoke arrangement.

This application leverages cutting-edge Machine Learning models locally (via Demucs and UVR) to separate vocals from instrumentals, aligns lyrics using professional-grade alignment APIs, and allows you to manually polish, highlight, and sync lyrics for an ultimate playback and export experience.

---

## 🔧 System Prerequisites

Before setting up KaraokeBox on another computer, ensure the machine has the following software installed:

1. **Git**: [Download & Install Git](https://git-scm.com/downloads)
2. **Node.js (v18 or newer)**: [Download & Install Node.js](https://nodejs.org/en) (Includes `npm`)
3. **Python (v3.10 to v3.12 recommended)**: [Download Python](https://www.python.org/downloads/)
   * *Important:* During Windows installation, ensure you check **"Add Python to PATH"**.
4. **(Optional) NVIDIA GPU Drivers + CUDA**: Highly recommended for extremely fast local AI audio separation. If no GPU is found, processing will fallback to CPU (slower but works).

---

## 🚀 Step-by-Step Setup Instructions

Follow these exact commands to replicate this workspace from scratch on a new machine.

### 1. Clone the Repository
Open your terminal (PowerShell on Windows) and clone the repository to your desired folder:
```bash
git clone https://github.com/doner21/karaoke-music-lyric-and-song-maker-
cd karaoke-music-lyric-and-song-maker-
```

### 2. Install Node.js Dependencies
Installs the React frontend dependencies, Electron runtime, and Express backend libraries:
```bash
npm install
```
> *Note:* This installs `ffmpeg-static` automatically, so you **do not** need to install FFmpeg globally on the host computer!

### 3. Create local Python Virtual Environment (`venv`)
The local AI audio splitting services (Demucs & UVR) look specifically for a Python environment located inside a folder named `venv` in the project root.

Run the following commands in your terminal:
```powershell
# 1. Create the venv
python -m venv venv

# 2. Activate the venv (PowerShell)
.\venv\Scripts\Activate.ps1

# 3. Upgrade pip
python -m pip install --upgrade pip

# 4. Install the AI splitting frameworks
pip install demucs audio-separator
```

### 4. Set Up Environment Configuration (`.env`)
Create a file named **`.env`** in the root folder of the project. Add the following lines, replacing with your active credentials:

```env
VITE_API_URL=http://localhost:3001
GENIUS_ACCESS_TOKEN=YOUR_GENIUS_API_TOKEN

# Active AudioShake API Key (V2 token prefixed with ashke_)
AUDIOSHAKE_API_KEY=ashke_YOUR_TOKEN
```

### 5. Launch the Application
Ensure you are in the project root directory and start the complete stack (Vite + Backend Express + Electron shell) with a single command:
```bash
npm run clean-start
```
*   **First Run Lag:** On your very first boot up, Vite might take 10-15 seconds to bundle the heavy dependencies. If you get a momentary white flash, simply press `Ctrl + R` inside the app to force-reload the UI. Subsequent launches are instantaneous!

---

## 🛠️ Project Architecture

*   **/src**: Modern React dashboard housing the lyrics editor, waveform timeline viewer, and management controls.
*   **/electron**: Desktop shell lifecycle and system integration scripts.
*   **/server**: Express Node backend holding services for downloading streams, caching assets, and queuing AI jobs.
*   **/server/splitter**: Handlers that spawn sub-processes in your local python `venv` to separate vocals via Demucs or UVR.
*   **/server/alignment**: Adapter to coordinate professional word-level timing with APIs.
*   **karaoke.db**: Lightweight, lightning-fast local SQLite database persisting your library, jobs, and tracks securely offline.

---

Happy Karaoke Making! 🎵
