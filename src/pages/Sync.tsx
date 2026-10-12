import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Smartphone, Wifi, ShieldCheck, RefreshCw } from "lucide-react";
import QRCode from "react-qr-code";
import { useVaultStore, VaultItem } from "../store/useVaultStore";
import { decrypt, encrypt, randomHex } from "../core/vaultCrypto";

// THE SMART MERGE LOGIC
const smartMerge = (localVault: VaultItem[], remoteVault: VaultItem[]) => {
  const mergedMap = new Map();

  localVault.forEach((item) => mergedMap.set(item.id, item));

  remoteVault.forEach((remoteItem) => {
    const localItem = mergedMap.get(remoteItem.id);

    if (!localItem) {
      mergedMap.set(remoteItem.id, remoteItem);
    } else {
      const localTime = localItem.updated_at || localItem.created_at || 0;
      const remoteTime = remoteItem.updated_at || remoteItem.created_at || 0;

      if (remoteTime > localTime) {
        mergedMap.set(remoteItem.id, remoteItem);
      }
    }
  });

  return Array.from(mergedMap.values()) as VaultItem[];
};

export default function Sync() {
  const [qrValue, setQrValue] = useState<string>("");
  const [connectionString, setConnectionString] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);

  const { setItems, items } = useVaultStore();
  // Latest vault + current session key, readable from the event listener
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const sessionKeyRef = useRef<string | null>(null);

  /**
   * Creates a one-time pairing session: a random id + 256-bit key go into the QR code
   * (the key never crosses the network). The desktop vault is encrypted with that key
   * before being handed to the Rust server.
   */
  const startSession = useCallback(async () => {
    try {
      setIsError(false);
      setSyncError("");
      setSyncSuccess(false);

      const url = await invoke<string>("get_sync_connection_string");
      const sid = randomHex(16);
      const key = randomHex(32);
      sessionKeyRef.current = key;

      await invoke("start_sync_session", {
        sid,
        payload: encrypt(JSON.stringify(itemsRef.current), key),
      });

      setConnectionString(url);
      setQrValue(JSON.stringify({ v: 2, url, sid, key }));
    } catch (error) {
      console.error(error);
      setIsError(true);
    }
  }, []);

  useEffect(() => {
    startSession();

    // Phone payload arrives encrypted with the session key
    const unlisten = listen<{ payload: string }>(
      "vault-sync-received",
      (event) => {
        const key = sessionKeyRef.current;
        const json = key ? decrypt(event.payload.payload, key) : null;
        sessionKeyRef.current = null; // single use

        if (json === null) {
          setSyncError("The phone's data could not be verified. Try again.");
          return;
        }

        const mobileItems = JSON.parse(json);
        if (Array.isArray(mobileItems)) {
          setItems(smartMerge(itemsRef.current, mobileItems));
          setSyncSuccess(true);
        }
      },
    );

    return () => {
      sessionKeyRef.current = null;
      invoke("cancel_sync_session").catch(() => {});
      unlisten.then((f) => f());
    };
  }, [startSession, setItems]);

  return (
    <div className="h-full w-full flex flex-col px-8 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-center py-6 shrink-0 mt-4">
        <div>
          <h1 className="text-4xl font-bold text-text tracking-tight">
            Device Sync
          </h1>
          <p className="text-subText mt-2">
            Connect your mobile phone to transfer your vault securely.
          </p>
        </div>
        <button
          onClick={startSession}
          className="h-12 px-6 bg-inputBg hover:bg-border rounded-full flex items-center justify-center text-text font-bold transition-colors gap-2"
        >
          <RefreshCw size={18} /> New QR Code
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* LEFT: INSTRUCTIONS */}
          <div className="flex flex-col justify-center space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Wifi className="text-blue-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text mb-1">
                  1. Same Network
                </h3>
                <p className="text-subText">
                  Ensure both your phone and computer are connected to the exact
                  same Wi-Fi network.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Smartphone className="text-purple-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text mb-1">
                  2. Open NeuroKey Mobile
                </h3>
                <p className="text-subText">
                  Go to Settings &gt; Sync Devices on your mobile app and tap
                  "Scan QR Code".
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-green-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text mb-1">
                  3. Secure Transfer
                </h3>
                <p className="text-subText">
                  Your vault is encrypted with a one-time key contained in the
                  QR code. It never touches the cloud or leaves your network.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: QR CODE */}
          <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center shadow-xl">
            {isError ? (
              <div className="text-center p-6">
                <p className="text-danger font-bold text-lg mb-2">
                  Network Error
                </p>
                <p className="text-subText text-sm">
                  Could not detect your local IP address. Are you connected to
                  Wi-Fi?
                </p>
              </div>
            ) : syncError ? (
              <div className="text-center p-6">
                <p className="text-danger font-bold text-lg mb-2">
                  Sync Rejected
                </p>
                <p className="text-subText text-sm mb-4">{syncError}</p>
                <button
                  onClick={startSession}
                  className="h-10 px-5 bg-inputBg hover:bg-border rounded-full text-text font-bold"
                >
                  Generate a new QR code
                </button>
              </div>
            ) : syncSuccess ? (
              <div className="text-center p-6 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck className="text-green-500 w-10 h-10" />
                </div>
                <p className="text-green-500 font-bold text-xl mb-2">
                  Vault Synced!
                </p>
                <p className="text-subText text-sm">
                  Your desktop and mobile vaults are now identical.
                </p>
              </div>
            ) : qrValue ? (
              <>
                <div className="bg-white p-4 rounded-2xl mb-6 shadow-md">
                  <QRCode
                    value={qrValue}
                    size={220}
                    level="M" // Payload is longer (session key); M keeps the code scannable
                  />
                </div>
                <p className="text-text font-mono font-bold tracking-widest bg-inputBg px-4 py-2 rounded-lg">
                  {connectionString}
                </p>
                <p className="text-subText text-xs mt-4 text-center max-w-[250px]">
                  Waiting for mobile connection… This code works once and
                  expires in 5 minutes.
                </p>
              </>
            ) : (
              <div className="animate-pulse w-[200px] h-[200px] bg-inputBg rounded-2xl mb-6" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
