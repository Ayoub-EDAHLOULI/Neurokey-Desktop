import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { getSecureItem, saveSecureItem, persistVault } from "../core/encryption";
import { decrypt, encrypt, isEncryptedPayload } from "../core/vaultCrypto";

export type VaultItemType = "password" | "card" | "note";

export interface VaultItem {
  id: string;
  type: VaultItemType;
  name: string;
  email?: string;
  password?: string;
  url?: string;
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  cvv?: string;
  cardType?: "visa" | "mastercard" | "amex";
  notes?: string;
  icon?: string;
  color?: string;
  created_at: number;
  updated_at: number;
  isDeleted?: boolean;
}

interface VaultStore {
  items: VaultItem[];
  /** Master key of the unlocked vault. Memory only, cleared on lock. */
  vaultKey: string | null;
  /** Decrypts the stored vault with the master key. Returns false if it can't be read. */
  loadVault: (key: string) => Promise<boolean>;
  setItems: (items: VaultItem[]) => void;
  addItem: (item: Omit<VaultItem, "id" | "created_at" | "updated_at">) => void;
  updateItem: (id: string, updates: Partial<VaultItem>) => void;
  deleteItem: (id: string) => void;
  /** Locks the vault: wipes decrypted items and the key from memory. */
  clearVault: () => void;
}

// Encrypt the whole vault with the master key before it touches the disk
const persistItems = (items: VaultItem[], key: string | null) => {
  if (!key) {
    console.error("Refusing to save: vault is locked");
    return;
  }
  saveSecureItem("vault_data", encrypt(JSON.stringify(items), key)).then(
    persistVault,
  );
};

export const useVaultStore = create<VaultStore>((set, get) => ({
  items: [],
  vaultKey: null,

  loadVault: async (key) => {
    const stored = await getSecureItem("vault_data");
    let items: VaultItem[] = [];

    if (stored && isEncryptedPayload(stored)) {
      const json = decrypt(stored, key);
      if (json === null) return false; // wrong key or tampered file
      items = JSON.parse(json);
    } else if (stored) {
      // v1 vaults were saved as plain JSON: encrypt them now
      items = JSON.parse(stored);
    }

    set({ items, vaultKey: key });
    if (!stored || !isEncryptedPayload(stored)) persistItems(items, key);
    return true;
  },

  setItems: (newItems) =>
    set(() => {
      persistItems(newItems, get().vaultKey);
      return { items: newItems };
    }),

  addItem: (item) =>
    set((state) => {
      const now = Date.now();
      const newItem = {
        id: uuidv4(),
        created_at: now,
        updated_at: now,
        ...item,
      };
      const newItems = [newItem, ...state.items];
      persistItems(newItems, state.vaultKey);
      return { items: newItems };
    }),

  updateItem: (id, updates) =>
    set((state) => {
      const newItems = state.items.map((i) =>
        // Inject the new updated_at timestamp on every edit
        i.id === id ? { ...i, ...updates, updated_at: Date.now() } : i,
      );
      persistItems(newItems, state.vaultKey);
      return { items: newItems };
    }),

  deleteItem: (id) =>
    set((state) => {
      // Turn the item into a Tombstone (kept so deletions sync to other devices)
      const newItems = state.items.map((i) =>
        i.id === id ? { ...i, isDeleted: true, updated_at: Date.now() } : i,
      );
      persistItems(newItems, state.vaultKey);
      return { items: newItems };
    }),

  clearVault: () => set({ items: [], vaultKey: null }),
}));
