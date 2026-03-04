import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineStorage } from "@/lib/offlineStorage";
import { base64ToBlob, isAlreadyCompressed, compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";
import { generatePhotoFileName } from "@/lib/fileNaming";
import { uploadPhotoToS3 } from "@/lib/s3Upload";

const BATCH_SIZE = 20; // Sync in batches of 20 items
const PARALLEL_UPLOADS = 3; // Upload 3 photos in parallel

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

  // Reset counters when exhibicion or user changes
  useEffect(() => {
    setSyncedCount(0);
    setTotalToSync(0);
    setErrorCount(0);
  }, [exhibicionId, userId]);

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
      // Only compress if not already compressed (avoid double compression)
      let dataToUpload = base64Data;
      if (!isAlreadyCompressed(base64Data)) {
        dataToUpload = await compressImage(base64Data);
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

        // Upload photo if it's base64 - check both possible locations
        const base64Photo = respuesta.photos?.fotoProducto ||
          (respuesta.data.foto?.startsWith("data:") ? respuesta.data.foto : null);

        if (base64Photo?.startsWith("data:")) {
          eventLogger.log(EventType.PHOTO_UPLOAD, "Subiendo foto offline", {
            severity: EventSeverity.INFO,
            context: { exhibicionId, productoId: respuesta.productoId, batchIndex: startIndex + i },
          });

          // Extract tienda and cod_producto from data for new naming format
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

        // Usar upsert para evitar duplicados - el índice único previene inserciones duplicadas
        // CRITICAL: Excluir created_by del spread para forzar el userId actual
        // Esto evita que un created_by obsoleto en datos offline cause errores RLS
        const { created_by: _ignoredCreatedBy, ...restData } = respuesta.data || {};
        const { error } = await supabase.from("respuestas_exhibicion").upsert({
          ...restData,
          foto: fotoUrl,
          created_by: syncUserId, // Forzar el userId del sync para cumplir con RLS - DESPUÉS del spread
        }, {
          onConflict: 'exhibicion_id,producto_id,tienda,created_by,fecha',
          ignoreDuplicates: true // Ignorar si ya existe
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
    if (!isOnline || !exhibicionId || !userId || isSyncing) return;

    // Ensure we have a valid authenticated session; otherwise RLS inserts will fail (auth.uid() = null)
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
      // Sync pending respuestas
      const pendingRespuestas = await offlineStorage.getPendingRespuestasExhibicion(exhibicionId);
      const pendingProgreso = await offlineStorage.getPendingProgresoExhibicion(exhibicionId, userId);

      const totalItems = pendingRespuestas.length + (pendingProgreso && !pendingProgreso.synced ? 1 : 0);
      setTotalToSync(totalItems);

      if (pendingRespuestas.length > 0) {
        toast.info(`Sincronizando ${pendingRespuestas.length} registros...`);
      }

      let totalSuccess = 0;
      let totalErrors = 0;

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
          // Manual select+update/insert to avoid 42P10 upsert cache issues
          const progresoPayload = {
            ...pendingProgreso.data,
            user_id: effectiveUserId,
            exhibicion_id: exhibicionId,
          };
          const { data: existingProg } = await supabase
            .from("progreso_encuestador_exhibicion")
            .select("id")
            .eq("user_id", effectiveUserId)
            .eq("exhibicion_id", exhibicionId)
            .eq("tienda", pendingProgreso.data.tienda)
            .maybeSingle();

          const { error } = existingProg
            ? await supabase.from("progreso_encuestador_exhibicion").update(progresoPayload).eq("id", existingProg.id)
            : await supabase.from("progreso_encuestador_exhibicion").insert(progresoPayload);

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
  }, [isOnline, exhibicionId, userId, isSyncing, checkPendingCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && exhibicionId && userId) {
      // Add a small delay to ensure the network is stable
      const timer = setTimeout(() => {
        syncData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, exhibicionId, userId, syncData]);

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
    checkPendingCount
  };
};
