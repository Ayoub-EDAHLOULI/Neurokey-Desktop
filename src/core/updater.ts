import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Update checks go to this repo's GitHub Releases (see "plugins.updater" in
// tauri.conf.json). The plugin verifies every download against the signing
// public key before installing it.

/** Returns the available update, or null if the app is up to date. Throws on network errors. */
export const checkForUpdate = async (): Promise<Update | null> => check();

/** Downloads, verifies and installs the update, then restarts the app. */
export const installUpdate = async (
  update: Update,
  onProgress?: (percent: number) => void,
): Promise<void> => {
  let total = 0;
  let received = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      if (total > 0) onProgress?.(Math.round((received / total) * 100));
    }
  });

  // On Windows the installer closes the app itself; this covers macOS/Linux.
  await relaunch();
};
