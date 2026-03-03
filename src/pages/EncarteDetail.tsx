import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EncarteAuditForm } from "@/components/encarte/EncarteAuditForm";
import { EncuestadorForm } from "@/components/encarte/EncuestadorForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { AddEncarteProducts } from "@/components/encarte/AddEncarteProducts";

interface Encarte {
  id: string;
  nombre: string;
  ciudad: string;
  fecha: string;
  estado: string;
}

interface UserProfile {
  role: string;
}

const EncarteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>();
  const [userRole, setUserRole] = useState<string>("auditor");
  const [encarte, setEncarte] = useState<Encarte | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkStatus();
  const [syncTrigger, setSyncTrigger] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (id) {
      loadEncarte();
    }
  }, [id]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/");
      return;
    }

    setUserEmail(session.user.email);

    // Get user role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (userRole) {
      setUserRole(userRole.role);
    }
  };

  const loadEncarte = async () => {
    try {
      const { data, error } = await supabase
        .from("encartes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setEncarte(data);
    } catch (error) {
      console.error("Error loading encarte:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let allRespuestas: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: respuestasData, error } = await supabase
          .from("respuestas")
          .select("*")
          .eq("encarte_id", id)
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
        toast.error("No hay datos para exportar");
        return;
      }

      const XLSX = await import("xlsx");

      const formatTime = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        } catch { return ""; }
      };

      const worksheetData = [
        [
          "AÑO", "MES_COD", "MES", "FECHA", "HORA_CREACION", "ENCARTE", "ENCARGADO", "ENCARGADO 2",
          "CIUDAD/CADENA", "CIUDAD", "BANDERA", "TIENDA", "MACROCATEGORIA", "CATEGORIA",
          "COD INTERNO", "PRODUCTO", "PRECIO ENCARTE", "PRECIO ENCONTRADO", "PRECIO TARJETA",
          "PRESENCIA PRODUCTO", "PRESENCIA CARTEL", "PRESENCIA CARTEL CON TARJETA",
          "OBS 1", "FOTO", "FOTO REGISTRO"
        ],
        ...allRespuestas.map((resp: any) => [
          resp.año || "", resp.mes_cod || "", resp.mes || "", resp.fecha || "",
          formatTime(resp.created_at),
          resp.encarte || "", resp.supervisor || "", resp.encargado_2 || "",
          resp.ciudad_cadena || "", resp.ciudad || "", resp.bandera || "",
          resp.tienda || "", resp.macrocategoria || "", resp.categoria || "",
          resp.cod_interno || "", resp.producto || "", resp.precio_encarte || "",
          resp.precio_encontrado || "", resp.precio_tarjeta || "",
          resp.presencia_producto ? "Sí" : "No", resp.presencia_cartel ? "Sí" : "No",
          resp.presencia_cartel_con_tarjeta ? "Sí" : "No",
          resp.obs_1 || "", resp.foto || "", resp.foto_registro || ""
        ])
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Respuestas");
      XLSX.writeFile(workbook, `${encarte?.nombre || 'encarte'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exportados ${allRespuestas.length} registros`);
    } catch (error: any) {
      toast.error(error.message || "Error al exportar");
      console.error(error);
    }
  };

  const handleExportAll = async () => {
    try {
      toast.info("Descargando todos los datos de encartes...");
      let allRespuestas: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: respuestasData, error } = await supabase
          .from("respuestas")
          .select("*")
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
        toast.error("No hay datos para exportar");
        return;
      }

      const XLSX = await import("xlsx");

      const formatTime = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        } catch { return ""; }
      };

      const worksheetData = [
        [
          "ENCARTE_ID", "AÑO", "MES_COD", "MES", "FECHA", "HORA_CREACION", "ENCARTE", "ENCARGADO", "ENCARGADO 2",
          "CIUDAD/CADENA", "CIUDAD", "BANDERA", "TIENDA", "MACROCATEGORIA", "CATEGORIA",
          "COD INTERNO", "PRODUCTO", "PRECIO ENCARTE", "PRECIO ENCONTRADO", "PRECIO TARJETA",
          "PRESENCIA PRODUCTO", "PRESENCIA CARTEL", "PRESENCIA CARTEL CON TARJETA",
          "OBS 1", "FOTO", "FOTO REGISTRO", "CREATED_AT"
        ],
        ...allRespuestas.map((resp: any) => [
          resp.encarte_id || "", resp.año || "", resp.mes_cod || "", resp.mes || "", resp.fecha || "",
          formatTime(resp.created_at),
          resp.encarte || "", resp.supervisor || "", resp.encargado_2 || "",
          resp.ciudad_cadena || "", resp.ciudad || "", resp.bandera || "",
          resp.tienda || "", resp.macrocategoria || "", resp.categoria || "",
          resp.cod_interno || "", resp.producto || "", resp.precio_encarte || "",
          resp.precio_encontrado || "", resp.precio_tarjeta || "",
          resp.presencia_producto ? "Sí" : "No", resp.presencia_cartel ? "Sí" : "No",
          resp.presencia_cartel_con_tarjeta ? "Sí" : "No",
          resp.obs_1 || "", resp.foto || "", resp.foto_registro || "", resp.created_at || ""
        ])
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Todos Encartes");
      XLSX.writeFile(workbook, `todos_encartes_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exportados ${allRespuestas.length} registros de todos los encartes`);
    } catch (error: any) {
      toast.error(error.message || "Error al exportar");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!encarte) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader userEmail={userEmail} />
      <main className="container py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <CardTitle className="text-2xl">{encarte.nombre}</CardTitle>
                   <CardDescription className="flex items-center gap-4 flex-wrap">
                     <span className="flex items-center gap-1">
                       <MapPin className="h-3.5 w-3.5" />
                       {encarte.ciudad}
                     </span>
                     <span className="flex items-center gap-1">
                       <Calendar className="h-3.5 w-3.5" />
                       {format(new Date(encarte.fecha), "d 'de' MMMM, yyyy", {
                         locale: es,
                       })}
                     </span>
                   </CardDescription>
                </div>
                <Badge variant={encarte.estado === "completado" ? "default" : "secondary"}>
                  {encarte.estado === "completado" ? "Completado" : "En Progreso"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {userRole === "admin" ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <p className="text-muted-foreground">
                    Como administrador, puedes agregar productos o exportar los datos del encarte.
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <AddEncarteProducts
                      encarteId={id!}
                      encarteNombre={encarte.nombre}
                      onUpdate={loadEncarte}
                    />
                    <Button onClick={handleExport} variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Exportar Estudio
                    </Button>
                    <Button onClick={handleExportAll} className="gap-2">
                      <Download className="h-4 w-4" />
                      Exportar TODO
                    </Button>
                  </div>
                </div>
              ) : userRole === "encuestador" ? (
                <EncuestadorForm 
                  isOnline={isOnline}
                  syncTrigger={syncTrigger}
                  onSyncRequest={() => setSyncTrigger(prev => prev + 1)}
                />
              ) : (
                <EncarteAuditForm encarteId={id!} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EncarteDetail;
