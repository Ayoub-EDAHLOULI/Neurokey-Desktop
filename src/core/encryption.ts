import { Store, load } from "@tauri-apps/plugin-store";

// Tauri store holding the vault file. Values written here are already encrypted
// (see vaultCrypto.ts); this module only handles persistence.

// Keep a single instance of the store in memory
let _storeInstance: Store | null = null;

const getStore = async (): Promise<Store> => {
  if (!_storeInstance) {
    try {
      _storeInstance = await load("neurokey_secure.dat", {
        autoSave: false,
        defaults: {},
      });
    } catch (error) {
      console.error("Failed to load Tauri store:", error);
      throw error;
    }
  }
  return _storeInstance;
};

export const saveSecureItem = async (
  key: string,
  value: string,
): Promise<void> => {
  try {
    const store = await getStore();
    await store.set(key, value);
    // Notice: NO store.save() here! We just queue the data in memory.
  } catch (error) {
    console.error(`Failed to save secure item (${key}):`, error);
  }
};

// NEW FUNCTION to manually trigger the hard drive write
export const persistVault = async (): Promise<void> => {
  try {
    const store = await getStore();
    await store.save();
  } catch (error) {
    console.error("Failed to write vault to disk:", error);
  }
};

export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    const store = await getStore();
    return (await store.get<string>(key)) || null;
  } catch (error) {
    console.error(`Failed to get secure item (${key}):`, error);
    return null;
  }
};

export const clearSecureStore = async (): Promise<void> => {
  try {
    const store = await getStore();
    await store.clear();
    await store.save(); // It is safe to manually save here since it's a single wipe action
  } catch (error) {
    console.error("Failed to clear secure store:", error);
  }
};
