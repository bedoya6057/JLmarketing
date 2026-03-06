import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Exhibicion {
  id: string;
  nombre: string;
  ciudad: string;
  tienda: string;
  fecha: string;
  estado: string;
  created_at: string;
}

export const ExhibicionList = () => {
  const navigate = useNavigate();
  const [exhibiciones, setExhibiciones] = useState<Exhibicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [concludeId, setConcludeId] = useState<string | null>(null);

  useEffect(() => {
    loadExhibiciones();
  }, []);

  const loadExhibiciones = async () => {
    try {
      const { data, error } = await supabase
        .from("exhibiciones")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExhibiciones(data || []);
    } catch (error) {
      console.error("Error loading exhibiciones:", error);
      toast.error("Error al cargar las exhibiciones");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      toast.info("Eliminando exhibición, esto puede tomar un momento...");

      // Delete respuestas_exhibicion in batches to avoid timeout
      let hasMoreRespuestas = true;
      while (hasMoreRespuestas) {
        const { data: respuestas } = await supabase
          .from("respuestas_exhibicion")
          .select("id")
          .eq("exhibicion_id", id)
          .limit(100);

        if (!respuestas || respuestas.length === 0) {
          hasMoreRespuestas = false;
        } else {
          const ids = respuestas.map(r => r.id);
          const { error } = await supabase
            .from("respuestas_exhibicion")
            .delete()
            .in("id", ids);
          if (error) throw error;
        }
      }

      // Delete productos_exhibicion in batches
      let hasMoreProductos = true;
      while (hasMoreProductos) {
        const { data: productos } = await supabase
          .from("productos_exhibicion")
          .select("id")
          .eq("exhibicion_id", id)
          .limit(100);

        if (!productos || productos.length === 0) {
          hasMoreProductos = false;
        } else {
          const ids = productos.map(p => p.id);
          const { error } = await supabase
            .from("productos_exhibicion")
            .delete()
            .in("id", ids);
          if (error) throw error;
        }
      }

      // Delete exhibicion
      const { error: exhibicionError } = await supabase
        .from("exhibiciones")
        .delete()
        .eq("id", id);

      if (exhibicionError) throw exhibicionError;

      toast.success("Exhibición eliminada correctamente");
      loadExhibiciones();
    } catch (error) {
      console.error("Error deleting exhibicion:", error);
      toast.error("Error al eliminar la exhibición");
    } finally {
      setDeleteId(null);
    }
  };

  const handleConclude = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("update-encarte-estado", {
        body: { id, tipo: "exhibiciones", estado: "concluido" },
      });

      if (error) {
        throw new Error(error.message || "Error devuelto por la función Edge");
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Exhibición marcada como concluida - ya no aparecerá para encuestadores");
      // Update local state to show new status instead of removing
      setExhibiciones(prev =>
        prev.map(e =>
          e.id === id ? { ...e, estado: "concluido" } : e
        )
      );
      setConcludeId(null);
    } catch (error: any) {
      console.error("Error al concluir exhibición:", error);
      toast.error(error.message || "Error al concluir exhibición");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Exhibiciones</h2>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (exhibiciones.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Exhibiciones</h2>
          <Button onClick={() => navigate("/dashboard/exhibicion/nuevo")}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Exhibición
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No hay exhibiciones aún</p>
            <Button onClick={() => navigate("/dashboard/exhibicion/nuevo")}>
              <Plus className="w-4 h-4 mr-2" />
              Crear primera exhibición
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Exhibiciones</h2>
        <Button onClick={() => navigate("/dashboard/exhibicion/nuevo")}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Exhibición
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exhibiciones.map((exhibicion) => (
          <Card
            key={exhibicion.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
          >
            <CardHeader
              className="space-y-2"
              onClick={() => navigate(`/dashboard/exhibicion/${exhibicion.id}`)}
            >
              <CardTitle className="text-lg">{exhibicion.nombre}</CardTitle>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <strong>Tienda:</strong> {exhibicion.tienda || "N/A"}
                </p>
                <p>
                  <strong>Ciudad:</strong> {exhibicion.ciudad || "N/A"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    exhibicion.estado === "concluido" ? "default" :
                      exhibicion.estado === "completado" ? "outline" : "secondary"
                  }
                >
                  {exhibicion.estado === "concluido" ? "Concluido" :
                    exhibicion.estado === "completado" ? "Completado" : "En Progreso"}
                </Badge>
                <div className="flex items-center gap-1">
                  {exhibicion.estado !== "concluido" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConcludeId(exhibicion.id);
                      }}
                      title="Marcar como concluido"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(exhibicion.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(exhibicion.fecha), "dd 'de' MMMM, yyyy", {
                  locale: es,
                })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los
              productos y respuestas asociados a esta exhibición.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conclude Dialog */}
      <AlertDialog open={!!concludeId} onOpenChange={() => setConcludeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar exhibición como concluida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta exhibición ya no aparecerá en la lista de estudios disponibles para los encuestadores.
              Los datos recopilados se mantendrán en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => concludeId && handleConclude(concludeId)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Concluir Exhibición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};