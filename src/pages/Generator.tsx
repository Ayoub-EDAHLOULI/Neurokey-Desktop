import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import CustomAlert from "../components/CustomAlert";
import { secureRandomInt } from "../core/vaultCrypto";

export default function Generator() {
  // --- STATE ---
  const [password, setPassword] = useState("");
  const [length, setLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [strengthScore, setStrengthScore] = useState(0);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as any,
  });

  const closeAlert = () =>
    setAlertConfig((prev) => ({ ...prev, visible: false }));

  // --- STRENGTH LOGIC ---
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 8) score++;
    if (pass.length > 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    setStrengthScore(score);
  };

  // --- GENERATOR LOGIC ---
  const generatePassword = useCallback(() => {
    const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowers = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    let chars = "";
    if (includeUpper) chars += uppers;
    if (includeLower) chars += lowers;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;

    // Fallback if nothing selected
    if (chars === "") {
      chars = lowers;
      setIncludeLower(true);
    }

    let generated = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = secureRandomInt(chars.length);
      generated += chars[randomIndex];
    }
    setPassword(generated);
    calculateStrength(generated);
  }, [length, includeUpper, includeLower, includeNumbers, includeSymbols]);

  // Run on first load and whenever settings change
  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const getStrengthColor = () => {
    if (strengthScore <= 2) return "text-danger";
    if (strengthScore === 3) return "text-orange-500";
    return "text-green-500";
  };

  const getStrengthLabel = () => {
    if (strengthScore <= 2) return "Weak";
    if (strengthScore === 3) return "Good";
    return "Strong";
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setAlertConfig({
        visible: true,
        title: "Copied!",
        message: "Password copied to clipboard.",
        type: "success",
      });
    } catch (err) {
      setAlertConfig({
        visible: true,
        title: "Error",
        message: "Failed to copy text.",
        type: "error",
      });
    }
  };

  // Helper component for the Tailwind Toggle Switch
  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex justify-between items-center px-6 py-4 border-b border-border last:border-0">
      <span className="text-text font-medium">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-inputBg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col px-8 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-center py-3 shrink-0 mt-2">
        <h1 className="text-3xl font-bold text-text tracking-tight">
          Generator
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="mx-auto w-full space-y-8 mt-4">
          {/* 1. PASSWORD DISPLAY CARD */}
          <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center shadow-lg">
            <h2 className="text-4xl md:text-5xl font-mono text-text text-center tracking-wider break-all mb-4 select-all">
              {password}
            </h2>
            <span
              className={`text-lg font-bold tracking-widest uppercase ${getStrengthColor()}`}
            >
              {getStrengthLabel()}
            </span>

            <div className="flex w-full gap-4 mt-8">
              <button
                onClick={generatePassword}
                className="w-14 h-14 bg-inputBg hover:bg-border rounded-2xl flex items-center justify-center transition-colors text-primary"
                title="Regenerate"
              >
                <RefreshCw size={24} />
              </button>
              <button
                onClick={copyToClipboard}
                className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg transition-colors gap-2 shadow-lg shadow-primary/30"
              >
                <Copy size={20} /> Copy Password
              </button>
            </div>
          </div>

          {/* 2. SETTINGS GROUP */}
          <section>
            <h3 className="text-xs font-bold text-subText mb-3 tracking-wider uppercase ml-4">
              Options
            </h3>
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              {/* Length Slider */}
              <div className="px-6 py-6 border-b border-border flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-text font-medium">Length</span>
                  <span className="text-primary font-bold text-xl">
                    {length}
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full h-2 bg-inputBg rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Toggles */}
              <Toggle
                label="Uppercase (A-Z)"
                checked={includeUpper}
                onChange={setIncludeUpper}
              />
              <Toggle
                label="Lowercase (a-z)"
                checked={includeLower}
                onChange={setIncludeLower}
              />
              <Toggle
                label="Numbers (0-9)"
                checked={includeNumbers}
                onChange={setIncludeNumbers}
              />
              <Toggle
                label="Symbols (!@#)"
                checked={includeSymbols}
                onChange={setIncludeSymbols}
              />
            </div>
          </section>
        </div>
      </div>

      {/* RENDER CUSTOM ALERT */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
      />
    </div>
  );
}
