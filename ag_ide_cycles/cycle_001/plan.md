# Cycle 1 Plan: yt-dlp Auto-Update Feature

**Goal:** Implement automatic and manual yt-dlp version checking and updating to ensure the downloader remains functional when YouTube changes its API policies.

## Constraints

1.  **Language/Runtime**: Use Node.js for the server-side service and React for the UI component.
2.  **yt-dlp Management**: yt-dlp is currently invoked via `python -m yt_dlp`. The update mechanism must use `python -m pip install --upgrade yt-dlp`.
3.  **Electron Compatibility**: The feature must work in the Electron environment where the server runs.
4.  **Non-Blocking**: Update checks and downloads must not block the main server or UI thread.
5.  **User Control**: The user must be able to trigger a manual update check and see the result before confirming an update.

## Step-by-Step Tasks

### Server-Side (`server/services/ytdlp-updater.js` - NEW)

1.  **Create a new service file** at `server/services/ytdlp-updater.js`.
2.  **Implement `getCurrentVersion()`**: Run `python -m yt_dlp --version` and parse the output.
3.  **Implement `getLatestVersion()`**: Fetch the latest release version from the yt-dlp GitHub API (`https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest`) OR run `python -m pip index versions yt-dlp` and parse the latest.
4.  **Implement `checkForUpdate()`**: Compare current vs. latest. Return `{ updateAvailable: boolean, currentVersion, latestVersion }`.
5.  **Implement `performUpdate()`**: Run `python -m pip install --upgrade yt-dlp`. Return success/failure status and log output.
6.  **Implement `checkAndUpdateOnStartup()`**: Call `checkForUpdate()`. If an update is available, call `performUpdate()`.

### Server-Side Endpoints (`server-proxy.js` - MODIFY)

7.  **Add `GET /ytdlp/status`**: Returns the result of `checkForUpdate()`.
8.  **Add `POST /ytdlp/update`**: Triggers `performUpdate()` and returns the result.
9.  **Call `checkAndUpdateOnStartup()`** in `server-proxy.js` during server initialization (in a `setTimeout` to not block startup).

### UI (`src/components/karaoke-designs/IntegratedEcologicalOS.jsx` - MODIFY)

> [!IMPORTANT]
> **CORRECTION**: The correct UI is `IntegratedEcologicalOS.jsx` (RESILIENCE_NODE_v5), NOT `KaraokeMakerUI.jsx`.

10. **Add an Updater section** in the ACQUISITION panel (near the engine selector).
11. **Add a "Check for yt-dlp Update" button**.
    *   On click, call `GET /ytdlp/status`.
    *   Display current version, latest version, and whether an update is available.
12. **If an update is available, show an "Update Now" button**.
    *   On click, call `POST /ytdlp/update`.
    *   Show a loading state while updating.
    *   Display success or failure message upon completion.

## Acceptance Criteria

- [ ] **AC1**: On server startup, the system checks for yt-dlp updates and logs the result.
- [ ] **AC2**: If an update is available on startup, the system automatically installs it.
- [ ] **AC3**: The UI displays a "Check for yt-dlp Update" button.
- [ ] **AC4**: Clicking the button correctly fetches and displays the current and latest versions.
- [ ] **AC5**: If an update is available, an "Update Now" button appears.
- [ ] **AC6**: Clicking "Update Now" successfully upgrades yt-dlp and displays a success message.
- [ ] **AC7**: If yt-dlp is already up-to-date, the UI shows an "Up to date" message.
- [ ] **AC8**: The feature works correctly in the Electron environment.

## Definition of Done (DoD)

All acceptance criteria (AC1-AC8) pass verification. The `AG_IDE_STATUS.md` is updated to reflect completion.

## Expected Changes

-   **NEW**: `server/services/ytdlp-updater.js`
-   **MODIFY**: `server-proxy.js` (add 2 new endpoints, call startup check)
-   **MODIFY**: `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` (add UI section for update)

## Verification Plan

### Automated Tests

*No pre-existing automated tests are applicable for this new feature.*

### Manual Verification

1.  **Startup Check**: Start the server and check the console logs for yt-dlp version check output. (AC1, AC2)
2.  **API Endpoint `/ytdlp/status`**: Use `curl http://localhost:3001/ytdlp/status` and verify the JSON response contains `currentVersion`, `latestVersion`, and `updateAvailable`. (AC4)
3.  **API Endpoint `/ytdlp/update`**: Use `curl -X POST http://localhost:3001/ytdlp/update` and verify the JSON response indicates success or failure. (AC6)
4.  **UI Check Button**: Open the Electron app (or web dev server), navigate to the Settings area, find and click "Check for yt-dlp Update", and observe the displayed versions. (AC3, AC4, AC7)
5.  **UI Update Button**: If an update is available, click "Update Now" and verify successful completion. (AC5, AC6)
6.  **Electron Environment**: Perform all above tests within the Electron app. (AC8)
