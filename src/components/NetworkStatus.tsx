import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NetworkStatusProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncClick?: () => void;
}

export const NetworkStatus = ({ 
  isOnline, 
  pendingCount, 
  isSyncing,
  onSyncClick 
}: NetworkStatusProps) => {
  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Wifi className="h-4 w-4 text-green-500" />
        <span className="hidden sm:inline text-muted-foreground">En línea</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-destructive" />
        <Badge variant="destructive" className="hidden sm:flex">
          Sin conexión
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    );
  }

  // Online with pending items
  return (
    <div className="flex items-center gap-2">
      <Wifi className="h-4 w-4 text-green-500" />
      <Button
        variant="outline"
        size="sm"
        onClick={onSyncClick}
        disabled={isSyncing}
        className="gap-2"
      >
        <CloudUpload className="h-3 w-3" />
        {isSyncing ? "Sincronizando..." : `Sincronizar (${pendingCount})`}
      </Button>
    </div>
  );
};
