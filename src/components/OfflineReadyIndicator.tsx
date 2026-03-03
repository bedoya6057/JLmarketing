import { useState, useEffect } from "react";
import { WifiOff, CheckCircle2, Download, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { offlineStorage } from "@/lib/offlineStorage";

interface OfflineReadyIndicatorProps {
  studyId: string;
  studyType: 'encarte' | 'exhibicion';
  isLoading: boolean;
  productCount: number;
  loadedCount: number;
}

export const OfflineReadyIndicator = ({
  studyId,
  studyType,
  isLoading,
  productCount,
  loadedCount,
}: OfflineReadyIndicatorProps) => {
  const [isReady, setIsReady] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ usage: 0, quota: 0, usagePercent: 0 });

  useEffect(() => {
    const checkStatus = async () => {
      if (!studyId) {
        setIsReady(false);
        return;
      }
      
      const status = await offlineStorage.getSyncStatus(studyId, studyType);
      setIsReady(status?.isReady || false);
      
      // Get storage estimate
      const estimate = await offlineStorage.getStorageEstimate();
      setStorageInfo(estimate);
    };
    
    checkStatus();
  }, [studyId, studyType, loadedCount]);

  // Update ready status when loading completes
  useEffect(() => {
    const updateStatus = async () => {
      if (!isLoading && productCount > 0 && loadedCount === productCount) {
        await offlineStorage.setSyncStatus(studyId, studyType, true, productCount);
        setIsReady(true);
      }
    };
    
    updateStatus();
  }, [isLoading, productCount, loadedCount, studyId, studyType]);

  if (!studyId) return null;

  const progress = productCount > 0 ? Math.round((loadedCount / productCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Download className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-blue-700 dark:text-blue-300">
              Descargando para trabajo offline...
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {loadedCount}/{productCount}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    );
  }

  if (isReady) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-green-700 dark:text-green-300 text-sm font-medium">
              ✓ Listo para trabajo offline
            </span>
            <span className="text-green-600 dark:text-green-400 text-xs">
              {productCount} productos
            </span>
          </div>
          {storageInfo.usagePercent > 0 && (
            <div className="text-xs text-green-600 dark:text-green-500 mt-1">
              Almacenamiento: {storageInfo.usagePercent}% usado
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <span className="text-yellow-700 dark:text-yellow-300 text-sm">
        Selecciona un estudio para preparar trabajo offline
      </span>
    </div>
  );
};
