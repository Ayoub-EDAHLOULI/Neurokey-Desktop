import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  ShieldAlert,
} from "lucide-react";
import { clearSecureStore } from "../core/encryption";
import {
  createVault,
  getSavedEmail,
  unlockWithPassword,
} from "../core/vaultAuth";
import { useVaultStore } from "../store/useVaultStore";
import CustomAlert from "../components/CustomAlert";

// Mocking the router navigate function for now
export default function Auth({ onUnlock }: { onUnlock: () => void }) {
  const { loadVault, clearVault } = useVaultStore();
  const [mode, setMode] = useState<0 | 1>(0); // 0 = Login, 1 = Signup
  const [isLoading, setIsLoading] = useState(true);

  // Changed from a single string to an object mapping specific fields to error strings
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // 👇 NEW: Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as any,
    buttons: [] as any[],
  });

  const closeAlert = () =>
    setAlertConfig((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const savedEmail = await getSavedEmail();
        if (savedEmail) {
          setFormData((prev) => ({ ...prev, email: savedEmail }));
          setMode(0);
        } else {
          setMode(1);
        }
      } catch (error) {
        console.error("Failed to read secure vault:", error);
        setMode(1);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  // --- VALIDATION LOGIC ---
  const validate = () => {
    let valid = true;
    let newErrors: { [key: string]: string } = {};

    if (!formData.email.includes("@")) {
      newErrors.email = "Invalid email address";
      valid = false;
    }

    if (formData.password.length < 8) {
      newErrors.password = "Minimum 8 characters required";
      valid = false;
    }

    if (mode === 1) {
      if (!formData.name) {
        newErrors.name = "Full name is required";
        valid = false;
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
        valid = false;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors

    // Run field validation before hitting the encryption logic
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (mode === 1) {
        const key = await createVault(formData.email, formData.password);
        await loadVault(key); // creates an empty, encrypted vault
        onUnlock();
        return;
      }

      if (!(await getSavedEmail())) {
        return setErrors({ general: "No vault found on this device." });
      }

      const key = await unlockWithPassword(formData.password);
      if (!key) {
        return setErrors({ general: "Incorrect Master Password." });
      }

      if (!(await loadVault(key))) {
        return setErrors({
          general: "Your vault file could not be decrypted on this device.",
        });
      }

      onUnlock();
    } catch (error) {
      console.error("Unlock failed:", error);
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWipeVault = () => {
    setAlertConfig({
      visible: true,
      title: "Wipe Vault?",
      message:
        "WARNING: This will permanently delete your encrypted vault and all saved data. This action cannot be undone. Continue?",
      type: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Wipe Data",
          style: "destructive",
          onPress: async () => {
            await clearSecureStore();
            clearVault(); // Wipe the RAM state
            setMode(1);
            setFormData({
              name: "",
              email: "",
              password: "",
              confirmPassword: "",
            });
            setErrors({});
          },
        },
      ],
    });
  };

  if (isLoading)
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="h-full w-full bg-background flex flex-col items-center justify-center p-6 relative overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md shrink-0 my-auto"
      >
        {/* LOGO */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 ring-1 ring-white/15 shadow-[0_0_28px_8px_rgba(10,132,255,0.35)]">
            <img
              src="/logo.png"
              alt="NeuroKey"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-text tracking-tight">
            Neuro<span className="text-primary">Key</span>
          </h1>
          <p className="text-subText mt-1">Your mind, secured.</p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border shadow-2xl relative z-10">
          {/* SEGMENT CONTROL */}
          <div className="flex bg-inputBg p-1 rounded-xl mb-6 relative">
            {["Unlock Vault", "Create Vault"].map((tab, idx) => (
              <button
                key={tab}
                onClick={() => {
                  setMode(idx as 0 | 1);
                  setErrors({}); // Clear errors when switching tabs
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg z-10 transition-colors ${mode === idx ? "text-text" : "text-subText"}`}
              >
                {tab}
              </button>
            ))}
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-card rounded-lg shadow-sm z-0"
              animate={{ left: mode === 0 ? "4px" : "calc(50%)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {mode === 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AuthInput
                    icon={<User size={18} />}
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={(v: string) =>
                      setFormData({ ...formData, name: v })
                    }
                    error={errors.name}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AuthInput
              icon={<Mail size={18} />}
              placeholder="Email Address"
              type="email"
              value={formData.email}
              onChange={(v: string) => setFormData({ ...formData, email: v })}
              error={errors.email}
            />
            <AuthInput
              icon={<Lock size={18} />}
              placeholder="Master Password"
              type="password"
              value={formData.password}
              onChange={(v: string) =>
                setFormData({ ...formData, password: v })
              }
              error={errors.password}
            />

            <AnimatePresence mode="popLayout">
              {mode === 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AuthInput
                    icon={<Lock size={18} />}
                    placeholder="Confirm Password"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(v: string) =>
                      setFormData({ ...formData, confirmPassword: v })
                    }
                    error={errors.confirmPassword}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* General system errors (like wrong password) */}
            {errors.general && (
              <p className="text-danger text-sm text-center font-medium mt-2">
                {errors.general}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-primary/30 mt-2"
            >
              {mode === 0 ? "Unlock" : "Initialize Vault"}
            </button>
          </form>

          {mode === 0 && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <button className="text-primary hover:text-blue-400 transition-colors">
                <Fingerprint size={36} />
              </button>
              <button
                onClick={handleWipeVault}
                className="text-sm text-subText hover:text-danger transition-colors flex items-center gap-1"
              >
                <ShieldAlert size={14} /> Forgot Master Password?
              </button>
            </div>
          )}
        </div>
      </motion.div>

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

// --- STRICT TYPESCRIPT INTERFACE ---
interface AuthInputProps {
  icon: React.ReactNode;
  placeholder: string;
  type?: "text" | "password" | "email";
  value: string;
  onChange: (value: string) => void;
  error?: string; // Optional error text to display
}

// Reusable Input Component
function AuthInput({
  icon,
  placeholder,
  type = "text",
  value,
  onChange,
  error,
}: AuthInputProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex items-center h-12 bg-inputBg rounded-xl px-4 border transition-colors ${
          error
            ? "border-danger focus-within:border-danger"
            : "border-transparent focus-within:border-primary"
        }`}
      >
        <span className="text-subText mr-3">{icon}</span>
        <input
          type={isPassword && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-text text-sm"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-subText hover:text-text transition-colors"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {/* Conditionally render the field-specific error message */}
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-danger text-xs font-semibold ml-2"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
