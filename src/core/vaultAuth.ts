import { getSecureItem, persistVault, saveSecureItem } from "./encryption";
import {
  checkVerifier,
  createVerifier,
  deriveVaultKey,
  DESKTOP_KDF_ITERATIONS,
  generateSalt,
  KDF_ALGORITHM,
  KdfParams,
  legacyCheckVerifier,
  legacyDeriveKey,
} from "./vaultCrypto";

// Keys in the Tauri store file
const K = {
  email: "user_email",
  salt: "vault_salt",
  kdf: "vault_kdf",
  verifier: "vault_validation",
} as const;

const currentKdf = (): KdfParams => ({
  alg: KDF_ALGORITHM,
  iterations: DESKTOP_KDF_ITERATIONS,
});

const writeKeyMaterial = async (password: string) => {
  const salt = generateSalt();
  const kdf = currentKdf();
  const key = await deriveVaultKey(password, salt, kdf);
  await saveSecureItem(K.salt, salt);
  await saveSecureItem(K.verifier, createVerifier(key));
  await saveSecureItem(K.kdf, JSON.stringify(kdf));
  await persistVault();
  return key;
};

export const getSavedEmail = () => getSecureItem(K.email);

/** Creates a new vault and returns its master key. */
export const createVault = async (email: string, password: string) => {
  await saveSecureItem(K.email, email);
  return writeKeyMaterial(password);
};

/**
 * Verifies the master password and returns the vault key, or null if wrong.
 * v1 vaults (5,000 iterations, no KDF params) are upgraded transparently.
 */
export const unlockWithPassword = async (
  password: string,
): Promise<string | null> => {
  const [salt, verifier, kdfJson] = await Promise.all([
    getSecureItem(K.salt),
    getSecureItem(K.verifier),
    getSecureItem(K.kdf),
  ]);
  if (!salt || !verifier) return null;

  if (kdfJson) {
    const key = await deriveVaultKey(password, salt, JSON.parse(kdfJson));
    return checkVerifier(verifier, key) ? key : null;
  }

  // --- v1 migration ---
  if (!legacyCheckVerifier(verifier, legacyDeriveKey(password, salt))) {
    return null;
  }
  return writeKeyMaterial(password);
};
