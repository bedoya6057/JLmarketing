import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  StudyPhotoStats, 
  MissingPhotoRecord, 
  DuplicatePhotoRecord,
  IngresoPhotoRecord 
} from "./types";

export function usePhotoValidation() {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [stats, setStats] = useState<StudyPhotoStats[]>([]);
  const [missingRecords, setMissingRecords] = useState<Record<string, MissingPhotoRecord[]>>({});
  const [brokenUrls, setBrokenUrls] = useState<Record<string, MissingPhotoRecord[]>>({});
  const [duplicates, setDuplicates] = useState<Record<string, DuplicatePhotoRecord[]>>({});
  const [missingIngreso, setMissingIngreso] = useState<Record<string, IngresoPhotoRecord[]>>({});

  const loadPhotoStats = async () => {
    setLoading(true);
    try {
      // Fetch exhibicion stats
      const { data: exhibicionStats, error: exhError } = await supabase
        .from("exhibiciones")
        .select("id, nombre, estado")
        .not("estado", "in", '("completado","concluido")');

      if (exhError) throw exhError;

      const exhibicionResults: StudyPhotoStats[] = [];
      for (const exh of exhibicionStats || []) {
        const { count: total } = await supabase
          .from("respuestas_exhibicion")
          .select("id", { count: "exact", head: true })
          .eq("exhibicion_id", exh.id);

        const { count: sinFoto } = await supabase
          .from("respuestas_exhibicion")
          .select("id", { count: "exact", head: true })
          .eq("exhibicion_id", exh.id)
          .or("foto.is.null,foto.eq.");

        // Get unique tiendas with responses
        const { data: tiendasData } = await supabase
          .from("respuestas_exhibicion")
          .select("tienda, foto_registro")
          .eq("exhibicion_id", exh.id);

        const uniqueTiendas = new Map<string, string | null>();
        (tiendasData || []).forEach(r => {
          if (r.tienda && !uniqueTiendas.has(r.tienda)) {
            uniqueTiendas.set(r.tienda, r.foto_registro);
          }
        });
        
        const sinFotoIngreso = Array.from(uniqueTiendas.values()).filter(
          foto => !foto || foto === ""
        ).length;

        // Check for duplicates
        const { data: allPhotos } = await supabase
          .from("respuestas_exhibicion")
          .select("foto")
          .eq("exhibicion_id", exh.id)
          .not("foto", "is", null)
          .neq("foto", "");

        const photoCount = new Map<string, number>();
        (allPhotos || []).forEach(r => {
          if (r.foto) {
            photoCount.set(r.foto, (photoCount.get(r.foto) || 0) + 1);
          }
        });
        const duplicateCount = Array.from(photoCount.values()).filter(c => c > 1).length;

        exhibicionResults.push({
          id: exh.id,
          nombre: exh.nombre,
          estado: exh.estado || "en_progreso",
          total_respuestas: total || 0,
          sin_foto: sinFoto || 0,
          con_foto: (total || 0) - (sinFoto || 0),
          sin_foto_ingreso: sinFotoIngreso,
          con_foto_ingreso: uniqueTiendas.size - sinFotoIngreso,
          duplicados: duplicateCount,
          tipo: "exhibicion",
        });
      }

      // Fetch encarte stats
      const { data: encarteStats, error: encError } = await supabase
        .from("encartes")
        .select("id, nombre, estado")
        .not("estado", "in", '("completado","concluido")');

      if (encError) throw encError;

      const encarteResults: StudyPhotoStats[] = [];
      for (const enc of encarteStats || []) {
        const { count: total } = await supabase
          .from("respuestas")
          .select("id", { count: "exact", head: true })
          .eq("encarte_id", enc.id);

        const { count: sinFoto } = await supabase
          .from("respuestas")
          .select("id", { count: "exact", head: true })
          .eq("encarte_id", enc.id)
          .or("foto.is.null,foto.eq.");

        // Get unique tiendas with responses
        const { data: tiendasData } = await supabase
          .from("respuestas")
          .select("tienda, foto_registro")
          .eq("encarte_id", enc.id);

        const uniqueTiendas = new Map<string, string | null>();
        (tiendasData || []).forEach(r => {
          if (r.tienda && !uniqueTiendas.has(r.tienda)) {
            uniqueTiendas.set(r.tienda, r.foto_registro);
          }
        });
        
        const sinFotoIngreso = Array.from(uniqueTiendas.values()).filter(
          foto => !foto || foto === ""
        ).length;

        // Check for duplicates
        const { data: allPhotos } = await supabase
          .from("respuestas")
          .select("foto")
          .eq("encarte_id", enc.id)
          .not("foto", "is", null)
          .neq("foto", "");

        const photoCount = new Map<string, number>();
        (allPhotos || []).forEach(r => {
          if (r.foto) {
            photoCount.set(r.foto, (photoCount.get(r.foto) || 0) + 1);
          }
        });
        const duplicateCount = Array.from(photoCount.values()).filter(c => c > 1).length;

        encarteResults.push({
          id: enc.id,
          nombre: enc.nombre,
          estado: enc.estado || "en_progreso",
          total_respuestas: total || 0,
          sin_foto: sinFoto || 0,
          con_foto: (total || 0) - (sinFoto || 0),
          sin_foto_ingreso: sinFotoIngreso,
          con_foto_ingreso: uniqueTiendas.size - sinFotoIngreso,
          duplicados: duplicateCount,
          tipo: "encarte",
        });
      }

      const allStats = [...exhibicionResults, ...encarteResults].sort((a, b) => {
        // Sort by issues: duplicates first, then missing photos
        const aIssues = a.duplicados * 10 + a.sin_foto + a.sin_foto_ingreso;
        const bIssues = b.duplicados * 10 + b.sin_foto + b.sin_foto_ingreso;
        return bIssues - aIssues;
      });
      
      setStats(allStats);
      toast.success("Estadísticas de fotos cargadas");
    } catch (error: any) {
      console.error("Error loading photo stats:", error);
      toast.error("Error al cargar estadísticas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMissingRecords = async (study: StudyPhotoStats) => {
    setValidating(study.id);
    try {
      if (study.tipo === "exhibicion") {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("id, tienda, descripcion_producto, fecha, encargado")
          .eq("exhibicion_id", study.id)
          .or("foto.is.null,foto.eq.")
          .order("fecha", { ascending: false })
          .limit(50);

        if (error) throw error;

        setMissingRecords((prev) => ({
          ...prev,
          [study.id]: (data || []).map((r) => ({
            id: r.id,
            tienda: r.tienda || "Sin tienda",
            producto: r.descripcion_producto || "Sin producto",
            fecha: r.fecha || "Sin fecha",
            encargado: r.encargado || "Sin encargado",
          })),
        }));
      } else {
        const { data, error } = await supabase
          .from("respuestas")
          .select("id, tienda, producto, fecha, supervisor")
          .eq("encarte_id", study.id)
          .or("foto.is.null,foto.eq.")
          .order("fecha", { ascending: false })
          .limit(50);

        if (error) throw error;

        setMissingRecords((prev) => ({
          ...prev,
          [study.id]: (data || []).map((r) => ({
            id: r.id,
            tienda: r.tienda || "Sin tienda",
            producto: r.producto || "Sin producto",
            fecha: r.fecha || "Sin fecha",
            encargado: r.supervisor || "Sin supervisor",
          })),
        }));
      }

      toast.success("Registros sin foto cargados");
    } catch (error: any) {
      console.error("Error loading missing records:", error);
      toast.error("Error: " + error.message);
    } finally {
      setValidating(null);
    }
  };

  const loadMissingIngresoPhotos = async (study: StudyPhotoStats) => {
    setValidating(study.id);
    try {
      if (study.tipo === "exhibicion") {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("tienda, encargado, fecha, foto_registro")
          .eq("exhibicion_id", study.id);

        if (error) throw error;

        const uniqueTiendas = new Map<string, IngresoPhotoRecord>();
        (data || []).forEach(r => {
          if (r.tienda && !uniqueTiendas.has(r.tienda)) {
            if (!r.foto_registro || r.foto_registro === "") {
              uniqueTiendas.set(r.tienda, {
                id: r.tienda,
                tienda: r.tienda,
                usuario: r.encargado || "Sin encargado",
                fecha: r.fecha || "Sin fecha",
              });
            }
          }
        });

        setMissingIngreso((prev) => ({
          ...prev,
          [study.id]: Array.from(uniqueTiendas.values()),
        }));
      } else {
        const { data, error } = await supabase
          .from("respuestas")
          .select("tienda, supervisor, fecha, foto_registro")
          .eq("encarte_id", study.id);

        if (error) throw error;

        const uniqueTiendas = new Map<string, IngresoPhotoRecord>();
        (data || []).forEach(r => {
          if (r.tienda && !uniqueTiendas.has(r.tienda)) {
            if (!r.foto_registro || r.foto_registro === "") {
              uniqueTiendas.set(r.tienda, {
                id: r.tienda,
                tienda: r.tienda,
                usuario: r.supervisor || "Sin supervisor",
                fecha: r.fecha || "Sin fecha",
              });
            }
          }
        });

        setMissingIngreso((prev) => ({
          ...prev,
          [study.id]: Array.from(uniqueTiendas.values()),
        }));
      }

      toast.success("Tiendas sin foto de ingreso cargadas");
    } catch (error: any) {
      console.error("Error loading missing ingreso photos:", error);
      toast.error("Error: " + error.message);
    } finally {
      setValidating(null);
    }
  };

  const loadDuplicates = async (study: StudyPhotoStats) => {
    setValidating(study.id);
    try {
      let records: { id: string; foto: string | null; tienda: string | null; fecha: string | null }[] = [];
      
      if (study.tipo === "exhibicion") {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("id, foto, tienda, fecha")
          .eq("exhibicion_id", study.id)
          .not("foto", "is", null)
          .neq("foto", "");
        if (error) throw error;
        records = data || [];
      } else {
        const { data, error } = await supabase
          .from("respuestas")
          .select("id, foto, tienda, fecha")
          .eq("encarte_id", study.id)
          .not("foto", "is", null)
          .neq("foto", "");
        if (error) throw error;
        records = data || [];
      }

      // Group by photo URL
      const photoGroups = new Map<string, typeof records>();
      records.forEach(r => {
        if (r.foto) {
          const existing = photoGroups.get(r.foto) || [];
          existing.push(r);
          photoGroups.set(r.foto, existing);
        }
      });

      // Filter to only duplicates
      const duplicateRecords: DuplicatePhotoRecord[] = [];
      photoGroups.forEach((recs, url) => {
        if (recs.length > 1) {
          duplicateRecords.push({
            url,
            count: recs.length,
            records: recs.map(r => ({
              id: r.id,
              tienda: r.tienda || "Sin tienda",
              fecha: r.fecha || "Sin fecha",
            })),
          });
        }
      });

      setDuplicates((prev) => ({
        ...prev,
        [study.id]: duplicateRecords,
      }));

      if (duplicateRecords.length === 0) {
        toast.success("✅ No se encontraron fotos duplicadas");
      } else {
        toast.warning(`⚠️ ${duplicateRecords.length} fotos duplicadas encontradas`);
      }
    } catch (error: any) {
      console.error("Error loading duplicates:", error);
      toast.error("Error: " + error.message);
    } finally {
      setValidating(null);
    }
  };

  const validateUrls = async (study: StudyPhotoStats) => {
    setValidating(study.id);
    try {
      let records: { id: string; foto: string | null; tienda: string | null; fecha: string | null }[] = [];
      
      if (study.tipo === "exhibicion") {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("id, foto, tienda, fecha")
          .eq("exhibicion_id", study.id)
          .not("foto", "is", null)
          .neq("foto", "")
          .limit(100);
        if (error) throw error;
        records = data || [];
      } else {
        const { data, error } = await supabase
          .from("respuestas")
          .select("id, foto, tienda, fecha")
          .eq("encarte_id", study.id)
          .not("foto", "is", null)
          .neq("foto", "")
          .limit(100);
        if (error) throw error;
        records = data || [];
      }

      const broken: MissingPhotoRecord[] = [];
      
      for (const record of records) {
        if (!record.foto) continue;
        try {
          const response = await fetch(record.foto, { method: "HEAD" });
          if (!response.ok) {
            broken.push({
              id: record.id,
              tienda: record.tienda || "Sin tienda",
              producto: record.foto.substring(record.foto.lastIndexOf("/") + 1) || "URL rota",
              fecha: record.fecha || "Sin fecha",
              encargado: `HTTP ${response.status}`,
            });
          }
        } catch {
          broken.push({
            id: record.id,
            tienda: record.tienda || "Sin tienda",
            producto: record.foto.substring(record.foto.lastIndexOf("/") + 1) || "URL inaccesible",
            fecha: record.fecha || "Sin fecha",
            encargado: "Error de red",
          });
        }
      }

      setBrokenUrls((prev) => ({
        ...prev,
        [study.id]: broken,
      }));

      if (broken.length === 0) {
        toast.success(`✅ Todas las ${records.length} URLs validadas correctamente`);
      } else {
        toast.warning(`⚠️ ${broken.length} URLs rotas encontradas`);
      }
    } catch (error: any) {
      console.error("Error validating URLs:", error);
      toast.error("Error: " + error.message);
    } finally {
      setValidating(null);
    }
  };

  return {
    loading,
    validating,
    stats,
    missingRecords,
    brokenUrls,
    duplicates,
    missingIngreso,
    loadPhotoStats,
    loadMissingRecords,
    loadMissingIngresoPhotos,
    loadDuplicates,
    validateUrls,
  };
}
