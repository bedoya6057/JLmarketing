import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, ArrowLeft } from "lucide-react";
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

export const NewExhibicionForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [csvProducts, setCsvProducts] = useState<ProductRow[]>([]);
  const [banderas, setBanderas] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nombre: "",
    ciudad: "",
    bandera: "",
    fecha: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadBanderas();
  }, []);


  const loadBanderas = async () => {
    try {
      const { data, error } = await supabase
        .from("tiendas")
        .select("bandera")
        .order("bandera");

      if (error) throw error;

      const uniqueBanderas = Array.from(new Set(data?.map(t => t.bandera) || []));
      setBanderas(uniqueBanderas);
    } catch (error) {
      console.error("Error loading banderas:", error);
    }
  };


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
            toast.error("No se reconocieron las columnas del archivo. Verifica los encabezados.");
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
            toast.error("No se reconocieron las columnas del archivo. Verifica los encabezados (usa nombres como 'Cód. Producto' y 'Descripción del producto en cartelería').");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (csvProducts.length === 0) {
      toast.error("Debes cargar un archivo con productos");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const fecha = new Date(formData.fecha);
      const mesNombre = fecha.toLocaleString("es-ES", { month: "long" });
      const mesCod = fecha.getMonth() + 1;

      const { data: exhibicion, error: exhibicionError } = await supabase
        .from("exhibiciones")
        .insert({
          nombre: formData.nombre,
          ciudad: formData.ciudad,
          bandera: formData.bandera,
          fecha: formData.fecha,
          mes: mesNombre,
          mes_cod: mesCod,
          created_by: user.id,
          encargado_1: user.id,
        })
        .select()
        .single();

      if (exhibicionError) throw exhibicionError;

      const productsToInsert = csvProducts.map((p: any) => ({
        exhibicion_id: exhibicion.id,
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

      const { error: productsError } = await supabase
        .from("productos_exhibicion")
        .insert(productsToInsert);

      if (productsError) throw productsError;

      toast.success("Exhibición creada exitosamente");
      navigate(`/dashboard/exhibicion/${exhibicion.id}`);
    } catch (error: any) {
      toast.error(error.message || "Error al crear exhibición");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva Exhibición</CardTitle>
          <CardDescription>
            Completa la información básica y carga la lista de productos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Exhibición *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  placeholder="Ej: Exhibición Enero 2025"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad *</Label>
                <Input
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={(e) =>
                    setFormData({ ...formData, ciudad: e.target.value })
                  }
                  placeholder="Ej: Santiago"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandera">Bandera *</Label>
                <Select
                  value={formData.bandera}
                  onValueChange={(value) =>
                    setFormData({ ...formData, bandera: value })
                  }
                  required
                >
                  <SelectTrigger id="bandera">
                    <SelectValue placeholder="Selecciona una bandera" />
                  </SelectTrigger>
                  <SelectContent>
                    {banderas.map((bandera) => (
                      <SelectItem key={bandera} value={bandera}>
                        {bandera}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Archivo de Productos (CSV o Excel) *</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    id="file"
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
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Seleccionar
                  </Button>
                </div>
                {csvProducts.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {csvProducts.length} productos cargados
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={loading || csvProducts.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Exhibición
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
