// Safe storage — the only door to localStorage / sessionStorage.
// The real helper is defined once in /boot.js (so it can run before paint);
// this module just hands it to the rest of the code, with a memory-only
// stand-in if boot.js did not run for some reason.

function memoryStore() {
  const mem = new Map();
  return {
    persistent: false,
    get(key, fallback) {
      if (!mem.has(key)) return fallback;
      try { return JSON.parse(mem.get(key)); } catch { return fallback; }
    },
    set(key, value) {
      try { mem.set(key, JSON.stringify(value)); } catch { /* ignore */ }
      return false;
    },
    remove(key) { mem.delete(key); },
  };
}

const boot = (typeof window !== 'undefined' && window.LNHStore) || null;

export const store = {
  local: boot ? boot.local : memoryStore(),
  session: boot ? boot.session : memoryStore(),
};

/** Build a store on top of any Storage-like object (used by tests.html). */
export function makeStoreFor(kind) {
  if (boot && typeof boot.makeStore === 'function') return boot.makeStore(kind);
  return memoryStore();
}

export { memoryStore };
