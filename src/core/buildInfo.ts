// Set VITE_STORE_BUILD=true when building for the Microsoft Store (together with
// the Rust "store" feature). Store builds are updated by the Store, so the
// in-app updater is disabled.
export const IS_STORE_BUILD = import.meta.env.VITE_STORE_BUILD === "true";
