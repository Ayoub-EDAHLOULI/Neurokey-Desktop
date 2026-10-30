import { useState, useEffect } from "react";
import {
  Lock,
  Clock,
  ShieldCheck,
  User,
  Star,
  Trash2,
  ChevronRight,
  Download,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { useVaultStore } from "../store/useVaultStore";
import { clearSecureStore } from "../core/encryption";
import { checkForUpdate, installUpdate } from "../core/updater";
import { IS_STORE_BUILD } from "../core/buildInfo";
import CustomAlert from "../components/CustomAlert";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { clearVault } = useVaultStore();
  const navigate = useNavigate();

  // --- STATE ---
  const [autoLockTime, setAutoLockTime] = useState<string>("5");
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as any,
    buttons: [] as any[],
  });

  const closeAlert = () =>
    setAlertConfig((prev) => ({ ...prev, visible: false }));

  const [appVersion, setAppVersion] = useState("");
  // null = idle, otherwise the text shown in the update row
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Simulate loading settings
  useEffect(() => {
    const savedTime = localStorage.getItem("autoLockTime");
    if (savedTime) setAutoLockTime(savedTime);
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus("Checking for Updates…");
    try {
      const update = await checkForUpdate();
      setUpdateStatus(null);

      if (!update) {
        return setAlertConfig({
          visible: true,
          title: "You're Up to Date",
          message: `NeuroKey ${appVersion} is the latest version.`,
          type: "success",
          buttons: [],
        });
      }

      setAlertConfig({
        visible: true,
        title: "Update Available",
        message: `Version ${update.version} is ready to install. NeuroKey will restart when it's done.`,
        type: "info",
        buttons: [
          { text: "Later", style: "cancel" },
          {
            text: "Install",
            onPress: async () => {
              setUpdateStatus("Downloading… 0%");
              try {
                await installUpdate(update, (p) =>
                  setUpdateStatus(`Downloading… ${p}%`),
                );
              } catch (e) {
                console.error("Update failed:", e);
                setUpdateStatus(null);
                setAlertConfig({
                  visible: true,
                  title: "Update Failed",
                  message: "The update could not be installed. Try again later.",
                  type: "error",
                  buttons: [],
                });
              }
            },
          },
        ],
      });
    } catch (e) {
      console.error("Update check failed:", e);
      setUpdateStatus(null);
      setAlertConfig({
        visible: true,
        title: "Couldn't Check for Updates",
        message: "Make sure you're connected to the internet and try again.",
        type: "error",
        buttons: [],
      });
    }
  };

  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAutoLockTime(val);
    localStorage.setItem("autoLockTime", val);
  };

  // --- ACTIONS ---
  const handleWipeData = async () => {
    setAlertConfig({
      visible: true,
      title: "Wipe All Data?",
      message:
        "This will permanently delete your encrypted vault from this device. You will lose everything.",
      type: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Wipe Data",
          style: "destructive",
          onPress: async () => {
            await clearSecureStore(); // Nuke the Tauri .dat file
            clearVault(); // Nuke the Zustand RAM
            // Force reload the app to trigger the Auth screen
            window.location.reload();
          },
        },
      ],
    });
  };

  // --- REUSABLE ROW COMPONENT ---
  const SettingRow = ({
    icon: Icon,
    color,
    label,
    type,
    value,
    onChange,
    onClick,
    disabled,
  }: any) => (
    <div
      className={`flex items-center justify-between px-6 py-4 border-b border-border last:border-0 ${onClick ? "cursor-pointer hover:bg-inputBg transition-colors" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} bg-opacity-20`}
        >
          <Icon size={18} className={color.replace("bg-", "text-")} />
        </div>
        <span className="text-text font-medium">{label}</span>
      </div>

      {type === "select" ? (
        <select
          value={value}
          onChange={onChange}
          className="bg-inputBg text-text border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary text-sm font-medium cursor-pointer"
        >
          <option value="1">1 Minute</option>
          <option value="5">5 Minutes</option>
          <option value="15">15 Minutes</option>
          <option value="never">Never</option>
        </select>
      ) : type === "danger" ? (
        <span className="text-danger font-bold text-sm">WIPE</span>
      ) : type === "static" ? null : (
        <ChevronRight size={20} className="text-subText" />
      )}
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col px-8 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-center py-3 shrink-0 mt-2">
        <h1 className="text-3xl font-bold text-text tracking-tight">
          Settings
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-8 mt-2 pb-10">
          {/* SECTION 1: SECURITY */}
          <section>
            <h2 className="text-xs font-bold text-subText mb-3 tracking-wider uppercase ml-2">
              Security
            </h2>
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              <SettingRow
                icon={Lock}
                color="bg-green-500"
                label="Master Password"
                onClick={() =>
                  setAlertConfig({
                    visible: true,
                    title: "Coming Soon",
                    message:
                      "Password changing will be available in the next update.",
                    type: "info",
                    buttons: [],
                  })
                }
              />
              <SettingRow
                icon={Clock}
                color="bg-orange-500"
                label="Auto-Lock Vault"
                type="select"
                value={autoLockTime}
                onChange={handleAutoLockChange}
              />
            </div>
          </section>

          {/* SECTION 3: ABOUT */}
          <section>
            <h2 className="text-xs font-bold text-subText mb-3 tracking-wider uppercase ml-2">
              About
            </h2>
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              <SettingRow
                icon={ShieldCheck}
                color="bg-sky-500"
                label="Security Architecture"
                onClick={() => navigate("/settings/security-tips")}
              />
              <SettingRow
                icon={User}
                color="bg-fuchsia-500"
                label="Developer Team"
                onClick={() => navigate("/settings/about")}
              />
              {IS_STORE_BUILD ? (
                <SettingRow
                  icon={Download}
                  color="bg-blue-500"
                  label="Updates are delivered through the Microsoft Store"
                  type="static"
                />
              ) : (
                <SettingRow
                  icon={Download}
                  color="bg-blue-500"
                  label={updateStatus ?? "Check for Updates"}
                  onClick={handleCheckForUpdates}
                  disabled={updateStatus !== null}
                />
              )}
              <SettingRow
                icon={Star}
                color="bg-yellow-500"
                label="Leave a Review"
                onClick={() =>
                  setAlertConfig({
                    visible: true,
                    title: "Thank You!",
                    message: "We appreciate your support.",
                    type: "success",
                    buttons: [],
                  })
                }
              />
            </div>
          </section>

          {/* SECTION 4: DANGER ZONE */}
          <section>
            <h2 className="text-xs font-bold text-danger mb-3 tracking-wider uppercase ml-2">
              Danger Zone
            </h2>
            <div className="bg-card border border-danger/30 rounded-3xl overflow-hidden shadow-sm">
              <SettingRow
                icon={Trash2}
                color="bg-danger"
                label="Wipe All Data"
                type="danger"
                onClick={handleWipeData}
              />
            </div>
            <p className="text-center text-subText text-sm mt-6 font-mono">
              NeuroKey {appVersion && `v${appVersion} `}(Desktop)
            </p>
          </section>
        </div>
      </div>

      {/* RENDER CUSTOM ALERT */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={closeAlert}
      />
    </div>
  );
}
