import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UpdateExhibicionProducts } from "@/components/exhibicion/UpdateExhibicionProducts";
import { AddExhibicionProducts } from "@/components/exhibicion/AddExhibicionProducts";
import { DataRestoreUpload } from "@/components/admin/DataRestoreUpload";

interface Exhibicion {
  id: string;
  nombre: string;
  tienda: string;
  ciudad: string;
  fecha: string;
  estado: string;
}

interface Producto {
  id: string;
  cod_producto: string;
  descripcion_producto: string;
  seccion: string;
  linea: string;
  tipo_exhibicion: string;
  codigo_exhibicion: string;
}

interface Respuesta {
  id: string;
  producto_id: string;
  presencia_exhibicion: string | null;
  ubicacion: string;
  observaciones: string;
  foto: string;
}

export default function ExhibicionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exhibicion, setExhibicion] = useState<Exhibicion | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!roleData);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (id) {
      loadExhibicionData();
    }
  }, [id]);

  const loadExhibicionData = async () => {
    try {
      const { data: exhibicionData, error: exhibicionError } = await supabase
        .from("exhibiciones")
        .select("*")
        .eq("id", id)
        .single();

      if (exhibicionError) throw exhibicionError;
      setExhibicion(exhibicionData);

      const { data: productosData, error: productosError } = await supabase
        .from("productos_exhibicion")
        .select("*")
        .eq("exhibicion_id", id);

      if (productosError) throw productosError;
      setProductos(productosData || []);

      const { data: respuestasData, error: respuestasError } = await supabase
        .from("respuestas_exhibicion")
        .select("*")
        .eq("exhibicion_id", id);

      if (respuestasError) throw respuestasError;
      setRespuestas(respuestasData || []);
    } catch (error) {
      console.error("Error loading exhibicion:", error);
      toast.error("Error al cargar la exhibición");
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely get string and truncate if exceeds Excel limit
  const safeExcel = (value: string | null | undefined, maxLength = 32000): string => {
    if (!value) return "";
    const str = String(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...[truncado]";
  };

  // Export only this exhibicion's data
  const handleExport = async () => {
    try {
      toast.info("Descargando datos del estudio...");
      let allRespuestas: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: respuestasData, error } = await supabase
          .from("respuestas_exhibicion")
          .select("*")
          .eq("exhibicion_id", id)
          .order("created_at", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (respuestasData && respuestasData.length > 0) {
          allRespuestas = [...allRespuestas, ...respuestasData];
          hasMore = respuestasData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (allRespuestas.length === 0) {
        toast.error("No hay datos para exportar en este estudio");
        return;
      }

      const formatTime = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        } catch { return ""; }
      };

      const exportData = allRespuestas.map((resp: any) => ({
        FECHA: safeExcel(resp.fecha),
        HORA_CREACION: formatTime(resp.created_at),
        TIENDA: safeExcel(resp.tienda),
        CIUDAD: safeExcel(resp.ciudad),
        BANDERA: safeExcel(resp.bandera),
        SECCION: safeExcel(resp.seccion),
        LINEA: safeExcel(resp.linea),
        "COD PRODUCTO": safeExcel(resp.cod_producto),
        PRODUCTO: safeExcel(resp.descripcion_producto),
        "TIPO EXHIBICION": safeExcel(resp.tipo_exhibicion),
        "CODIGO EXHIBICION": safeExcel(resp.codigo_exhibicion),
        "PRESENCIA EXHIBICION": safeExcel(resp.presencia_exhibicion),
        UBICACION: safeExcel(resp.ubicacion),
        "PRESENCIA CARTEL CON TARJETA": resp.presencia_cartel_con_tarjeta ? "Sí" : "No",
        "PRECIO TARJETA": resp.precio_tarjeta || "",
        OBSERVACIONES: safeExcel(resp.observaciones),
        ENCARGADO: safeExcel(resp.encargado),
        "ENCARGADO 2": safeExcel(resp.encargado_2),
        FOTO: safeExcel(resp.foto),
        "FOTO REGISTRO": safeExcel(resp.foto_registro),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exhibiciones");

      XLSX.writeFile(wb, `exhibicion_${exhibicion?.nombre}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Archivo exportado correctamente (${allRespuestas.length} registros)`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Error al exportar");
    }
  };

  // Export ALL data from ALL exhibiciones
  const handleExportAll = async () => {
    try {
      toast.info("Descargando todos los datos... esto puede tomar un momento");
      let allRespuestas: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: respuestasData, error } = await supabase
          .from("respuestas_exhibicion")
          .select("*")
          .order("created_at", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (respuestasData && respuestasData.length > 0) {
          allRespuestas = [...allRespuestas, ...respuestasData];
          hasMore = respuestasData.length === pageSize;
          page++;
          toast.info(`Descargando... ${allRespuestas.length} registros`);
        } else {
          hasMore = false;
        }
      }

      if (allRespuestas.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }

      const formatTime = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        } catch { return ""; }
      };

      const exportData = allRespuestas.map((resp: any) => ({
        EXHIBICION_ID: safeExcel(resp.exhibicion_id),
        FECHA: safeExcel(resp.fecha),
        HORA_CREACION: formatTime(resp.created_at),
        TIENDA: safeExcel(resp.tienda),
        CIUDAD: safeExcel(resp.ciudad),
        BANDERA: safeExcel(resp.bandera),
        SECCION: safeExcel(resp.seccion),
        LINEA: safeExcel(resp.linea),
        "COD PRODUCTO": safeExcel(resp.cod_producto),
        PRODUCTO: safeExcel(resp.descripcion_producto),
        "TIPO EXHIBICION": safeExcel(resp.tipo_exhibicion),
        "CODIGO EXHIBICION": safeExcel(resp.codigo_exhibicion),
        "PRESENCIA EXHIBICION": safeExcel(resp.presencia_exhibicion),
        UBICACION: safeExcel(resp.ubicacion),
        "PRESENCIA CARTEL CON TARJETA": resp.presencia_cartel_con_tarjeta ? "Sí" : "No",
        "PRECIO TARJETA": resp.precio_tarjeta || "",
        OBSERVACIONES: safeExcel(resp.observaciones),
        ENCARGADO: safeExcel(resp.encargado),
        "ENCARGADO 2": safeExcel(resp.encargado_2),
        FOTO: safeExcel(resp.foto),
        "FOTO REGISTRO": safeExcel(resp.foto_registro),
        CREATED_AT: safeExcel(resp.created_at),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Todas Exhibiciones");

      XLSX.writeFile(wb, `todas_exhibiciones_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exportados ${allRespuestas.length} registros de todas las exhibiciones`);
    } catch (error) {
      console.error("Error exporting all:", error);
      toast.error("Error al exportar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!exhibicion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Exhibición no encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div className="flex gap-2 flex-wrap">
            <AddExhibicionProducts 
              exhibicionId={id!} 
              exhibicionNombre={exhibicion.nombre}
              onUpdate={loadExhibicionData}
            />
            <UpdateExhibicionProducts 
              exhibicionId={id!} 
              exhibicionNombre={exhibicion.nombre}
              onUpdate={loadExhibicionData}
            />
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar Estudio
            </Button>
            <Button onClick={handleExportAll}>
              <Download className="w-4 h-4 mr-2" />
              Exportar TODO
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{exhibicion.nombre}</CardTitle>
              <Badge
                variant={exhibicion.estado === "completado" ? "default" : "secondary"}
              >
                {exhibicion.estado === "completado" ? "Completado" : "En Progreso"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Tienda:</strong> {exhibicion.tienda || "N/A"}
            </p>
            <p>
              <strong>Ciudad:</strong> {exhibicion.ciudad || "N/A"}
            </p>
            <p>
              <strong>Fecha:</strong> {exhibicion.fecha}
            </p>
            <p>
              <strong>Productos:</strong> {productos.length}
            </p>
            <p>
              <strong>Respuestas:</strong> {respuestas.length}
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <DataRestoreUpload 
            exhibicionId={id!} 
            onComplete={loadExhibicionData}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Código Exhibición</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell>{producto.cod_producto}</TableCell>
                    <TableCell>{producto.descripcion_producto}</TableCell>
                    <TableCell>{producto.seccion}</TableCell>
                    <TableCell>{producto.linea}</TableCell>
                    <TableCell>{producto.tipo_exhibicion}</TableCell>
                    <TableCell>{producto.codigo_exhibicion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}