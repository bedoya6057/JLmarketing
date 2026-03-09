import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Camera, SkipForward } from "lucide-react";
import { compressImageFile, base64ToBlob } from "@/lib/imageCompression";
import { useOfflineSyncExhibicion } from "@/hooks/useOfflineSyncExhibicion";
import { offlineStorage } from "@/lib/offlineStorage";
import { NetworkStatus } from "@/components/NetworkStatus";
import { OfflineReadyIndicator } from "@/components/OfflineReadyIndicator";
import { SyncProgressIndicator } from "@/components/SyncProgressIndicator";
import { debounce, withRetry } from "@/lib/retryLogic";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";
import { generatePhotoFileName, generateIngresoPhotoFileName } from "@/lib/fileNaming";
import { uploadPhotoToS3 } from "@/lib/s3Upload";

interface Exhibicion {
  id: string;
  nombre: string;
  tienda: string;
  ciudad: string;
  bandera: string;
}

interface ProductoExhibicion {
  id: string;
  cod_producto: string;
  descripcion_producto: string;
  seccion: string;
  linea: string;
  tipo_exhibicion: string;
  codigo_exhibicion: string;
  tienda: string | null;
  macrocategoria: string | null;
  microcategoria: string | null;
  marca: string | null;
}

interface EncuestadorExhibicionFormProps {
  isOnline: boolean;
  syncTrigger: number;
  onSyncRequest: () => void;
  saveProgressRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSyncStatusChange?: (status: { isSyncing: boolean; pendingCount: number; syncedCount: number; totalToSync: number }) => void;
  onActivityChange?: (activity: { studyName?: string; tienda?: string; currentProductIndex?: number; totalProducts?: number; progress?: number }) => void;
}

export const EncuestadorExhibicionForm = ({ isOnline, syncTrigger, onSyncRequest, saveProgressRef, onSyncStatusChange, onActivityChange }: EncuestadorExhibicionFormProps) => {
  const [exhibiciones, setExhibiciones] = useState<Exhibicion[]>([]);
  const [selectedExhibicionId, setSelectedExhibicionId] = useState("");
  const [selectedExhibicionData, setSelectedExhibicionData] = useState<Exhibicion | null>(null);
  const [tiendasDisponibles, setTiendasDisponibles] = useState<string[]>([]);
  const [selectedTienda, setSelectedTienda] = useState("");
  const [productos, setProductos] = useState<ProductoExhibicion[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<ProductoExhibicion[]>([]);
  const [allProductos, setAllProductos] = useState<ProductoExhibicion[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [supervisor, setSupervisor] = useState("");
  const [acompaniamientoEncargado, setAcompaniamientoEncargado] = useState(false);
  const [fotoIngreso, setFotoIngreso] = useState<string | null>(null);
  const [fotoIngresoUrl, setFotoIngresoUrl] = useState<string | null>(null);
  const [presenciaExhibicion, setPresenciaExhibicion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");

  // Filters
  const [macrocategorias, setMacrocategorias] = useState<string[]>([]);
  const [microcategorias, setMicrocategorias] = useState<string[]>([]);
  const [selectedMacrocategoria, setSelectedMacrocategoria] = useState("todas");
  const [selectedMicrocategoria, setSelectedMicrocategoria] = useState("todas");

  // Progress tracking
  const [respondedProductIds, setRespondedProductIds] = useState<Set<string>>(new Set());
  const [skippedProductIds, setSkippedProductIds] = useState<Set<string>>(new Set());
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);
  const [showSkippedReview, setShowSkippedReview] = useState(false);
  const [skippedProducts, setSkippedProducts] = useState<ProductoExhibicion[]>([]);
  const [reviewingSkippedIndex, setReviewingSkippedIndex] = useState(0);
  const [startedFresh, setStartedFresh] = useState(false);

  // Offline sync
  const { isSyncing, pendingCount, syncedCount, totalToSync, errorCount, syncData, checkPendingCount } = useOfflineSyncExhibicion(
    selectedExhibicionId,
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
    if (onActivityChange && hasStarted && selectedExhibicionData && selectedTienda) {
      const totalProducts = productos.length;
      const answeredCount = respondedProductIds.size;
      const progress = totalProducts > 0 ? Math.round((answeredCount / totalProducts) * 100) : 0;

      onActivityChange({
        studyName: selectedExhibicionData.nombre,
        tienda: selectedTienda,
        currentProductIndex: currentProductoIndex + 1,
        totalProducts,
        progress
      });
    }
  }, [onActivityChange, hasStarted, selectedExhibicionData, selectedTienda, currentProductoIndex, productos.length, respondedProductIds.size]);

  useEffect(() => {
    const initUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    initUser();
    loadExhibiciones();
  }, []);

  useEffect(() => {
    if (syncTrigger > 0) {
      syncData();
    }
  }, [syncTrigger, syncData]);

  useEffect(() => {
    if (selectedExhibicionId) {
      setIsCompleted(false);
      setHasStarted(false);
      setShowContinueDialog(false);
      setSavedProgress(null);
      setSelectedMacrocategoria("todas");
      setSelectedMicrocategoria("todas");
      setRespondedProductIds(new Set());
      setSkippedProductIds(new Set());
      setFilteredProductos([]);
      setCurrentProductoIndex(0);
      setSelectedTienda("");
      setStartedFresh(false); // Reset flag when changing exhibicion
      checkSavedProgress();
      loadExhibicionData();
      loadProductos();
    }
  }, [selectedExhibicionId]);

  const checkProgressForStore = useCallback(
    async (tienda: string) => {
      try {
        if (!isOnline) return;
        if (!selectedExhibicionId) return;
        if (!tienda) return;

        const { data: { session } } = await supabase.auth.getSession();
        const uid = userId || session?.user?.id;
        if (!uid) return;

        // 1) Prefer the explicit progress record for THIS store
        const { data: progressRow, error: progressError } = await supabase
          .from("progreso_encuestador_exhibicion")
          .select("*")
          .eq("user_id", uid)
          .eq("exhibicion_id", selectedExhibicionId)
          .eq("tienda", tienda)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (progressError) throw progressError;

        if (progressRow) {
          setSavedProgress(progressRow);
          setShowContinueDialog(true);
          return;
        }

        // 2) If there is NO progress record, but there ARE responses in DB, still offer “Continuar”.
        // This covers cases where the progress row was deleted/corrupted but answers exist.
        const { count: respuestasCount, error: respuestasError } = await supabase
          .from("respuestas_exhibicion")
          .select("id", { count: "exact", head: true })
          .eq("exhibicion_id", selectedExhibicionId)
          .eq("created_by", uid)
          .eq("tienda", tienda);

        if (respuestasError) throw respuestasError;

        if ((respuestasCount ?? 0) > 0) {
          console.log(`✅ Se detectaron ${respuestasCount} respuestas en BD para ${tienda} sin progreso; ofreciendo Continuar.`);
          setSavedProgress({
            user_id: uid,
            exhibicion_id: selectedExhibicionId,
            tienda,
            // Defaults used by restoreProgress
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
      } catch (error) {
        console.error("Error checking progress for store:", error);
      }
    },
    [isOnline, selectedExhibicionId, userId]
  );

  // Trigger “Continuar” prompt when the user selects a store.
  useEffect(() => {
    if (!selectedExhibicionId) return;
    if (!selectedTienda) return;
    if (hasStarted) return;
    if (showContinueDialog) return;
    void checkProgressForStore(selectedTienda);
  }, [selectedExhibicionId, selectedTienda, hasStarted, showContinueDialog, checkProgressForStore]);

  // Load tiendas from tiendas table (with RLS) filtered by productos in exhibicion
  useEffect(() => {
    const loadTiendasAsignadas = async () => {
      if (productos.length === 0) return;

      // Get tiendas that have productos in this exhibicion
      const tiendasConProductos = [...new Set(productos.map(p => p.tienda).filter(Boolean))];
      const tiendasConProductosLower = tiendasConProductos.map(t => t.toLowerCase());
      console.log(`📦 Tiendas con productos:`, tiendasConProductos.length, JSON.stringify(tiendasConProductos.slice(0, 10)));

      // Get ALL tiendas from the tiendas table (RLS filters by responsable/admin)
      const { data: tiendasData, error } = await supabase
        .from("tiendas")
        .select("tienda")
        .order("tienda");

      if (error) {
        console.error("Error loading tiendas:", error);
        return;
      }

      // Get unique tiendas that the user has access to
      const tiendasUsuario = [...new Set(tiendasData?.map(t => t.tienda) || [])];
      console.log(`📋 Tiendas del usuario (RLS):`, tiendasUsuario.length, JSON.stringify(tiendasUsuario.slice(0, 10)));

      // Debug: Check for matches (case-insensitive)
      console.log(`🔍 Buscando coincidencias...`);
      tiendasUsuario.forEach(tu => {
        const found = tiendasConProductosLower.includes(tu.toLowerCase());
        if (found) {
          console.log(`   - "${tu}" encontrada en productos: SÍ`);
        }
      });

      // Intersect: only tiendas the user has access to AND have productos (case-insensitive)
      // Return the product's tienda name (for correct filtering later)
      const tiendasFiltradas = tiendasUsuario
        .map(tu => {
          const match = tiendasConProductos.find(tp => tp.toLowerCase() === tu.toLowerCase());
          return match || null;
        })
        .filter(Boolean)
        .sort() as string[];

      setTiendasDisponibles(tiendasFiltradas);
      console.log(`✅ Tiendas asignadas con productos:`, tiendasFiltradas.length);
    };

    loadTiendasAsignadas();
  }, [productos]);

  // Filter products when tienda or category changes
  useEffect(() => {
    if (productos.length > 0 && hasStarted) {
      // First get all products for the store without category filters
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);

      // Get remaining products (not responded/skipped) for the store
      const remainingInStore = tiendaProducts.filter(p => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id));

      // Apply current filters
      let filtered = tiendaProducts;
      if (selectedMacrocategoria !== "todas") {
        filtered = filtered.filter(p => p.macrocategoria === selectedMacrocategoria);
      }
      if (selectedMicrocategoria !== "todas") {
        filtered = filtered.filter(p => p.microcategoria === selectedMicrocategoria);
      }
      filtered = filtered.filter(p => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id));

      // If current microcategoria is complete (no products left with current filters)
      if (filtered.length === 0 && selectedMicrocategoria !== "todas") {
        // Only reset microcategoria, keep macrocategoria selected
        setSelectedMicrocategoria("todas");

        // Check if there are remaining products in the same macrocategoria
        const remainingInMacro = remainingInStore.filter(p =>
          selectedMacrocategoria === "todas" || p.macrocategoria === selectedMacrocategoria
        );

        if (remainingInMacro.length > 0) {
          toast.info("Microcategoría completada, mostrando productos restantes de la macrocategoría");
          setFilteredProductos(remainingInMacro);
        } else if (remainingInStore.length > 0) {
          // No more products in macrocategoria, reset to todas
          setSelectedMacrocategoria("todas");
          toast.info("Macrocategoría completada, mostrando productos restantes");
          setFilteredProductos(remainingInStore);
        } else {
          setFilteredProductos([]);
          checkCompletion();
        }
        setCurrentProductoIndex(0);
      } else if (filtered.length === 0 && selectedMacrocategoria !== "todas") {
        // Macrocategoria complete but no microcategoria filter
        setSelectedMacrocategoria("todas");

        if (remainingInStore.length > 0) {
          toast.info("Macrocategoría completada, mostrando productos restantes");
          setFilteredProductos(remainingInStore);
        } else {
          setFilteredProductos([]);
          checkCompletion();
        }
        setCurrentProductoIndex(0);
      } else {
        setFilteredProductos(filtered);
        setCurrentProductoIndex(0);

        if (filtered.length === 0 && respondedProductIds.size > 0) {
          checkCompletion();
        }
      }
    }
  }, [selectedTienda, productos, selectedMacrocategoria, selectedMicrocategoria, respondedProductIds, skippedProductIds, hasStarted]);

  // Extract categories when productos change - only show categories with remaining products
  useEffect(() => {
    if (productos.length > 0 && selectedTienda) {
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
      // Only include macrocategorias that have products not yet responded/skipped
      const remainingProducts = tiendaProducts.filter(p => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id));
      const macros = [...new Set(remainingProducts.map(p => p.macrocategoria).filter(Boolean))] as string[];
      setMacrocategorias(macros.sort());
    }
  }, [productos, selectedTienda, respondedProductIds, skippedProductIds]);

  // Update microcategorias when macrocategoria changes - only show categories with remaining products
  useEffect(() => {
    if (productos.length > 0 && selectedTienda) {
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
      // Only include products not yet responded/skipped
      const remainingProducts = tiendaProducts.filter(p => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id));

      let microProducts = remainingProducts;
      if (selectedMacrocategoria !== "todas") {
        microProducts = remainingProducts.filter(p => p.macrocategoria === selectedMacrocategoria);
      }
      const micros = [...new Set(microProducts.map(p => p.microcategoria).filter(Boolean))] as string[];
      setMicrocategorias(micros.sort());

      // Reset microcategoria when macrocategoria changes
      setSelectedMicrocategoria("todas");
    }
  }, [productos, selectedTienda, selectedMacrocategoria, respondedProductIds, skippedProductIds]);

  // Estado para indicar que está procesando filtros
  const [isProcessingFilters, setIsProcessingFilters] = useState(false);

  // Efecto de seguridad para evitar pantalla en blanco
  useEffect(() => {
    if (!hasStarted || isCompleted || showSkippedReview) return;

    // Marcar como procesando
    setIsProcessingFilters(true);

    // Verificar que el índice esté dentro del rango
    if (filteredProductos.length > 0 && currentProductoIndex >= filteredProductos.length) {
      setCurrentProductoIndex(0);
      setIsProcessingFilters(false);
      return;
    }

    // Si no hay productos filtrados pero hay productos de la tienda
    if (filteredProductos.length === 0 && selectedTienda && productos.length > 0) {
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
      const remainingProducts = tiendaProducts.filter(p =>
        !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id)
      );

      if (remainingProducts.length === 0) {
        // No quedan productos - verificar si hay omitidos para revisar
        if (skippedProductIds.size > 0) {
          const skipped = tiendaProducts.filter(p => skippedProductIds.has(p.id));
          if (skipped.length > 0) {
            setSkippedProducts(skipped);
            setReviewingSkippedIndex(0);
            setShowSkippedReview(true);
            setIsProcessingFilters(false);
            return;
          }
        }
        // Sin productos pendientes ni omitidos - completado
        setIsCompleted(true);
      } else if (selectedMacrocategoria !== "todas" || selectedMicrocategoria !== "todas") {
        // Hay productos pero no en el filtro actual - resetear filtros
        console.log("🔄 Reseteando filtros - hay productos restantes:", remainingProducts.length);
        setSelectedMacrocategoria("todas");
        setSelectedMicrocategoria("todas");
        setCurrentProductoIndex(0);
        // Forzar actualización de productos filtrados
        setFilteredProductos(remainingProducts);
      } else {
        // Filtros en "todas" pero no hay productos filtrados - forzar recarga
        console.log("⚠️ Sin productos filtrados con filtros en 'todas' - forzando recarga");
        setFilteredProductos(remainingProducts);
        setCurrentProductoIndex(0);
      }
    }

    setIsProcessingFilters(false);
  }, [
    hasStarted,
    isCompleted,
    showSkippedReview,
    filteredProductos.length,
    currentProductoIndex,
    selectedTienda,
    productos,
    respondedProductIds,
    skippedProductIds,
    selectedMacrocategoria,
    selectedMicrocategoria
  ]);

  // Timeout de seguridad para evitar pantalla en blanco infinita
  useEffect(() => {
    // Verificar si hay producto actual basado en las condiciones
    const hasCurrentProduct = showSkippedReview
      ? skippedProducts[reviewingSkippedIndex] !== undefined
      : filteredProductos[currentProductoIndex] !== undefined;

    if (!hasStarted || isCompleted || showSkippedReview || hasCurrentProduct) return;

    const timeout = setTimeout(() => {
      console.log("⏰ Timeout de seguridad activado");
      // Si después de 5 segundos no hay producto, intentar recuperar
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
      const remainingProducts = tiendaProducts.filter(p =>
        !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id)
      );

      if (remainingProducts.length > 0) {
        console.log("🔧 Recuperando productos:", remainingProducts.length);
        setSelectedMacrocategoria("todas");
        setSelectedMicrocategoria("todas");
        setFilteredProductos(remainingProducts);
        setCurrentProductoIndex(0);
      } else if (skippedProductIds.size > 0) {
        const skipped = tiendaProducts.filter(p => skippedProductIds.has(p.id));
        if (skipped.length > 0) {
          setSkippedProducts(skipped);
          setReviewingSkippedIndex(0);
          setShowSkippedReview(true);
        }
      } else if (respondedProductIds.size > 0 || tiendaProducts.length === 0) {
        setIsCompleted(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [hasStarted, isCompleted, showSkippedReview, filteredProductos, currentProductoIndex, skippedProducts, reviewingSkippedIndex, productos, selectedTienda, respondedProductIds, skippedProductIds]);

  const loadExhibiciones = async () => {
    const { data, error } = await supabase
      .from("exhibiciones")
      .select("*")
      // Excluir estudios finalizados para encuestadores
      .neq("estado", "completado")
      .neq("estado", "concluido")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading exhibiciones:", error);
      return;
    }

    setExhibiciones(data || []);
  };

  const loadExhibicionData = async () => {
    const { data } = await supabase
      .from("exhibiciones")
      .select("*")
      .eq("id", selectedExhibicionId)
      .single();

    if (data) {
      setSelectedExhibicionData(data);
    }
  };

  const loadProductos = async () => {
    // Try to load from cache first if offline
    if (!isOnline) {
      const cachedProducts = await offlineStorage.getCachedProductosExhibicion(selectedExhibicionId);
      if (cachedProducts && cachedProducts.length > 0) {
        console.log(`📦 ${cachedProducts.length} productos cargados desde caché offline`);
        setProductos(cachedProducts);
        setAllProductos(cachedProducts);
        setCurrentProductoIndex(0);
        toast.info(`${cachedProducts.length} productos cargados desde caché`);
        return;
      } else {
        toast.error("Sin conexión y sin productos en caché. Necesitas conexión para cargar los productos.");
        return;
      }
    }

    // Get count first
    const { count: totalCount, error: countError } = await supabase
      .from("productos_exhibicion")
      .select("id", { count: 'exact', head: true })
      .eq("exhibicion_id", selectedExhibicionId);

    if (countError || !totalCount) {
      console.error("Error getting count:", countError);
      // Try cache as fallback
      const cachedProducts = await offlineStorage.getCachedProductosExhibicion(selectedExhibicionId);
      if (cachedProducts && cachedProducts.length > 0) {
        console.log(`📦 Fallback: ${cachedProducts.length} productos desde caché`);
        setProductos(cachedProducts);
        setAllProductos(cachedProducts);
        setCurrentProductoIndex(0);
        toast.warning("Error de conexión. Usando productos en caché.");
        return;
      }
      return;
    }

    // Fetch all products in PARALLEL batches of 1000
    const pageSize = 1000;
    const totalPages = Math.ceil(totalCount / pageSize);

    const fetchPromises = Array.from({ length: totalPages }, (_, page) => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      return supabase
        .from("productos_exhibicion")
        .select("id, exhibicion_id, cod_producto, descripcion_producto, tienda, seccion, linea, tipo_exhibicion, codigo_exhibicion, macrocategoria, microcategoria, marca, estado_producto, vigencia, suma_tiendas")
        .eq("exhibicion_id", selectedExhibicionId)
        .range(from, to);
    });

    const results = await Promise.all(fetchPromises);
    const allData = results.flatMap(r => r.data || []) as ProductoExhibicion[];

    console.log(`✅ ${allData.length} productos cargados`);

    // Cache products for offline use
    await offlineStorage.cacheProductosExhibicion(selectedExhibicionId, allData);
    console.log(`💾 ${allData.length} productos guardados en caché offline`);

    setProductos(allData);
    setAllProductos(allData);
    setCurrentProductoIndex(0);
  };

  const checkSavedProgress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // First check offline storage for any pending progress
      const offlineProgress = await offlineStorage.getPendingProgresoExhibicion(selectedExhibicionId, session.user.id);

      if (offlineProgress && offlineProgress.data) {
        console.log("📱 Progreso encontrado en almacenamiento offline");
        setSavedProgress(offlineProgress.data);
        setShowContinueDialog(true);
        return;
      }

      // Then check database if online - get the LATEST progress (by tienda)
      if (isOnline) {
        const { data, error } = await supabase
          .from("progreso_encuestador_exhibicion")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("exhibicion_id", selectedExhibicionId)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSavedProgress(data);
          setShowContinueDialog(true);
        }
      }
    } catch (error) {
      console.error("Error checking saved progress:", error);
    }
  };

  const loadRespondedProducts = async (tienda?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // CRITICAL: Filter by tienda to only load products responded for THIS specific store
      const storeToFilter = tienda || selectedTienda;
      if (!storeToFilter) {
        console.warn("⚠️ No tienda specified for loading responded products");
        return;
      }

      console.log(`📥 Cargando productos respondidos para tienda: ${storeToFilter}`);

      const { data, error } = await supabase
        .from("respuestas_exhibicion")
        .select("producto_id")
        .eq("exhibicion_id", selectedExhibicionId)
        .eq("created_by", session.user.id)
        .eq("tienda", storeToFilter);

      if (error) throw error;

      if (data && data.length > 0) {
        const productIds = data.map(r => r.producto_id).filter(id => id !== null);
        console.log(`✅ ${productIds.length} productos ya respondidos en ${storeToFilter}`);
        setRespondedProductIds(new Set(productIds as string[]));
      } else {
        console.log(`ℹ️ Sin productos respondidos aún en ${storeToFilter}`);
        setRespondedProductIds(new Set());
      }
    } catch (error) {
      console.error("Error loading responded products:", error);
    }
  };

  const restoreProgress = async () => {
    if (!savedProgress) return;

    try {
      console.log("🔄 Restaurando progreso de exhibición:", savedProgress);

      const restoredTienda = savedProgress.tienda || "";
      const wasFreshStart = savedProgress.started_fresh === true;

      // 1. Set tienda FIRST so other operations use it
      setSelectedTienda(restoredTienda);

      // 2. Restore skipped products (these are per-session)
      if (savedProgress.skipped_product_ids) {
        setSkippedProductIds(new Set(savedProgress.skipped_product_ids));
      }

      // 3. Load responded products from DB filtered by THIS store
      // CRITICAL: ALWAYS load from DB to get accurate state - this prevents false "completado"
      // The responded_product_ids in progress may be stale or incomplete
      if (restoredTienda) {
        console.log(`📥 Cargando productos respondidos desde DB para tienda: ${restoredTienda} (started_fresh: ${wasFreshStart})`);
        await loadRespondedProducts(restoredTienda);
      } else {
        console.log("⚠️ No hay tienda guardada - respondedProductIds vacío");
        setRespondedProductIds(new Set());
      }

      // 4. Restaurar datos de formulario
      setSupervisor(savedProgress.supervisor || "");
      setAcompaniamientoEncargado(savedProgress.acompaniamiento_encargado || false);
      setFotoIngresoUrl(savedProgress.foto_ingreso_url);

      // 5. Wait for products to be filtered by tienda
      await new Promise(resolve => setTimeout(resolve, 300));

      // 6. Restaurar filtros
      setSelectedMacrocategoria(savedProgress.selected_macrocategoria || "todas");
      setSelectedMicrocategoria(savedProgress.selected_microcategoria || "todas");

      // 7. Restaurar índice - use 0 to start at first remaining product
      // The previous index may be invalid after loading fresh responded products
      setCurrentProductoIndex(0);

      // 8. Cerrar diálogo y activar
      setShowContinueDialog(false);
      setHasStarted(true);
      setStartedFresh(wasFreshStart);

      console.log("✅ Progreso restaurado para tienda:", restoredTienda);
      toast.success("Progreso restaurado");
    } catch (error) {
      console.error("Error restoring progress:", error);
      toast.error("Error al restaurar el progreso");
    }
  };

  const startFresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete saved progress from database (navigation state only)
      await supabase
        .from("progreso_encuestador_exhibicion")
        .delete()
        .eq("user_id", session.user.id)
        .eq("exhibicion_id", selectedExhibicionId);

      // Delete offline progress as well
      try {
        const offlineId = `${session.user.id}_${selectedExhibicionId}`;
        await offlineStorage.deleteProgresoExhibicion(offlineId);
      } catch (e) {
        console.warn("No se pudo eliminar progreso offline:", e);
      }

      // Reset ALL navigation and progress state for fresh start
      setSavedProgress(null);
      setShowContinueDialog(false);
      setHasStarted(false);
      setCurrentProductoIndex(0);
      setSelectedMacrocategoria("todas");
      setSelectedMicrocategoria("todas");
      // Reset respondedProductIds to allow re-surveying (DB keeps records, upsert will update)
      setRespondedProductIds(new Set());
      setSkippedProductIds(new Set());
      // Preserve store selection - don't reset selectedTienda
      // setSelectedTienda(""); // KEEP the selected store
      setSupervisor("");
      setAcompaniamientoEncargado(false);
      setFotoIngreso(null);
      setFotoIngresoUrl(null);
      setPresenciaExhibicion("");
      setUbicacion("");
      setObservaciones("");
      setFoto(null);
      setFotoUrl(null);
      setIsCompleted(false);
      setShowSkippedReview(false);
      setSkippedProducts([]);
      setReviewingSkippedIndex(0);
      setFilteredProductos([]);
      setStartedFresh(true); // Mark that user chose to start fresh

      eventLogger.log(EventType.INFO, 'Usuario eligió comenzar desde cero (exhibición)', {
        context: {
          exhibicionId: selectedExhibicionId,
          userId: session.user.id
        }
      });

      toast.success("Reiniciando desde cero - verás todos los productos nuevamente");
    } catch (error) {
      console.error("Error deleting progress:", error);
      toast.error("Error al reiniciar el progreso");
    }
  };

  const saveProgress = useCallback(async () => {
    if (!selectedExhibicionId || !userId || !hasStarted) return;

    try {
      const progressData = {
        user_id: userId,
        exhibicion_id: selectedExhibicionId,
        tienda: selectedTienda,
        supervisor: supervisor,
        acompaniamiento_encargado: acompaniamientoEncargado,
        foto_ingreso_url: fotoIngresoUrl,
        current_index: currentProductoIndex,
        has_started: hasStarted,
        selected_macrocategoria: selectedMacrocategoria,
        selected_microcategoria: selectedMicrocategoria,
        responded_product_ids: Array.from(respondedProductIds),
        skipped_product_ids: Array.from(skippedProductIds),
        started_fresh: startedFresh, // Persist fresh start flag
      };

      if (isOnline) {
        try {
          // Manual select+update/insert to avoid 42P10 upsert cache issues
          const { data: existingProg } = await supabase
            .from("progreso_encuestador_exhibicion")
            .select("id")
            .eq("user_id", progressData.user_id)
            .eq("exhibicion_id", progressData.exhibicion_id)
            .eq("tienda", progressData.tienda)
            .maybeSingle();

          if (existingProg) {
            const { error } = await supabase
              .from("progreso_encuestador_exhibicion")
              .update(progressData)
              .eq("id", existingProg.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("progreso_encuestador_exhibicion")
              .insert(progressData);
            if (error) throw error;
          }
        } catch (error: any) {
          // NO guardar offline cuando estamos online - solo loguear el error
          console.error("Error saving progress online:", error);
          eventLogger.log(EventType.SAVE_ERROR, `Error al guardar progreso exhibición online: ${error?.message}`, {
            severity: EventSeverity.ERROR,
            context: {
              exhibicionId: selectedExhibicionId,
              userId,
              errorCode: error?.code
            },
            error
          });
          // No mostrar toast para progreso (es silencioso)
        }
      } else {
        // Solo guardar offline cuando NO hay conexión
        await offlineStorage.saveProgresoExhibicion(selectedExhibicionId, userId, progressData);
      }
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  }, [selectedExhibicionId, userId, selectedTienda, supervisor, acompaniamientoEncargado, fotoIngresoUrl, currentProductoIndex, hasStarted, selectedMacrocategoria, selectedMicrocategoria, respondedProductIds, skippedProductIds, isOnline, startedFresh]);

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

  const debouncedSaveProgress = useCallback(debounce(() => saveProgress(), 2000), [saveProgress]);

  useEffect(() => {
    if (hasStarted) {
      debouncedSaveProgress();
    }
  }, [respondedProductIds, skippedProductIds, currentProductoIndex, hasStarted]);

  const handleStartStudy = () => {
    if (!selectedTienda) {
      toast.error("Selecciona una tienda primero");
      return;
    }
    setHasStarted(true);
    // Only load responded products if user didn't choose "Comenzar de nuevo"
    if (!startedFresh) {
      loadRespondedProducts(selectedTienda);
    }
  };

  const checkCompletion = async () => {
    const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);

    // SAFEGUARD: Don't mark as complete if no products were loaded for this store
    if (tiendaProducts.length === 0) {
      console.warn("⚠️ No products loaded for this store - cannot verify completion");
      toast.error("No se pudieron cargar los productos de esta tienda. Verifica tu conexión.");
      return;
    }

    const remaining = tiendaProducts.filter(p => !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id));

    // SAFEGUARD: Must have at least 1 responded product to consider completion
    if (remaining.length === 0 && respondedProductIds.size === 0 && skippedProductIds.size === 0) {
      console.warn("⚠️ No responses recorded - possible data loading issue");
      return;
    }

    // CRITICAL SAFEGUARD: Verify respondedProductIds matches DB count before showing completion
    // This prevents false completion when local state is stale
    if (remaining.length === 0 && isOnline) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: dbResponses, error } = await supabase
            .from("respuestas_exhibicion")
            .select("producto_id")
            .eq("exhibicion_id", selectedExhibicionId)
            .eq("created_by", session.user.id)
            .eq("tienda", selectedTienda);

          if (!error && dbResponses) {
            const dbCount = dbResponses.length;
            const localCount = respondedProductIds.size;
            const totalProducts = tiendaProducts.length;

            console.log(`🔍 Verificación de completado: BD=${dbCount}, Local=${localCount}, Total=${totalProducts}`);

            // If DB has less responses than total products and no skipped, don't show completed
            if (dbCount < totalProducts && skippedProductIds.size === 0) {
              console.warn(`⚠️ Falso completado detectado: BD tiene ${dbCount} respuestas pero hay ${totalProducts} productos`);
              // Reload responded products from DB to fix local state
              await loadRespondedProducts(selectedTienda);
              toast.warning(`Hay ${totalProducts - dbCount} productos pendientes por responder`);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error verificando completado:", error);
      }
    }

    if (remaining.length === 0) {
      const skipped = tiendaProducts.filter(p => skippedProductIds.has(p.id));
      if (skipped.length > 0) {
        setSkippedProducts(skipped);
        setShowSkippedReview(true);
        setReviewingSkippedIndex(0);
      } else {
        // Force sync before showing completion to ensure data is saved
        if (isOnline) {
          await syncData();
          await checkPendingCount();
        }

        console.log(`✅ Estudio completado: ${respondedProductIds.size} respondidos, ${skippedProductIds.size} omitidos de ${tiendaProducts.length} productos`);
        setIsCompleted(true);
      }
    }
  };

  const handleFotoIngresoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFile(file);

      if (isOnline) {
        const fileName = generateIngresoPhotoFileName(selectedTienda, userId);

        const { data: s3Url, error: uploadError } = await withRetry(
          async () => {
            const result = await uploadPhotoToS3(compressedDataUrl, fileName);
            if (!result) throw new Error("AWS S3 Upload Failed");
            return { data: result, error: null };
          },
          {
            maxRetries: 3,
            onRetry: (attempt) => console.log(`Reintentando subir foto de ingreso a S3 (intento ${attempt})...`)
          }
        );

        if (uploadError) throw uploadError;

        setFotoIngreso(s3Url);
        setFotoIngresoUrl(s3Url);
      } else {
        setFotoIngreso(compressedDataUrl);
        setFotoIngresoUrl(compressedDataUrl);
      }
      toast.success("Foto de ingreso cargada");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Error al cargar la foto");
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Get current product ID for the filename
    const currentProducto = showSkippedReview
      ? skippedProducts[reviewingSkippedIndex]
      : filteredProductos[currentProductoIndex];

    if (!currentProducto) {
      toast.error("No hay producto seleccionado");
      return;
    }

    setUploadingFoto(true);
    try {
      const compressedDataUrl = await compressImageFile(file);

      if (isOnline) {
        const fileName = generatePhotoFileName(selectedTienda, currentProducto.cod_producto, userId, 'exhibicion');

        const { data: s3Url, error: uploadError } = await withRetry(
          async () => {
            const result = await uploadPhotoToS3(compressedDataUrl, fileName);
            if (!result) throw new Error("AWS S3 Upload Failed");
            return { data: result, error: null };
          },
          {
            maxRetries: 3,
            onRetry: (attempt) => console.log(`Reintentando subir foto de producto a S3 (intento ${attempt})...`)
          }
        );

        if (uploadError) throw uploadError;

        setFoto(s3Url);
        setFotoUrl(s3Url);
      } else {
        setFoto(compressedDataUrl);
        setFotoUrl(compressedDataUrl);
      }
      toast.success("Foto cargada");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Error al cargar la foto");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSkip = async () => {
    const currentProducto = showSkippedReview ? skippedProducts[reviewingSkippedIndex] : filteredProductos[currentProductoIndex];
    if (!currentProducto) {
      console.warn("⚠️ handleSkip: No hay producto actual");
      return;
    }

    console.log("🔵 Omitiendo producto:", {
      productId: currentProducto.id,
      productName: currentProducto.descripcion_producto,
      currentIndex: currentProductoIndex,
      totalFiltered: filteredProductos.length,
      showSkippedReview
    });

    eventLogger.log(EventType.INFO, 'Producto omitido para revisión posterior', {
      context: {
        productId: currentProducto.id,
        exhibicionId: selectedExhibicionId,
        tienda: selectedTienda,
        currentIndex: currentProductoIndex,
        totalFiltered: filteredProductos.length
      }
    });

    // Add to skipped set
    const newSkippedIds = new Set([...skippedProductIds, currentProducto.id]);
    setSkippedProductIds(newSkippedIds);

    if (showSkippedReview) {
      // In review mode - handle navigation within skipped products
      const newSkipped = skippedProducts.filter((_, i) => i !== reviewingSkippedIndex);
      setSkippedProducts(newSkipped);
      if (newSkipped.length === 0) {
        setShowSkippedReview(false);
        // Force sync before showing completion
        if (isOnline) {
          await syncData();
          await checkPendingCount();
        }
        setIsCompleted(true);
      } else if (reviewingSkippedIndex >= newSkipped.length) {
        setReviewingSkippedIndex(0);
      }
    } else {
      // Normal flow - calculate remaining products excluding the one just skipped
      const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
      const remainingProducts = tiendaProducts.filter(p =>
        !respondedProductIds.has(p.id) && !newSkippedIds.has(p.id)
      );

      console.log("🔵 Estado después de omitir:", {
        remainingCount: remainingProducts.length,
        skippedCount: newSkippedIds.size,
        currentIndex: currentProductoIndex
      });

      if (remainingProducts.length === 0) {
        // No more products left - check if we need to show skipped review
        if (newSkippedIds.size > 0) {
          const skipped = tiendaProducts.filter(p => newSkippedIds.has(p.id));
          console.log("✅ Mostrando revisión de productos omitidos:", skipped.length);
          setSkippedProducts(skipped);
          setReviewingSkippedIndex(0);
          setShowSkippedReview(true);
        } else {
          // No skipped products either - complete
          if (isOnline) {
            await syncData();
            await checkPendingCount();
          }
          setIsCompleted(true);
        }
      } else {
        // There are still products remaining
        // Apply current filters to remaining products
        let filtered = remainingProducts;
        if (selectedMacrocategoria !== "todas") {
          filtered = filtered.filter(p => p.macrocategoria === selectedMacrocategoria);
        }
        if (selectedMicrocategoria !== "todas") {
          filtered = filtered.filter(p => p.microcategoria === selectedMicrocategoria);
        }

        if (filtered.length === 0) {
          // No products with current filters - reset filters
          console.log("🔄 Reseteando filtros - no hay productos con filtros actuales");
          setSelectedMacrocategoria("todas");
          setSelectedMicrocategoria("todas");
          setFilteredProductos(remainingProducts);
          setCurrentProductoIndex(0);
        } else if (currentProductoIndex >= filtered.length) {
          // Current index out of bounds - reset to 0
          console.log("🔄 Índice fuera de rango, reseteando a 0");
          setFilteredProductos(filtered);
          setCurrentProductoIndex(0);
        } else {
          // Update filtered products - index should stay valid
          setFilteredProductos(filtered);
        }
      }
    }

    resetForm();
    toast.info("Producto omitido");
  };

  const resetForm = () => {
    setPresenciaExhibicion("");
    setUbicacion("");
    setObservaciones("");
    setFoto(null);
    setFotoUrl(null);
  };

  const handleSave = async () => {
    if (!selectedExhibicionId || !selectedTienda) {
      toast.error("Selecciona una exhibición y una tienda primero");
      return;
    }

    if (!presenciaExhibicion) {
      toast.error("Debes seleccionar una opción de presencia de exhibición");
      return;
    }

    if (uploadingFoto) {
      toast.error("Espera a que termine de subir la foto");
      return;
    }

    if (!fotoUrl) {
      toast.error("Debes tomar una foto del producto");
      return;
    }

    setSaving(true);

    try {
      // Use cached userId instead of getUser() which requires network
      if (!userId) {
        toast.error("Usuario no autenticado");
        setSaving(false);
        return;
      }

      const currentProducto = showSkippedReview
        ? skippedProducts[reviewingSkippedIndex]
        : filteredProductos[currentProductoIndex];

      if (!currentProducto) {
        toast.error("No hay producto seleccionado");
        return;
      }

      const respuestaData = {
        exhibicion_id: selectedExhibicionId,
        producto_id: currentProducto.id,
        created_by: userId,
        fecha: new Date().toISOString().split('T')[0],
        tienda: selectedTienda,
        ciudad: selectedExhibicionData?.ciudad,
        bandera: selectedExhibicionData?.bandera,
        seccion: currentProducto.seccion,
        linea: currentProducto.linea,
        cod_producto: currentProducto.cod_producto,
        descripcion_producto: currentProducto.descripcion_producto,
        tipo_exhibicion: currentProducto.tipo_exhibicion,
        codigo_exhibicion: currentProducto.codigo_exhibicion,
        presencia_exhibicion: presenciaExhibicion,
        ubicacion: ubicacion,
        observaciones: observaciones,
        foto: isOnline ? fotoUrl : fotoUrl, // Save foto URL/base64 in both modes
        foto_registro: fotoIngresoUrl,
        encargado: supervisor,
        encargado_2: acompaniamientoEncargado ? "Sí" : "No",
      };

      eventLogger.log(EventType.FORM_SUBMIT, "Guardando respuesta exhibición", {
        severity: EventSeverity.INFO,
        context: {
          exhibicionId: selectedExhibicionId,
          productoId: currentProducto.id,
          isOnline,
          hasFoto: !!fotoUrl,
          fotoIsBase64: fotoUrl?.startsWith("data:") || false,
        },
      });

      if (isOnline) {
        try {
          // Usar upsert para evitar duplicados
          const { error } = await supabase
            .from("respuestas_exhibicion")
            .upsert(respuestaData, {
              onConflict: 'exhibicion_id,producto_id,tienda,created_by,fecha',
              ignoreDuplicates: true
            });

          if (error && !error.message.includes('duplicate')) throw error;

          eventLogger.log(EventType.SAVE_SUCCESS, "Respuesta exhibición guardada online", {
            severity: EventSeverity.SUCCESS,
            context: { exhibicionId: selectedExhibicionId, productoId: currentProducto.id, tienda: selectedTienda },
          });
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

          eventLogger.log(EventType.SAVE_ERROR, `Error al guardar exhibición en línea: ${errorMessage}`, {
            severity: EventSeverity.ERROR,
            context: {
              exhibicionId: selectedExhibicionId,
              productoId: currentProducto.id,
              errorCode: error?.code,
              isAuthError
            },
            error: error as Error,
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
        // When offline, save the base64 photo in fotoProducto for later upload
        await offlineStorage.saveRespuestaExhibicion(
          selectedExhibicionId,
          currentProducto.id,
          { ...respuestaData, foto: null }, // Don't save base64 in data.foto
          { fotoProducto: fotoUrl } // Save base64 here for sync to upload
        );
        await checkPendingCount();

        eventLogger.log(EventType.SAVE_SUCCESS, "Respuesta exhibición guardada offline", {
          severity: EventSeverity.SUCCESS,
          context: { exhibicionId: selectedExhibicionId, productoId: currentProducto.id, tienda: selectedTienda },
        });
      }

      // Update responded products
      setRespondedProductIds(prev => new Set([...prev, currentProducto.id]));

      // Remove from skipped if it was there
      if (skippedProductIds.has(currentProducto.id)) {
        setSkippedProductIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentProducto.id);
          return newSet;
        });
      }

      toast.success(isOnline ? "Respuesta guardada" : "Guardado offline");
      resetForm();

      // Handle navigation - only for skipped review, regular flow handled by useEffect
      if (showSkippedReview) {
        const newSkipped = skippedProducts.filter((_, i) => i !== reviewingSkippedIndex);
        setSkippedProducts(newSkipped);
        if (newSkipped.length === 0) {
          setShowSkippedReview(false);
          // Force sync before showing completion
          if (isOnline) {
            await syncData();
            await checkPendingCount();
          }
          setIsCompleted(true);
        } else if (reviewingSkippedIndex >= newSkipped.length) {
          setReviewingSkippedIndex(0);
        }
      }
      // No incrementamos índice manualmente - el useEffect lo maneja al actualizar filteredProductos
    } catch (error) {
      console.error("Error saving:", error);
      eventLogger.log(EventType.SAVE_ERROR, "Error guardando respuesta exhibición", {
        severity: EventSeverity.ERROR,
        context: { exhibicionId: selectedExhibicionId, productoId: currentProducto?.id },
        error: error as Error,
      });
      toast.error("Error al guardar la respuesta");
    } finally {
      setSaving(false);
    }
  };

  const currentProducto = showSkippedReview
    ? skippedProducts[reviewingSkippedIndex]
    : filteredProductos[currentProductoIndex];

  // Calculate filtered products for progress (considering category filters)
  const getFilteredByCategories = () => {
    let filtered = productos.filter(p => p.tienda === selectedTienda);
    if (selectedMacrocategoria !== "todas") {
      filtered = filtered.filter(p => p.macrocategoria === selectedMacrocategoria);
    }
    if (selectedMicrocategoria !== "todas") {
      filtered = filtered.filter(p => p.microcategoria === selectedMicrocategoria);
    }
    return filtered;
  };

  const filteredByCategories = getFilteredByCategories();
  const totalProductos = filteredByCategories.length;
  const respondedCount = Array.from(respondedProductIds).filter(id =>
    filteredByCategories.some(p => p.id === id)
  ).length;
  const progressPercent = totalProductos > 0 ? (respondedCount / totalProductos) * 100 : 0;

  // Network status portal
  const networkStatusContainer = document.getElementById("network-status-container");

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
      {/* Network Status Portal */}
      {networkStatusContainer && createPortal(
        <NetworkStatus
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          onSyncClick={onSyncRequest}
        />,
        networkStatusContainer
      )}

      {/* Continue Dialog */}
      <AlertDialog open={showContinueDialog} onOpenChange={setShowContinueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Continuar donde lo dejaste?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes progreso guardado en esta exhibición. ¿Deseas continuar o empezar de nuevo?
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
              Empezar de nuevo
            </AlertDialogAction>
            <AlertDialogAction onClick={restoreProgress}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Selection Card */}
      <Card>
        <CardContent className="space-y-4 pt-4 md:pt-6">
          <div className="space-y-2">
            <Label htmlFor="exhibicion">Seleccionar Exhibición</Label>
            <Select value={selectedExhibicionId} onValueChange={setSelectedExhibicionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una exhibición" />
              </SelectTrigger>
              <SelectContent>
                {exhibiciones.map((exhibicion) => (
                  <SelectItem key={exhibicion.id} value={exhibicion.id}>
                    {exhibicion.nombre} - {exhibicion.tienda}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExhibicionId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tienda">Seleccionar Tienda</Label>
                <Select value={selectedTienda} onValueChange={setSelectedTienda} disabled={hasStarted}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiendasDisponibles.map((tienda) => (
                      <SelectItem key={tienda} value={tienda}>
                        {tienda}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {selectedTienda && !hasStarted && (
            <>
              <div className="space-y-2">
                <Label htmlFor="supervisor">Nombre del Supervisor</Label>
                <Input
                  id="supervisor"
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
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoIngresoChange}
                    className="hidden"
                    id="foto-ingreso"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("foto-ingreso")?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {fotoIngreso ? "Cambiar Foto" : "Tomar Foto"}
                  </Button>
                  {fotoIngresoUrl && (
                    <img
                      src={fotoIngresoUrl}
                      alt="Foto de ingreso"
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                </div>
              </div>

              <Button onClick={handleStartStudy} className="w-full">
                Iniciar Estudio
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Filters Card */}
      {hasStarted && !isCompleted && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Macrocategoría</Label>
                <Select value={selectedMacrocategoria} onValueChange={setSelectedMacrocategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label>Microcategoría</Label>
                <Select value={selectedMicrocategoria} onValueChange={setSelectedMicrocategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso: {respondedCount} de {totalProductos}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state when hasStarted but no products yet */}
      {hasStarted && !currentProducto && !isCompleted && !showSkippedReview && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">
              {isProcessingFilters ? "Procesando filtros..." : "Cargando productos..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {filteredProductos.length === 0 && productos.length > 0
                ? `Buscando productos para ${selectedTienda}...`
                : productos.length === 0
                  ? "Cargando lista de productos..."
                  : `${filteredProductos.length} productos encontrados`
              }
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Forzar recarga de productos
                setSelectedMacrocategoria("todas");
                setSelectedMicrocategoria("todas");
                const tiendaProducts = productos.filter(p => p.tienda === selectedTienda);
                const remainingProducts = tiendaProducts.filter(p =>
                  !respondedProductIds.has(p.id) && !skippedProductIds.has(p.id)
                );
                if (remainingProducts.length > 0) {
                  setFilteredProductos(remainingProducts);
                  setCurrentProductoIndex(0);
                } else if (tiendaProducts.length === 0) {
                  toast.error("No hay productos para esta tienda");
                  setHasStarted(false);
                } else {
                  setIsCompleted(true);
                }
              }}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Product Card */}
      {hasStarted && currentProducto && !isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>
                {showSkippedReview
                  ? `Revisión ${reviewingSkippedIndex + 1} de ${skippedProducts.length}`
                  : `Producto ${currentProductoIndex + 1} de ${filteredProductos.length}`
                }
              </span>
              {showSkippedReview && (
                <span className="text-sm text-amber-500">Productos omitidos</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p><strong>Código:</strong> {currentProducto.cod_producto}</p>
              <p><strong>Producto:</strong> {currentProducto.descripcion_producto}</p>
              <p><strong>Sección:</strong> {currentProducto.seccion}</p>
              <p><strong>Línea:</strong> {currentProducto.linea}</p>
              {currentProducto.macrocategoria && (
                <p><strong>Macrocategoría:</strong> {currentProducto.macrocategoria}</p>
              )}
              {currentProducto.microcategoria && (
                <p><strong>Microcategoría:</strong> {currentProducto.microcategoria}</p>
              )}
              {currentProducto.marca && (
                <p><strong>Marca:</strong> {currentProducto.marca}</p>
              )}
              <p><strong>Tipo:</strong> {currentProducto.tipo_exhibicion}</p>
              <p><strong>Código de Exhibición:</strong> {currentProducto.codigo_exhibicion}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presencia">Presencia de Exhibición *</Label>
              <Select
                key={currentProducto.id}
                value={presenciaExhibicion}
                onValueChange={setPresenciaExhibicion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SI SE ARMO">SI SE ARMO</SelectItem>
                  <SelectItem value="NO SE ARMO PORQUE NO LLEGO SUFICIENTE MERCADERIA">
                    NO SE ARMO PORQUE NO LLEGO SUFICIENTE MERCADERIA
                  </SelectItem>
                  <SelectItem value="NO SE ARMO PORQUE NO LLEGO MERCADERIA">
                    NO SE ARMO PORQUE NO LLEGO MERCADERIA
                  </SelectItem>
                  <SelectItem value="NO SE ARMO, PERO SI CUENTA CON STOCK (NO CUMPLE)">
                    NO SE ARMO, PERO SI CUENTA CON STOCK (NO CUMPLE)
                  </SelectItem>
                  <SelectItem value="NO SE ARMO, NO HUBO ENCARGADO PARA INDICAR MOTIVO">
                    NO SE ARMO, NO HUBO ENCARGADO PARA INDICAR MOTIVO
                  </SelectItem>
                  <SelectItem value="NO SE ARMO PORQUE NO ES PARTE DEL SURTIDO DE TIENDA">
                    NO SE ARMO PORQUE NO ES PARTE DEL SURTIDO DE TIENDA
                  </SelectItem>
                  <SelectItem value="NO SE ARMO, ARMADO EN UN ESPACIO DISTINTO">
                    NO SE ARMO, ARMADO EN UN ESPACIO DISTINTO
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Pasillo 3, Góndola A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Escribe tus observaciones aquí"
              />
            </div>

            <div className="space-y-2">
              <Label>Foto del Producto</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoChange}
                  className="hidden"
                  id="foto-producto"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("foto-producto")?.click()}
                  disabled={uploadingFoto}
                >
                  {uploadingFoto ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      {foto ? "Cambiar Foto" : "Tomar Foto *"}
                    </>
                  )}
                </Button>
                {fotoUrl && (
                  <img
                    src={fotoUrl}
                    alt="Foto del producto"
                    className="w-20 h-20 object-cover rounded"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Omitir
              </Button>
              <Button onClick={handleSave} disabled={saving || uploadingFoto} className="flex-1" size="lg">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Card */}
      {isCompleted && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">¡Estudio Completado!</h2>
            <p className="text-muted-foreground">
              Has completado todos los productos de la tienda {selectedTienda}.
            </p>

            {/* Warning if there are pending items */}
            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                <p className="text-amber-800 font-medium">
                  ⚠️ Tienes {pendingCount} respuestas pendientes de sincronizar.
                </p>
                <p className="text-amber-600 text-sm mt-1">
                  {isOnline
                    ? "Sincronizando automáticamente..."
                    : "Se sincronizarán cuando tengas conexión a internet."}
                </p>
                {isOnline && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncData}
                    disabled={isSyncing}
                    className="mt-2"
                  >
                    {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
                  </Button>
                )}
              </div>
            )}

            {pendingCount === 0 && (
              <p className="text-green-600 text-sm">✓ Todos los datos han sido guardados correctamente.</p>
            )}

            <Button onClick={() => {
              setHasStarted(false);
              setIsCompleted(false);
              setSelectedTienda("");
              setRespondedProductIds(new Set());
              setSkippedProductIds(new Set());
              setCurrentProductoIndex(0);
            }}>
              Comenzar otra tienda
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
