import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SyncProgressIndicatorProps {
  isSyncing: boolean;
  pendingCount: number;
  syncedCount: number;
  totalToSync: number;
  errorCount: number;
}

export const SyncProgressIndicator = ({
  isSyncing,
  pendingCount,
  syncedCount,
  totalToSync,
  errorCount,
}: SyncProgressIndicatorProps) => {
  if (!isSyncing && pendingCount === 0) return null;

  // Clamp values to prevent showing values over 100%
  const displaySyncedCount = Math.min(syncedCount, totalToSync);
  const progress = totalToSync > 0 ? Math.min(100, Math.round((syncedCount / totalToSync) * 100)) : 0;

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-blue-700 dark:text-blue-300 font-medium">
              Sincronizando: {displaySyncedCount} de {totalToSync}
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {errorCount > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorCount} errores durante sincronización
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <div className="flex-1">
          <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
            {pendingCount} {pendingCount === 1 ? 'registro pendiente' : 'registros pendientes'} de sincronizar
          </span>
          <div className="text-xs text-orange-600 dark:text-orange-500 mt-1">
            Se sincronizará automáticamente cuando haya conexión
          </div>
        </div>
      </div>
    );
  }

  return null;
};
