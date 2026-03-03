import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Camera } from "lucide-react";
import { compressImage, base64ToBlob } from "@/lib/imageCompression";
import { withRetry, debounce } from "@/lib/retryLogic";
import { toast } from "sonner";
import logo from "@/assets/jl-marketing-logo.jpg";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { offlineStorage } from "@/lib/offlineStorage";
import { NetworkStatus } from "@/components/NetworkStatus";
import { OfflineReadyIndicator } from "@/components/OfflineReadyIndicator";
import { SyncProgressIndicator } from "@/components/SyncProgressIndicator";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";
import { generatePhotoFileName, generateIngresoPhotoFileName } from "@/lib/fileNaming";

interface Encarte {
  id: string;
  nombre: string;
  ciudad: string;
  fecha: string;
  bandera: string;
}

interface Producto {
  id: string;
  descripcion_producto_carteleria: string;
  precio_promo: number | null;
  categoria: string | null;
  macrocategoria: string | null;
  microcategoria: string | null;
  division: string | null;
  cod_interno: string | null;
  descripcion_producto: string | null;
}

interface Tienda {
  id: string;
  tienda: string;
  distrito: string;
}

interface EncarteFullData extends Encarte {
  encargado_1: string | null;
  encargado_2: string | null;
  cadena: string | null;
}

interface EncuestadorFormProps {
  isOnline: boolean;
  syncTrigger: number;
  onSyncRequest: () => void;
  saveProgressRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSyncStatusChange?: (status: { isSyncing: boolean; pendingCount: number; syncedCount: number; totalToSync: number }) => void;
  onActivityChange?: (activity: { studyName?: string; tienda?: string; currentProductIndex?: number; totalProducts?: number; progress?: number }) => void;
}

export const EncuestadorForm = ({ isOnline, syncTrigger, onSyncRequest, saveProgressRef, onSyncStatusChange, onActivityChange }: EncuestadorFormProps) => {
  const [encartes, setEncartes] = useState<Encarte[]>([]);
  const [selectedEncarte, setSelectedEncarte] = useState<string>("");
  const [selectedEncarteData, setSelectedEncarteData] = useState<EncarteFullData | null>(null);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [nombreTienda, setNombreTienda] = useState("");
  const [selectedTiendaDistrito, setSelectedTiendaDistrito] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [acompaniamientoEncargado, setAcompaniamientoEncargado] = useState(false);
  const [fotoIngreso, setFotoIngreso] = useState<string | null>(null);
  const [fotoIngresoUrl, setFotoIngresoUrl] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [allProductos, setAllProductos] = useState<Producto[]>([]);
  const [respondedProductIds, setRespondedProductIds] = useState<Set<string>>(new Set());
  const [macrocategorias, setMacrocategorias] = useState<string[]>([]);
  const [microcategorias, setMicrocategorias] = useState<string[]>([]);
  const [selectedMacrocategoria, setSelectedMacrocategoria] = useState<string>("todas");
  const [selectedMicrocategoria, setSelectedMicrocategoria] = useState<string>("todas");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitPhotoDialog, setShowExitPhotoDialog] = useState(false);
  const [fotoSalida, setFotoSalida] = useState<string | null>(null);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);
  const [skippedProductIds, setSkippedProductIds] = useState<Set<string>>(new Set());
  const [showSkippedReview, setShowSkippedReview] = useState(false);
  const [skippedProducts, setSkippedProducts] = useState<Producto[]>([]);
  const [reviewingSkippedIndex, setReviewingSkippedIndex] = useState(0);
  const [userId, setUserId] = useState<string>("");
  const [isFilterTransitioning, setIsFilterTransitioning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [preserveIndex, setPreserveIndex] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedCount, setPreloadedCount] = useState(0);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [startedFresh, setStartedFresh] = useState(false);

  // Offline sync hook
  const { isSyncing, pendingCount, syncedCount, totalToSync, errorCount, syncData, checkPendingCount } = useOfflineSync(
    selectedEncarte,
    userId,
    isOnline
  );

  // Notify parent about sync status changes
  useEffect(() => {
    if (onSyncStatusChange) {
      onSyncStatusChange({ isSyncing, pendingCount, syncedCount, totalToSync });
    }
  }, [isSyncing, pendingCount, syncedCount, totalToSync, onSyncStatusChange]);

  // Notify parent about activity changes for real-time presence
  useEffect(() => {
    if (onActivityChange && hasStarted && selectedEncarteData && nombreTienda) {
      const totalProducts = allProductos.length;
      const answeredCount = respondedProductIds.size;
      const progress = totalProducts > 0 ? Math.round((answeredCount / totalProducts) * 100) : 0;

      onActivityChange({
        studyName: selectedEncarteData.nombre,
        tienda: nombreTienda,
        currentProductIndex: currentIndex + 1,
        totalProducts,
        progress
      });
    }
  }, [onActivityChange, hasStarted, selectedEncarteData, nombreTienda, currentIndex, allProductos.length, respondedProductIds.size]);

  const [formData, setFormData] = useState({
    precio_encontrado: "",
    presencia_producto: null as boolean | null,
    motivo_ausencia: "",
    presencia_cartel: null as boolean | null,
    cartel_presenta_precio: false,
    precio_tarjeta: "",
    ubicacion_sku: "",
    observacion_1: "",
    foto_producto: null as string | null,
  });

  // Create debounced version of saveProgress to avoid excessive saves under load
  const debouncedSaveProgress = useCallback(
    debounce((overrides?: any) => {
      saveProgress(overrides);
    }, 2000), // Save at most once every 2 seconds
    [selectedEncarte, nombreTienda, selectedTiendaDistrito, supervisor, acompaniamientoEncargado,
      fotoIngresoUrl, currentIndex, selectedMacrocategoria, selectedMicrocategoria, hasStarted,
      respondedProductIds, skippedProductIds, isOnline]
  );

  useEffect(() => {
    const initUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    initUser();
    loadEncartes();
  }, []);

  // Trigger manual sync when requested
  useEffect(() => {
    if (syncTrigger > 0) {
      syncData();
    }
  }, [syncTrigger, syncData]);

  // Validar estado de revisión de productos omitidos
  useEffect(() => {
    if (showSkippedReview) {
      if (skippedProducts.length === 0) {
        console.log("🔄 Revisión activada sin productos, cambiando a foto de salida");
        setShowSkippedReview(false);
        setShowExitPhotoDialog(true);
      } else if (reviewingSkippedIndex >= skippedProducts.length) {
        console.log("🔄 Índice de revisión fuera de rango, reseteando a 0");
        setReviewingSkippedIndex(0);
      }
    }
  }, [showSkippedReview, skippedProducts.length, reviewingSkippedIndex]);

  useEffect(() => {
    const loadData = async () => {
      if (selectedEncarte) {
        console.log("📋 Encarte seleccionado:", selectedEncarte);
        // Reset completion state when changing encarte
        setIsCompleted(false);
        setHasStarted(false);
        setShowContinueDialog(false);
        setSavedProgress(null);
        setSelectedMacrocategoria("todas");
        setSelectedMicrocategoria("todas");
        setStartedFresh(false); // Reset flag when changing encarte

        await loadProductos();
        await loadEncarteData();
        console.log("✅ Carga de datos completada");
      }
    };

    loadData();
  }, [selectedEncarte]);

  useEffect(() => {
    if (selectedEncarteData?.bandera) {
      loadTiendas(selectedEncarteData.bandera);
    }
  }, [selectedEncarteData]);

  const loadEncartes = async () => {
    try {
      const { data, error } = await supabase
        .from("encartes")
        .select("id, nombre, ciudad, fecha, bandera")
        // Excluir estudios finalizados para encuestadores
        .neq("estado", "completado")
        .neq("estado", "concluido")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEncartes(data || []);
    } catch (error) {
      console.error("Error loading encartes:", error);
      toast.error("Error al cargar encartes");
    }
  };


  const loadEncarteData = async () => {
    try {
      const { data, error } = await supabase
        .from("encartes")
        .select("id, nombre, ciudad, fecha, bandera, encargado_1, encargado_2, cadena")
        .eq("id", selectedEncarte)
        .single();

      if (error) throw error;
      setSelectedEncarteData(data);
    } catch (error) {
      console.error("Error loading encarte data:", error);
    }
  };

  const loadTiendas = async (bandera: string) => {
    try {
      const { data, error } = await supabase
        .from("tiendas")
        .select("id, tienda, distrito")
        .eq("bandera", bandera)
        .order("tienda");

      if (error) throw error;
      setTiendas(data || []);
    } catch (error) {
      console.error("Error loading tiendas:", error);
      toast.error("Error al cargar las tiendas");
    }
  };

  const loadRespondedProducts = async (tienda?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // CRITICAL: Filter by tienda to only load products responded for THIS specific store
      const storeToFilter = tienda || nombreTienda;

      console.log(`📥 Cargando productos respondidos para encarte${storeToFilter ? ` y tienda: ${storeToFilter}` : ''}`);

      // Use retry logic with exponential backoff for high-load scenarios
      const data = await withRetry(
        async () => {
          let query = supabase
            .from("respuestas")
            .select("producto_id")
            .eq("encarte_id", selectedEncarte)
            .eq("created_by", session.user.id);

          // Filter by tienda if specified
          if (storeToFilter) {
            query = query.eq("tienda", storeToFilter);
          }

          const { data, error } = await query;

          if (error) throw error;
          return data;
        },
        {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`Reintentando cargar productos respondidos (intento ${attempt})...`);
          }
        }
      );

      if (data && data.length > 0) {
        const productIds = data.map(r => r.producto_id).filter(id => id !== null);
        console.log(`✅ ${productIds.length} productos ya respondidos${storeToFilter ? ` en ${storeToFilter}` : ''}`);
        setRespondedProductIds(new Set(productIds));

        eventLogger.log(EventType.INFO, 'Productos respondidos cargados desde base de datos', {
          severity: EventSeverity.SUCCESS,
          context: {
            encarteId: selectedEncarte,
            userId: session.user.id,
            tienda: storeToFilter,
            count: productIds.length
          }
        });
      } else {
        console.log(`ℹ️ Sin productos respondidos aún${storeToFilter ? ` en ${storeToFilter}` : ''}`);
        setRespondedProductIds(new Set());
      }
    } catch (error) {
      console.error("Error loading responded products:", error);
      eventLogger.log(EventType.ERROR, 'Error al cargar productos respondidos', {
        context: { encarteId: selectedEncarte },
        error: error as Error
      });
    }
  };

  const checkProgressForStore = useCallback(
    async (tienda: string) => {
      try {
        if (!selectedEncarte) return;
        if (!tienda) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;

        // First check offline storage for any pending progress for THIS store
        const offlineProgress = await offlineStorage.getPendingProgreso(selectedEncarte, uid);

        // Offline storage doesn't strictly fragment by store, but if the latest progress 
        // matches the selected store, trigger the load.
        if (offlineProgress && offlineProgress.data && offlineProgress.data.tienda === tienda) {
          console.log(`📱 Progreso encontrado en almacenamiento offline para tienda: ${tienda}`);
          setSavedProgress(offlineProgress.data);
          setShowContinueDialog(true);
          return;
        }

        // Then check database if online for THIS store
        if (isOnline) {
          const { data, error } = await supabase
            .from("progreso_encuestador")
            .select("*")
            .eq("user_id", uid)
            .eq("encarte_id", selectedEncarte)
            .eq("tienda", tienda)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            console.log(`☁️ Progreso encontrado en Supabase para tienda: ${tienda}`);
            setSavedProgress(data);
            setShowContinueDialog(true);
            return;
          }

          // If there is NO progress record, but there ARE responses in DB, still offer "Continuar".
          const { count: respuestasCount, error: respuestasError } = await supabase
            .from("respuestas")
            .select("id", { count: "exact", head: true })
            .eq("encarte_id", selectedEncarte)
            .eq("created_by", uid)
            .eq("tienda", tienda);

          if (respuestasError) throw respuestasError;

          if ((respuestasCount ?? 0) > 0) {
            console.log(`✅ Se detectaron ${respuestasCount} respuestas en BD para ${tienda} sin progreso explícito; ofreciendo Continuar.`);
            setSavedProgress({
              user_id: uid,
              encarte_id: selectedEncarte,
              tienda,
              supervisor: "",
              acompaniamiento_encargado: false,
              foto_ingreso_url: null,
              selected_macrocategoria: "todas",
              selected_microcategoria: "todas",
              skipped_product_ids: [],
              started_fresh: false,
            });
            setShowContinueDialog(true);
          }
        }
      } catch (error) {
        console.error("Error checking saved progress for store:", error);
      }
    },
    [isOnline, selectedEncarte]
  );

  // Trigger "Continuar" prompt when the user selects a store.
  useEffect(() => {
    if (!selectedEncarte) return;
    if (!nombreTienda) return;
    if (hasStarted) return;
    if (showContinueDialog) return;
    if (startedFresh) return; // Si el usuario eligió explícitamente comenzar de nuevo, no auto-verificar progreso de nuevo.
    void checkProgressForStore(nombreTienda);
  }, [selectedEncarte, nombreTienda, hasStarted, showContinueDialog, startedFresh, checkProgressForStore]);
  const restoreProgress = async () => {
    if (!savedProgress) return;

    try {
      setIsRestoring(true);
      setLoading(true);
      setHasStarted(false); // Desactivar temporalmente para evitar que el useEffect se dispare
      console.log("🔄 INICIO RESTAURACIÓN DE PROGRESO");

      eventLogger.log(EventType.INFO, 'Restaurando progreso guardado', {
        context: {
          encarteId: selectedEncarte,
          userId,
          currentIndex: savedProgress.current_index,
          hasResponded: savedProgress.responded_product_ids?.length || 0,
          hasSkipped: savedProgress.skipped_product_ids?.length || 0
        }
      });

      // 1. RESTAURAR PRODUCTOS OMITIDOS
      if (savedProgress.skipped_product_ids && Array.isArray(savedProgress.skipped_product_ids)) {
        console.log("✅ Restaurando productos omitidos:", savedProgress.skipped_product_ids.length);
        setSkippedProductIds(new Set(savedProgress.skipped_product_ids));
      }

      // 2. RESTAURAR DATOS DEL FORMULARIO
      console.log("📝 Restaurando datos del formulario");
      setNombreTienda(savedProgress.tienda || "");
      setSelectedTiendaDistrito(savedProgress.distrito || "");
      setSupervisor(savedProgress.supervisor || "");
      setAcompaniamientoEncargado(savedProgress.acompaniamiento_encargado || false);
      setFotoIngresoUrl(savedProgress.foto_ingreso_url);

      // 3. CARGAR PRODUCTOS RESPONDIDOS DESDE DB (only if NOT a fresh start)
      const wasFreshStart = savedProgress.started_fresh === true;
      const restoredTienda = savedProgress.tienda || "";
      if (!wasFreshStart && restoredTienda) {
        console.log(`📥 Cargando productos respondidos desde DB para tienda: ${restoredTienda}`);
        await loadRespondedProducts(restoredTienda);
      } else if (wasFreshStart) {
        console.log("🆕 Fue fresh start - usando solo los responded_product_ids guardados");
        // Set startedFresh state to true to maintain fresh start behavior
        setStartedFresh(true);
      } else {
        console.log("ℹ️ Sin tienda guardada - no se cargan productos respondidos");
        setRespondedProductIds(new Set());
      }

      // 4. FUSIONAR PROGRESO OFFLINE
      console.log("🔄 Fusionando progreso offline");
      try {
        const pendingProg = await offlineStorage.getPendingProgreso(selectedEncarte, userId);
        if (pendingProg?.data) {
          if (Array.isArray(pendingProg.data.skipped_product_ids)) {
            setSkippedProductIds(prev => new Set([...Array.from(prev), ...pendingProg.data.skipped_product_ids]));
          }
          if (Array.isArray(pendingProg.data.responded_product_ids)) {
            setRespondedProductIds(prev => new Set([...Array.from(prev), ...pendingProg.data.responded_product_ids]));
          }
        }
        const pendingResps = await offlineStorage.getPendingRespuestas(selectedEncarte);
        if (pendingResps?.length) {
          setRespondedProductIds(prev => {
            const merged = new Set(prev);
            pendingResps.forEach(r => r.productoId && merged.add(r.productoId));
            return merged;
          });
        }
      } catch (e) {
        console.warn("No se pudo fusionar progreso/respuestas offline:", e);
      }

      // 5. FUSIONAR CON IDs DEL PROGRESO GUARDADO
      if (savedProgress.responded_product_ids && Array.isArray(savedProgress.responded_product_ids)) {
        setRespondedProductIds(prev => {
          const merged = new Set([...Array.from(prev), ...savedProgress.responded_product_ids]);
          console.log("✅ Total productos respondidos:", merged.size);
          return merged;
        });
      }

      // 6. ESPERAR A QUE LOS ESTADOS SE PROPAGUEN
      console.log("⏳ Esperando propagación de estados...");
      await new Promise(resolve => setTimeout(resolve, 100));

      // 7. RECARGAR PRODUCTOS CON LOS ESTADOS ACTUALIZADOS
      console.log("📦 Recargando productos");
      await loadProductos();

      console.log("📊 Productos cargados:", allProductos.length);

      // 8. ESPERAR A QUE SE RECARGUEN LOS PRODUCTOS
      await new Promise(resolve => setTimeout(resolve, 100));

      // 9. RESTAURAR ÍNDICE PRIMERO (antes de aplicar filtros)
      const restoredIndex = savedProgress.current_index || 0;
      console.log("📍 Restaurando índice:", restoredIndex);
      setCurrentIndex(restoredIndex);

      // 10. ACTIVAR MODO DE PRESERVACIÓN DE ÍNDICE
      setPreserveIndex(true);

      // 11. RESTAURAR FILTROS (esto disparará el useEffect pero preservará el índice)
      console.log("🎯 Restaurando filtros:", {
        macro: savedProgress.selected_macrocategoria || "todas",
        micro: savedProgress.selected_microcategoria || "todas"
      });
      setSelectedMacrocategoria(savedProgress.selected_macrocategoria || "todas");
      setSelectedMicrocategoria(savedProgress.selected_microcategoria || "todas");

      // 12. CERRAR DIÁLOGO
      setShowContinueDialog(false);

      // 13. ESPERAR UN MOMENTO ANTES DE ACTIVAR
      await new Promise(resolve => setTimeout(resolve, 100));

      // 14. ACTIVAR MODO INICIADO (esto disparará el useEffect de filtrado)
      console.log("🚀 Activando modo iniciado");
      setHasStarted(true);
      setStartedFresh(false); // User chose to continue, so reset fresh flag

      // 15. ESPERAR A QUE EL useEffect DE FILTRADO PROCESE
      await new Promise(resolve => setTimeout(resolve, 200));

      // 16. DESACTIVAR ESTADOS DE CARGA
      console.log("✅ PROGRESO RESTAURADO COMPLETAMENTE");
      setIsRestoring(false);
      setLoading(false);

      eventLogger.log(EventType.SAVE_SUCCESS, 'Progreso restaurado exitosamente', {
        severity: EventSeverity.SUCCESS,
        context: {
          encarteId: selectedEncarte,
          tienda: nombreTienda || savedProgress.tienda,
          userId,
          respondedCount: savedProgress.responded_product_ids?.length || 0,
          skippedCount: savedProgress.skipped_product_ids?.length || 0
        }
      });

      const skippedCount = savedProgress.skipped_product_ids?.length || 0;
      const respondedCount = savedProgress.responded_product_ids?.length || 0;
      toast.success(`Progreso restaurado: ${respondedCount} respondidos, ${skippedCount} marcados como no encontrados`);
    } catch (error) {
      console.error("❌ Error restaurando progreso:", error);
      setIsRestoring(false);
      setLoading(false);
      toast.error("Error al restaurar el progreso");
    }
  };

  const startFresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete saved progress from database (navigation state only)
      await supabase
        .from("progreso_encuestador")
        .delete()
        .eq("user_id", session.user.id)
        .eq("encarte_id", selectedEncarte);

      // Delete offline progress as well
      try {
        const storeId = nombreTienda || 'default';
        const offlineId = `${session.user.id}_${selectedEncarte}_${storeId}`;
        await offlineStorage.deleteProgreso(offlineId);
      } catch (e) {
        console.warn("No se pudo eliminar progreso offline:", e);
      }

      // Reset ALL navigation and progress state for fresh start
      setSavedProgress(null);
      setShowContinueDialog(false);
      setHasStarted(false);
      setCurrentIndex(0);
      setSelectedMacrocategoria("todas");
      setSelectedMicrocategoria("todas");
      // Reset respondedProductIds to allow re-surveying (DB keeps records, upsert will update)
      setRespondedProductIds(new Set());
      setSkippedProductIds(new Set());
      // Preserve store selection - don't reset nombreTienda or selectedTiendaDistrito
      // setNombreTienda(""); // KEEP the selected store
      // setSelectedTiendaDistrito(""); // KEEP the selected district
      setSupervisor("");
      setAcompaniamientoEncargado(false);
      setFotoIngreso(null);
      setFotoIngresoUrl(null);
      setFormData({
        precio_encontrado: "",
        presencia_producto: null,
        motivo_ausencia: "",
        presencia_cartel: null,
        cartel_presenta_precio: false,
        precio_tarjeta: "",
        ubicacion_sku: "",
        observacion_1: "",
        foto_producto: null,
      });
      setIsCompleted(false);
      setShowExitPhotoDialog(false);
      setFotoSalida(null);
      setShowSkippedReview(false);
      setSkippedProducts([]);
      setReviewingSkippedIndex(0);
      setStartedFresh(true); // Mark that user chose to start fresh

      eventLogger.log(EventType.INFO, 'Usuario eligió comenzar desde cero', {
        context: {
          encarteId: selectedEncarte,
          userId: session.user.id
        }
      });

      toast.success("Reiniciando desde cero - verás todos los productos nuevamente");
    } catch (error) {
      console.error("Error deleting progress:", error);
      toast.error("Error al reiniciar el progreso");
    }
  };

  const saveProgress = async (overrides?: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Convert Sets to Arrays for database storage
      const respondedArray = Array.from(respondedProductIds);
      const skippedArray = Array.from(skippedProductIds);

      const progressData = {
        user_id: session.user.id,
        encarte_id: selectedEncarte,
        tienda: nombreTienda,
        distrito: selectedTiendaDistrito,
        supervisor: supervisor,
        acompaniamiento_encargado: acompaniamientoEncargado,
        foto_ingreso_url: fotoIngresoUrl,
        current_index: currentIndex,
        selected_macrocategoria: selectedMacrocategoria,
        selected_microcategoria: selectedMicrocategoria,
        has_started: hasStarted,
        responded_product_ids: respondedArray,
        skipped_product_ids: skippedArray,
        started_fresh: startedFresh, // Persist fresh start flag
        ...(overrides || {}),
      };

      eventLogger.log(EventType.INFO, 'Guardando progreso', {
        context: {
          encarteId: selectedEncarte,
          userId: session.user.id,
          currentIndex,
          respondedCount: respondedArray.length,
          skippedCount: skippedArray.length,
          isOnline
        }
      });

      // Try to save online first if connected
      if (isOnline) {
        try {
          // Use retry logic for database operations under load
          await withRetry(
            async () => {
              // Manual select+update/insert to avoid 42P10 upsert cache issues
              const { data: existing } = await supabase
                .from("progreso_encuestador")
                .select("id")
                .eq("user_id", progressData.user_id)
                .eq("encarte_id", progressData.encarte_id)
                .eq("tienda", progressData.tienda)
                .maybeSingle();

              if (existing) {
                const { error } = await supabase
                  .from("progreso_encuestador")
                  .update(progressData)
                  .eq("id", existing.id);
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from("progreso_encuestador")
                  .insert(progressData);
                if (error) throw error;
              }
            },
            {
              maxRetries: 3,
              onRetry: (attempt) => {
                console.log(`Reintentando guardar progreso (intento ${attempt})...`);
              }
            }
          );

          eventLogger.log(EventType.SAVE_SUCCESS, 'Progreso guardado exitosamente (online)', {
            severity: EventSeverity.SUCCESS,
            context: {
              encarteId: selectedEncarte,
              tienda: nombreTienda,
              userId: session.user.id,
              respondedCount: respondedArray.length,
              skippedCount: skippedArray.length
            }
          });
        } catch (error: any) {
          console.error("Error saving progress online:", error);

          // NO guardar offline cuando estamos online - solo loguear el error
          const errorMessage = error?.message || 'Error desconocido';
          eventLogger.log(EventType.SAVE_ERROR, `Error al guardar progreso online: ${errorMessage}`, {
            severity: EventSeverity.ERROR,
            context: {
              encarteId: selectedEncarte,
              userId: session.user.id,
              errorCode: error?.code
            },
            error
          });

          // No mostrar toast para progreso (es silencioso), pero loguear
          console.warn("Progreso no guardado - se reintentará en la próxima acción");
        }
      } else {
        // Guardar también offline (incluyendo la tienda para el Multi-Store Progress)
        await offlineStorage.saveProgreso(selectedEncarte, session.user.id, progressData, progressData.tienda);
        await checkPendingCount();

        eventLogger.log(EventType.SAVE_OFFLINE, 'Progreso guardado offline', {
          severity: EventSeverity.SUCCESS,
          context: {
            encarteId: selectedEncarte,
            tienda: nombreTienda,
            userId: session.user.id,
            respondedCount: respondedArray.length,
            skippedCount: skippedArray.length
          }
        });
      }
    } catch (error: any) {
      console.error("Error saving progress:", error);
      eventLogger.log(EventType.SAVE_ERROR, 'Error crítico al guardar progreso', {
        context: { encarteId: selectedEncarte, userId },
        error
      });
    }
  };

  // Expose saveProgress to parent via ref for logout handling
  useEffect(() => {
    if (saveProgressRef) {
      saveProgressRef.current = saveProgress;
    }
    return () => {
      if (saveProgressRef) {
        saveProgressRef.current = null;
      }
    };
  }, [saveProgress, saveProgressRef]);

  const loadProductos = async () => {
    setLoading(true);
    setIsPreloading(true);
    setPreloadedCount(0);
    console.log("🔍 loadProductos: Iniciando carga para encarte:", selectedEncarte);

    try {
      let productos: Producto[] = [];

      // Try to load from cache first if offline
      if (!isOnline) {
        const cached = await offlineStorage.getCachedProductosEncarte(selectedEncarte);
        if (cached && cached.productos?.length > 0) {
          console.log(`📦 ${cached.productos.length} productos cargados desde caché offline`);
          productos = cached.productos;
          setTotalProductCount(productos.length);
          setPreloadedCount(productos.length);
          toast.info(`${productos.length} productos cargados desde caché`);
        } else {
          toast.error("Sin conexión y sin productos en caché. Necesitas conexión para cargar los productos.");
          setLoading(false);
          setIsPreloading(false);
          return;
        }
      } else {
        // Online - fetch from server
        const { data, error } = await supabase
          .from("productos")
          .select("id, descripcion_producto_carteleria, precio_promo, categoria, division, cod_interno, descripcion_producto, macrocategoria, microcategoria")
          .eq("encarte_id", selectedEncarte)
          .order("categoria", { ascending: true, nullsFirst: false })
          .order("descripcion_producto_carteleria");

        if (error) {
          console.error("❌ Error al cargar productos:", error);
          // Try cache as fallback
          const cached = await offlineStorage.getCachedProductosEncarte(selectedEncarte);
          if (cached && cached.productos?.length > 0) {
            console.log(`📦 Fallback: ${cached.productos.length} productos desde caché`);
            productos = cached.productos;
            toast.warning("Error de conexión. Usando productos en caché.");
          } else {
            throw error;
          }
        } else {
          productos = data || [];
        }

        setTotalProductCount(productos.length);
        setPreloadedCount(productos.length);
        console.log("✅ Productos cargados:", productos.length);

        // Cache products and encarte data for offline use
        if (productos.length > 0) {
          await offlineStorage.cacheProductosEncarte(
            selectedEncarte,
            productos,
            selectedEncarteData,
            tiendas
          );
          await offlineStorage.setSyncStatus(selectedEncarte, 'encarte', true, productos.length);
          console.log(`💾 ${productos.length} productos guardados en caché offline`);
        }
      }

      setAllProductos(productos);

      // Load existing responses (solo del usuario actual) + offline pendientes
      // CRITICAL: ALWAYS filter by tienda to avoid cross-store contamination
      // If no tienda is selected yet, do NOT load any responded IDs - they will be loaded
      // when the user selects a tienda and starts the survey
      const { data: { session } } = await supabase.auth.getSession();
      let respondedIds = new Set<string>();
      const currentTienda = nombreTienda || savedProgress?.tienda;

      // Solo cargar de Supabase si NO venimos explícitamente de "Comenzar de Nuevo" (startedFresh=true)
      if (session && isOnline && currentTienda && !startedFresh) {
        const { data: respuestas } = await supabase
          .from("respuestas")
          .select("producto_id")
          .eq("encarte_id", selectedEncarte)
          .eq("created_by", session.user.id)
          .eq("tienda", currentTienda);

        respondedIds = new Set((respuestas?.map(r => r.producto_id).filter(Boolean) as string[]) || []);
      }

      // Merge offline respuestas pendientes
      try {
        const offlinePending = await offlineStorage.getPendingRespuestas(selectedEncarte);
        offlinePending.forEach(r => {
          if (r.productoId) respondedIds.add(r.productoId);
        });
      } catch (e) {
        console.warn("No se pudo cargar respuestas pendientes offline:", e);
      }

      // Merge responded from saved progress (in case DB/offline doesn't have them yet)
      if (!startedFresh && savedProgress?.responded_product_ids?.length) {
        (savedProgress.responded_product_ids as string[]).forEach((id) => respondedIds.add(id));
      }

      setRespondedProductIds(respondedIds);

      // Merge skipped from saved progress for filtering stability
      const mergedSkipped = new Set<string>([
        ...Array.from(skippedProductIds),
        ...(((savedProgress?.skipped_product_ids as string[]) || []))
      ]);

      // Filter out already responded products and skipped products
      const pendingProductos = productos.filter(p =>
        !respondedIds.has(p.id) && !mergedSkipped.has(p.id)
      );
      setProductos(pendingProductos);

      // Extract unique macrocategorias and microcategorias (normalized, trimmed, non-empty)
      const uniqueMacros = Array.from(
        new Set(
          pendingProductos
            .map((p) => (p.macrocategoria ?? "").toString().trim())
            .filter((v) => v.length > 0)
        )
      );
      const uniqueMicros = Array.from(
        new Set(
          pendingProductos
            .map((p) => (p.microcategoria ?? "").toString().trim())
            .filter((v) => v.length > 0)
        )
      );

      setMacrocategorias(uniqueMacros.sort());
      setMicrocategorias(uniqueMicros.sort());
    } catch (error) {
      console.error("Error loading productos:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
      setIsPreloading(false);
    }
  };

  // Filter products based on selected filters and update available categories
  useEffect(() => {
    if (!hasStarted) {
      console.log("⏸️ Filtrado pausado: hasStarted =", hasStarted);
      return;
    }

    console.log("🔄 Iniciando filtrado de productos", {
      hasStarted,
      allProductosCount: allProductos.length,
      respondedCount: respondedProductIds.size,
      skippedCount: skippedProductIds.size,
      selectedMacro: selectedMacrocategoria,
      selectedMicro: selectedMicrocategoria
    });

    setIsFilterTransitioning(true);

    // Start with all pending products (not responded yet AND not skipped)
    const pendingProductos = allProductos.filter(p =>
      !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id)
    );

    console.log("📊 Productos pendientes:", pendingProductos.length);

    // Update available macrocategorias from pending products
    const uniqueMacros = Array.from(
      new Set(
        pendingProductos
          .map((p) => (p.macrocategoria ?? "").toString().trim())
          .filter((v) => v.length > 0)
      )
    );
    setMacrocategorias(uniqueMacros.sort());

    // Reset macrocategoria if current is not in available list
    if (selectedMacrocategoria !== "todas" && !uniqueMacros.includes(selectedMacrocategoria)) {
      console.log("⚠️ Macrocategoría actual no disponible, reseteando");
      setSelectedMacrocategoria("todas");
      setIsFilterTransitioning(false);
      return; // El efecto se volverá a ejecutar con la nueva macrocategoría
    }

    let filtered = [...pendingProductos];

    if (selectedMacrocategoria && selectedMacrocategoria !== "todas") {
      filtered = filtered.filter(p => p.macrocategoria === selectedMacrocategoria);

      // Update available microcategorias based on selected macrocategoria
      const uniqueMicros = Array.from(
        new Set(
          filtered
            .map((p) => (p.microcategoria ?? "").toString().trim())
            .filter((v) => v.length > 0)
        )
      );
      setMicrocategorias(uniqueMicros.sort());

      // Reset microcategoria selection if current is not in filtered list
      if (selectedMicrocategoria !== "todas" && !uniqueMicros.includes(selectedMicrocategoria)) {
        console.log("⚠️ Microcategoría actual no disponible, reseteando");
        setSelectedMicrocategoria("todas");
        setIsFilterTransitioning(false);
        return; // El efecto se volverá a ejecutar
      }
    } else {
      // If no macrocategoria selected, show all microcategorias from pending products
      const uniqueMicros = Array.from(
        new Set(
          pendingProductos
            .map((p) => (p.microcategoria ?? "").toString().trim())
            .filter((v) => v.length > 0)
        )
      );
      setMicrocategorias(uniqueMicros.sort());
    }

    if (selectedMicrocategoria && selectedMicrocategoria !== "todas") {
      filtered = filtered.filter(p => p.microcategoria === selectedMicrocategoria);
    }

    console.log("✅ Productos filtrados:", filtered.length);

    setProductos(filtered);

    // NO resetear el índice si estamos preservándolo (durante restauración)
    if (!preserveIndex) {
      setCurrentIndex(0);
    } else {
      // Después de restaurar, desactivar el modo de preservación
      setPreserveIndex(false);
    }

    // Esperar un tick para asegurar que el estado se actualice
    setTimeout(() => {
      setIsFilterTransitioning(false);
    }, 0);
  }, [selectedMacrocategoria, selectedMicrocategoria, hasStarted, allProductos, respondedProductIds, skippedProductIds, preserveIndex]);

  // Evitar pantallas en blanco: manejar transiciones cuando el filtro queda sin productos
  useEffect(() => {
    // Proteger cierre anticipado: Si está cargando, pre-cargando, o transicionando los filtros, ignorar.
    if (!hasStarted || loading || isPreloading || isFilterTransitioning || isRestoring || showExitPhotoDialog || showSkippedReview) return;

    // Mantener índice válido cuando cambia la lista filtrada
    if (productos.length > 0) {
      if (currentIndex >= productos.length) setCurrentIndex(0);
      return;
    }

    // productos.length === 0
    const allPendingProducts = allProductos.filter(
      (p) => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id)
    );

    // Si no hay pendientes, decidir si revisar omitidos o pedir foto de salida
    if (allPendingProducts.length === 0) {
      if (skippedProductIds.size > 0) {
        const skipped = allProductos.filter((p) => skippedProductIds.has(p.id));
        setSkippedProducts(skipped);
        setReviewingSkippedIndex(0);
        setShowSkippedReview(true);
      } else {
        setShowExitPhotoDialog(true);
      }
      return;
    }

    // Hay pendientes pero no en este filtro: resetear filtros
    if (selectedMacrocategoria !== "todas" || selectedMicrocategoria !== "todas") {
      setCurrentIndex(0);
      setSelectedMacrocategoria("todas");
      setSelectedMicrocategoria("todas");
    }
  }, [
    hasStarted,
    loading,
    isPreloading,
    isFilterTransitioning,
    isRestoring,
    showExitPhotoDialog,
    showSkippedReview,
    productos.length,
    currentIndex,
    allProductos,
    respondedProductIds,
    skippedProductIds,
    selectedMacrocategoria,
    selectedMicrocategoria,
  ]);


  const handleFotoIngreso = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setFotoIngreso(compressed);
        } catch (error) {
          console.error("Error compressing image:", error);
          setFotoIngreso(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFotoSalida = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setFotoSalida(compressed);
        } catch (error) {
          console.error("Error compressing image:", error);
          setFotoSalida(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFotoProducto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño del archivo antes de procesarlo
      const maxSizeMB = 10;
      const fileSizeMB = file.size / 1024 / 1024;

      if (fileSizeMB > maxSizeMB) {
        toast.error(`La foto es demasiado grande (${fileSizeMB.toFixed(1)}MB). Máximo ${maxSizeMB}MB.`);
        eventLogger.log(EventType.FORM_ERROR, 'Foto demasiado grande', {
          context: {
            fileSizeMB: fileSizeMB.toFixed(2),
            maxSizeMB
          }
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setFormData({ ...formData, foto_producto: compressed });
        } catch (error: any) {
          console.error("Error compressing image:", error);

          // Si falla la compresión, intentar usar la original si no es muy grande
          if (fileSizeMB < 5) {
            setFormData({ ...formData, foto_producto: reader.result as string });
            toast.warning("No se pudo comprimir la imagen, usando original");
          } else {
            toast.error("Error al procesar la foto. Intenta capturar una nueva.");
            eventLogger.log(EventType.FORM_ERROR, 'Error al comprimir imagen', {
              context: {
                fileSizeMB: fileSizeMB.toFixed(2),
                errorMessage: error?.message
              },
              error
            });
          }
        }
      };

      reader.onerror = () => {
        console.error("Error reading file");
        toast.error("Error al leer la foto. Intenta de nuevo.");
        eventLogger.log(EventType.FORM_ERROR, 'Error al leer archivo', {
          context: { fileName: file.name }
        });
      };

      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (dataUrl: string, fileName: string, tienda?: string, codProducto?: string) => {
    try {
      // Validar que la imagen no sea demasiado grande (prevenir crash por memoria)
      const sizeInMB = (dataUrl.length * 3) / 4 / 1024 / 1024;
      if (sizeInMB > 10) {
        throw new Error("La imagen es demasiado grande (máx 10MB). Por favor captura una nueva foto.");
      }

      if (!dataUrl.includes(",")) {
        throw new Error("Formato de imagen inválido");
      }

      // Use fast fetch-based conversion instead of byte-by-byte loop
      const blob = await base64ToBlob(dataUrl);
      const file = new File([blob], fileName, { type: "image/jpeg" });

      // Generate new naming format if tienda and codProducto are provided
      const uploadPath = tienda && codProducto
        ? generatePhotoFileName(tienda, codProducto, userId, 'producto')
        : `${userId}/${Date.now()}_${fileName}`;

      // Usar retry logic para subida de fotos
      const { data, error } = await withRetry(
        async () => {
          const result = await supabase.storage
            .from("encarte-photos")
            .upload(uploadPath, file);

          if (result.error) throw result.error;
          return result;
        },
        {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`Reintentando subir foto (intento ${attempt})...`);
          }
        }
      );

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("encarte-photos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error("❌ Error uploading photo:", error);

      // Registrar error específico
      eventLogger.log(EventType.PHOTO_UPLOAD, 'Error al subir foto', {
        severity: EventSeverity.ERROR,
        context: {
          fileName,
          errorMessage: error?.message,
          errorType: error?.name
        },
        error
      });

      throw error;
    }
  };

  const handleStart = async () => {
    if (!selectedEncarte || !nombreTienda || !supervisor || !fotoIngreso) {
      toast.error("Por favor completa todos los campos iniciales");
      eventLogger.log(EventType.FORM_ERROR, 'Campos incompletos al iniciar encuesta', {
        context: { selectedEncarte, nombreTienda, supervisor, hasFotoIngreso: !!fotoIngreso }
      });
      return;
    }

    setSaving(true);
    eventLogger.log(EventType.FORM_SUBMIT, 'Iniciando registro de encuesta', {
      context: { encarteId: selectedEncarte, tienda: nombreTienda, userId }
    });

    try {
      // Step 1: Upload foto ingreso
      eventLogger.log(EventType.PHOTO_UPLOAD, 'Subiendo foto de ingreso', {
        context: { encarteId: selectedEncarte }
      });
      const uploadedFotoIngresoUrl = await uploadPhoto(fotoIngreso, "foto_ingreso.jpg");
      eventLogger.log(EventType.PHOTO_UPLOAD, 'Foto de ingreso subida exitosamente', {
        context: { encarteId: selectedEncarte, fotoUrl: uploadedFotoIngresoUrl }
      });

      // Step 2: Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Debes iniciar sesión");
        eventLogger.log(EventType.AUTH_ERROR, 'Sesión no encontrada al iniciar encuesta', {
          context: { encarteId: selectedEncarte }
        });
        return;
      }

      // Step 3: Update encarte with foto_registro (non-blocking - encuestadores may not have UPDATE permission)
      try {
        eventLogger.log(EventType.INFO, 'Actualizando encarte con foto de registro', {
          context: { encarteId: selectedEncarte }
        });

        await withRetry(
          async () => {
            const { error: updateError } = await supabase
              .from("encartes")
              .update({ foto_registro: uploadedFotoIngresoUrl, tienda: nombreTienda })
              .eq("id", selectedEncarte);

            if (updateError) {
              throw updateError;
            }
          },
          {
            maxRetries: 2,
            onRetry: (attempt) => {
              console.log(`Reintentando actualizar encarte (intento ${attempt})...`);
            }
          }
        );
      } catch (encarteUpdateError: any) {
        // Non-critical: encuestadores may lack UPDATE permission on encartes table
        console.warn("No se pudo actualizar encarte (posiblemente sin permisos):", encarteUpdateError?.message);
        eventLogger.log(EventType.INFO, 'Encarte update skipped (RLS)', {
          context: { encarteId: selectedEncarte, error: encarteUpdateError?.message }
        });
      }

      // Step 4: Save progress
      eventLogger.log(EventType.INFO, 'Guardando progreso inicial', {
        context: { encarteId: selectedEncarte, userId: session.user.id }
      });

      setFotoIngresoUrl(uploadedFotoIngresoUrl);
      setHasStarted(true);

      await saveProgress({
        has_started: true,
        foto_ingreso_url: uploadedFotoIngresoUrl,
        tienda: nombreTienda,
        distrito: selectedTiendaDistrito,
        supervisor: supervisor,
        acompaniamiento_encargado: acompaniamientoEncargado,
        current_index: 0,
        selected_macrocategoria: selectedMacrocategoria,
        selected_microcategoria: selectedMicrocategoria,
      });

      eventLogger.log(EventType.SAVE_SUCCESS, 'Registro iniciado correctamente', {
        context: { encarteId: selectedEncarte, tienda: nombreTienda, userId: session.user.id }
      });
      toast.success("Registro iniciado correctamente");
    } catch (error: any) {
      console.error("Error al iniciar registro:", error);
      const errorMessage = error?.message || 'Error desconocido';
      eventLogger.log(EventType.FORM_ERROR, `Error al iniciar registro: ${errorMessage}`, {
        context: { encarteId: selectedEncarte, tienda: nombreTienda, userId },
        error
      });
      toast.error(`Error al iniciar el registro: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipProduct = async () => {
    const currentProduct = productos[currentIndex];
    const newSkippedIds = new Set(skippedProductIds);
    newSkippedIds.add(currentProduct.id);
    setSkippedProductIds(newSkippedIds);

    console.log("🔵 Producto saltado:", {
      productId: currentProduct.id,
      currentIndex,
      totalFiltered: productos.length,
      skippedCount: newSkippedIds.size
    });

    eventLogger.log(EventType.INFO, 'Producto saltado para revisión posterior', {
      context: {
        productId: currentProduct.id,
        encarteId: selectedEncarte,
        skippedCount: newSkippedIds.size
      }
    });

    // CRÍTICO: Guardar inmediatamente con el estado actualizado de productos omitidos
    await saveProgress({ skipped_product_ids: Array.from(newSkippedIds) });

    // Verificar si quedan productos sin responder (excluyendo los saltados)
    const allPendingProducts = allProductos.filter(p =>
      !respondedProductIds.has(p.id) && !newSkippedIds.has(p.id)
    );

    console.log("🔵 Estado después de saltar:", {
      allPendingCount: allPendingProducts.length,
      isLastInFilter: currentIndex >= productos.length - 1,
      shouldShowReview: allPendingProducts.length === 0 && newSkippedIds.size > 0
    });

    if (currentIndex < productos.length - 1) {
      // Hay más productos en la lista actual
      setCurrentIndex(currentIndex + 1);
      toast.success("Producto marcado para revisión posterior");
    } else if (allPendingProducts.length > 0) {
      // No hay más productos en la lista actual pero hay productos pendientes en otras categorías
      console.log("🔄 Reseteando filtros para mostrar productos pendientes");
      setSelectedMacrocategoria("todas");
      setSelectedMicrocategoria("todas");
      setCurrentIndex(0);  // IMPORTANTE: Resetear índice cuando cambian filtros
      toast.success("Producto marcado para revisión posterior");
    } else {
      // No hay más productos pendientes, mostrar revisión de saltados
      console.log("✅ Mostrando revisión de productos omitidos:", newSkippedIds.size);
      if (newSkippedIds.size > 0) {
        const skipped = allProductos.filter(p => newSkippedIds.has(p.id));
        console.log("📋 Productos para revisar:", skipped.map(p => ({ id: p.id, name: p.descripcion_producto_carteleria })));
        setSkippedProducts(skipped);
        setReviewingSkippedIndex(0);
        setShowSkippedReview(true);
        toast.info(`Revisando ${skipped.length} productos marcados como no encontrados`);
      } else {
        // No hay productos saltados, ir directamente a foto de salida
        console.log("📸 No hay productos omitidos, mostrando diálogo de salida");
        setShowExitPhotoDialog(true);
      }
    }
  };

  const handleSave = async () => {
    // In review mode, allow saving without photo if user found the product
    if (!showSkippedReview && !formData.precio_encontrado) {
      toast.error("Por favor ingresa el precio encontrado");
      eventLogger.log(EventType.FORM_ERROR, 'Precio no ingresado', {
        context: { currentIndex, showSkippedReview }
      });
      return;
    }

    if (formData.presencia_producto === null) {
      toast.error("Por favor responde si hay presencia del producto");
      return;
    }

    if (formData.presencia_producto === false && !formData.motivo_ausencia) {
      toast.error("Por favor selecciona un motivo de ausencia");
      return;
    }

    if (formData.presencia_cartel === null) {
      toast.error("Por favor responde si hay presencia del cartel");
      return;
    }

    // Solo requerir foto si hay presencia del producto
    if (!showSkippedReview && formData.presencia_producto && !formData.foto_producto) {
      toast.error("Por favor captura la foto del producto");
      eventLogger.log(EventType.FORM_ERROR, 'Foto de producto no capturada', {
        context: { currentIndex, showSkippedReview }
      });
      return;
    }

    // In review mode, require at least precio to save
    if (showSkippedReview && formData.presencia_producto && !formData.precio_encontrado) {
      toast.error("Por favor ingresa el precio encontrado");
      eventLogger.log(EventType.FORM_ERROR, 'Precio no ingresado en modo revisión', {
        context: { reviewingSkippedIndex, showSkippedReview }
      });
      return;
    }

    setSaving(true);

    const currentProduct = showSkippedReview
      ? skippedProducts[reviewingSkippedIndex]
      : productos[currentIndex];

    eventLogger.log(EventType.FORM_SUBMIT, 'Iniciando guardado de respuesta', {
      context: {
        productId: currentProduct.id,
        encarteId: selectedEncarte,
        isOnline,
        showSkippedReview
      }
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Debes iniciar sesión");
        eventLogger.log(EventType.AUTH_ERROR, 'Sesión no encontrada al guardar', {
          context: { productId: currentProduct.id, encarteId: selectedEncarte }
        });
        return;
      }

      const encarteDate = new Date(selectedEncarteData?.fecha || new Date());

      // Validar precio antes de parsearlo
      const precioValue = parseFloat(formData.precio_encontrado);
      if (isNaN(precioValue) || precioValue < 0 || precioValue > 9999999) {
        toast.error("Error: Precio inválido (debe ser un número entre 0 y 9,999,999)");
        eventLogger.log(EventType.FORM_ERROR, 'Precio inválido', {
          context: {
            precioIngresado: formData.precio_encontrado,
            productId: currentProduct.id,
            encarteId: selectedEncarte
          }
        });
        setSaving(false);
        return;
      }

      const observacionesCombined = formData.presencia_producto === false
        ? `[Motivo Ausencia: ${formData.motivo_ausencia}] ${formData.observacion_1}`.trim()
        : formData.observacion_1;

      const obs1Combined = formData.presencia_producto === false
        ? formData.motivo_ausencia
        : formData.observacion_1;

      const respuestaData = {
        encarte_id: selectedEncarte,
        producto_id: currentProduct.id,
        precio_encontrado: precioValue,
        presencia_producto: formData.presencia_producto,
        presencia_cartel: formData.presencia_cartel,
        cartel_presenta_precio: formData.cartel_presenta_precio,
        precio_tarjeta: formData.precio_tarjeta ? parseFloat(formData.precio_tarjeta) : null,
        ubicacion_sku: formData.ubicacion_sku?.substring(0, 500) || null,
        observaciones: observacionesCombined?.substring(0, 2000) || null,
        obs_1: obs1Combined?.substring(0, 50) || null,
        created_by: session.user.id,
        año: encarteDate.getFullYear(),
        mes_cod: encarteDate.getMonth() + 1,
        mes: encarteDate.toLocaleDateString('es-ES', { month: 'long' }),
        fecha: new Date().toISOString().split('T')[0],
        encarte: selectedEncarteData?.nombre,
        encargado: selectedEncarteData?.encargado_1,
        encargado_2: acompaniamientoEncargado ? "Sí" : "No",
        ciudad_cadena: selectedEncarteData?.cadena,
        ciudad: selectedTiendaDistrito,
        bandera: selectedEncarteData?.bandera,
        tienda: nombreTienda,
        macrocategoria: currentProduct.macrocategoria,
        categoria: currentProduct.categoria,
        cod_interno: currentProduct.cod_interno,
        producto: currentProduct.descripcion_producto_carteleria,
        precio_encarte: currentProduct.precio_promo,
        foto_registro: fotoIngresoUrl,
        supervisor: supervisor,
      };

      // Basic validation
      if (!respuestaData.encarte_id || !respuestaData.producto_id) {
        toast.error("Error: Datos del producto o encarte no válidos");
        eventLogger.log(EventType.FORM_ERROR, 'Datos inválidos', {
          context: {
            hasEncarteId: !!respuestaData.encarte_id,
            hasProductId: !!respuestaData.producto_id
          }
        });
        setSaving(false);
        return;
      }

      // Try to save online first if connected
      // Try to save online first if connected
      if (isOnline) {
        eventLogger.log(EventType.INFO, 'Intentando guardar en línea', {
          context: { productId: currentProduct.id, encarteId: selectedEncarte }
        });
        try {
          let fotoProductoUrl = null;
          // Siempre subir foto si existe
          if (formData.foto_producto) {
            const currentProduct = showSkippedReview
              ? skippedProducts[reviewingSkippedIndex]
              : productos[currentIndex];
            fotoProductoUrl = await uploadPhoto(
              formData.foto_producto,
              `producto_${currentProduct.id}.jpg`,
              nombreTienda,
              currentProduct.cod_interno || undefined
            );

            eventLogger.log(EventType.PHOTO_UPLOAD, 'Foto de producto subida', {
              context: { productId: currentProduct.id, encarteId: selectedEncarte }
            });
          }

          const respuesta = {
            ...respuestaData,
            foto: fotoProductoUrl,
          };

          // Use retry logic for database insert under concurrent load
          await withRetry(
            async () => {
              const { data, error } = await supabase.functions.invoke('sync-encarte-respuestas', {
                body: { respuestas: [respuesta] },
              });

              if (error) throw error;

              const result = data as any;
              if (result?.error) {
                throw new Error(result.error_details || result.error);
              }
              if (typeof result?.errors === 'number' && result.errors > 0) {
                const first = result.failed?.[0];
                throw new Error(first?.error_message || 'Error al sincronizar respuesta');
              }
            },
            {
              maxRetries: 3,
              onRetry: (attempt) => {
                console.log(`Reintentando guardar respuesta (intento ${attempt})...`);
                toast.info(`Reintentando guardar... (${attempt}/3)`);
              },
            }
          );

          eventLogger.log(EventType.SAVE_SUCCESS, 'Respuesta guardada en línea', {
            context: {
              productId: currentProduct.id,
              encarteId: selectedEncarte,
              tienda: nombreTienda,
              userId: session.user.id
            }
          });

          toast.success("Respuesta guardada en línea");
        } catch (error: any) {
          console.error("Error saving online:", error);

          // Determinar tipo de error
          const errorMessage = error?.message || 'Error desconocido';
          const isAuthError = errorMessage.includes('JWT') ||
            errorMessage.includes('token') ||
            errorMessage.includes('session') ||
            errorMessage.includes('auth') ||
            error?.code === '42501' ||
            error?.code === 'PGRST301';

          eventLogger.log(EventType.SAVE_ERROR, `Error al guardar en línea: ${errorMessage}`, {
            severity: EventSeverity.ERROR,
            context: {
              productId: currentProduct.id,
              encarteId: selectedEncarte,
              errorCode: error?.code,
              isAuthError
            },
            error
          });

          // NO guardar offline cuando estamos online - mostrar error al usuario
          if (isAuthError) {
            toast.error("Error de sesión. Por favor cierra sesión y vuelve a iniciar.");
          } else {
            toast.error(`Error al guardar: ${errorMessage}. Por favor intenta de nuevo.`);
          }

          setSaving(false);
          return; // Salir sin continuar al siguiente producto
        }
      } else {
        // Save offline
        eventLogger.log(EventType.INFO, 'Sin conexión - guardando offline', {
          context: {
            productId: currentProduct.id,
            encarteId: selectedEncarte,
            isOnline: false
          }
        });

        try {
          // Siempre guardar foto si existe
          await offlineStorage.saveRespuesta(
            selectedEncarte,
            currentProduct.id,
            respuestaData,
            { fotoProducto: formData.foto_producto }
          );
          await checkPendingCount();
          toast.info("Guardado sin conexión. Se sincronizará cuando vuelva internet.");

          eventLogger.log(EventType.SAVE_OFFLINE, 'Respuesta guardada offline exitosamente', {
            severity: EventSeverity.SUCCESS,
            context: {
              productId: currentProduct.id,
              encarteId: selectedEncarte,
              tienda: nombreTienda,
              userId: session.user.id
            }
          });
        } catch (offlineError: any) {
          console.error("Error saving offline:", offlineError);
          eventLogger.log(EventType.SAVE_ERROR, 'Error al guardar offline', {
            context: {
              productId: currentProduct.id,
              encarteId: selectedEncarte
            },
            error: offlineError
          });
          throw offlineError; // Re-throw para que sea capturado por el catch principal
        }
      }

      // Add to responded products and remove from skipped
      const newRespondedIds = new Set(respondedProductIds);
      newRespondedIds.add(currentProduct.id);
      setRespondedProductIds(newRespondedIds);

      const newSkippedIds = new Set(skippedProductIds);
      newSkippedIds.delete(currentProduct.id);
      setSkippedProductIds(newSkippedIds);

      // Reset form
      setFormData({
        precio_encontrado: "",
        presencia_producto: null,
        motivo_ausencia: "",
        presencia_cartel: null,
        cartel_presenta_precio: false,
        precio_tarjeta: "",
        ubicacion_sku: "",
        observacion_1: "",
        foto_producto: null,
      });

      if (showSkippedReview) {
        // In review mode
        if (reviewingSkippedIndex < skippedProducts.length - 1) {
          setReviewingSkippedIndex(reviewingSkippedIndex + 1);
          await saveProgress({ responded_product_ids: Array.from(newRespondedIds), skipped_product_ids: Array.from(newSkippedIds) });
        } else {
          // Finished reviewing all skipped products
          setShowSkippedReview(false);
          setShowExitPhotoDialog(true);
        }
      } else {
        // Normal mode - Check if all products in current filter are completed
        const remainingInFilter = productos.filter((p, idx) => idx > currentIndex);

        if (remainingInFilter.length === 0) {
          // Current filter completed, check if there are more pending products (excluding skipped)
          const allPendingProducts = allProductos.filter(p =>
            !newRespondedIds.has(p.id) && !newSkippedIds.has(p.id)
          );

          if (allPendingProducts.length === 0) {
            // All non-skipped products completed - check if there are skipped products to review
            if (newSkippedIds.size > 0) {
              const skipped = allProductos.filter(p => newSkippedIds.has(p.id));
              setSkippedProducts(skipped);
              setReviewingSkippedIndex(0);
              setShowSkippedReview(true);
              await saveProgress({ responded_product_ids: Array.from(newRespondedIds), skipped_product_ids: Array.from(newSkippedIds) });
              toast.info("Revisando productos marcados como no encontrados");
            } else {
              // No skipped products, proceed to exit photo
              setShowExitPhotoDialog(true);
            }
          } else {
            // Reset filters to continue with remaining products
            console.log("🔄 Categoría completada, reseteando filtros y índice");

            // CRÍTICO: Activar modo de preservación y cambiar filtros primero
            setPreserveIndex(true);
            setSelectedMacrocategoria("todas");
            setSelectedMicrocategoria("todas");

            // Esperar a que los filtros se apliquen
            await new Promise(resolve => setTimeout(resolve, 100));

            // Ahora sí resetear el índice
            setCurrentIndex(0);

            // Guardar progreso con índice 0
            await saveProgress({
              current_index: 0,
              responded_product_ids: Array.from(newRespondedIds),
              skipped_product_ids: Array.from(newSkippedIds)
            });

            toast.success("Categoría completada. Continuando con los productos restantes...");
          }
        } else {
          // Incrementar índice y guardar
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);

          // Save progress after moving to next product con el índice correcto
          await saveProgress({
            current_index: nextIndex,
            responded_product_ids: Array.from(newRespondedIds),
            skipped_product_ids: Array.from(newSkippedIds)
          });

          toast.success("Respuesta guardada");
        }
      }
    } catch (error: any) {
      console.error("❌ Error crítico al guardar:", error);
      const errorMessage = error?.message || 'Error desconocido';
      const errorStack = error?.stack || '';

      // Mostrar error específico al usuario
      if (errorMessage.includes('Failed to fetch')) {
        toast.error("Error de conexión. Verifica tu internet e intenta de nuevo.");
      } else if (errorMessage.includes('QuotaExceededError')) {
        toast.error("Memoria llena. Sincroniza los datos pendientes e intenta de nuevo.");
      } else {
        toast.error(`Error al guardar: ${errorMessage}`);
      }

      eventLogger.log(EventType.FORM_ERROR, `Error crítico al guardar respuesta: ${errorMessage}`, {
        severity: EventSeverity.ERROR,
        context: {
          encarteId: selectedEncarte,
          productId: currentProduct?.id,
          currentIndex,
          showSkippedReview,
          isOnline,
          errorType: error?.name,
          errorStack: errorStack.substring(0, 500)
        },
        error
      });

      // No hacer nada más para evitar que la app se cierre
      // El usuario puede reintentar
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setIsCompleted(false);
    setHasStarted(false);
    setSelectedEncarte("");
    setSelectedEncarteData(null);
    setNombreTienda("");
    setSelectedTiendaDistrito("");
    setSupervisor("");
    setAcompaniamientoEncargado(false);
    setFotoIngreso(null);
    setFotoIngresoUrl(null);
    setProductos([]);
    setAllProductos([]);
    setCurrentIndex(0);
    setSelectedMacrocategoria("todas");
    setSelectedMicrocategoria("todas");
    setFormData({
      precio_encontrado: "",
      presencia_producto: null,
      motivo_ausencia: "",
      presencia_cartel: null,
      cartel_presenta_precio: false,
      precio_tarjeta: "",
      ubicacion_sku: "",
      observacion_1: "",
      foto_producto: null,
    });
  };

  const handleCompleteEncarte = async () => {
    if (!fotoSalida) {
      toast.error("Por favor captura la foto de salida");
      return;
    }

    setSaving(true);
    try {
      // Upload exit photo
      const fotoSalidaUrl = await uploadPhoto(fotoSalida, "foto_salida.jpg");

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Save foto_salida to progreso_encuestador (per store)
        await supabase
          .from("progreso_encuestador")
          .update({ foto_salida_url: fotoSalidaUrl })
          .eq("user_id", session.user.id)
          .eq("encarte_id", selectedEncarte)
          .eq("tienda", nombreTienda);
      }

      // Also update encarte with exit photo (keep backward compat, non-blocking for encuestadores)
      try {
        await supabase
          .from("encartes")
          .update({
            foto_salida: fotoSalidaUrl
          })
          .eq("id", selectedEncarte);
      } catch (encarteExitError: any) {
        console.warn("No se pudo actualizar foto_salida en encarte (posiblemente sin permisos):", encarteExitError?.message);
      }

      setShowExitPhotoDialog(false);
      setIsCompleted(true);
      toast.success("¡Tienda completada!");
    } catch (error) {
      console.error("Error completing encarte:", error);
      toast.error("Error al completar el encarte");
    } finally {
      setSaving(false);
    }
  };

  if (showExitPhotoDialog) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <img
                src={logo}
                alt="JL Marketing"
                className="h-16 mx-auto object-contain"
              />
              <h2 className="text-xl font-bold text-primary">
                Foto de Salida Requerida
              </h2>
              <p className="text-sm text-muted-foreground">
                Para completar el encarte, debes capturar una foto de salida del local
              </p>
            </div>

            <div className="space-y-2">
              <Label>Foto de Salida *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoSalida}
                  className="hidden"
                  id="foto-salida"
                />
                <label
                  htmlFor="foto-salida"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Capturar Foto de Salida
                  </span>
                </label>
                {fotoSalida && (
                  <img
                    src={fotoSalida}
                    alt="Preview"
                    className="mt-4 max-w-full h-auto rounded"
                  />
                )}
              </div>
            </div>

            <Button
              onClick={handleCompleteEncarte}
              disabled={!fotoSalida || saving}
              className="w-full"
              size="lg"
            >
              {saving ? "Completando..." : "Completar Encarte"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasStarted && isCompleted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-6">
            <img
              src={logo}
              alt="JL Marketing"
              className="h-20 mx-auto object-contain"
            />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">
                ¡Encarte Completado!
              </h2>
              <p className="text-muted-foreground">
                Se completó satisfactoriamente el encarte
              </p>
            </div>
            <Button
              onClick={handleReset}
              className="w-full"
              size="lg"
            >
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (!hasStarted) {
    return (
      <>
        <AlertDialog open={showContinueDialog} onOpenChange={setShowContinueDialog}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Progreso Guardado</AlertDialogTitle>
              <AlertDialogDescription>
                Se encontró un progreso guardado para este encarte. ¿Deseas continuar donde lo dejaste o comenzar de nuevo?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  await startFresh();
                }}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Comenzar de Nuevo
              </AlertDialogAction>
              <AlertDialogAction onClick={restoreProgress}>Continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
          {/* Offline Ready Indicator */}
          <OfflineReadyIndicator
            studyId={selectedEncarte}
            studyType="encarte"
            isLoading={isPreloading}
            productCount={totalProductCount}
            loadedCount={preloadedCount}
          />

          {/* Sync Progress Indicator */}
          <SyncProgressIndicator
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            syncedCount={syncedCount}
            totalToSync={totalToSync}
            errorCount={errorCount}
          />

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="encarte">Selección de Encarte</Label>
                <Select value={selectedEncarte} onValueChange={(value) => {
                  // Clear store-related state SYNCHRONOUSLY to prevent race condition
                  // where checkProgressForStore fires with old tienda before loadData clears it
                  setNombreTienda("");
                  setSelectedTiendaDistrito("");
                  setShowContinueDialog(false);
                  setSavedProgress(null);
                  setHasStarted(false);
                  setSelectedEncarte(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un encarte" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {encartes.map((encarte) => (
                      <SelectItem key={encarte.id} value={encarte.id}>
                        {encarte.nombre} - {encarte.ciudad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tienda">Tienda</Label>
                <Select
                  value={nombreTienda}
                  onValueChange={(value) => {
                    setNombreTienda(value);
                    const tienda = tiendas.find(t => t.tienda === value);
                    if (tienda) {
                      setSelectedTiendaDistrito(tienda.distrito);
                    }
                    // LIMPIEZA DE MEMORIA: Evitar contaminar con las respuestas de la tienda anterior
                    setRespondedProductIds(new Set());
                    setSkippedProductIds(new Set());
                    setSavedProgress(null);
                    setShowContinueDialog(false);
                    setHasStarted(false);
                    setIsCompleted(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedEncarteData?.bandera ? "Selecciona una tienda" : "Primero selecciona un encarte"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {tiendas.map((tienda) => (
                      <SelectItem key={tienda.id} value={tienda.tienda}>
                        {tienda.tienda} - {tienda.distrito}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Nombre del Supervisor</Label>
                <Input
                  id="supervisor"
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  placeholder="Ingresa el nombre del supervisor"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acompaniamiento"
                  checked={acompaniamientoEncargado}
                  onCheckedChange={(checked) => setAcompaniamientoEncargado(checked as boolean)}
                />
                <Label htmlFor="acompaniamiento" className="cursor-pointer text-sm">
                  Acompañamiento del encargado
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Foto de Ingreso</Label>
                <div className="border-2 border-dashed rounded-lg p-4 md:p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoIngreso}
                    className="hidden"
                    id="foto-ingreso"
                  />
                  <label
                    htmlFor="foto-ingreso"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Camera className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                    <span className="text-xs md:text-sm text-muted-foreground">
                      Capturar Foto Inicial
                    </span>
                  </label>
                  {fotoIngreso && (
                    <img
                      src={fotoIngreso}
                      alt="Preview"
                      className="mt-4 max-w-full h-auto rounded"
                    />
                  )}
                </div>
              </div>

              <Button
                onClick={handleStart}
                disabled={!selectedEncarte || !nombreTienda || !supervisor || !fotoIngreso || saving}
                className="w-full"
                size="lg"
              >
                {saving ? "Iniciando..." : "Iniciar Encuesta"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (loading || isRestoring) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        {isRestoring && <p className="text-sm text-muted-foreground">Restaurando progreso...</p>}
      </div>
    );
  }

  // Skipped Products Review Screen - VERIFICAR PRIMERO antes de mostrar "no hay productos"
  if (showSkippedReview) {
    console.log("🔍 Modo revisión activado:", {
      skippedProductsLength: skippedProducts.length,
      reviewingIndex: reviewingSkippedIndex
    });


    // Si no hay productos para revisar o el índice está fuera de rango, mostrar transición.
    // (El ajuste de estado se maneja en un useEffect para evitar setState durante render)
    if (skippedProducts.length === 0 || reviewingSkippedIndex >= skippedProducts.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Preparando revisión...</p>
        </div>
      );
    }

    const reviewProduct = skippedProducts[reviewingSkippedIndex];

    if (!reviewProduct) {
      console.error("❌ Producto no encontrado en índice:", reviewingSkippedIndex);
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Cargando producto de revisión...</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-4 md:pt-6 pb-4">
            <div className="space-y-4">
              <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Revisión de Productos No Encontrados
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Revisa los productos que marcaste como no encontrados. Puedes llenar los datos si lo encontraste o marcarlo definitivamente como no encontrado.
                </p>
              </div>

              <div className="flex justify-between text-xs md:text-sm text-muted-foreground">
                <span>
                  Producto {reviewingSkippedIndex + 1} de {skippedProducts.length} (no encontrados)
                </span>
              </div>
              <Progress value={((reviewingSkippedIndex + 1) / skippedProducts.length) * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6">
            <div>
              {reviewProduct.categoria && (
                <div className="mb-3">
                  <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {reviewProduct.categoria}
                  </span>
                </div>
              )}
              {reviewProduct.cod_interno && (
                <p className="text-sm text-muted-foreground mb-1">
                  Cód. Producto: <span className="font-medium">{reviewProduct.cod_interno}</span>
                </p>
              )}
              <h3 className="font-semibold text-lg mb-2">
                {reviewProduct.descripcion_producto_carteleria}
              </h3>
              {reviewProduct.precio_promo && (
                <p className="text-muted-foreground">
                  Precio Promo: ${reviewProduct.precio_promo}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio_encontrado">Precio Encontrado</Label>
              <Input
                id="precio_encontrado"
                type="number"
                step="0.01"
                value={formData.precio_encontrado}
                onChange={(e) =>
                  setFormData({ ...formData, precio_encontrado: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            <div className="flex flex-col space-y-3 rounded-md border p-3">
              <Label className="text-sm font-semibold text-foreground/90">
                Presencia del Producto <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.presencia_producto === null ? undefined : formData.presencia_producto ? "si" : "no"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    presencia_producto: value === "si",
                    foto_producto: value === "si" ? formData.foto_producto : null,
                  })
                }
                className="flex space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="si" id="producto-si" />
                  <Label htmlFor="producto-si" className="cursor-pointer">Sí</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="producto-no" />
                  <Label htmlFor="producto-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.presencia_producto === false && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/30 border-red-200">
                <Label htmlFor="motivo_ausencia" className="text-red-600 font-medium">Motivo de Ausencia *</Label>
                <Select
                  value={formData.motivo_ausencia}
                  onValueChange={(value) => setFormData({ ...formData, motivo_ausencia: value })}
                >
                  <SelectTrigger id="motivo_ausencia" className="border-red-200 focus:ring-red-500">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="NO CATALOGADO">NO CATALOGADO</SelectItem>
                    <SelectItem value="NO EXHIBIDO (STOCK EN TRASTIENDA)">NO EXHIBIDO (STOCK EN TRASTIENDA)</SelectItem>
                    <SelectItem value="SIN STOCK EN TIENDA (SIN POCKET)">SIN STOCK EN TIENDA (SIN POCKET)</SelectItem>
                    <SelectItem value="SIN STOCK EN TIENDA (CON POCKET)">SIN STOCK EN TIENDA (CON POCKET)</SelectItem>
                    <SelectItem value="SIN STOCK EN TIENDA (SIN ACOMPAÑAMIENTO)">SIN STOCK EN TIENDA (SIN ACOMPAÑAMIENTO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col space-y-3 rounded-md border p-3">
              <Label className="text-sm font-semibold text-foreground/90">
                Presencia de cartel <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.presencia_cartel === null ? undefined : formData.presencia_cartel ? "si" : "no"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    presencia_cartel: value === "si",
                  })
                }
                className="flex space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="si" id="cartel-si" />
                  <Label htmlFor="cartel-si" className="cursor-pointer">Sí</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="cartel-no" />
                  <Label htmlFor="cartel-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cartel_presenta_precio"
                checked={formData.cartel_presenta_precio}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    cartel_presenta_precio: checked as boolean,
                  })
                }
              />
              <Label htmlFor="cartel_presenta_precio" className="cursor-pointer">
                Presencia de cartel con tarjeta
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio_tarjeta">Precio con tarjeta</Label>
              <Input
                id="precio_tarjeta"
                type="number"
                step="0.01"
                value={formData.precio_tarjeta}
                onChange={(e) =>
                  setFormData({ ...formData, precio_tarjeta: e.target.value })
                }
                placeholder="Ej: 12.50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion_sku">Ubicación del SKU</Label>
              <Input
                id="ubicacion_sku"
                value={formData.ubicacion_sku}
                onChange={(e) =>
                  setFormData({ ...formData, ubicacion_sku: e.target.value })
                }
                placeholder="Ej: Pasillo 3, Estante B"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacion_1">Observación 1 (máx. 50 caracteres)</Label>
              <Textarea
                id="observacion_1"
                value={formData.observacion_1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    observacion_1: e.target.value.substring(0, 50),
                  })
                }
                placeholder="Observaciones adicionales..."
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.observacion_1.length}/50
              </p>
            </div>

            <div className="space-y-2">
              <Label>Foto del Producto</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoProducto}
                  className="hidden"
                  id="foto-producto-review"
                />
                <label
                  htmlFor="foto-producto-review"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Capturar Foto
                  </span>
                </label>
                {formData.foto_producto && (
                  <img
                    src={formData.foto_producto}
                    alt="Preview"
                    className="mt-4 max-w-full h-auto rounded"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.foto_producto}
                className="w-full"
                size="lg"
              >
                {saving ? "Guardando..." : "Guardar Producto"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Verificar si no hay productos en el filtro actual
  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Actualizando lista de productos...</p>
      </div>
    );
  }

  // Validación de seguridad: si el índice queda fuera de rango, mostrar transición y dejar que el effect lo corrija
  if (currentIndex >= productos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Cargando el producto...</p>
      </div>
    );
  }

  const currentProduct = productos[currentIndex];

  if (!currentProduct) {
    console.error("❌ Producto actual no existe");
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Error: Producto no encontrado</p>
        <Button onClick={() => setCurrentIndex(0)} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  const totalProducts = allProductos.length;
  const completedProducts = respondedProductIds.size;
  const progress = totalProducts > 0 ? (completedProducts / totalProducts) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-4 md:pt-6 pb-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="macrocategoria">Filtrar por Macrocategoría</Label>
                <Select
                  value={selectedMacrocategoria}
                  onValueChange={setSelectedMacrocategoria}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="todas">Todas</SelectItem>
                    {macrocategorias.map((macro) => (
                      <SelectItem key={macro} value={macro}>
                        {macro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="microcategoria">Filtrar por Categoría</Label>
                <Select
                  value={selectedMicrocategoria}
                  onValueChange={setSelectedMicrocategoria}
                  disabled={selectedMacrocategoria === "todas"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedMacrocategoria === "todas" ? "Primero selecciona macrocategoría" : "Todas"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="todas">Todas</SelectItem>
                    {microcategorias.map((micro) => (
                      <SelectItem key={micro} value={micro}>
                        {micro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between text-xs md:text-sm text-muted-foreground">
              <span>
                Producto {currentIndex + 1} de {productos.length} (filtrados)
              </span>
              <span>
                Total: {completedProducts}/{totalProducts} ({Math.round(progress)}%)
              </span>
            </div>
            <Progress value={progress} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6">
          <div>
            {currentProduct.categoria && (
              <div className="mb-3">
                <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {currentProduct.categoria}
                </span>
              </div>
            )}
            {currentProduct.cod_interno && (
              <p className="text-sm text-muted-foreground mb-1">
                Cód. Producto: <span className="font-medium">{currentProduct.cod_interno}</span>
              </p>
            )}
            <h3 className="font-semibold text-lg mb-2">
              {currentProduct.descripcion_producto_carteleria}
            </h3>
            {currentProduct.precio_promo && (
              <p className="text-muted-foreground">
                Precio Promo: ${currentProduct.precio_promo}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="precio_encontrado">Precio Encontrado *</Label>
            <Input
              id="precio_encontrado"
              type="number"
              step="0.01"
              value={formData.precio_encontrado}
              onChange={(e) =>
                setFormData({ ...formData, precio_encontrado: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col space-y-3 rounded-md border p-3">
            <Label className="text-sm font-semibold text-foreground/90">
              Presencia del Producto <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={formData.presencia_producto === null ? undefined : formData.presencia_producto ? "si" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  presencia_producto: value === "si",
                  foto_producto: value === "si" ? formData.foto_producto : null,
                })
              }
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="si" id="producto-si-main" />
                <Label htmlFor="producto-si-main" className="cursor-pointer">Sí</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="producto-no-main" />
                <Label htmlFor="producto-no-main" className="cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {formData.presencia_producto === false && (
            <div className="space-y-2 rounded-md border p-3 bg-muted/30 border-red-200">
              <Label htmlFor="motivo_ausencia_main" className="text-red-600 font-medium">Motivo de Ausencia *</Label>
              <Select
                value={formData.motivo_ausencia}
                onValueChange={(value) => setFormData({ ...formData, motivo_ausencia: value })}
              >
                <SelectTrigger id="motivo_ausencia_main" className="border-red-200 focus:ring-red-500">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="NO CATALOGADO">NO CATALOGADO</SelectItem>
                  <SelectItem value="NO EXHIBIDO (STOCK EN TRASTIENDA)">NO EXHIBIDO (STOCK EN TRASTIENDA)</SelectItem>
                  <SelectItem value="SIN STOCK EN TIENDA (SIN POCKET)">SIN STOCK EN TIENDA (SIN POCKET)</SelectItem>
                  <SelectItem value="SIN STOCK EN TIENDA (CON POCKET)">SIN STOCK EN TIENDA (CON POCKET)</SelectItem>
                  <SelectItem value="SIN STOCK EN TIENDA (SIN ACOMPAÑAMIENTO)">SIN STOCK EN TIENDA (SIN ACOMPAÑAMIENTO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col space-y-3 rounded-md border p-3">
            <Label className="text-sm font-semibold text-foreground/90">
              Presencia de cartel <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={formData.presencia_cartel === null ? undefined : formData.presencia_cartel ? "si" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  presencia_cartel: value === "si",
                })
              }
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="si" id="cartel-si-main" />
                <Label htmlFor="cartel-si-main" className="cursor-pointer">Sí</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="cartel-no-main" />
                <Label htmlFor="cartel-no-main" className="cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cartel_presenta_precio"
              checked={formData.cartel_presenta_precio}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  cartel_presenta_precio: checked as boolean,
                })
              }
            />
            <Label htmlFor="cartel_presenta_precio" className="cursor-pointer">
              Presencia de cartel con tarjeta
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="precio_tarjeta_main">Precio con tarjeta</Label>
            <Input
              id="precio_tarjeta_main"
              type="number"
              step="0.01"
              value={formData.precio_tarjeta}
              onChange={(e) =>
                setFormData({ ...formData, precio_tarjeta: e.target.value })
              }
              placeholder="Ej: 12.50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ubicacion_sku">Ubicación del SKU</Label>
            <Input
              id="ubicacion_sku"
              value={formData.ubicacion_sku}
              onChange={(e) =>
                setFormData({ ...formData, ubicacion_sku: e.target.value })
              }
              placeholder="Ej: Pasillo 3, Estante B"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacion_1">Observación 1 (máx. 50 caracteres)</Label>
            <Textarea
              id="observacion_1"
              value={formData.observacion_1}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  observacion_1: e.target.value.substring(0, 50),
                })
              }
              placeholder="Observaciones adicionales..."
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.observacion_1.length}/50
            </p>
          </div>

          <div className="space-y-2">
            <Label>Foto del Producto *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoProducto}
                className="hidden"
                id="foto-producto"
              />
              <label
                htmlFor="foto-producto"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Capturar Foto
                </span>
              </label>
              {formData.foto_producto && (
                <img
                  src={formData.foto_producto}
                  alt="Preview"
                  className="mt-4 max-w-full h-auto rounded"
                />
              )}
            </div>
          </div>


          <Button
            onClick={handleSkipProduct}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Producto No Encontrado - Pasar al Siguiente
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !formData.foto_producto}
            className="w-full"
            size="lg"
          >
            {saving
              ? "Guardando..."
              : currentIndex < productos.length - 1
                ? "Guardar y Continuar"
                : "Guardar y Finalizar"}
          </Button>
        </CardContent>
      </Card>

      {/* Network Status Portal */}
      {typeof document !== 'undefined' && document.getElementById("network-status-container") &&
        createPortal(
          <NetworkStatus
            isOnline={isOnline}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
            onSyncClick={onSyncRequest}
          />,
          document.getElementById("network-status-container")!
        )
      }
    </div>
  );
};
