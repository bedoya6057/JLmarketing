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
import { Loader2, FileSpreadsheet, Plus } from "lucide-react";
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

interface AddExhibicionProductsProps {
  exhibicionId: string;
  exhibicionNombre: string;
  onUpdate: () => void;
}

export const AddExhibicionProducts = ({ 
  exhibicionId, 
  exhibicionNombre,
  onUpdate 
}: AddExhibicionProductsProps) => {
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

  const handleAdd = async () => {
    if (csvProducts.length === 0) {
      toast.error("Debes cargar un archivo con productos");
      return;
    }

    setLoading(true);

    try {
      // Group products from file by store (tienda)
      const productsByStore = new Map<string, ProductRow[]>();
      csvProducts.forEach(p => {
        const tienda = String(p.tienda ?? "").trim();
        if (!productsByStore.has(tienda)) {
          productsByStore.set(tienda, []);
        }
        productsByStore.get(tienda)!.push(p);
      });

      // Get existing products for this exhibition grouped by store and code
      const { data: existingProducts, error: fetchError } = await supabase
        .from("productos_exhibicion")
        .select("id, tienda, cod_producto")
        .eq("exhibicion_id", exhibicionId);

      if (fetchError) throw fetchError;

      // Create a map of existing stores and their products
      const existingByStore = new Map<string, Map<string, string>>();
      (existingProducts || []).forEach(p => {
        const tienda = String(p.tienda ?? "").toLowerCase().trim();
        const code = String(p.cod_producto ?? "").toLowerCase().trim();
        if (!existingByStore.has(tienda)) {
          existingByStore.set(tienda, new Map());
        }
        if (code) {
          existingByStore.get(tienda)!.set(code, p.id);
        }
      });

      const productsToInsert: any[] = [];
      const productsToUpdate: { id: string; data: any }[] = [];
      let newStoresCount = 0;
      let updatedCount = 0;

      for (const [tienda, products] of productsByStore) {
        const tiendaKey = tienda.toLowerCase().trim();
        const existingCodesForStore = existingByStore.get(tiendaKey);

        if (!existingCodesForStore || existingCodesForStore.size === 0) {
          // Store doesn't exist in exhibition - add all products
          newStoresCount++;
          products.forEach(p => {
            productsToInsert.push({
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
            });
          });
        } else {
          // Store exists - check each product
          products.forEach(p => {
            const code = String(p.cod_producto ?? "").toLowerCase().trim();
            const existingId = code ? existingCodesForStore.get(code) : null;

            if (existingId) {
              // Product exists - update it
              productsToUpdate.push({
                id: existingId,
                data: {
                  tienda: p.tienda,
                  vigencia: p.vigencia,
                  seccion: p.seccion,
                  linea: p.linea,
                  estado_producto: p.estado_producto,
                  macrocategoria: p.macrocategoria,
                  microcategoria: p.microcategoria,
                  descripcion_producto: p.descripcion_producto,
                  marca: p.marca,
                  tipo_exhibicion: p.tipo_exhibicion,
                  codigo_exhibicion: p.codigo_exhibicion,
                  suma_tiendas: p.suma_tiendas,
                }
              });
              updatedCount++;
            } else {
              // New product for existing store - insert it
              productsToInsert.push({
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
              });
            }
          });
        }
      }

      // Perform insertions
      if (productsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("productos_exhibicion")
          .insert(productsToInsert);

        if (insertError) throw insertError;
      }

      // Perform updates
      for (const item of productsToUpdate) {
        const { error: updateError } = await supabase
          .from("productos_exhibicion")
          .update(item.data)
          .eq("id", item.id);

        if (updateError) throw updateError;
      }

      // Build summary message
      const messages: string[] = [];
      if (newStoresCount > 0) {
        messages.push(`${newStoresCount} tienda(s) nueva(s)`);
      }
      if (productsToInsert.length > 0) {
        messages.push(`${productsToInsert.length} productos agregados`);
      }
      if (updatedCount > 0) {
        messages.push(`${updatedCount} productos actualizados`);
      }

      if (messages.length > 0) {
        toast.success(messages.join(", "));
      } else {
        toast.info("No hubo cambios que aplicar");
      }

      setCsvProducts([]);
      setOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Error al procesar productos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Productos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Productos</DialogTitle>
          <DialogDescription>
            Sube un archivo para agregar nuevos productos a "{exhibicionNombre}" sin eliminar los existentes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file-add">Archivo de Productos (CSV o Excel)</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file-add"
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
                {csvProducts.length} productos listos para agregar
              </p>
            )}
          </div>

          <div className="bg-primary/10 p-3 rounded-md space-y-1">
            <p className="text-sm text-primary font-medium">Lógica por tienda:</p>
            <ul className="text-sm text-primary list-disc list-inside">
              <li>Tienda nueva → se agregan todos los productos</li>
              <li>Tienda existente → se actualizan productos existentes y se agregan nuevos</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={loading || csvProducts.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
