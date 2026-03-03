import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EncuestadorExhibicionForm } from "@/components/exhibicion/EncuestadorExhibicionForm";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { NetworkStatusDialog } from "@/components/NetworkStatusDialog";
import { usePresence } from "@/contexts/PresenceContext";
import logo from "@/assets/jl-marketing-logo.jpg";
import { toast } from "sonner";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

const EncuestadorExhibicion = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isOnline } = useNetworkStatus();
  const [syncTrigger, setSyncTrigger] = useState(0);
  const saveProgressRef = useRef<(() => Promise<void>) | null>(null);
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, pendingCount: 0, syncedCount: 0, totalToSync: 0 });

  // Global presence tracking
  const { trackActivity } = usePresence();

  const handleActivityChange = useCallback((activity: { studyName?: string; tienda?: string; currentProductIndex?: number; totalProducts?: number; progress?: number }) => {
    trackActivity({
      type: "exhibicion",
      studyName: activity.studyName,
      tienda: activity.tienda,
      currentProductIndex: activity.currentProductIndex,
      totalProducts: activity.totalProducts,
      progress: activity.progress
    });
  }, [trackActivity]);

  useEffect(() => {
    checkAuth();
  }, []);

  // Track initial state when entering the page
  useEffect(() => {
    if (!loading) {
      trackActivity({ type: "exhibicion" });
    }
  }, [loading, trackActivity]);

  // Reset to idle when leaving the page
  useEffect(() => {
    return () => {
      trackActivity({ type: "idle" });
    };
  }, [trackActivity]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/");
      return;
    }

    setUserEmail(session.user.email);

    // Verificar que sea encuestador
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (userRole?.role !== "encuestador") {
      navigate("/dashboard");
      return;
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Save progress before logout
      if (saveProgressRef.current) {
        try {
          await saveProgressRef.current();
          eventLogger.log(EventType.INFO, 'Progreso guardado antes de cerrar sesión (exhibición)', {
            severity: EventSeverity.SUCCESS
          });
        } catch (error) {
          console.error("Error saving progress before logout:", error);
          // Continue with logout even if save fails
        }
      }

      // Set to idle before logout
      await trackActivity({ type: "idle" });
      
      await supabase.auth.signOut();
      
      eventLogger.log(EventType.LOGOUT, 'Sesión cerrada exitosamente', {
        severity: EventSeverity.INFO
      });
      
      toast.success("Sesión cerrada");
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
      toast.error("Error al cerrar sesión");
    } finally {
      setIsLoggingOut(false);
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
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container px-4 py-3">
          {/* Mobile Layout */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <img src={logo} alt="JL Marketing" className="h-8 object-contain" />
              <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salir"
                )}
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-lg font-bold">Estudio de Exhibición</h1>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <img src={logo} alt="JL Marketing" className="h-10 object-contain" />
              <h1 className="text-2xl font-bold">Estudio de Exhibición</h1>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{userEmail}</span>
              <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Cerrar Sesión"
                )}
              </Button>
            </div>
          </div>
          {/* Network Status Row */}
          <div className="flex justify-end mt-2 md:mt-0 md:absolute md:right-4 md:top-16">
            <div id="network-status-container"></div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 md:py-8">
        <EncuestadorExhibicionForm 
          isOnline={isOnline}
          syncTrigger={syncTrigger}
          onSyncRequest={() => setSyncTrigger(prev => prev + 1)}
          saveProgressRef={saveProgressRef}
          onSyncStatusChange={setSyncStatus}
          onActivityChange={handleActivityChange}
        />
      </main>

      <NetworkStatusDialog 
        isOnline={isOnline}
        isSyncing={syncStatus.isSyncing}
        pendingCount={syncStatus.pendingCount}
        syncedCount={syncStatus.syncedCount}
        totalToSync={syncStatus.totalToSync}
      />
    </div>
  );
};

export default EncuestadorExhibicion;
