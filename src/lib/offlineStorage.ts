import { openDB, DBSchema, IDBPDatabase } from "idb";

interface OfflineDB extends DBSchema {
  respuestas: {
    key: string;
    value: {
      id: string;
      encarteId: string;
      productoId: string;
      data: any;
      photos: {
        fotoProducto?: string;
      };
      timestamp: number;
      synced: boolean;
    };
  };
  progreso: {
    key: string;
    value: {
      id: string;
      encarteId: string;
      userId: string;
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
  respuestas_exhibicion: {
    key: string;
    value: {
      id: string;
      exhibicionId: string;
      productoId: string;
      data: any;
      photos: {
        fotoProducto?: string;
      };
      timestamp: number;
      synced: boolean;
    };
  };
  progreso_exhibicion: {
    key: string;
    value: {
      id: string;
      exhibicionId: string;
      userId: string;
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
  productos_exhibicion_cache: {
    key: string;
    value: {
      id: string;
      exhibicionId: string;
      productos: any[];
      timestamp: number;
    };
  };
  productos_encarte_cache: {
    key: string;
    value: {
      id: string;
      encarteId: string;
      productos: any[];
      encarteData: any;
      tiendasData: any[];
      timestamp: number;
    };
  };
  sync_status: {
    key: string;
    value: {
      id: string;
      studyId: string;
      studyType: 'encarte' | 'exhibicion';
      isReady: boolean;
      productCount: number;
      timestamp: number;
    };
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

const getDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDB>("encarte-offline", 4, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains("respuestas")) {
        db.createObjectStore("respuestas", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("progreso")) {
        db.createObjectStore("progreso", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("respuestas_exhibicion")) {
        db.createObjectStore("respuestas_exhibicion", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("progreso_exhibicion")) {
        db.createObjectStore("progreso_exhibicion", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("productos_exhibicion_cache")) {
        db.createObjectStore("productos_exhibicion_cache", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("productos_encarte_cache")) {
        db.createObjectStore("productos_encarte_cache", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync_status")) {
        db.createObjectStore("sync_status", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
};

export const offlineStorage = {
  // Respuestas
  async saveRespuesta(encarteId: string, productoId: string, data: any, photos: any) {
    const db = await getDB();
    const id = `${encarteId}_${productoId}`;

    await db.put("respuestas", {
      id,
      encarteId,
      productoId,
      data,
      photos,
      timestamp: Date.now(),
      synced: false,
    });
  },

  async getPendingRespuestas(encarteId: string) {
    const db = await getDB();
    const all = await db.getAll("respuestas");
    return all.filter((r) => r.encarteId === encarteId && !r.synced);
  },

  async markRespuestaSynced(id: string) {
    const db = await getDB();
    const item = await db.get("respuestas", id);
    if (item) {
      item.synced = true;
      await db.put("respuestas", item);
    }
  },

  async deleteRespuesta(id: string) {
    const db = await getDB();
    await db.delete("respuestas", id);
  },

  // Progreso
  async saveProgreso(encarteId: string, userId: string, data: any, tienda?: string) {
    const db = await getDB();
    const storeId = tienda || data?.tienda || 'default';
    const id = `${userId}_${encarteId}_${storeId}`;

    await db.put("progreso", {
      id,
      encarteId,
      userId,
      data,
      timestamp: Date.now(),
      synced: false,
    });
  },

  async getPendingProgreso(encarteId: string, userId: string, tienda?: string) {
    const db = await getDB();
    if (tienda) {
      // Buscar progreso específico para esta tienda
      const id = `${userId}_${encarteId}_${tienda}`;
      return await db.get("progreso", id);
    } else {
      // Buscar el progreso más reciente para este usuario y encarte (comportamiento legacy)
      const all = await db.getAll("progreso");
      const userProgress = all.filter(p => p.userId === userId && p.encarteId === encarteId);

      if (userProgress.length === 0) return undefined;

      // Ordenar por fecha descendente (más reciente primero)
      userProgress.sort((a, b) => b.timestamp - a.timestamp);
      return userProgress[0]; // Devolver el más reciente
    }
  },

  async markProgresoSynced(id: string) {
    const db = await getDB();
    const item = await db.get("progreso", id);
    if (item) {
      item.synced = true;
      await db.put("progreso", item);
    }
  },

  async deleteProgreso(id: string) {
    const db = await getDB();
    await db.delete("progreso", id);
  },

  async clearAll() {
    const db = await getDB();
    await db.clear("respuestas");
    await db.clear("progreso");
    await db.clear("respuestas_exhibicion");
    await db.clear("progreso_exhibicion");
  },

  // Respuestas Exhibición
  async saveRespuestaExhibicion(exhibicionId: string, productoId: string, data: any, photos: any) {
    const db = await getDB();
    const id = `${exhibicionId}_${productoId}`;

    await db.put("respuestas_exhibicion", {
      id,
      exhibicionId,
      productoId,
      data,
      photos,
      timestamp: Date.now(),
      synced: false,
    });
  },

  async getPendingRespuestasExhibicion(exhibicionId: string) {
    const db = await getDB();
    const all = await db.getAll("respuestas_exhibicion");
    return all.filter((r) => r.exhibicionId === exhibicionId && !r.synced);
  },

  async markRespuestaExhibicionSynced(id: string) {
    const db = await getDB();
    const item = await db.get("respuestas_exhibicion", id);
    if (item) {
      item.synced = true;
      await db.put("respuestas_exhibicion", item);
    }
  },

  async deleteRespuestaExhibicion(id: string) {
    const db = await getDB();
    await db.delete("respuestas_exhibicion", id);
  },

  // Progreso Exhibición
  async saveProgresoExhibicion(exhibicionId: string, userId: string, data: any) {
    const db = await getDB();
    const id = `${userId}_${exhibicionId}`;

    await db.put("progreso_exhibicion", {
      id,
      exhibicionId,
      userId,
      data,
      timestamp: Date.now(),
      synced: false,
    });
  },

  async getPendingProgresoExhibicion(exhibicionId: string, userId: string) {
    const db = await getDB();
    const id = `${userId}_${exhibicionId}`;
    return await db.get("progreso_exhibicion", id);
  },

  async markProgresoExhibicionSynced(id: string) {
    const db = await getDB();
    const item = await db.get("progreso_exhibicion", id);
    if (item) {
      item.synced = true;
      await db.put("progreso_exhibicion", item);
    }
  },

  async deleteProgresoExhibicion(id: string) {
    const db = await getDB();
    await db.delete("progreso_exhibicion", id);
  },

  // Productos Exhibición Cache (for offline support)
  async cacheProductosExhibicion(exhibicionId: string, productos: any[]) {
    const db = await getDB();
    await db.put("productos_exhibicion_cache", {
      id: exhibicionId,
      exhibicionId,
      productos,
      timestamp: Date.now(),
    });
  },

  async getCachedProductosExhibicion(exhibicionId: string) {
    const db = await getDB();
    const cached = await db.get("productos_exhibicion_cache", exhibicionId);
    return cached?.productos || null;
  },

  async clearProductosCache(exhibicionId: string) {
    const db = await getDB();
    await db.delete("productos_exhibicion_cache", exhibicionId);
  },

  // Productos Encarte Cache (for offline support)
  async cacheProductosEncarte(encarteId: string, productos: any[], encarteData: any, tiendasData: any[]) {
    const db = await getDB();
    await db.put("productos_encarte_cache", {
      id: encarteId,
      encarteId,
      productos,
      encarteData,
      tiendasData,
      timestamp: Date.now(),
    });
  },

  async getCachedProductosEncarte(encarteId: string) {
    const db = await getDB();
    const cached = await db.get("productos_encarte_cache", encarteId);
    return cached || null;
  },

  async clearProductosEncarteCache(encarteId: string) {
    const db = await getDB();
    await db.delete("productos_encarte_cache", encarteId);
  },

  // Sync Status (track offline readiness)
  async setSyncStatus(studyId: string, studyType: 'encarte' | 'exhibicion', isReady: boolean, productCount: number) {
    const db = await getDB();
    await db.put("sync_status", {
      id: `${studyType}_${studyId}`,
      studyId,
      studyType,
      isReady,
      productCount,
      timestamp: Date.now(),
    });
  },

  async getSyncStatus(studyId: string, studyType: 'encarte' | 'exhibicion') {
    const db = await getDB();
    const status = await db.get("sync_status", `${studyType}_${studyId}`);
    return status || null;
  },

  async clearSyncStatus(studyId: string, studyType: 'encarte' | 'exhibicion') {
    const db = await getDB();
    await db.delete("sync_status", `${studyType}_${studyId}`);
  },

  // Get storage estimate
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usagePercent: estimate.quota ? Math.round((estimate.usage || 0) / estimate.quota * 100) : 0
      };
    }
    return { usage: 0, quota: 0, usagePercent: 0 };
  },
};
