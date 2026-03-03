import { useState, useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface NetworkStatusDialogProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncedCount?: number;
  totalToSync?: number;
}

export const NetworkStatusDialog = ({
  isOnline,
  isSyncing,
  pendingCount,
  syncedCount = 0,
  totalToSync = 0,
}: NetworkStatusDialogProps) => {
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const previousOnlineStatus = useRef<boolean | null>(null);
  const isFirstMount = useRef(true);
  
  // Clamp progress to prevent showing values over 100%
  const progress = totalToSync > 0 ? Math.min(100, Math.round((syncedCount / totalToSync) * 100)) : 0;
  const displaySyncedCount = Math.min(syncedCount, totalToSync);

  useEffect(() => {
    // Skip the first mount to avoid showing dialogs on initial load
    if (isFirstMount.current) {
      previousOnlineStatus.current = isOnline;
      isFirstMount.current = false;
      return;
    }

    // Only show dialogs when status actually changes
    if (previousOnlineStatus.current !== null && previousOnlineStatus.current !== isOnline) {
      if (!isOnline) {
        // Going offline
        setShowOfflineDialog(true);
        setShowOnlineDialog(false);
      } else {
        // Coming back online
        setShowOnlineDialog(true);
        setShowOfflineDialog(false);
      }
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  return (
    <>
      {/* Offline Dialog */}
      <AlertDialog open={showOfflineDialog} onOpenChange={setShowOfflineDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <WifiOff className="h-8 w-8 text-destructive" />
              <AlertDialogTitle className="text-destructive text-xl">
                Usted está ingresando al modo Offline
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p className="font-medium text-foreground">
                  Por favor tenga en cuenta las siguientes indicaciones:
                </p>
                <ol className="list-decimal list-inside space-y-3 text-sm">
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Antes de cerrar el app
                    </span>{" "}
                    validar que se han sincronizado los items, lo podrá ver en
                    la parte superior izquierda
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Mientras el app esté sincronizando
                    </span>{" "}
                    no cerrar el app en ningún momento
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      No cerrar sesión
                    </span>{" "}
                    mientras se encuentre en el modo offline
                  </li>
                </ol>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowOfflineDialog(false)}
              className="w-full"
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Online Dialog */}
      <AlertDialog open={showOnlineDialog} onOpenChange={setShowOnlineDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Wifi className="h-8 w-8 text-green-500" />
              <AlertDialogTitle className="text-green-600 text-xl">
                Usted ha vuelto al modo Online
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                {isSyncing ? (
                  <>
                    <div className="flex items-center gap-2 text-amber-600 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sincronización en progreso...
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Sincronizado: {displaySyncedCount} de {totalToSync}
                        </span>
                        <span className="font-bold text-foreground">
                          {progress}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <p className="text-sm text-destructive font-medium">
                      ¡No cierre el app ni la sesión hasta que termine!
                    </p>
                  </>
                ) : pendingCount > 0 ? (
                  <>
                    <p className="text-amber-600 font-medium">
                      ⚠️ {pendingCount} items pendientes de sincronizar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Por favor espere a que la sincronización termine antes de 
                      cerrar el app o cerrar sesión.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Valide que la sincronización haya terminado antes de cerrar 
                    el app o cerrar sesión. Puede verificar el estado en la 
                    parte superior izquierda.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowOnlineDialog(false)}
              className="w-full"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
