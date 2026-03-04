import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { uploadPhotoToS3 } from "@/lib/s3Upload";

interface Props {
  exhibicionId: string;
  onComplete?: () => void;
}

// Helper function to normalize column names for flexible matching
const normalize = (s: any): string => {
  if (s === undefined || s === null) return "";
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();
};

// Helper to pick value from row using multiple possible column names
const pick = (row: Record<string, any>, candidates: string[]): string => {
  for (const key of Object.keys(row)) {
    const normalizedKey = normalize(key);
    for (const candidate of candidates) {
      if (normalizedKey === normalize(candidate)) {
        return String(row[key] ?? "").trim();
      }
    }
  }
  return "";
};

export const DataRestoreUpload = ({ exhibicionId, onComplete }: Props) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; errors: number; skipped: number; reasons: Record<string, number> }>({
    success: 0, errors: 0, skipped: 0, reasons: {}
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const STORAGE_BASE_URL = "https://mznbbplygemkbolqcjjn.supabase.co/storage/v1/object/public/encarte-photos/";

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Cache for user IDs by store
  const userCache = new Map<string, string | null>();

  const getUserIdForStore = async (tienda: string): Promise<string> => {
    // If no tienda, return current admin user
    if (!tienda) return currentUserId || "";

    // Check cache first
    const cacheKey = tienda.toLowerCase().trim();
    if (userCache.has(cacheKey)) {
      return userCache.get(cacheKey) || currentUserId || "";
    }

    // Look up in tiendas table by responsable email
    const { data: tiendaData } = await supabase
      .from("tiendas")
      .select("responsable")
      .ilike("tienda", `%${tienda.replace("PVEA ", "").replace("Plaza Vea", "").trim()}%`)
      .maybeSingle();

    if (tiendaData?.responsable) {
      // Find user by email
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${tiendaData.responsable.split("@")[0]}%`)
        .maybeSingle();

      if (profileData?.id) {
        userCache.set(cacheKey, profileData.id);
        return profileData.id;
      }
    }

    // Fallback: use current admin user doing the restore
    userCache.set(cacheKey, currentUserId);
    return currentUserId || "";
  };

  // Upload base64 image to storage and return URL
  const uploadBase64ToStorage = async (base64Data: string, fileName: string): Promise<string | null> => {
    return await uploadPhotoToS3(base64Data, fileName);
  };

  // Search for photo in storage by filename
  const findPhotoInStorage = async (filename: string): Promise<string | null> => {
    if (!filename) return null;

    const cleanFilename = filename.trim();

    try {
      // List all folders (user IDs) in the bucket
      const { data: folders, error: foldersError } = await supabase.storage
        .from("encarte-photos")
        .list("", { limit: 1000 });

      if (foldersError || !folders) {
        console.error("Error listing folders:", foldersError);
        return null;
      }

      // Search in each folder for the file
      for (const folder of folders) {
        if (folder.id) continue; // Skip if it's a file at root level

        const { data: files, error: filesError } = await supabase.storage
          .from("encarte-photos")
          .list(folder.name, { limit: 1000 });

        if (filesError || !files) continue;

        // Look for exact match or partial match
        const matchedFile = files.find(f =>
          f.name === cleanFilename ||
          f.name.includes(cleanFilename) ||
          cleanFilename.includes(f.name.replace(".jpg", "").replace(".jpeg", "").replace(".png", ""))
        );

        if (matchedFile) {
          return `${STORAGE_BASE_URL}${folder.name}/${matchedFile.name}`;
        }
      }

      // Also check root level files
      const rootFiles = folders.filter(f => f.id !== null);
      const rootMatch = rootFiles.find(f =>
        f.name === cleanFilename ||
        f.name.includes(cleanFilename)
      );

      if (rootMatch) {
        return `${STORAGE_BASE_URL}${rootMatch.name}`;
      }

      console.log(`Photo not found in storage: ${cleanFilename}`);
      return null;
    } catch (error) {
      console.error("Error searching for photo:", error);
      return null;
    }
  };

  const processPhoto = async (photoData: string | undefined, userId: string, productoId: string, suffix: string): Promise<string | null> => {
    if (!photoData) return null;

    const cleanPhotoData = photoData.trim();

    // If already a full URL, return as is
    if (cleanPhotoData.startsWith("http")) return cleanPhotoData;

    // If it's base64, upload to storage
    if (cleanPhotoData.startsWith("data:")) {
      const fileName = `${userId}/${exhibicionId}_${productoId}_${Date.now()}_${suffix}.jpg`;
      return await uploadBase64ToStorage(cleanPhotoData, fileName);
    }

    // Otherwise, search for the filename in storage
    return await findPhotoInStorage(cleanPhotoData);
  };

  const findProductId = async (codProducto: string, tienda: string): Promise<string | null> => {
    const { data } = await supabase
      .from("productos_exhibicion")
      .select("id")
      .eq("exhibicion_id", exhibicionId)
      .eq("cod_producto", codProducto)
      .ilike("tienda", `%${tienda.replace("PVEA ", "")}%`)
      .maybeSingle();

    return data?.id || null;
  };

  const checkIfRecordExists = async (productoId: string, tienda: string): Promise<boolean> => {
    const { data } = await supabase
      .from("respuestas_exhibicion")
      .select("id")
      .eq("exhibicion_id", exhibicionId)
      .eq("producto_id", productoId)
      .ilike("tienda", `%${tienda}%`)
      .maybeSingle();

    return !!data;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResults({ success: 0, errors: 0, skipped: 0, reasons: {} });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

      setProgress({ current: 0, total: rows.length });

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const skipReasons: Record<string, number> = {};

      const addSkipReason = (reason: string) => {
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        skippedCount++;
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setProgress({ current: i + 1, total: rows.length });

        try {
          // Get values using flexible column name matching
          const tienda = pick(row, ["tienda", "TIENDA"]);
          const codProducto = pick(row, ["cod_producto", "COD PRODUCTO", "codigo producto", "cod producto"]);
          const ciudad = pick(row, ["ciudad", "CIUDAD"]);
          const bandera = pick(row, ["bandera", "BANDERA"]);
          const seccion = pick(row, ["seccion", "SECCION"]);
          const linea = pick(row, ["linea", "LINEA"]);
          const descripcionProducto = pick(row, ["descripcion_producto", "PRODUCTO", "descripcion producto", "producto"]);
          const tipoExhibicion = pick(row, ["tipo_exhibicion", "TIPO EXHIBICION", "tipo exhibicion"]);
          const codigoExhibicion = pick(row, ["codigo_exhibicion", "CODIGO EXHIBICION", "codigo exhibicion"]);
          const presenciaExhibicion = pick(row, ["presencia_exhibicion", "PRESENCIA EXHIBICION", "presencia exhibicion"]);
          const ubicacion = pick(row, ["ubicacion", "UBICACION"]);
          const observaciones = pick(row, ["observaciones", "OBSERVACIONES"]);
          const foto = pick(row, ["foto", "FOTO"]);
          const fotoRegistro = pick(row, ["foto_registro", "FOTO REGISTRO", "foto registro"]);
          const fechaStr = pick(row, ["fecha", "FECHA"]);
          const encargado = pick(row, ["encargado", "ENCARGADO"]);
          const encargado2 = pick(row, ["encargado_2", "ENCARGADO 2", "encargado 2"]);
          const presenciaCartel = pick(row, ["presencia_cartel_con_tarjeta", "PRESENCIA CARTEL CON TARJETA", "presencia cartel con tarjeta"]);
          const precioTarjeta = pick(row, ["precio_tarjeta", "PRECIO TARJETA", "precio tarjeta"]);

          // Skip rows without required data
          if (!tienda || !codProducto) {
            addSkipReason("Sin tienda o cod_producto");
            continue;
          }

          // Get user ID for this store (falls back to current admin user)
          const userId = await getUserIdForStore(tienda);

          // Find the product ID
          const productoId = await findProductId(codProducto, tienda);
          if (!productoId) {
            addSkipReason(`Producto no encontrado: ${codProducto}`);
            continue;
          }

          // Check if record already exists
          const exists = await checkIfRecordExists(productoId, tienda);
          if (exists) {
            addSkipReason("Ya existe");
            continue;
          }

          // Parse date - support multiple formats
          let fecha: string | null = null;
          if (fechaStr) {
            if (fechaStr.includes("/")) {
              const dateParts = fechaStr.split("/");
              if (dateParts.length === 3) {
                fecha = `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`;
              }
            } else if (fechaStr.includes("-")) {
              fecha = fechaStr; // Already in YYYY-MM-DD format
            }
          }

          // Process photos - if it's a URL, keep it as is
          const fotoUrl = await processPhoto(foto, userId, productoId, "foto");
          const fotoRegistroUrl = await processPhoto(fotoRegistro, userId, productoId, "registro");

          // Prepare the record
          const record = {
            exhibicion_id: exhibicionId,
            producto_id: productoId,
            created_by: userId,
            tienda: tienda,
            ciudad: ciudad || null,
            bandera: bandera || null,
            seccion: seccion || null,
            linea: linea || null,
            cod_producto: codProducto,
            descripcion_producto: descripcionProducto || null,
            tipo_exhibicion: tipoExhibicion || null,
            codigo_exhibicion: codigoExhibicion || null,
            presencia_exhibicion: presenciaExhibicion || null,
            ubicacion: ubicacion || null,
            observaciones: observaciones || null,
            foto: fotoUrl,
            foto_registro: fotoRegistroUrl,
            fecha: fecha,
            encargado: encargado || null,
            encargado_2: encargado2 || null,
            presencia_cartel_con_tarjeta: presenciaCartel?.toLowerCase() === "sí" || presenciaCartel?.toLowerCase() === "si" || presenciaCartel?.toLowerCase() === "true" || presenciaCartel === "1",
            precio_tarjeta: precioTarjeta ? parseFloat(precioTarjeta) : null,
          };

          const { error } = await supabase.from("respuestas_exhibicion").insert(record);

          if (error) {
            console.error("Insert error:", error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error("Row processing error:", err);
          errorCount++;
        }
      }

      setResults({ success: successCount, errors: errorCount, skipped: skippedCount, reasons: skipReasons });

      if (successCount > 0) {
        toast.success(`${successCount} registros restaurados exitosamente`);
        onComplete?.();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} registros fallaron`);
      }
    } catch (error) {
      console.error("XLSX parse error:", error);
      toast.error("Error al leer el archivo Excel");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Upload className="h-5 w-5" />
          Restaurar Datos desde Excel
        </CardTitle>
        <CardDescription>
          Sube el archivo XLSX para restaurar los registros. Las fotos deben estar como links en las columnas FOTO y FOTO REGISTRO.
          Solo se insertarán registros que no existan actualmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="max-w-xs"
          />
          {isProcessing && (
            <div className="flex items-center gap-2 text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Procesando {progress.current} de {progress.total}...</span>
            </div>
          )}
        </div>

        {(results.success > 0 || results.errors > 0 || results.skipped > 0) && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-4 text-sm">
              {results.success > 0 && (
                <div className="flex items-center gap-1 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  {results.success} insertados
                </div>
              )}
              {results.skipped > 0 && (
                <div className="flex items-center gap-1 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  {results.skipped} omitidos
                </div>
              )}
              {results.errors > 0 && (
                <div className="flex items-center gap-1 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {results.errors} errores
                </div>
              )}
            </div>
            {Object.keys(results.reasons).length > 0 && (
              <div className="text-xs text-muted-foreground bg-white/50 p-2 rounded">
                <strong>Razones de omisión:</strong>
                <ul className="mt-1 list-disc list-inside">
                  {Object.entries(results.reasons).map(([reason, count]) => (
                    <li key={reason}>{reason}: {count}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
