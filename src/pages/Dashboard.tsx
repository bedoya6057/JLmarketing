import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EncarteList } from "@/components/dashboard/EncarteList";
import { ExhibicionList } from "@/components/dashboard/ExhibicionList";
import { RespuestasList } from "@/components/dashboard/RespuestasList";
import { StorageMetrics } from "@/components/dashboard/StorageMetrics";
import { UserManagement } from "@/components/admin/UserManagement";
import { TiendasManagement } from "@/components/admin/TiendasManagement";
import { PhotoManagement } from "@/components/admin/PhotoManagement";
import { PhotoValidation } from "@/components/admin/PhotoValidation";
import { Button } from "@/components/ui/button";
import { Trash2, Download, BarChart3, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>();
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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

      // Only admins can access dashboard
      if (userRole.role !== "admin") {
        navigate("/encuestador");
        return;
      }
    } else {
      // No role assigned, redirect
      navigate("/");
      return;
    }

    setLoading(false);
  };

  const handleDeleteAllRespuestas = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("respuestas")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

      if (error) throw error;

      toast.success("Todos los registros han sido eliminados exitosamente");

      // Refresh the page to update the lists
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting respuestas:", error);
      toast.error("Error al eliminar los registros: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportAllEncartes = async () => {
    try {
      // Fetch foto_salida per tienda from progreso_encuestador
      const { data: progresoData } = await supabase
        .from("progreso_encuestador")
        .select("encarte_id, tienda, foto_salida_url");
      const fotoSalidaMap: Record<string, string> = {};
      progresoData?.forEach((p: any) => {
        if (p.foto_salida_url && p.tienda) {
          fotoSalidaMap[`${p.encarte_id}_${p.tienda}`] = p.foto_salida_url;
        }
      });

      const { data: respuestas, error } = await supabase
        .from("respuestas")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!respuestas || respuestas.length === 0) {
        toast.error("No hay datos de encartes para exportar");
        return;
      }

      const XLSX = await import("xlsx");

      const worksheetData = [
        [
          "AÑO", "MES_COD", "MES", "FECHA", "ENCARTE", "ENCARGADO", "ENCARGADO 2",
          "CIUDAD/CADENA", "CIUDAD", "BANDERA", "TIENDA", "MACROCATEGORIA",
          "CATEGORIA", "COD INTERNO", "PRODUCTO", "PRECIO ENCARTE",
          "PRECIO ENCONTRADO", "PRECIO TARJETA", "PRESENCIA PRODUCTO",
          "MOTIVO AUSENCIA", "PRESENCIA CARTEL", "TIPO LEGAL", "OBS 1", "FOTO", "FOTO REGISTRO", "FOTO SALIDA"
        ],
        ...respuestas.map((resp: any) => [
          resp.año || "", resp.mes_cod || "", resp.mes || "", resp.fecha || "",
          resp.encarte || "", resp.supervisor || "", resp.encargado_2 || "",
          resp.ciudad_cadena || "", resp.ciudad || "", resp.bandera || "",
          resp.tienda || "", resp.macrocategoria || "", resp.categoria || "",
          resp.cod_interno || "", resp.producto || "", resp.precio_encarte || "",
          resp.precio_encontrado || "", resp.precio_tarjeta || "",
          resp.presencia_producto ? "Sí" : "No", resp.motivo_ausencia || "",
          resp.presencia_cartel ? "Sí" : "No",
          resp.cartel_tipo_legal || "",
          resp.obs_1 || "", resp.foto || "", resp.foto_registro || "",
          fotoSalidaMap[`${resp.encarte_id}_${resp.tienda}`] || ""
        ])
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Todos los Encartes");
      XLSX.writeFile(workbook, `todos_los_encartes_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Todos los encartes exportados correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al exportar encartes");
      console.error(error);
    }
  };

  const handleExportAllExhibiciones = async () => {
    try {
      const { data: respuestas, error } = await supabase
        .from("respuestas_exhibicion")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!respuestas || respuestas.length === 0) {
        toast.error("No hay datos de exhibiciones para exportar");
        return;
      }

      const XLSX = await import("xlsx");

      const exportData = respuestas.map((resp: any) => ({
        FECHA: resp.fecha || "",
        TIENDA: resp.tienda || "",
        CIUDAD: resp.ciudad || "",
        BANDERA: resp.bandera || "",
        SECCION: resp.seccion || "",
        LINEA: resp.linea || "",
        "COD PRODUCTO": resp.cod_producto || "",
        PRODUCTO: resp.descripcion_producto || "",
        "TIPO EXHIBICION": resp.tipo_exhibicion || "",
        "CODIGO EXHIBICION": resp.codigo_exhibicion || "",
        "PRESENCIA EXHIBICION": resp.presencia_exhibicion || "",
        UBICACION: resp.ubicacion || "",
        OBSERVACIONES: resp.observaciones || "",
        ENCARGADO: resp.encargado || "",
        "ENCARGADO 2": resp.encargado_2 || "",
        FOTO: resp.foto || "",
        "FOTO REGISTRO": resp.foto_registro || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Todas las Exhibiciones");
      XLSX.writeFile(workbook, `todas_las_exhibiciones_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Todas las exhibiciones exportadas correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al exportar exhibiciones");
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

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader userEmail={userEmail} />
      <main className="container px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {userRole === "admin" && (
          <>
            <UserManagement />
            <TiendasManagement />
            <PhotoManagement />
            <PhotoValidation />
            <div className="flex flex-wrap gap-4 justify-end">
              <Button onClick={() => navigate("/seguimiento")} variant="default">
                <BarChart3 className="mr-2 h-4 w-4" />
                Seguimiento
              </Button>
              <Button onClick={() => navigate("/event-logs")} variant="secondary">
                <ClipboardList className="mr-2 h-4 w-4" />
                Logs del Sistema
              </Button>
              <Button onClick={handleExportAllEncartes} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Todos los Encartes
              </Button>
              <Button onClick={handleExportAllExhibiciones} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Todas las Exhibiciones
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleting ? "Eliminando..." : "Eliminar Todos los Registros"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Esto eliminará permanentemente todos los
                      registros de la tabla de respuestas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllRespuestas}>
                      Eliminar Todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
        <StorageMetrics />
        <EncarteList />
        <ExhibicionList />
        <RespuestasList />
      </main>
    </div>
  );
};

export default Dashboard;
