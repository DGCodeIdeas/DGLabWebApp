import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VisualNovelDB extends DBSchema {
  visual_novels: {
    key: string;
    value: {
      id: string;
      title: string;
      description: string;
      script: string;
      isPublic: boolean;
      createdAt: string;
      updatedAt: string;
      userId: string;
      authorName: string;
      sync_status: 'synced' | 'pending';
    };
    indexes: { 'by-userId': string, 'by-isPublic': string };
  };
}

let dbPromise: Promise<IDBPDatabase<VisualNovelDB>>;

export async function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<VisualNovelDB>('dglab-vn-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('visual_novels', { keyPath: 'id' });
        store.createIndex('by-userId', 'userId');
        store.createIndex('by-isPublic', 'isPublic');
      },
    });
  }
  return dbPromise;
}

export async function getLocalNovels(userId?: string, isPublic?: boolean) {
  const db = await initDB();
  if (userId) {
    return db.getAllFromIndex('visual_novels', 'by-userId', userId);
  } else if (isPublic !== undefined) {
    // IDB doesn't cleanly index booleans without a custom index, but we can filter
    const all = await db.getAll('visual_novels');
    return all.filter(n => n.isPublic === isPublic);
  }
  return db.getAll('visual_novels');
}

export async function getLocalNovel(id: string) {
  const db = await initDB();
  return db.get('visual_novels', id);
}

export async function saveLocalNovel(novel: any) {
  const db = await initDB();
  await db.put('visual_novels', { ...novel, sync_status: 'pending' });
  syncPendingNovels(); // Trigger background sync
}

export async function deleteLocalNovel(id: string) {
  const db = await initDB();
  await db.delete('visual_novels', id);
  // We should ideally sync deletes too, but for simplicity we'll just fire and forget to server
  try {
    await fetch(`/api/novels/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Failed to sync delete', e);
  }
}

export async function syncPendingNovels() {
  const db = await initDB();
  const all = await db.getAll('visual_novels');
  const pending = all.filter(n => n.sync_status === 'pending');
  
  for (const novel of pending) {
    try {
      const res = await fetch('/api/novels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novel)
      });

      if (res.ok) {
        novel.sync_status = 'synced';
        await db.put('visual_novels', novel);
      } else if (res.status === 409) {
        // Conflict: Server has a newer version
        const data = await res.json();
        if (data.serverNovel) {
          console.log(`[SYNC CONFLICT] Resolving conflict for ${novel.id} by accepting server version.`);
          await db.put('visual_novels', { ...data.serverNovel, sync_status: 'synced' });
        }
      }
    } catch (e) {
      console.error('Failed to sync novel to server', novel.id, e);
    }
  }
}

export async function pullFromServer(userId?: string, isPublic?: boolean) {
  try {
    let url = '/api/novels';
    if (userId) url += `?userId=${userId}`;
    else if (isPublic) url += `?isPublic=true`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch from server');
    
    const serverNovels = await res.json();
    const db = await initDB();
    
    const tx = db.transaction('visual_novels', 'readwrite');
    for (const novel of serverNovels) {
      // Don't overwrite pending local changes
      const local = await tx.store.get(novel.id);
      if (!local || local.sync_status === 'synced') {
        await tx.store.put({ ...novel, sync_status: 'synced' });
      }
    }
    await tx.done;
    return serverNovels;
  } catch (e) {
    console.error('Failed to pull from server, using local cache', e);
    return getLocalNovels(userId, isPublic);
  }
}

export async function pullSingleFromServer(id: string) {
  try {
    const res = await fetch(`/api/novels/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        // Novel might be newly created and not synced yet, just use local
        return getLocalNovel(id);
      }
      throw new Error('Failed to fetch from server');
    }
    
    const novel = await res.json();
    const db = await initDB();
    
    const local = await db.get('visual_novels', id);
    if (!local || local.sync_status === 'synced') {
      await db.put('visual_novels', { ...novel, sync_status: 'synced' });
    }
    return novel;
  } catch (e) {
    console.error('Failed to pull single from server, using local cache', e);
    return getLocalNovel(id);
  }
}
