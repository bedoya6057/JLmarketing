import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, RefreshCw } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ProductRow {
  tienda?: string;
  vigencia?: string;
  seccion?: string;
  linea?: string;
  estado_producto?: string;
  macrocategoria?: string;
  microcategoria?: string;
  cod_producto?: string;
  descripcion_producto: string;
  marca?: string;
  tipo_exhibicion?: string;
  codigo_exhibicion?: string;
  suma_tiendas?: string;
}

const normalize = (s: any) => (s ?? "").toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const pick = (row: any, candidates: string[]) => {
  const map = new Map<string, any>();
  Object.keys(row || {}).forEach((k) => map.set(normalize(k), (row as any)[k]));
  for (const key of candidates) {
    const v = map.get(normalize(key));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

interface UpdateExhibicionProductsProps {
  exhibicionId: string;
  exhibicionNombre: string;
  onUpdate: () => void;
}

export const UpdateExhibicionProducts = ({ 
  exhibicionId, 
  exhibicionNombre,
  onUpdate 
}: UpdateExhibicionProductsProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvProducts, setCsvProducts] = useState<ProductRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const products = (results.data as any[]).map((row: any) => ({
            tienda: pick(row, ["Tienda", "TIENDA", "Local", "Sucursal"]),
            vigencia: pick(row, ["Vigencia", "VIGENCIA", "Periodo", "Período"]),
            seccion: pick(row, ["Sección", "Seccion", "SECCIÓN"]),
            linea: pick(row, ["Linea", "Línea", "LINEA"]),
            estado_producto: pick(row, ["Estado", "ESTADO", "Estado del producto"]),
            macrocategoria: pick(row, ["MACROCATEGORÍA", "Macrocategoría", "Macrocategoria", "MACROCATEGORIA"]),
            microcategoria: pick(row, ["MICROCATEGORÍA", "Microcategoría", "Microcategoria", "MICROCATEGORIA"]),
            cod_producto: pick(row, ["Cód. Producto", "Cod. Producto", "COD. PRODUCTO", "Código Producto"]),
            descripcion_producto: pick(row, [
              "Descripción del producto en cartelería", "Descripcion del producto en carteleria",
              "Descripción de producto en cartelería", "Descripción del producto", "Producto",
            ]),
            marca: pick(row, ["Marca", "MARCA"]),
            tipo_exhibicion: pick(row, ["Tipo de exhibición", "Tipo Exhibición", "Tipo exhibicion"]),
            codigo_exhibicion: pick(row, ["Código de exhibición", "Codigo de exhibicion", "Código Exhibición"]),
            suma_tiendas: pick(row, ["Suma Tiendas", "SUMA TIENDAS", "Suma tiendas"]),
          })).filter((p: any) => p.descripcion_producto);

          setCsvProducts(products);
          if (products.length === 0) {
            toast.error("No se reconocieron las columnas del archivo");
          } else {
            toast.success(`${products.length} productos cargados`);
          }
        },
        error: (error) => {
          toast.error("Error al leer el archivo CSV");
          console.error(error);
        },
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          let best: any[] = [];

          for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
            const mapped = (rows as any[]).map((row: any) => ({
              tienda: pick(row, ["Tienda", "TIENDA", "Local", "Sucursal"]),
              vigencia: pick(row, ["Vigencia", "VIGENCIA", "Periodo", "Período"]),
              seccion: pick(row, ["Sección", "Seccion", "SECCIÓN"]),
              linea: pick(row, ["Linea", "Línea", "LINEA"]),
              estado_producto: pick(row, ["Estado", "ESTADO", "Estado del producto"]),
              macrocategoria: pick(row, ["MACROCATEGORÍA", "Macrocategoría", "Macrocategoria", "MACROCATEGORIA"]),
              microcategoria: pick(row, ["MICROCATEGORÍA", "Microcategoría", "Microcategoria", "MICROCATEGORIA"]),
              cod_producto: pick(row, ["Cód. Producto", "Cod. Producto", "COD. PRODUCTO", "Código Producto"]),
              descripcion_producto: pick(row, [
                "Descripción del producto en cartelería", "Descripcion del producto en carteleria",
                "Descripción de producto en cartelería", "Descripción del producto", "Producto",
              ]),
              marca: pick(row, ["Marca", "MARCA"]),
              tipo_exhibicion: pick(row, ["Tipo de exhibición", "Tipo Exhibición", "Tipo exhibicion"]),
              codigo_exhibicion: pick(row, ["Código de exhibición", "Codigo de exhibicion", "Código Exhibición"]),
              suma_tiendas: pick(row, ["Suma Tiendas", "SUMA TIENDAS", "Suma tiendas"]),
            })).filter((p: any) => p.descripcion_producto);

            if (mapped.length > best.length) best = mapped;
          }

          setCsvProducts(best);
          if (best.length === 0) {
            toast.error("No se reconocieron las columnas del archivo");
          } else {
            toast.success(`${best.length} productos cargados desde Excel`);
          }
        } catch (error) {
          toast.error("Error al leer el archivo Excel");
          console.error(error);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato no soportado. Use CSV o Excel (.xlsx, .xls)");
    }
  };

  const handleUpdate = async () => {
    if (csvProducts.length === 0) {
      toast.error("Debes cargar un archivo con productos");
      return;
    }

    setLoading(true);

    try {
      // Delete existing products for this exhibición
      const { error: deleteError } = await supabase
        .from("productos_exhibicion")
        .delete()
        .eq("exhibicion_id", exhibicionId);

      if (deleteError) throw deleteError;

      // Insert new products
      const productsToInsert = csvProducts.map((p: any) => ({
        exhibicion_id: exhibicionId,
        tienda: p.tienda,
        vigencia: p.vigencia,
        seccion: p.seccion,
        linea: p.linea,
        estado_producto: p.estado_producto,
        macrocategoria: p.macrocategoria,
        microcategoria: p.microcategoria,
        cod_producto: p.cod_producto,
        descripcion_producto: p.descripcion_producto,
        marca: p.marca,
        tipo_exhibicion: p.tipo_exhibicion,
        codigo_exhibicion: p.codigo_exhibicion,
        suma_tiendas: p.suma_tiendas,
      }));

      const { error: insertError } = await supabase
        .from("productos_exhibicion")
        .insert(productsToInsert);

      if (insertError) throw insertError;

      toast.success(`Productos actualizados: ${csvProducts.length} productos cargados`);
      setCsvProducts([]);
      setOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar productos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar Productos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar Productos</DialogTitle>
          <DialogDescription>
            Sube un nuevo archivo para reemplazar los productos de "{exhibicionNombre}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file-update">Archivo de Productos (CSV o Excel)</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file-update"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </div>
            {csvProducts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {csvProducts.length} productos listos para cargar
              </p>
            )}
          </div>

          <div className="bg-destructive/10 p-3 rounded-md">
            <p className="text-sm text-destructive">
              ⚠️ Esto eliminará todos los productos actuales y los reemplazará con los nuevos. Las respuestas existentes se mantendrán.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={loading || csvProducts.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
