# Sistema Offline - Código Completo

## 1. src/lib/offlineStorage.ts

```typescript
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
  async saveProgreso(encarteId: string, userId: string, data: any) {
    const db = await getDB();
    const id = `${userId}_${encarteId}`;
    
    await db.put("progreso", {
      id,
      encarteId,
      userId,
      data,
      timestamp: Date.now(),
      synced: false,
    });
  },

  async getPendingProgreso(encarteId: string, userId: string) {
    const db = await getDB();
    const id = `${userId}_${encarteId}`;
    return await db.get("progreso", id);
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
```

---

## 2. src/hooks/useOfflineSync.tsx

```typescript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineStorage } from "@/lib/offlineStorage";
import { toast } from "sonner";
import { eventLogger, EventType } from "@/lib/eventLogger";
import { compressImage } from "@/lib/imageCompression";
import { generatePhotoFileName } from "@/lib/fileNaming";
import { normalizeError } from "@/lib/errorUtils";

const BATCH_SIZE = 20;

interface SyncResultFromServer {
  success: number;
  errors: number;
  successIds: string[];
  failed: Array<{
    producto_id: string;
    tienda: string;
    error_code: string;
    error_message: string;
  }>;
  error?: string;
  error_code?: string;
  error_details?: string;
}

interface OfflineItem {
  id: string;
  encarteId: string;
  productoId: string;
  data: any;
  photos: {
    fotoProducto?: string;
  };
}

export const useOfflineSync = (encarteId: string, userId: string, isOnline: boolean) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [totalToSync, setTotalToSync] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const checkPendingCount = useCallback(async () => {
    try {
      if (!encarteId || !userId) {
        setPendingCount(0);
        return;
      }
      const pendingRespuestas = await offlineStorage.getPendingRespuestas(encarteId);
      const pendingProgreso = await offlineStorage.getPendingProgreso(encarteId, userId);
      setPendingCount(pendingRespuestas.length + (pendingProgreso && !pendingProgreso.synced ? 1 : 0));
    } catch (error) {
      console.error("Error checking pending count:", error);
    }
  }, [encarteId, userId]);

  const uploadPhoto = async (photoBase64: string, fileName: string): Promise<string | null> => {
    try {
      const compressedDataUrl = await compressImage(photoBase64);
      const base64Data = compressedDataUrl.split(",")[1];
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const { data, error } = await supabase.storage
        .from("encarte-photos")
        .upload(fileName, blob, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("encarte-photos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const syncBatch = async (
    items: OfflineItem[], 
    startIndex: number, 
    syncUserId: string
  ): Promise<{ success: number; errors: number; syncedLocalIds: string[] }> => {
    let success = 0;
    let errors = 0;
    const syncedLocalIds: string[] = [];
    const localIdMap = new Map<string, string>();
    const payloads: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        let fotoProductoUrl = null;
        if (item.photos?.fotoProducto) {
          const tienda = item.data?.tienda || '';
          const codProducto = item.data?.cod_interno || '';
          const fileName = generatePhotoFileName(tienda, codProducto, syncUserId, 'producto');
          fotoProductoUrl = await uploadPhoto(item.photos.fotoProducto, fileName);
        }

        const { created_by: _ignoredCreatedBy, ...restData } = item.data || {};
        
        const payload = {
          encarte_id: item.encarteId,
          producto_id: item.productoId,
          ...restData,
          foto: fotoProductoUrl,
        };

        payloads.push(payload);
        localIdMap.set(item.productoId, item.id);
        
      } catch (photoError) {
        console.error("Error uploading photo for item:", item.productoId, photoError);
        errors++;
        setErrorCount(prev => prev + 1);
        
        eventLogger.log(EventType.SYNC_ITEM_ERROR, 'Error al subir foto', {
          context: { productoId: item.productoId, encarteId: item.encarteId },
          error: photoError instanceof Error ? photoError : new Error(String(photoError)),
        });
      }
    }

    if (payloads.length === 0) {
      return { success, errors, syncedLocalIds };
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-encarte-respuestas', {
        body: { respuestas: payloads },
      });

      if (error) {
        const normalized = normalizeError(error);
        
        eventLogger.log(EventType.SYNC_ERROR, 'Error de red/invocación en sync', {
          context: {
            encarteId: items[0]?.encarteId,
            batchStart: startIndex,
            batchSize: payloads.length,
            errorMessage: normalized.message,
            errorCode: normalized.code,
            errorStatus: normalized.status,
          },
          error: error instanceof Error ? error : new Error(normalized.message),
        });
        
        throw error;
      }

      const result = data as SyncResultFromServer;

      if (result.error) {
        eventLogger.log(EventType.SYNC_ERROR, `Error del servidor: ${result.error_code}`, {
          context: {
            encarteId: items[0]?.encarteId,
            errorCode: result.error_code,
            errorMessage: result.error,
            errorDetails: result.error_details,
          }
        });
        
        if (result.error_code === 'AUTH_INVALID' || result.error_code === 'AUTH_MISSING') {
          throw new Error(`Auth error: ${result.error}`);
        }
      }

      success = result.success || 0;
      errors += result.errors || 0;

      if (result.successIds && result.successIds.length > 0) {
        for (const productoId of result.successIds) {
          const localId = localIdMap.get(productoId);
          if (localId) {
            try {
              await offlineStorage.deleteRespuesta(localId);
              syncedLocalIds.push(localId);
            } catch (deleteErr) {
              console.warn("Could not delete local respuesta:", localId, deleteErr);
            }
          }
        }
      }

      setSyncedCount(prev => prev + success);
      setErrorCount(prev => prev + (result.errors || 0));

      if (success > 0) {
        eventLogger.log(EventType.SYNC_ITEM_SUCCESS, `Batch sincronizado: ${success} respuestas`, {
          context: { 
            encarteId: items[0]?.encarteId, 
            batchStart: startIndex, 
            batchSize: payloads.length,
            successIds: result.successIds?.slice(0, 5)
          }
        });
      }

      if (result.failed && result.failed.length > 0) {
        const firstErrors = result.failed.slice(0, 5);
        eventLogger.log(EventType.SYNC_ITEM_ERROR, `Errores en batch: ${result.errors}`, {
          context: { 
            encarteId: items[0]?.encarteId,
            failedDetails: firstErrors.map(f => ({
              producto: f.producto_id,
              tienda: f.tienda,
              code: f.error_code,
              msg: f.error_message?.substring(0, 100)
            }))
          }
        });
      }

    } catch (batchError: any) {
      const normalized = normalizeError(batchError);
      console.error("Batch sync failed:", normalized);
      errors += payloads.length;
      setErrorCount(prev => prev + payloads.length);

      eventLogger.log(EventType.SYNC_ERROR, 'Error en sincronización batch', {
        context: {
          encarteId: items[0]?.encarteId,
          batchStart: startIndex,
          batchSize: payloads.length,
          errorMessage: normalized.message,
          errorCode: normalized.code,
          errorStatus: normalized.status,
        },
        error: batchError instanceof Error ? batchError : new Error(normalized.message),
      });
    }

    return { success, errors, syncedLocalIds };
  };

  const syncData = useCallback(async () => {
    if (!isOnline || isSyncing || !encarteId || !userId) return;

    const { data: sessionData } = await supabase.auth.getSession();
    let effectiveUserId = sessionData.session?.user?.id;

    if (!effectiveUserId) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      effectiveUserId = refreshed.session?.user?.id;
    }

    if (!effectiveUserId) {
      toast.error("Sesión no válida. Vuelve a iniciar sesión para sincronizar.");
      eventLogger.log(EventType.SYNC_ERROR, "Sin sesión válida para sincronizar", {
        context: { encarteId, expectedUserId: userId },
      });
      return;
    }

    setIsSyncing(true);
    setSyncedCount(0);
    setErrorCount(0);
    let totalSuccess = 0;
    let totalErrors = 0;

    eventLogger.log(EventType.SYNC_START, 'Iniciando sincronización de datos offline', {
      context: { encarteId, userId: effectiveUserId }
    });

    try {
      const pendingRespuestas = await offlineStorage.getPendingRespuestas(encarteId);
      const pendingProgreso = await offlineStorage.getPendingProgreso(encarteId, effectiveUserId);

      const totalItems = pendingRespuestas.length + (pendingProgreso && !pendingProgreso.synced ? 1 : 0);
      setTotalToSync(totalItems);
      
      if (pendingRespuestas.length > 0) {
        toast.info(`Sincronizando ${pendingRespuestas.length} registros...`);
      }

      for (let i = 0; i < pendingRespuestas.length; i += BATCH_SIZE) {
        const batch = pendingRespuestas.slice(i, i + BATCH_SIZE);
        const { success, errors } = await syncBatch(batch, i, effectiveUserId);
        totalSuccess += success;
        totalErrors += errors;
        
        if (i + BATCH_SIZE < pendingRespuestas.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (pendingProgreso && !pendingProgreso.synced) {
        try {
          const { error } = await supabase
            .from("progreso_encuestador")
            .upsert({
              ...pendingProgreso.data,
              user_id: effectiveUserId,
              encarte_id: encarteId,
            }, {
              onConflict: "user_id,encarte_id",
            });

          if (error) throw error;

          await offlineStorage.deleteProgreso(pendingProgreso.id);
          totalSuccess++;
          setSyncedCount(prev => prev + 1);
          
          eventLogger.log(EventType.SYNC_ITEM_SUCCESS, 'Progreso sincronizado', {
            context: { encarteId, userId }
          });
        } catch (error: any) {
          const normalized = normalizeError(error);
          console.error("Error syncing progreso:", normalized);
          totalErrors++;
          setErrorCount(prev => prev + 1);

          eventLogger.log(EventType.SYNC_ITEM_ERROR, 'Error al sincronizar progreso', {
            context: {
              encarteId,
              userId,
              errorMessage: normalized.message,
              errorCode: normalized.code,
              errorStatus: normalized.status,
            },
            error: error instanceof Error ? error : new Error(normalized.message),
          });
        }
      }

      if (totalSuccess > 0) {
        toast.success(`${totalSuccess} registros sincronizados correctamente`);
        eventLogger.log(EventType.SYNC_SUCCESS, `Sincronización completada: ${totalSuccess} éxitos`, {
          context: { successCount: totalSuccess, errorCount: totalErrors, encarteId, userId }
        });
      }
      if (totalErrors > 0) {
        toast.error(`${totalErrors} registros no se pudieron sincronizar`);
        eventLogger.log(EventType.SYNC_ERROR, `Sincronización con errores: ${totalErrors} fallos`, {
          context: { successCount: totalSuccess, errorCount: totalErrors, encarteId, userId }
        });
      }

      await checkPendingCount();
    } catch (error: any) {
      const normalized = normalizeError(error);
      console.error("Error during sync:", normalized);
      toast.error("Error al sincronizar datos");

      eventLogger.log(EventType.SYNC_ERROR, "Error crítico durante sincronización", {
        context: {
          encarteId,
          userId,
          errorMessage: normalized.message,
          errorCode: normalized.code,
          errorStatus: normalized.status,
        },
        error: error instanceof Error ? error : new Error(normalized.message),
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, encarteId, userId, checkPendingCount]);

  useEffect(() => {
    if (isOnline && encarteId && userId) {
      const timer = setTimeout(() => {
        syncData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, encarteId, userId]);

  useEffect(() => {
    checkPendingCount();
  }, [checkPendingCount]);

  return {
    isSyncing,
    pendingCount,
    syncedCount,
    totalToSync,
    errorCount,
    syncData,
    checkPendingCount,
  };
};
```

---

## 3. src/hooks/useOfflineSyncExhibicion.tsx

```typescript
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineStorage } from "@/lib/offlineStorage";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";
import { generatePhotoFileName } from "@/lib/fileNaming";

const BATCH_SIZE = 20;

export const useOfflineSyncExhibicion = (
  exhibicionId: string,
  userId: string,
  isOnline: boolean
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [totalToSync, setTotalToSync] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const checkPendingCount = useCallback(async () => {
    if (!exhibicionId) return;
    try {
      const pending = await offlineStorage.getPendingRespuestasExhibicion(exhibicionId);
      setPendingCount(pending.length);
    } catch (error) {
      console.error("Error checking pending count:", error);
    }
  }, [exhibicionId]);

  const uploadPhoto = async (base64Data: string, fileName: string): Promise<string | null> => {
    try {
      const compressed = await compressImage(base64Data);
      const base64 = compressed.split(",")[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const { error, data } = await supabase.storage
        .from("encarte-photos")
        .upload(fileName, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("encarte-photos")
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const syncBatch = async (
    items: any[],
    startIndex: number,
    syncUserId: string
  ): Promise<{ success: number; errors: number }> => {
    let success = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i++) {
      const respuesta = items[i];
      try {
        let fotoUrl = respuesta.data.foto;

        const base64Photo = respuesta.photos?.fotoProducto || 
                           (respuesta.data.foto?.startsWith("data:") ? respuesta.data.foto : null);
        
        if (base64Photo?.startsWith("data:")) {
          eventLogger.log(EventType.PHOTO_UPLOAD, "Subiendo foto offline", {
            severity: EventSeverity.INFO,
            context: { exhibicionId, productoId: respuesta.productoId, batchIndex: startIndex + i },
          });
          
          const tienda = respuesta.data?.tienda || '';
          const codProducto = respuesta.data?.cod_producto || '';
          const fileName = generatePhotoFileName(tienda, codProducto, syncUserId, 'producto');
          fotoUrl = await uploadPhoto(base64Photo, fileName);
          
          if (fotoUrl) {
            eventLogger.log(EventType.PHOTO_UPLOAD, "Foto offline subida exitosamente", {
              severity: EventSeverity.SUCCESS,
              context: { exhibicionId, productoId: respuesta.productoId, fotoUrl },
            });
          } else {
            eventLogger.log(EventType.PHOTO_UPLOAD, "Error subiendo foto offline", {
              severity: EventSeverity.ERROR,
              context: { exhibicionId, productoId: respuesta.productoId },
            });
          }
        }

        const { created_by: _ignoredCreatedBy, ...restData } = respuesta.data || {};
        const { error } = await supabase.from("respuestas_exhibicion").upsert({
          ...restData,
          foto: fotoUrl,
          created_by: syncUserId,
        }, { 
          onConflict: 'exhibicion_id,producto_id,tienda,created_by,fecha',
          ignoreDuplicates: true
        });

        if (error && !error.message.includes('duplicate')) throw error;

        await offlineStorage.deleteRespuestaExhibicion(respuesta.id);
        success++;
        setSyncedCount(prev => prev + 1);

        eventLogger.log(EventType.SYNC_SUCCESS, "Respuesta exhibición sincronizada", {
          severity: EventSeverity.SUCCESS,
          context: { exhibicionId, productoId: respuesta.productoId },
        });
      } catch (error) {
        console.error("Error syncing respuesta:", error);
        errors++;
        setErrorCount(prev => prev + 1);
        
        eventLogger.log(EventType.SYNC_ERROR, "Error sincronizando respuesta exhibición", {
          severity: EventSeverity.ERROR,
          context: { exhibicionId, productoId: respuesta.productoId },
          error: error as Error,
        });
      }
    }

    return { success, errors };
  };

  const syncData = useCallback(async () => {
    if (!isOnline || !exhibicionId || !userId) return;

    const { data: sessionData } = await supabase.auth.getSession();
    let effectiveUserId = sessionData.session?.user?.id;

    if (!effectiveUserId) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      effectiveUserId = refreshed.session?.user?.id;
    }

    if (!effectiveUserId) {
      toast.error("Sesión no válida. Vuelve a iniciar sesión para sincronizar.");
      eventLogger.log(EventType.SYNC_ERROR, "Sin sesión válida para sincronizar exhibición", {
        severity: EventSeverity.ERROR,
        context: { exhibicionId, expectedUserId: userId },
      });
      return;
    }

    setIsSyncing(true);
    setSyncedCount(0);
    setErrorCount(0);

    eventLogger.log(EventType.SYNC_START, "Iniciando sincronización exhibición", {
      severity: EventSeverity.INFO,
      context: { exhibicionId, userId: effectiveUserId },
    });

    try {
      const pendingRespuestas = await offlineStorage.getPendingRespuestasExhibicion(exhibicionId);
      const pendingProgreso = await offlineStorage.getPendingProgresoExhibicion(exhibicionId, userId);
      
      const totalItems = pendingRespuestas.length + (pendingProgreso && !pendingProgreso.synced ? 1 : 0);
      setTotalToSync(totalItems);
      
      if (pendingRespuestas.length > 0) {
        toast.info(`Sincronizando ${pendingRespuestas.length} registros...`);
      }

      let totalSuccess = 0;
      let totalErrors = 0;

      for (let i = 0; i < pendingRespuestas.length; i += BATCH_SIZE) {
        const batch = pendingRespuestas.slice(i, i + BATCH_SIZE);
        const { success, errors } = await syncBatch(batch, i, effectiveUserId);
        totalSuccess += success;
        totalErrors += errors;
        
        if (i + BATCH_SIZE < pendingRespuestas.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (pendingProgreso && !pendingProgreso.synced) {
        try {
          const { error } = await supabase
            .from("progreso_encuestador_exhibicion")
            .upsert({
              ...pendingProgreso.data,
              user_id: effectiveUserId,
              exhibicion_id: exhibicionId,
            }, { onConflict: "user_id,exhibicion_id" });

          if (!error) {
            await offlineStorage.deleteProgresoExhibicion(pendingProgreso.id);
            totalSuccess++;
            setSyncedCount(prev => prev + 1);
          }
        } catch (error) {
          console.error("Error syncing progreso:", error);
          totalErrors++;
          setErrorCount(prev => prev + 1);
        }
      }

      await checkPendingCount();

      if (totalSuccess > 0) {
        toast.success(`${totalSuccess} registros sincronizados`);
      }
      if (totalErrors > 0) {
        toast.error(`${totalErrors} registros no se pudieron sincronizar`);
      }
    } catch (error) {
      console.error("Error during sync:", error);
      toast.error("Error durante la sincronización");
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, exhibicionId, userId, checkPendingCount]);

  useEffect(() => {
    if (isOnline && exhibicionId && userId) {
      const timer = setTimeout(() => {
        syncData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, exhibicionId, userId, syncData]);

  useEffect(() => {
    checkPendingCount();
  }, [checkPendingCount]);

  return { 
    isSyncing, 
    pendingCount, 
    syncedCount, 
    totalToSync, 
    errorCount, 
    syncData, 
    checkPendingCount 
  };
};
```

---

## 4. src/hooks/useNetworkStatus.tsx

```typescript
import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>("unknown");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setNetworkType(status.connectionType);
        
        eventLogger.log(
          status.connected ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
          `Estado de red inicial: ${status.connected ? 'conectado' : 'desconectado'}`,
          { context: { connectionType: status.connectionType } }
        );
      } catch (error) {
        const online = navigator.onLine;
        setIsOnline(online);
        setNetworkType("unknown");
        
        eventLogger.log(
          online ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
          `Estado de red inicial (fallback): ${online ? 'conectado' : 'desconectado'}`,
          { context: { connectionType: "unknown" } }
        );
      }
    };

    checkStatus();

    let networkListener: any;
    const setupListener = async () => {
      try {
        networkListener = await Network.addListener("networkStatusChange", (status) => {
          setIsOnline(status.connected);
          setNetworkType(status.connectionType);
          
          eventLogger.log(
            status.connected ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
            `Cambio de estado de red: ${status.connected ? 'conectado' : 'desconectado'}`,
            { context: { connectionType: status.connectionType } }
          );
        });
      } catch (error) {
        const handleOnline = () => {
          setIsOnline(true);
          eventLogger.log(EventType.NETWORK_ONLINE, 'Red conectada (evento browser)', {
            context: { connectionType: "unknown" }
          });
        };
        const handleOffline = () => {
          setIsOnline(false);
          eventLogger.log(EventType.NETWORK_OFFLINE, 'Red desconectada (evento browser)', {
            context: { connectionType: "unknown" }
          });
        };
        
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        };
      }
    };

    setupListener();

    return () => {
      if (networkListener) {
        networkListener.remove();
      }
    };
  }, []);

  return { isOnline, networkType };
};
```

---

## 5. src/components/NetworkStatus.tsx

```typescript
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NetworkStatusProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncClick?: () => void;
}

export const NetworkStatus = ({ 
  isOnline, 
  pendingCount, 
  isSyncing,
  onSyncClick 
}: NetworkStatusProps) => {
  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Wifi className="h-4 w-4 text-green-500" />
        <span className="hidden sm:inline text-muted-foreground">En línea</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-destructive" />
        <Badge variant="destructive" className="hidden sm:flex">
          Sin conexión
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Wifi className="h-4 w-4 text-green-500" />
      <Button
        variant="outline"
        size="sm"
        onClick={onSyncClick}
        disabled={isSyncing}
        className="gap-2"
      >
        <CloudUpload className="h-3 w-3" />
        {isSyncing ? "Sincronizando..." : `Sincronizar (${pendingCount})`}
      </Button>
    </div>
  );
};
```

---

## 6. src/components/NetworkStatusDialog.tsx

```typescript
import { useState, useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface NetworkStatusDialogProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncedCount?: number;
  totalToSync?: number;
}

export const NetworkStatusDialog = ({
  isOnline,
  isSyncing,
  pendingCount,
  syncedCount = 0,
  totalToSync = 0,
}: NetworkStatusDialogProps) => {
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const previousOnlineStatus = useRef<boolean | null>(null);
  const isFirstMount = useRef(true);
  
  const progress = totalToSync > 0 ? Math.round((syncedCount / totalToSync) * 100) : 0;

  useEffect(() => {
    if (isFirstMount.current) {
      previousOnlineStatus.current = isOnline;
      isFirstMount.current = false;
      return;
    }

    if (previousOnlineStatus.current !== null && previousOnlineStatus.current !== isOnline) {
      if (!isOnline) {
        setShowOfflineDialog(true);
        setShowOnlineDialog(false);
      } else {
        setShowOnlineDialog(true);
        setShowOfflineDialog(false);
      }
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  return (
    <>
      <AlertDialog open={showOfflineDialog} onOpenChange={setShowOfflineDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <WifiOff className="h-8 w-8 text-destructive" />
              <AlertDialogTitle className="text-destructive text-xl">
                Usted está ingresando al modo Offline
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p className="font-medium text-foreground">
                  Por favor tenga en cuenta las siguientes indicaciones:
                </p>
                <ol className="list-decimal list-inside space-y-3 text-sm">
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Antes de cerrar el app
                    </span>{" "}
                    validar que se han sincronizado los items
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Mientras el app esté sincronizando
                    </span>{" "}
                    no cerrar el app en ningún momento
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      No cerrar sesión
                    </span>{" "}
                    mientras se encuentre en el modo offline
                  </li>
                </ol>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowOfflineDialog(false)}
              className="w-full"
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showOnlineDialog} onOpenChange={setShowOnlineDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Wifi className="h-8 w-8 text-green-500" />
              <AlertDialogTitle className="text-green-600 text-xl">
                Usted ha vuelto al modo Online
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                {isSyncing ? (
                  <>
                    <div className="flex items-center gap-2 text-amber-600 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sincronización en progreso...
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Sincronizado: {syncedCount} de {totalToSync}
                        </span>
                        <span className="font-bold text-foreground">
                          {progress}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <p className="text-sm text-destructive font-medium">
                      ¡No cierre el app ni la sesión hasta que termine!
                    </p>
                  </>
                ) : pendingCount > 0 ? (
                  <>
                    <p className="text-amber-600 font-medium">
                      ⚠️ {pendingCount} items pendientes de sincronizar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Por favor espere a que la sincronización termine.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Valide que la sincronización haya terminado antes de cerrar.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowOnlineDialog(false)}
              className="w-full"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
```

---

## 7. src/lib/imageCompression.ts

```typescript
export const compressImage = async (
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        
        if (width > height) {
          width = maxWidth;
          height = maxWidth / aspectRatio;
        } else {
          height = maxHeight;
          width = maxHeight * aspectRatio;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      const originalSize = dataUrl.length;
      const compressedSize = compressedDataUrl.length;
      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      console.log(`Image compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (${reduction}% reduction)`);
      
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUrl;
  });
};

export const compressImageFile = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        const compressed = await compressImage(dataUrl, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};
```

---

## 8. src/lib/fileNaming.ts

```typescript
export const normalizeForFileName = (str: string): string => {
  if (!str) return 'unknown';
  
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
    .substring(0, 50);
};

export const generatePhotoFileName = (
  tienda: string,
  codProducto: string,
  userId: string,
  suffix: string = 'producto'
): string => {
  const normalizedTienda = normalizeForFileName(tienda);
  const normalizedCodProducto = normalizeForFileName(codProducto || 'sin_codigo');
  const timestamp = Date.now();
  
  return `${userId}/${normalizedTienda}_${normalizedCodProducto}_${timestamp}_${suffix}.jpg`;
};

export const generateIngresoPhotoFileName = (
  tienda: string,
  userId: string
): string => {
  const normalizedTienda = normalizeForFileName(tienda);
  const timestamp = Date.now();
  
  return `${userId}/${normalizedTienda}_${timestamp}_ingreso.jpg`;
};

export const generateAdminPhotoFileName = (
  tienda: string | undefined,
  codProducto: string | undefined
): string => {
  const normalizedTienda = normalizeForFileName(tienda || 'sin_tienda');
  const normalizedCodProducto = normalizeForFileName(codProducto || 'sin_codigo');
  const timestamp = Date.now();
  
  return `admin_${normalizedTienda}_${normalizedCodProducto}_${timestamp}.jpg`;
};
```

---

## 9. src/lib/errorUtils.ts

```typescript
export type NormalizedError = {
  message: string;
  name?: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export function normalizeError(err: unknown): NormalizedError {
  if (!err) return { message: "Unknown error" };

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message || "Error",
      details: { stack: err.stack },
    };
  }

  if (typeof err === "object") {
    const anyErr = err as Record<string, any>;
    const message =
      (typeof anyErr.message === "string" && anyErr.message) ||
      (typeof anyErr.error === "string" && anyErr.error) ||
      (typeof anyErr.msg === "string" && anyErr.msg) ||
      JSON.stringify(anyErr);

    return {
      message,
      code: typeof anyErr.code === "string" ? anyErr.code : undefined,
      status: typeof anyErr.status === "number" ? anyErr.status : undefined,
      details: anyErr,
    };
  }

  return { message: String(err) };
}
```

---

## 10. src/lib/eventLogger.ts

```typescript
import { supabase } from "@/integrations/supabase/client";

export enum EventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  AUTH_ERROR = 'AUTH_ERROR',
  NETWORK_ONLINE = 'NETWORK_ONLINE',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  SAVE_SUCCESS = 'SAVE_SUCCESS',
  SAVE_ERROR = 'SAVE_ERROR',
  SAVE_OFFLINE = 'SAVE_OFFLINE',
  SYNC_START = 'SYNC_START',
  SYNC_SUCCESS = 'SYNC_SUCCESS',
  SYNC_ERROR = 'SYNC_ERROR',
  SYNC_ITEM_SUCCESS = 'SYNC_ITEM_SUCCESS',
  SYNC_ITEM_ERROR = 'SYNC_ITEM_ERROR',
  FORM_SUBMIT = 'FORM_SUBMIT',
  FORM_ERROR = 'FORM_ERROR',
  PHOTO_UPLOAD = 'PHOTO_UPLOAD',
  PHOTO_ERROR = 'PHOTO_ERROR',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

export interface LogEvent {
  id: string;
  timestamp: number;
  type: EventType;
  severity: EventSeverity;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  stackTrace?: string;
}

class EventLogger {
  private events: LogEvent[] = [];
  private maxEvents = 1000;
  private storageKey = 'app_event_logs';

  constructor() {
    this.loadFromStorage();
  }

  log(
    type: EventType,
    message: string,
    options?: {
      severity?: EventSeverity;
      context?: Record<string, any>;
      userId?: string;
      error?: Error;
    }
  ): void {
    const event: LogEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      severity: options?.severity || this.getDefaultSeverity(type),
      message,
      context: options?.context,
      userId: options?.userId,
      stackTrace: options?.error?.stack
    };

    this.events.push(event);
    
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.saveToStorage();
    this.consoleLog(event);
    this.saveToSupabase(event);
  }

  private async saveToSupabase(event: LogEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('event_logs').insert({
        timestamp: event.timestamp,
        type: event.type,
        severity: event.severity,
        message: event.message,
        context: event.context,
        user_id: event.userId || user?.id,
        stack_trace: event.stackTrace
      });
    } catch (error) {
      // Silent fail to avoid loops
    }
  }

  getEvents(filter?: {
    type?: EventType;
    severity?: EventSeverity;
    startDate?: number;
    endDate?: number;
    userId?: string;
  }): LogEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.type) filtered = filtered.filter(e => e.type === filter.type);
      if (filter.severity) filtered = filtered.filter(e => e.severity === filter.severity);
      if (filter.startDate) filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
      if (filter.endDate) filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
      if (filter.userId) filtered = filtered.filter(e => e.userId === filter.userId);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecentEvents(limit: number = 50): LogEvent[] {
    return this.events.slice(-limit).reverse();
  }

  clearEvents(): void {
    this.events = [];
    this.saveToStorage();
  }

  exportEvents(filter?: Parameters<typeof this.getEvents>[0]): string {
    const events = filter ? this.getEvents(filter) : this.events;
    return JSON.stringify(events, null, 2);
  }

  getStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    lastHour: number;
    last24Hours: number;
  } {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const twentyFourHours = 24 * oneHour;

    return {
      total: this.events.length,
      byType: this.countByProperty('type'),
      bySeverity: this.countByProperty('severity'),
      lastHour: this.events.filter(e => now - e.timestamp < oneHour).length,
      last24Hours: this.events.filter(e => now - e.timestamp < twentyFourHours).length
    };
  }

  private countByProperty(property: keyof LogEvent): Record<string, number> {
    return this.events.reduce((acc, event) => {
      const key = String(event[property]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultSeverity(type: EventType): EventSeverity {
    if (type.includes('ERROR')) return EventSeverity.ERROR;
    if (type.includes('WARNING')) return EventSeverity.WARNING;
    if (type.includes('SUCCESS')) return EventSeverity.SUCCESS;
    return EventSeverity.INFO;
  }

  private consoleLog(event: LogEvent): void {
    const prefix = `[${event.type}]`;
    const timestamp = new Date(event.timestamp).toISOString();
    const message = `${prefix} ${timestamp} - ${event.message}`;

    switch (event.severity) {
      case EventSeverity.ERROR:
        console.error(message, event.context);
        if (event.stackTrace) console.error(event.stackTrace);
        break;
      case EventSeverity.WARNING:
        console.warn(message, event.context);
        break;
      case EventSeverity.SUCCESS:
        console.log(`✅ ${message}`, event.context);
        break;
      default:
        console.log(message, event.context);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (error) {
      console.error('[EventLogger] Error guardando eventos:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[EventLogger] Error cargando eventos:', error);
      this.events = [];
    }
  }
}

export const eventLogger = new EventLogger();

export const logInfo = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.INFO, message, { severity: EventSeverity.INFO, context });
};

export const logWarning = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.WARNING, message, { severity: EventSeverity.WARNING, context });
};

export const logError = (message: string, error?: Error, context?: Record<string, any>) => {
  eventLogger.log(EventType.ERROR, message, { severity: EventSeverity.ERROR, error, context });
};

export const logSuccess = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.INFO, message, { severity: EventSeverity.SUCCESS, context });
};
```

---

## Dependencias NPM requeridas

```json
{
  "dependencies": {
    "idb": "^8.0.3",
    "@capacitor/network": "^7.0.2"
  }
}
```
