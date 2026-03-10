import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineStorage } from "@/lib/offlineStorage";
import { toast } from "sonner";
import { eventLogger, EventType } from "@/lib/eventLogger";
import { base64ToBlob, isAlreadyCompressed, compressImage } from "@/lib/imageCompression";
import { generatePhotoFileName, generateIngresoPhotoFileName } from "@/lib/fileNaming";
import { normalizeError } from "@/lib/errorUtils";
import { uploadPhotoToS3 } from "@/lib/s3Upload";
const BATCH_SIZE = 20; // Sync in batches of 20 items

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

  // Reset counters when encarte or user changes
  useEffect(() => {
    setSyncedCount(0);
    setTotalToSync(0);
    setErrorCount(0);
  }, [encarteId, userId]);

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
      // Only compress if not already compressed (avoid double compression)
      let dataToUpload = photoBase64;
      if (!isAlreadyCompressed(photoBase64)) {
        dataToUpload = await compressImage(photoBase64);
      }

      // Use fast fetch-based conversion instead of byte-by-byte loop
      const s3Url = await uploadPhotoToS3(dataToUpload, fileName);
      if (!s3Url) throw new Error("AWS S3 Upload Failed");
      return s3Url;
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

    // Map to track localId -> productoId for deletion
    const localIdMap = new Map<string, string>();

    // Prepare payloads with uploaded photos
    const payloads: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Upload photo if exists
        let fotoProductoUrl = null;
        if (item.photos?.fotoProducto) {
          const tienda = item.data?.tienda || '';
          const codProducto = item.data?.cod_interno || '';
          const fileName = generatePhotoFileName(tienda, codProducto, syncUserId, 'producto');
          fotoProductoUrl = await uploadPhoto(item.photos.fotoProducto, fileName);

          if (!fotoProductoUrl) {
            console.error("Photo upload failed for item, aborting sync for this record:", item.productoId);
            errors++;
            setErrorCount(prev => prev + 1);
            continue; // Skip this record so it's not sent to Edge Function or deleted locally
          }
        }

        // Build payload - exclude created_by as edge function will set it
        const { created_by: _ignoredCreatedBy, ...restData } = item.data || {};

        let fotoRegistroUrl = restData.foto_registro;
        // Si hay una foto de registro en base64, subirla antes de enviar al Edge Function
        if (fotoRegistroUrl?.startsWith("data:")) {
          const tienda = restData.tienda || '';
          const fileName = generateIngresoPhotoFileName(tienda, syncUserId);
          const uploadedUrl = await uploadPhoto(fotoRegistroUrl, fileName);
          if (uploadedUrl) {
            fotoRegistroUrl = uploadedUrl;
          }
        }

        const payload = {
          encarte_id: item.encarteId,
          producto_id: item.productoId,
          ...restData,
          foto: fotoProductoUrl,
          foto_registro: fotoRegistroUrl,
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

    // Call edge function to sync all respuestas in batch
    try {
      const { data, error } = await supabase.functions.invoke('sync-encarte-respuestas', {
        body: { respuestas: payloads },
      });

      if (error) {
        // Network or invocation error - log detailed info
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

      // Check for auth/server errors
      if (result.error) {
        eventLogger.log(EventType.SYNC_ERROR, `Error del servidor: ${result.error_code}`, {
          context: {
            encarteId: items[0]?.encarteId,
            errorCode: result.error_code,
            errorMessage: result.error,
            errorDetails: result.error_details,
          }
        });

        // If auth error, don't proceed
        if (result.error_code === 'AUTH_INVALID' || result.error_code === 'AUTH_MISSING') {
          throw new Error(`Auth error: ${result.error}`);
        }
      }

      success = result.success || 0;
      errors += result.errors || 0;

      // Only delete items that were confirmed successful by the server
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

      // Use absolute count instead of relative increment to prevent overflow
      setSyncedCount(currentSynced => {
        const newCount = currentSynced + success;
        // Safety check: never exceed totalToSync
        return newCount;
      });
      setErrorCount(currentErrors => currentErrors + (result.errors || 0));

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

      // Log detailed errors for debugging
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

      // Try single-item fallback to diagnose the exact issue
      if (payloads.length > 1) {
        console.log("Attempting single-item diagnostic sync...");
        try {
          const singleResult = await supabase.functions.invoke('sync-encarte-respuestas', {
            body: { respuestas: [payloads[0]] },
          });

          eventLogger.log(EventType.SYNC_ERROR, 'Diagnóstico de error (1 item)', {
            context: {
              encarteId: items[0]?.encarteId,
              singleItemResult: singleResult.data,
              singleItemError: singleResult.error?.message,
              originalBatchSize: payloads.length,
            }
          });
        } catch (diagError) {
          eventLogger.log(EventType.SYNC_ERROR, 'Fallo diagnóstico de 1 item', {
            context: {
              encarteId: items[0]?.encarteId,
              diagError: diagError instanceof Error ? diagError.message : String(diagError),
            }
          });
        }
      }

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

    // Ensure we have a valid authenticated session
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
      // Get all pending respuestas
      const pendingRespuestas = await offlineStorage.getPendingRespuestas(encarteId);
      const pendingProgreso = await offlineStorage.getPendingProgreso(encarteId, effectiveUserId);

      const totalItems = pendingRespuestas.length + (pendingProgreso && !pendingProgreso.synced ? 1 : 0);
      setTotalToSync(totalItems);

      if (pendingRespuestas.length > 0) {
        toast.info(`Sincronizando ${pendingRespuestas.length} registros...`);
      }

      // Sync respuestas in batches
      for (let i = 0; i < pendingRespuestas.length; i += BATCH_SIZE) {
        const batch = pendingRespuestas.slice(i, i + BATCH_SIZE);
        const { success, errors } = await syncBatch(batch, i, effectiveUserId);
        totalSuccess += success;
        totalErrors += errors;

        // Small delay between batches to avoid overwhelming the server
        if (i + BATCH_SIZE < pendingRespuestas.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Sync progreso
      if (pendingProgreso && !pendingProgreso.synced) {
        try {
          let fotoIngresoUrl = pendingProgreso.data.foto_ingreso_url;

          // Si la foto de ingreso está en base64, subirla a S3
          if (fotoIngresoUrl?.startsWith("data:")) {
            const tienda = pendingProgreso.data.tienda || '';
            const fileName = generateIngresoPhotoFileName(tienda, effectiveUserId);
            const uploadedUrl = await uploadPhoto(fotoIngresoUrl, fileName);
            if (uploadedUrl) {
              fotoIngresoUrl = uploadedUrl;
            }
          }

          const progresoPayload = {
            ...pendingProgreso.data,
            foto_ingreso_url: fotoIngresoUrl,
            user_id: effectiveUserId,
            encarte_id: encarteId,
          };

          // Filtrar también por tienda para no sobrescribir progreso de otras tiendas del mismo encarte
          const storeToCheck = pendingProgreso.data.tienda;

          let query = supabase
            .from("progreso_encuestador")
            .select("id")
            .eq("user_id", effectiveUserId)
            .eq("encarte_id", encarteId);

          if (storeToCheck) {
            query = query.eq("tienda", storeToCheck);
          } else {
            query = query.is("tienda", null); // Just in case, though it's typically required
          }

          const { data: existingProg } = await query.maybeSingle();

          const { error } = existingProg
            ? await supabase.from("progreso_encuestador").update(progresoPayload).eq("id", existingProg.id)
            : await supabase.from("progreso_encuestador").insert(progresoPayload);

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

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && encarteId && userId) {
      // Add a small delay to ensure the network is stable
      const timer = setTimeout(() => {
        syncData();
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, encarteId, userId]);

  // Check pending count on mount
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
