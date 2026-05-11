// Offline storage using IndexedDB for Bible data and offline queue

const DB_NAME = "vine-tracker-offline";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("bible")) {
        db.createObjectStore("bible");
      }
      if (!db.objectStoreNames.contains("offlineQueue")) {
        db.createObjectStore("offlineQueue", { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheBibleChapter(key: string, verses: { verse: number; text: string }[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("bible", "readwrite");
    tx.objectStore("bible").put(verses, key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch { /* silently fail */ }
}

export async function getCachedBibleChapter(key: string): Promise<{ verse: number; text: string }[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction("bible", "readonly");
    const request = tx.objectStore("bible").get(key);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Offline queue for syncing data when back online
export interface OfflineAction {
  type: "insert" | "update" | "delete";
  table: string;
  data: Record<string, any>;
  id?: string;
}

export async function addToOfflineQueue(action: OfflineAction): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offlineQueue", "readwrite");
    tx.objectStore("offlineQueue").add(action);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch { /* silently fail */ }
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("offlineQueue", "readonly");
    const request = tx.objectStore("offlineQueue").getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offlineQueue", "readwrite");
    tx.objectStore("offlineQueue").clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch { /* silently fail */ }
}

// Sync offline queue when back online
export async function syncOfflineQueue(supabase: any): Promise<number> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  for (const action of queue) {
    try {
      if (action.type === "insert") {
        await supabase.from(action.table).insert(action.data);
        synced++;
      } else if (action.type === "update" && action.id) {
        await supabase.from(action.table).update(action.data).eq("id", action.id);
        synced++;
      } else if (action.type === "delete" && action.id) {
        await supabase.from(action.table).delete().eq("id", action.id);
        synced++;
      }
    } catch { /* skip failed items */ }
  }

  if (synced > 0) await clearOfflineQueue();
  return synced;
}
