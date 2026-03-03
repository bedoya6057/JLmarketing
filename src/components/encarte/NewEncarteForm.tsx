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
  cod_interno?: string;
  nombre_campana?: string;
  tipo_requerimiento?: string;
  pagina?: string;
  numero_cartel?: string;
  descripcion_producto_carteleria: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  mecanica?: string;
  nombre_mecanica?: string;
  precio_regular?: number;
  precio_promo?: number;
  precio_pack?: number;
  uxb?: string;
  bi_tri_precio?: string;
  medio_pago?: string;
  descripcion_mecanica_tarjeta?: string;
  cuotas?: string;
  precio_promo_tarjeta?: number;
  precio_pack_tarjeta?: number;
  exhibicion?: string;
  cabecera?: string;
  cantidad_comprar?: string;
  monto_minimo?: number;
  macrocategoria?: string;
  microcategoria?: string;
  categoria?: string;
  division?: string;
  atributo?: string;
  estado_producto?: string;
  unidad_medida?: string;
  alto_grasas_saturadas?: boolean;
  alto_azucar?: boolean;
  alto_sodio?: boolean;
  contiene_grasas_trans?: boolean;
  precio_encarte: number;
  foto_publicar?: string;
  cod_gpo_articulo?: string;
  gasto_producto?: number;
  gasto_financiero?: number;
  aporte_col?: number;
  promocion_acumulable?: string;
  cod_auspiciador?: string;
  descripcion_auspiciador?: string;
  cant_auspiciador?: string;
  formato?: string;
  codigo_local?: string;
  legal?: string;
  unidad_limite?: string;
  maximo_abierto?: string;
  maximo_tarjeta?: string;
  condicion_especial?: string;
  logo?: string;
  tags?: string;
  descripcion_col?: string;
  medidas?: string;
  regalos?: string;
  usuario_comercial?: string;
  estado_carga?: string;
  usuario_promociones?: string;
  usuario_pricing?: string;
  variacion_promocional_abierta?: string;
  descripcion_variacion_abierta?: string;
  variacion_promocional_tarjeta?: string;
  descripcion_variacion_tarjeta?: string;
  num_promo?: string;
  producto_id?: string;
  estado_variacion?: string;
  gerente_aprobador?: string;
  tipo_promocion?: string;
  gasto_total_promos_oh?: string;
  gasto_toh?: string;
  gasto_comercial_promos_toh?: string;
  dp?: string;
}

export const NewEncarteForm = () => {
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

  // Load unique banderas on component mount
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

      // Get unique banderas
      const uniqueBanderas = Array.from(new Set(data?.map(t => t.bandera) || []));
      setBanderas(uniqueBanderas);
    } catch (error) {
      console.error("Error loading banderas:", error);
    }
  };



  // Función para convertir números de fecha de Excel o strings numéricos a fecha ISO (YYYY-MM-DD)
  const convertExcelDate = (excelDate: any): string | undefined => {
    if (excelDate === null || excelDate === undefined || excelDate === '') return undefined;

    // Si ya es un objeto Date válido
    if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
      return excelDate.toISOString().split('T')[0];
    }

    if (typeof excelDate === 'number') {
      // Excel serial date number to JavaScript timestamp
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
    }

    if (typeof excelDate === 'string') {
      const trimmed = excelDate.trim();
      if (!trimmed) return undefined;

      // Si es un número en string (ej. "45914.2083") tratar como serial de Excel
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const serial = parseFloat(trimmed);
        const date = new Date((serial - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
      }

      // Intento parsear formato dd/mm/yyyy o d/m/yy
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
        const [d, m, y] = trimmed.split('/');
        const year = y.length === 2 ? (2000 + Number(y)) : Number(y);
        const date = new Date(year, Number(m) - 1, Number(d));
        return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
      }

      // Como fallback, intentar new Date con el string
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split('T')[0];
    }

    return undefined;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      // Handle CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
      complete: (results) => {
        const products = results.data.map((row: any) => ({
          cod_interno: row["Cód. Producto"] || row.cod_interno,
          nombre_campana: row["Nombre de Campaña"] || row.nombre_campana,
          tipo_requerimiento: row["Tipo de Requerimiento"] || row.tipo_requerimiento,
          pagina: row["Página"] || row.pagina,
          numero_cartel: row["N° de Cartel"] || row.numero_cartel,
          descripcion_producto_carteleria: row["Descripción de producto (Cartelería)"] || row.descripcion_producto || row.producto,
          fecha_inicio: convertExcelDate(row["Fecha Inicio"] || row.fecha_inicio),
          fecha_fin: convertExcelDate(row["Fecha Fin"] || row.fecha_fin),
          mecanica: row["Mecánica"] || row.mecanica,
          nombre_mecanica: row["Nombre de Mécanica"] || row.nombre_mecanica,
          precio_regular: parseFloat(row["Precio Regular"] || row.precio_regular || "0"),
          precio_promo: parseFloat(row["Precio Promo"] || row.precio_promo || "0"),
          precio_pack: parseFloat(row["Precio Pack"] || row.precio_pack || "0"),
          uxb: row["UxB"] || row.uxb,
          bi_tri_precio: row["BiTriPrecio"] || row.bi_tri_precio,
          medio_pago: row["Medio de Pago"] || row.medio_pago,
          descripcion_mecanica_tarjeta: row["Descripción Mecánica de Tarjeta"] || row.descripcion_mecanica_tarjeta,
          cuotas: row["Cuotas"] || row.cuotas,
          precio_promo_tarjeta: parseFloat(row["Precio Promo Tarjeta"] || row.precio_promo_tarjeta || "0"),
          precio_pack_tarjeta: parseFloat(row["Precio Pack Tarjeta"] || row.precio_pack_tarjeta || "0"),
          exhibicion: row["Exhibición"] || row.exhibicion,
          cabecera: row["Cabecera"] || row.cabecera,
          cantidad_comprar: row["Cantidad a Comprar"] || row.cantidad_comprar,
          monto_minimo: parseFloat(row["Monto Minimo"] || row.monto_minimo || "0"),
          macrocategoria: row["MACROCATEGORIA"] || row.macrocategoria,
          microcategoria: row["Microcategoria"] || row.microcategoria,
          division: row["División"] || row.division,
          categoria: row["Categoría"] || row.categoria,
          atributo: row["Atributo"] || row.atributo,
          estado_producto: row["Estado"] || row.estado_producto || row.estado,
          unidad_medida: row["Unidad de Medida"] || row.unidad_medida,
          alto_grasas_saturadas: row["Alto en grasas saturadas"] === "X",
          alto_azucar: row["Alto en azúcar"] === "X",
          alto_sodio: row["Alto en Sodio"] === "X",
          contiene_grasas_trans: row["Contiene grasas trans"] === "X",
          precio_encarte: parseFloat(row["Precio Promo"] || row["Precio Regular"] || row.precio_encarte || "0"),
          foto_publicar: row["Foto a publicar"] || row.foto_publicar,
          cod_gpo_articulo: row["Cód. Gpo. Artículo"] || row.cod_gpo_articulo,
          gasto_producto: parseFloat(row["Gasto Producto"] || row.gasto_producto || "0"),
          gasto_financiero: parseFloat(row["Gasto Financiero"] || row.gasto_financiero || "0"),
          aporte_col: parseFloat(row["Aporte"] || row.aporte || "0"),
          promocion_acumulable: row["Promoción acumulable"] || row.promocion_acumulable,
          cod_auspiciador: row["Cod. Auspiciador"] || row.cod_auspiciador,
          descripcion_auspiciador: row["Descripción de Auspiciador"] || row.descripcion_auspiciador,
          cant_auspiciador: row["Cant. Auspiciador"] || row.cant_auspiciador,
          formato: row["Formato"] || row.formato,
          codigo_local: row["Código Local"] || row.codigo_local,
          legal: row["Legal"] || row.legal,
          unidad_limite: row["Unidad Limite"] || row.unidad_limite,
          maximo_abierto: row["Máximo abierto"] || row.maximo_abierto,
          maximo_tarjeta: row["Máximo Tarjeta"] || row.maximo_tarjeta,
          condicion_especial: row["Condición Especial"] || row.condicion_especial,
          logo: row["Logo"] || row.logo,
          tags: row["Tags"] || row.tags,
          descripcion_col: row["Descripción"] || row.descripcion,
          medidas: row["Medidas"] || row.medidas,
          regalos: row["Regalos"] || row.regalos,
          usuario_comercial: row["Usuario Comercial"] || row.usuario_comercial,
          estado_carga: row["Estado de carga"] || row.estado_carga,
          usuario_promociones: row["Usuario promociones"] || row.usuario_promociones,
          usuario_pricing: row["Usuario Pricing"] || row.usuario_pricing,
          variacion_promocional_abierta: row["Variación Promocional Abierta"] || row.variacion_promocional_abierta,
          descripcion_variacion_abierta: row["Descripción Variación Abierta"] || row.descripcion_variacion_abierta,
          variacion_promocional_tarjeta: row["Variación Promocional Tarjeta"] || row.variacion_promocional_tarjeta,
          descripcion_variacion_tarjeta: row["Descripción Variación Tarjeta"] || row.descripcion_variacion_tarjeta,
          num_promo: row["Núm. Promo"] || row.num_promo,
          producto_id: row["ProductoID"] || row.producto_id,
          estado_variacion: row["Estado Variacion"] || row.estado_variacion,
          gerente_aprobador: row["Gerente Aprobador"] || row.gerente_aprobador,
          tipo_promocion: row["Tipo Promocion"] || row.tipo_promocion,
          gasto_total_promos_oh: row["Gasto Total Promos OH"] || row.gasto_total_promos_oh,
          gasto_toh: row["Gasto TOH"] || row.gasto_toh,
          gasto_comercial_promos_toh: row["Gasto Comercial Promos TOH"] || row.gasto_comercial_promos_toh,
          dp: row["DP"] || row.dp,
        })).filter((p: any) => p.descripcion_producto_carteleria);

        setCsvProducts(products);
        toast.success(`${products.length} productos cargados`);
      },
        error: (error) => {
          toast.error("Error al leer el archivo CSV");
          console.error(error);
        },
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      // Handle Excel
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const products = jsonData.map((row: any) => ({
            cod_interno: row["Cód. Producto"] || row.cod_interno,
            nombre_campana: row["Nombre de Campaña"] || row.nombre_campana,
            tipo_requerimiento: row["Tipo de Requerimiento"] || row.tipo_requerimiento,
            pagina: row["Página"] || row.pagina,
            numero_cartel: row["N° de Cartel"] || row.numero_cartel,
            descripcion_producto_carteleria: row["Descripción de producto (Cartelería)"] || row.descripcion_producto || row.producto,
            fecha_inicio: convertExcelDate(row["Fecha Inicio"] || row.fecha_inicio),
            fecha_fin: convertExcelDate(row["Fecha Fin"] || row.fecha_fin),
            mecanica: row["Mecánica"] || row.mecanica,
            nombre_mecanica: row["Nombre de Mécanica"] || row.nombre_mecanica,
            precio_regular: parseFloat(row["Precio Regular"] || row.precio_regular || "0"),
            precio_promo: parseFloat(row["Precio Promo"] || row.precio_promo || "0"),
            precio_pack: parseFloat(row["Precio Pack"] || row.precio_pack || "0"),
            uxb: row["UxB"] || row.uxb,
            bi_tri_precio: row["BiTriPrecio"] || row.bi_tri_precio,
            medio_pago: row["Medio de Pago"] || row.medio_pago,
            descripcion_mecanica_tarjeta: row["Descripción Mecánica de Tarjeta"] || row.descripcion_mecanica_tarjeta,
            cuotas: row["Cuotas"] || row.cuotas,
            precio_promo_tarjeta: parseFloat(row["Precio Promo Tarjeta"] || row.precio_promo_tarjeta || "0"),
            precio_pack_tarjeta: parseFloat(row["Precio Pack Tarjeta"] || row.precio_pack_tarjeta || "0"),
            exhibicion: row["Exhibición"] || row.exhibicion,
            cabecera: row["Cabecera"] || row.cabecera,
            cantidad_comprar: row["Cantidad a Comprar"] || row.cantidad_comprar,
            monto_minimo: parseFloat(row["Monto Minimo"] || row.monto_minimo || "0"),
            macrocategoria: row["MACROCATEGORIA"] || row.macrocategoria,
            microcategoria: row["Microcategoria"] || row.microcategoria,
            division: row["División"] || row.division,
            categoria: row["Categoría"] || row.categoria,
            atributo: row["Atributo"] || row.atributo,
            estado_producto: row["Estado"] || row.estado_producto || row.estado,
            unidad_medida: row["Unidad de Medida"] || row.unidad_medida,
            alto_grasas_saturadas: row["Alto en grasas saturadas"] === "X",
            alto_azucar: row["Alto en azúcar"] === "X",
            alto_sodio: row["Alto en Sodio"] === "X",
            contiene_grasas_trans: row["Contiene grasas trans"] === "X",
            precio_encarte: parseFloat(row["Precio Promo"] || row["Precio Regular"] || row.precio_encarte || "0"),
            foto_publicar: row["Foto a publicar"] || row.foto_publicar,
            cod_gpo_articulo: row["Cód. Gpo. Artículo"] || row.cod_gpo_articulo,
            gasto_producto: parseFloat(row["Gasto Producto"] || row.gasto_producto || "0"),
            gasto_financiero: parseFloat(row["Gasto Financiero"] || row.gasto_financiero || "0"),
            aporte_col: parseFloat(row["Aporte"] || row.aporte || "0"),
            promocion_acumulable: row["Promoción acumulable"] || row.promocion_acumulable,
            cod_auspiciador: row["Cod. Auspiciador"] || row.cod_auspiciador,
            descripcion_auspiciador: row["Descripción de Auspiciador"] || row.descripcion_auspiciador,
            cant_auspiciador: row["Cant. Auspiciador"] || row.cant_auspiciador,
            formato: row["Formato"] || row.formato,
            codigo_local: row["Código Local"] || row.codigo_local,
            legal: row["Legal"] || row.legal,
            unidad_limite: row["Unidad Limite"] || row.unidad_limite,
            maximo_abierto: row["Máximo abierto"] || row.maximo_abierto,
            maximo_tarjeta: row["Máximo Tarjeta"] || row.maximo_tarjeta,
            condicion_especial: row["Condición Especial"] || row.condicion_especial,
            logo: row["Logo"] || row.logo,
            tags: row["Tags"] || row.tags,
            descripcion_col: row["Descripción"] || row.descripcion,
            medidas: row["Medidas"] || row.medidas,
            regalos: row["Regalos"] || row.regalos,
            usuario_comercial: row["Usuario Comercial"] || row.usuario_comercial,
            estado_carga: row["Estado de carga"] || row.estado_carga,
            usuario_promociones: row["Usuario promociones"] || row.usuario_promociones,
            usuario_pricing: row["Usuario Pricing"] || row.usuario_pricing,
            variacion_promocional_abierta: row["Variación Promocional Abierta"] || row.variacion_promocional_abierta,
            descripcion_variacion_abierta: row["Descripción Variación Abierta"] || row.descripcion_variacion_abierta,
            variacion_promocional_tarjeta: row["Variación Promocional Tarjeta"] || row.variacion_promocional_tarjeta,
            descripcion_variacion_tarjeta: row["Descripción Variación Tarjeta"] || row.descripcion_variacion_tarjeta,
            num_promo: row["Núm. Promo"] || row.num_promo,
            producto_id: row["ProductoID"] || row.producto_id,
            estado_variacion: row["Estado Variacion"] || row.estado_variacion,
            gerente_aprobador: row["Gerente Aprobador"] || row.gerente_aprobador,
            tipo_promocion: row["Tipo Promocion"] || row.tipo_promocion,
            gasto_total_promos_oh: row["Gasto Total Promos OH"] || row.gasto_total_promos_oh,
            gasto_toh: row["Gasto TOH"] || row.gasto_toh,
            gasto_comercial_promos_toh: row["Gasto Comercial Promos TOH"] || row.gasto_comercial_promos_toh,
            dp: row["DP"] || row.dp,
          })).filter((p: any) => p.descripcion_producto_carteleria);

          setCsvProducts(products);
          toast.success(`${products.length} productos cargados desde Excel`);
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
      toast.error("Debes cargar un archivo CSV con productos");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Parse month data
      const fecha = new Date(formData.fecha);
      const mesNombre = fecha.toLocaleString("es-ES", { month: "long" });
      const mesCod = fecha.getMonth() + 1;

      // Create encarte
      const { data: encarte, error: encarteError } = await supabase
        .from("encartes")
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

      if (encarteError) throw encarteError;

      // Insert products
      const productsToInsert = csvProducts.map((p: any) => ({
        encarte_id: encarte.id,
        cod_interno: p.cod_interno,
        nombre_campana: p.nombre_campana,
        tipo_requerimiento: p.tipo_requerimiento,
        pagina: p.pagina,
        numero_cartel: p.numero_cartel,
        descripcion_producto_carteleria: p.descripcion_producto_carteleria,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        mecanica: p.mecanica,
        nombre_mecanica: p.nombre_mecanica,
        precio_regular: p.precio_regular,
        precio_promo: p.precio_promo,
        precio_pack: p.precio_pack,
        uxb: p.uxb,
        bi_tri_precio: p.bi_tri_precio,
        medio_pago: p.medio_pago,
        descripcion_mecanica_tarjeta: p.descripcion_mecanica_tarjeta,
        cuotas: p.cuotas,
        precio_promo_tarjeta: p.precio_promo_tarjeta,
        precio_pack_tarjeta: p.precio_pack_tarjeta,
        exhibicion: p.exhibicion,
        cabecera: p.cabecera,
        cantidad_comprar: p.cantidad_comprar,
        monto_minimo: p.monto_minimo,
        macrocategoria: p.macrocategoria,
        microcategoria: p.microcategoria,
        division: p.division,
        categoria: p.categoria,
        atributo: p.atributo,
        estado_producto: p.estado_producto,
        unidad_medida: p.unidad_medida,
        alto_grasas_saturadas: p.alto_grasas_saturadas,
        alto_azucar: p.alto_azucar,
        alto_sodio: p.alto_sodio,
        contiene_grasas_trans: p.contiene_grasas_trans,
        precio_encarte: p.precio_encarte,
        foto_publicar: p.foto_publicar,
        cod_gpo_articulo: p.cod_gpo_articulo,
        gasto_producto: p.gasto_producto,
        gasto_financiero: p.gasto_financiero,
        aporte_col: p.aporte_col,
        promocion_acumulable: p.promocion_acumulable,
        cod_auspiciador: p.cod_auspiciador,
        descripcion_auspiciador: p.descripcion_auspiciador,
        cant_auspiciador: p.cant_auspiciador,
        formato: p.formato,
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

      const { error: productsError } = await supabase
        .from("productos")
        .insert(productsToInsert);

      if (productsError) throw productsError;

      toast.success("Encarte creado exitosamente");
      navigate(`/dashboard/encarte/${encarte.id}`);
    } catch (error: any) {
      toast.error(error.message || "Error al crear encarte");
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
          <CardTitle>Nuevo Encarte</CardTitle>
          <CardDescription>
            Completa la información básica y carga la lista de productos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información básica */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Encarte *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  placeholder="Ej: Encarte Enero 2025"
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

            {/* Carga de archivo */}
            <div className="space-y-2">
              <Label>Archivo CSV o Excel con Productos *</Label>
              <div className="flex gap-4 items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Cargar Archivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {csvProducts.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {csvProducts.length} productos cargados ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sube el archivo Excel con los productos de Vivanda. Se leerán automáticamente todas las columnas necesarias.
              </p>
            </div>

            {/* Preview de productos */}
            {csvProducts.length > 0 && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Productos Cargados ({csvProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-auto space-y-1">
                    {csvProducts.slice(0, 10).map((p: any, i) => (
                      <div key={i} className="text-xs flex justify-between py-1 border-b border-border/50">
                        <div className="flex-1 space-y-0.5">
                          <div className="truncate font-medium">{p.descripcion_producto_carteleria}</div>
                          <div className="text-muted-foreground">
                            {p.cod_interno} • {p.categoria}
                          </div>
                        </div>
                        <div className="ml-2 text-right space-y-0.5">
                          <div className="font-mono text-primary">
                            ${p.precio_promo > 0 ? p.precio_promo?.toFixed(2) : p.precio_regular?.toFixed(2)}
                          </div>
                          {p.precio_promo > 0 && (
                            <div className="text-muted-foreground line-through text-[10px]">
                              ${p.precio_regular?.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {csvProducts.length > 10 && (
                      <p className="text-xs text-muted-foreground pt-2">
                        ... y {csvProducts.length - 10} productos más
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Encarte
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
