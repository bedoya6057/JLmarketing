import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Database, HardDrive, Loader2, Image, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface StorageStats {
  totalSize: number;
  fileCount: number;
}

interface DatabaseStats {
  totalSize: number;
  tableCount: number;
}

export const StorageMetrics = () => {
  const [storageStats, setStorageStats] = useState<StorageStats>({ totalSize: 0, fileCount: 0 });
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats>({ totalSize: 0, tableCount: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadMetrics = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      // Load storage bucket statistics - recursively list all folders
      let allFiles: { name: string; metadata?: { size?: number } }[] = [];
      
      // First, list root level (folders like user IDs)
      const { data: rootItems, error: rootError } = await supabase
        .storage
        .from('encarte-photos')
        .list('', { limit: 1000 });

      if (rootError) {
        console.error("Error loading storage root:", rootError);
      } else if (rootItems) {
        // For each folder (user ID), list its contents
        for (const item of rootItems) {
          if (item.id === null) {
            // This is a folder, list its contents
            const { data: folderFiles, error: folderError } = await supabase
              .storage
              .from('encarte-photos')
              .list(item.name, { limit: 10000 });
            
            if (!folderError && folderFiles) {
              // Add files with their full path
              allFiles = [...allFiles, ...folderFiles.filter(f => f.id !== null).map(f => ({
                ...f,
                name: `${item.name}/${f.name}`
              }))];
            }
          } else {
            // This is a file at root level
            allFiles.push(item);
          }
        }
      }

      const totalSize = allFiles.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
      setStorageStats({
        totalSize,
        fileCount: allFiles.length
      });

      // Load database statistics - count records in main tables
      const [encartes, exhibiciones, productos, respuestas, respuestasExhibicion, productosExhibicion] = await Promise.all([
        supabase.from('encartes').select('*', { count: 'exact', head: true }),
        supabase.from('exhibiciones').select('*', { count: 'exact', head: true }),
        supabase.from('productos').select('*', { count: 'exact', head: true }),
        supabase.from('respuestas').select('*', { count: 'exact', head: true }),
        supabase.from('respuestas_exhibicion').select('*', { count: 'exact', head: true }),
        supabase.from('productos_exhibicion').select('*', { count: 'exact', head: true }),
      ]);

      const totalRecords = 
        (encartes.count || 0) +
        (exhibiciones.count || 0) +
        (productos.count || 0) +
        (respuestas.count || 0) +
        (respuestasExhibicion.count || 0) +
        (productosExhibicion.count || 0);

      // Estimate size based on records (approximate)
      const estimatedSize = totalRecords * 5; // ~5KB per record average

      setDatabaseStats({
        totalSize: estimatedSize,
        tableCount: 6
      });

    } catch (error: any) {
      console.error("Error loading metrics:", error);
      toast.error("Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and set up real-time subscription
  useEffect(() => {
    loadMetrics();

    // Set up real-time subscriptions for database changes
    const channel = supabase
      .channel('storage-metrics-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'respuestas' },
        () => loadMetrics(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'respuestas_exhibicion' },
        () => loadMetrics(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos' },
        () => loadMetrics(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos_exhibicion' },
        () => loadMetrics(false)
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => loadMetrics(false), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadMetrics]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStoragePercentage = (used: number, limit: number = 107374182400): number => {
    // Default limit: 100GB in bytes (for Medium plan)
    return Math.min((used / limit) * 100, 100);
  };

  const getDatabasePercentage = (estimatedKB: number, limit: number = 8388608): number => {
    // Default limit: 8GB in KB (for Medium plan)
    return Math.min((estimatedKB / limit) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const storagePercentage = getStoragePercentage(storageStats.totalSize);
  const databasePercentage = getDatabasePercentage(databaseStats.totalSize);

  const handleDeleteAllPhotos = async () => {
    try {
      setDeleting(true);
      
      // List all files in the bucket
      const { data: files, error: listError } = await supabase
        .storage
        .from('encarte-photos')
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (listError) throw listError;

      if (!files || files.length === 0) {
        toast.info("No hay archivos para eliminar");
        return;
      }

      // Delete all files
      const filePaths = files.map(file => file.name);
      const { error: deleteError } = await supabase
        .storage
        .from('encarte-photos')
        .remove(filePaths);

      if (deleteError) throw deleteError;

      toast.success(`${files.length} archivos eliminados exitosamente`);
      
      // Reload metrics
      await loadMetrics();
      
    } catch (error: any) {
      console.error("Error deleting files:", error);
      toast.error("Error al eliminar archivos: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Storage Bucket Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <CardTitle>Almacenamiento de Archivos</CardTitle>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={storageStats.fileCount === 0 || deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpiar Storage
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar todas las fotos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente {storageStats.fileCount} archivo(s) 
                    del storage ({formatBytes(storageStats.totalSize)}). Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAllPhotos}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <CardDescription className="flex items-center gap-2">
            Uso del storage bucket
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5"
              onClick={() => loadMetrics(false)}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Espacio utilizado</span>
              <span className="font-medium">{formatBytes(storageStats.totalSize)} / 100 GB</span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {storagePercentage.toFixed(1)}% utilizado
            </p>
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de archivos</span>
              <span className="text-2xl font-bold">{storageStats.fileCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tamaño promedio</span>
              <span className="text-sm font-medium">
                {storageStats.fileCount > 0 
                  ? formatBytes(storageStats.totalSize / storageStats.fileCount)
                  : '0 B'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Base de Datos</CardTitle>
          </div>
          <CardDescription>Estimación del uso de la base de datos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Espacio estimado</span>
              <span className="font-medium">{formatBytes(databaseStats.totalSize * 1024)} / 8 GB</span>
            </div>
            <Progress value={databasePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {databasePercentage.toFixed(1)}% utilizado
            </p>
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tablas principales</span>
              <span className="text-2xl font-bold">{databaseStats.tableCount}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span className="text-muted-foreground">Productos, Encartes, etc.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
