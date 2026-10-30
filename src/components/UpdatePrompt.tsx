import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, installUpdate } from "../core/updater";
import { IS_STORE_BUILD } from "../core/buildInfo";

// Check once per app launch, not every time the vault is unlocked
let startupCheckDone = false;

export default function UpdatePrompt() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (IS_STORE_BUILD || startupCheckDone) return;
    startupCheckDone = true;

    // Wait a moment so the check doesn't compete with unlocking the vault
    const timer = setTimeout(() => {
      checkForUpdate()
        .then(setUpdate)
        .catch(() => {}); // Offline or no release yet: stay silent
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (!update) return;
    setError("");
    setProgress(0);
    try {
      await installUpdate(update, setProgress);
    } catch (e) {
      console.error("Update failed:", e);
      setProgress(null);
      setError("Update failed. Try again later.");
    }
  };

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="mx-3 mb-3 p-3 rounded-xl bg-primary/10 border border-primary/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-text text-sm font-bold">Update available</p>
              <p className="text-subText text-xs mt-0.5">
                Version {update.version}
              </p>
            </div>
            {progress === null && (
              <button
                onClick={() => setUpdate(null)}
                className="text-subText hover:text-text transition-colors"
                aria-label="Dismiss update"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {error && <p className="text-danger text-xs mt-2">{error}</p>}

          <button
            onClick={handleInstall}
            disabled={progress !== null}
            className="mt-3 w-full h-8 bg-primary hover:bg-blue-600 disabled:opacity-70 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            {progress === null ? (
              <>
                <Download size={14} /> Install & Restart
              </>
            ) : (
              `Downloading… ${progress}%`
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
