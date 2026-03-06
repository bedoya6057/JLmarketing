import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Calendar, MapPin, ChevronRight, Trash2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

interface Encarte {
  id: string;
  nombre: string;
  ciudad: string;
  tienda: string;
  fecha: string;
  estado: string;
  created_at: string;
  created_by: string | null;
}

export const EncarteList = () => {
  const navigate = useNavigate();
  const [encartes, setEncartes] = useState<Encarte[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [concludeId, setConcludeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (user) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (userRole) {
          setUserRole(userRole.role);
        }
      }
    })();
    loadEncartes();
  }, []);

  const loadEncartes = async () => {
    try {
      console.log("Cargando encartes...");
      const { data, error } = await supabase
        .from("encartes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error de Supabase:", error);
        toast.error(`Error al cargar encartes: ${error.message}`);
        throw error;
      }

      console.log("Encartes cargados:", data?.length || 0);
      setEncartes(data || []);
    } catch (error: any) {
      console.error("Error loading encartes:", error);
      toast.error(error.message || "Error al cargar encartes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (encarteId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      console.log('Iniciando eliminación del encarte:', encarteId);

      // Delete all related respuestas (registros del encarte)
      console.log('Eliminando respuestas...');
      const { error: respuestasError } = await supabase
        .from("respuestas")
        .delete()
        .eq("encarte_id", encarteId);

      if (respuestasError) {
        console.error('Error eliminando respuestas:', respuestasError);
        throw respuestasError;
      }
      console.log('Respuestas eliminadas exitosamente');

      // Nota: No eliminamos productos aquí por solicitud: solo registros (respuestas)

      // Delete the encarte
      console.log('Eliminando encarte...');
      const { error: encarteError } = await supabase
        .from("encartes")
        .delete()
        .eq("id", encarteId);

      if (encarteError) {
        console.error('Error eliminando encarte:', encarteError);
        throw encarteError;
      }
      console.log('Encarte eliminado exitosamente');

      toast.success("Encarte eliminado correctamente");

      // Update the local state immediately
      setEncartes(prevEncartes => prevEncartes.filter(e => e.id !== encarteId));

      // Also reload from database to ensure consistency
      await loadEncartes();
    } catch (error: any) {
      console.error('Error completo:', error);
      toast.error(error.message || "Error al eliminar encarte");
    }
  };

  const handleConclude = async (encarteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("update-encarte-estado", {
        body: { id: encarteId, tipo: "encartes", estado: "concluido" },
      });

      if (error) {
        throw new Error(error.message || "Error devuelto por la función Edge");
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Encarte marcado como concluido - ya no aparecerá para encuestadores");
      // Update local state to show new status instead of removing
      setEncartes(prevEncartes =>
        prevEncartes.map(e =>
          e.id === encarteId ? { ...e, estado: "concluido" } : e
        )
      );
      setConcludeId(null);
    } catch (error: any) {
      console.error("Error al concluir encarte:", error);
      toast.error(error.message || "Error al concluir encarte");
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-24 bg-muted" />
            <CardContent className="h-20 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mis Encartes</h2>
          <p className="text-muted-foreground">Gestiona tus auditorías de precios</p>
        </div>
        <Button onClick={() => navigate("/dashboard/nuevo")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Encarte
        </Button>
      </div>

      {encartes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay encartes aún</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comienza creando tu primer encarte
            </p>
            <Button onClick={() => navigate("/dashboard/nuevo")}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Encarte
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {encartes.map((encarte) => (
            <Card
              key={encarte.id}
              className="group hover:shadow-lg transition-all cursor-pointer"
              onClick={() => navigate(`/dashboard/encarte/${encarte.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg line-clamp-1">
                      {encarte.nombre}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" />
                      {encarte.tienda} - {encarte.ciudad}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge
                      variant={
                        encarte.estado === "concluido" ? "default" :
                          encarte.estado === "completado" ? "outline" : "secondary"
                      }
                    >
                      {encarte.estado === "concluido" ? "Concluido" :
                        encarte.estado === "completado" ? "Completado" : "En Progreso"}
                    </Badge>
                    {userId && (userRole === 'admin' || encarte.created_by === userId) && encarte.estado !== "concluido" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConcludeId(encarte.id);
                        }}
                        title="Marcar como concluido"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {userId && (userRole === 'admin' || encarte.created_by === userId) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar encarte?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminarán los registros (respuestas) y productos asociados a este encarte.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => handleDelete(encarte.id, e)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(encarte.fecha), "d 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conclude Dialog */}
      <AlertDialog open={!!concludeId} onOpenChange={() => setConcludeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar encarte como concluido?</AlertDialogTitle>
            <AlertDialogDescription>
              Este encarte ya no aparecerá en la lista de estudios disponibles para los encuestadores.
              Los datos recopilados se mantendrán en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => concludeId && handleConclude(concludeId)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Concluir Encarte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
