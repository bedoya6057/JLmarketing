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

const normalize = (s: any) => (s ?? "").toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Convert Excel serial date to ISO date string
const excelDateToISO = (value: any): string | null => {
  if (value === undefined || value === null || value === '') return null;
  
  // If it's already a date string (YYYY-MM-DD or similar), return as-is
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Check if it looks like a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
      // Convert DD/MM/YYYY to YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return trimmed;
    }
  }
  
  // If it's a number (Excel serial date)
  const num = parseFloat(value);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    // Excel dates start from 1900-01-01 (serial = 1)
    // But Excel has a bug treating 1900 as a leap year, so we subtract 2 instead of 1
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const resultDate = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    return resultDate.toISOString().split('T')[0];
  }
  
  return null;
};

const pick = (row: any, candidates: string[]) => {
  const map = new Map<string, any>();
  Object.keys(row || {}).forEach((k) => map.set(normalize(k), (row as any)[k]));
  for (const key of candidates) {
    const v = map.get(normalize(key));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

interface AddEncarteProductsProps {
  encarteId: string;
  encarteNombre: string;
  onUpdate: () => void;
}

export const AddEncarteProducts = ({ 
  encarteId, 
  encarteNombre,
  onUpdate 
}: AddEncarteProductsProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvProducts, setCsvProducts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseRow = (row: any) => ({
    cod_interno: pick(row, [
      "Cód. Interno", "Cod Interno", "COD INTERNO", "codigo_interno",
      "Cód. Producto", "Cod Producto", "COD PRODUCTO", "codigo_producto"
    ]),
    descripcion_producto_carteleria: pick(row, [
      "Descripción del producto en cartelería", "Descripcion del producto en carteleria",
      "Descripción de producto en cartelería", "Descripción del producto", "Producto", 
      "descripcion_producto_carteleria", "Descripción de producto (Cartelería)",
      "Descripcion de producto (Carteleria)", "DESCRIPCION DE PRODUCTO (CARTELERIA)"
    ]),
    macrocategoria: pick(row, [
      "MACROCATEGORÍA", "Macrocategoría", "Macrocategoria", "MACROCATEGORIA",
      "MACROTEGORIA", "Macrotegoria" // Common typo
    ]),
    microcategoria: pick(row, ["MICROCATEGORÍA", "Microcategoría", "Microcategoria", "MICROCATEGORIA"]),
    categoria: pick(row, ["Categoría", "Categoria", "CATEGORÍA", "CATEGORIA"]),
    division: pick(row, ["División", "Division", "DIVISIÓN", "DIVISION"]),
    precio_encarte: parseFloat(pick(row, ["Precio Encarte", "PRECIO ENCARTE", "precio_encarte"]) || "0") || null,
    precio_promo: parseFloat(pick(row, ["Precio Promo", "PRECIO PROMO", "precio_promo"]) || "0") || null,
    precio_regular: parseFloat(pick(row, ["Precio Regular", "PRECIO REGULAR", "precio_regular"]) || "0") || null,
    precio_promo_tarjeta: parseFloat(pick(row, ["Precio Promo Tarjeta", "PRECIO PROMO TARJETA", "precio_promo_tarjeta"]) || "0") || null,
    precio_pack: parseFloat(pick(row, ["Precio Pack", "PRECIO PACK", "precio_pack"]) || "0") || null,
    precio_pack_tarjeta: parseFloat(pick(row, ["Precio Pack Tarjeta", "PRECIO PACK TARJETA", "precio_pack_tarjeta"]) || "0") || null,
    monto_minimo: parseFloat(pick(row, ["Monto Minimo", "MONTO MINIMO", "monto_minimo"]) || "0") || null,
    mecanica: pick(row, ["Mecánica", "Mecanica", "MECÁNICA", "MECANICA"]),
    nombre_mecanica: pick(row, ["Nombre de Mécanica", "Nombre de Mecanica", "Nombre Mecanica", "NOMBRE MECANICA", "nombre_mecanica"]),
    nombre_campana: pick(row, ["Nombre de Campaña", "Nombre de Campana", "Nombre Campana", "NOMBRE CAMPANA", "nombre_campana"]),
    formato: pick(row, ["Formato", "FORMATO"]),
    atributo: pick(row, ["Atributo", "ATRIBUTO"]),
    pagina: pick(row, ["Página", "Pagina", "PÁGINA", "PAGINA"]),
    numero_cartel: pick(row, [
      "Número Cartel", "Numero Cartel", "NÚMERO CARTEL", "numero_cartel",
      "N° de Cartel", "N de Cartel", "No. de Cartel", "No de Cartel"
    ]),
    exhibicion: pick(row, ["Exhibición", "Exhibicion", "EXHIBICIÓN", "EXHIBICION"]),
    cabecera: pick(row, ["Cabecera", "CABECERA"]),
    tipo_requerimiento: pick(row, ["Tipo de Requerimiento", "Tipo Requerimiento", "TIPO REQUERIMIENTO", "tipo_requerimiento"]),
    foto_publicar: pick(row, ["Foto a publicar", "Foto Publicar", "FOTO PUBLICAR", "foto_publicar"]),
    cod_gpo_articulo: pick(row, ["Cód. Gpo. Artículo", "Cod Gpo Articulo", "COD GPO ARTICULO", "cod_gpo_articulo"]),
    fecha_inicio: excelDateToISO(pick(row, ["Fecha Inicio", "FECHA INICIO", "fecha_inicio"])),
    fecha_fin: excelDateToISO(pick(row, ["Fecha Fin", "FECHA FIN", "fecha_fin"])),
    uxb: pick(row, ["UxB", "UXB", "uxb"]),
    bi_tri_precio: pick(row, ["BiTriPrecio", "Bi Tri Precio", "BI TRI PRECIO", "bi_tri_precio"]),
    medio_pago: pick(row, ["Medio de Pago", "Medio Pago", "MEDIO PAGO", "medio_pago"]),
    descripcion_mecanica_tarjeta: pick(row, ["Descripción Mecánica de Tarjeta", "Descripcion Mecanica Tarjeta", "descripcion_mecanica_tarjeta"]),
    cuotas: pick(row, ["Cuotas", "CUOTAS", "cuotas"]),
    cantidad_comprar: pick(row, ["Cantidad a Comprar", "Cantidad Comprar", "CANTIDAD COMPRAR", "cantidad_comprar"]),
    gasto_producto: parseFloat(pick(row, ["Gasto Producto", "GASTO PRODUCTO", "gasto_producto"]) || "0") || null,
    gasto_financiero: parseFloat(pick(row, ["Gasto Financiero", "GASTO FINANCIERO", "gasto_financiero"]) || "0") || null,
    aporte_col: parseFloat(pick(row, ["Aporte", "APORTE", "aporte_col"]) || "0") || null,
    promocion_acumulable: pick(row, ["Promoción acumulable", "Promocion acumulable", "PROMOCION ACUMULABLE", "promocion_acumulable"]),
    cod_auspiciador: pick(row, ["Cod. Auspiciador", "Cod Auspiciador", "COD AUSPICIADOR", "cod_auspiciador"]),
    descripcion_auspiciador: pick(row, ["Descripción de Auspiciador", "Descripcion Auspiciador", "descripcion_auspiciador"]),
    cant_auspiciador: pick(row, ["Cant. Auspiciador", "Cant Auspiciador", "CANT AUSPICIADOR", "cant_auspiciador"]),
    codigo_local: pick(row, ["Código Local", "Codigo Local", "CODIGO LOCAL", "codigo_local"]),
    legal: pick(row, ["Legal", "LEGAL", "legal"]),
    unidad_limite: pick(row, ["Unidad Limite", "UNIDAD LIMITE", "unidad_limite"]),
    maximo_abierto: pick(row, ["Máximo abierto", "Maximo abierto", "MAXIMO ABIERTO", "maximo_abierto"]),
    maximo_tarjeta: pick(row, ["Máximo Tarjeta", "Maximo Tarjeta", "MAXIMO TARJETA", "maximo_tarjeta"]),
    condicion_especial: pick(row, ["Condición Especial", "Condicion Especial", "CONDICION ESPECIAL", "condicion_especial"]),
    logo: pick(row, ["Logo", "LOGO", "logo"]),
    tags: pick(row, ["Tags", "TAGS", "tags"]),
    descripcion_col: pick(row, ["Descripción", "Descripcion", "DESCRIPCION", "descripcion_col"]),
    medidas: pick(row, ["Medidas", "MEDIDAS", "medidas"]),
    regalos: pick(row, ["Regalos", "REGALOS", "regalos"]),
    usuario_comercial: pick(row, ["Usuario Comercial", "USUARIO COMERCIAL", "usuario_comercial"]),
    estado_producto: pick(row, ["Estado", "ESTADO", "estado_producto"]),
    unidad_medida: pick(row, ["Unidad de Medida", "Unidad Medida", "UNIDAD MEDIDA", "unidad_medida"]),
    alto_grasas_saturadas: pick(row, ["Alto en grasas saturadas", "ALTO EN GRASAS SATURADAS", "alto_grasas_saturadas"]) === "SI" || pick(row, ["Alto en grasas saturadas"]) === true,
    alto_azucar: pick(row, ["Alto en azúcar", "Alto en azucar", "ALTO EN AZUCAR", "alto_azucar"]) === "SI" || pick(row, ["Alto en azúcar"]) === true,
    alto_sodio: pick(row, ["Alto en Sodio", "Alto en sodio", "ALTO EN SODIO", "alto_sodio"]) === "SI" || pick(row, ["Alto en Sodio"]) === true,
    contiene_grasas_trans: pick(row, ["Contiene grasas trans", "CONTIENE GRASAS TRANS", "contiene_grasas_trans"]) === "SI" || pick(row, ["Contiene grasas trans"]) === true,
    estado_carga: pick(row, ["Estado de carga", "Estado Carga", "ESTADO CARGA", "estado_carga"]),
    usuario_promociones: pick(row, ["Usuario promociones", "Usuario Promociones", "USUARIO PROMOCIONES", "usuario_promociones"]),
    usuario_pricing: pick(row, ["Usuario Pricing", "USUARIO PRICING", "usuario_pricing"]),
    variacion_promocional_abierta: pick(row, ["Variación Promocional Abierta", "Variacion Promocional Abierta", "variacion_promocional_abierta"]),
    descripcion_variacion_abierta: pick(row, ["Descripción Variación Abierta", "Descripcion Variacion Abierta", "descripcion_variacion_abierta"]),
    variacion_promocional_tarjeta: pick(row, ["Variación Promocional Tarjeta", "Variacion Promocional Tarjeta", "variacion_promocional_tarjeta"]),
    descripcion_variacion_tarjeta: pick(row, ["Descripción Variación Tarjeta", "Descripcion Variacion Tarjeta", "descripcion_variacion_tarjeta"]),
    num_promo: pick(row, ["Núm. Promo", "Num Promo", "NUM PROMO", "num_promo"]),
    producto_id: pick(row, ["ProductoID", "Producto ID", "PRODUCTOID", "producto_id"]),
    estado_variacion: pick(row, ["Estado Variacion", "ESTADO VARIACION", "estado_variacion"]),
    gerente_aprobador: pick(row, ["Gerente Aprobador", "GERENTE APROBADOR", "gerente_aprobador"]),
    tipo_promocion: pick(row, ["Tipo Promocion", "TIPO PROMOCION", "tipo_promocion"]),
    gasto_total_promos_oh: pick(row, ["Gasto Total Promos OH", "GASTO TOTAL PROMOS OH", "gasto_total_promos_oh"]),
    gasto_toh: pick(row, ["Gasto TOH", "GASTO TOH", "gasto_toh"]),
    gasto_comercial_promos_toh: pick(row, ["Gasto Comercial Promos TOH", "GASTO COMERCIAL PROMOS TOH", "gasto_comercial_promos_toh"]),
    dp: pick(row, ["Aporte DP", "Aporte dp", "APORTE DP", "dp"]),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const products = (results.data as any[])
            .map(parseRow)
            .filter((p: any) => p.descripcion_producto_carteleria);

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
            const mapped = (rows as any[])
              .map(parseRow)
              .filter((p: any) => p.descripcion_producto_carteleria);

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
      // Get existing products with id and cod_interno to detect existing ones
      const { data: existingProducts, error: fetchError } = await supabase
        .from("productos")
        .select("id, cod_interno, microcategoria, macrocategoria")
        .eq("encarte_id", encarteId);

      if (fetchError) throw fetchError;

      const existingMap = new Map(
        (existingProducts || [])
          .filter(p => p.cod_interno)
          .map(p => [String(p.cod_interno).toLowerCase().trim(), p])
      );

      // Separate: products to update (existing) vs insert (new)
      const toUpdate: { id: string; microcategoria?: string; macrocategoria?: string }[] = [];
      const newProducts = csvProducts.filter(p => {
        const code = String(p.cod_interno ?? "").toLowerCase().trim();
        if (code && existingMap.has(code)) {
          const existing = existingMap.get(code)!;
          // Update microcategoria/macrocategoria if file has them and DB doesn't
          if (
            (p.microcategoria && !existing.microcategoria) ||
            (p.macrocategoria && !existing.macrocategoria)
          ) {
            toUpdate.push({
              id: existing.id,
              microcategoria: p.microcategoria || existing.microcategoria,
              macrocategoria: p.macrocategoria || existing.macrocategoria,
            });
          }
          return false; // don't insert
        }
        return true;
      });

      // Update existing products with microcategoria/macrocategoria
      let updatedCount = 0;
      for (const item of toUpdate) {
        const { error: updateError } = await supabase
          .from("productos")
          .update({ microcategoria: item.microcategoria, macrocategoria: item.macrocategoria })
          .eq("id", item.id);
        if (!updateError) updatedCount++;
      }

      if (newProducts.length === 0 && updatedCount === 0) {
        toast.info("Todos los productos ya existen en el encarte y están completos");
        setOpen(false);
        return;
      }

      if (newProducts.length === 0) {
        toast.success(`${updatedCount} productos actualizados con microcategoría`);
        setCsvProducts([]);
        setOpen(false);
        onUpdate();
        return;
      }

      // Insert only new products with all fields
      const productsToInsert = newProducts.map((p: any) => ({
        encarte_id: encarteId,
        cod_interno: p.cod_interno,
        descripcion_producto_carteleria: p.descripcion_producto_carteleria,
        macrocategoria: p.macrocategoria,
        microcategoria: p.microcategoria,
        categoria: p.categoria,
        division: p.division,
        precio_encarte: p.precio_encarte,
        precio_promo: p.precio_promo,
        precio_regular: p.precio_regular,
        precio_promo_tarjeta: p.precio_promo_tarjeta,
        precio_pack: p.precio_pack,
        precio_pack_tarjeta: p.precio_pack_tarjeta,
        monto_minimo: p.monto_minimo,
        mecanica: p.mecanica,
        nombre_mecanica: p.nombre_mecanica,
        nombre_campana: p.nombre_campana,
        formato: p.formato,
        atributo: p.atributo,
        pagina: p.pagina,
        numero_cartel: p.numero_cartel,
        exhibicion: p.exhibicion,
        cabecera: p.cabecera,
        tipo_requerimiento: p.tipo_requerimiento,
        foto_publicar: p.foto_publicar,
        cod_gpo_articulo: p.cod_gpo_articulo,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        uxb: p.uxb,
        bi_tri_precio: p.bi_tri_precio,
        medio_pago: p.medio_pago,
        descripcion_mecanica_tarjeta: p.descripcion_mecanica_tarjeta,
        cuotas: p.cuotas,
        cantidad_comprar: p.cantidad_comprar,
        gasto_producto: p.gasto_producto,
        gasto_financiero: p.gasto_financiero,
        aporte_col: p.aporte_col,
        promocion_acumulable: p.promocion_acumulable,
        cod_auspiciador: p.cod_auspiciador,
        descripcion_auspiciador: p.descripcion_auspiciador,
        cant_auspiciador: p.cant_auspiciador,
        codigo_local: p.codigo_local,
        legal: p.legal,
        unidad_limite: p.unidad_limite,
        maximo_abierto: p.maximo_abierto,
        maximo_tarjeta: p.maximo_tarjeta,
        condicion_especial: p.condicion_especial,
        logo: p.logo,
        tags: p.tags,
        descripcion_col: p.descripcion_col,
        medidas: p.medidas,
        regalos: p.regalos,
        usuario_comercial: p.usuario_comercial,
        estado_producto: p.estado_producto,
        unidad_medida: p.unidad_medida,
        alto_grasas_saturadas: p.alto_grasas_saturadas,
        alto_azucar: p.alto_azucar,
        alto_sodio: p.alto_sodio,
        contiene_grasas_trans: p.contiene_grasas_trans,
        estado_carga: p.estado_carga,
        usuario_promociones: p.usuario_promociones,
        usuario_pricing: p.usuario_pricing,
        variacion_promocional_abierta: p.variacion_promocional_abierta,
        descripcion_variacion_abierta: p.descripcion_variacion_abierta,
        variacion_promocional_tarjeta: p.variacion_promocional_tarjeta,
        descripcion_variacion_tarjeta: p.descripcion_variacion_tarjeta,
        num_promo: p.num_promo,
        producto_id: p.producto_id,
        estado_variacion: p.estado_variacion,
        gerente_aprobador: p.gerente_aprobador,
        tipo_promocion: p.tipo_promocion,
        gasto_total_promos_oh: p.gasto_total_promos_oh,
        gasto_toh: p.gasto_toh,
        gasto_comercial_promos_toh: p.gasto_comercial_promos_toh,
        dp: p.dp,
      }));

      const { error: insertError } = await supabase
        .from("productos")
        .insert(productsToInsert);

      if (insertError) throw insertError;

      const parts = [];
      if (newProducts.length > 0) parts.push(`${newProducts.length} productos agregados`);
      if (updatedCount > 0) parts.push(`${updatedCount} actualizados con microcategoría`);
      toast.success(parts.join(', '));
      setCsvProducts([]);
      setOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Error al agregar productos");
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
            Sube un archivo para agregar nuevos productos a "{encarteNombre}" sin eliminar los existentes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file-add-encarte">Archivo de Productos (CSV o Excel)</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file-add-encarte"
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

          <div className="bg-primary/10 p-3 rounded-md">
            <p className="text-sm text-primary">
              ✓ Los productos existentes se mantendrán. Solo se agregarán productos nuevos (por código interno).
            </p>
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
