import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/jl-marketing-logo.jpg";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

interface DashboardHeaderProps {
  userEmail?: string;
  onBeforeLogout?: () => Promise<void>;
}

export const DashboardHeader = ({ userEmail, onBeforeLogout }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Save any pending progress before logout
      if (onBeforeLogout) {
        try {
          await onBeforeLogout();
          eventLogger.log(EventType.INFO, 'Progreso guardado antes de cerrar sesión', {
            severity: EventSeverity.SUCCESS
          });
        } catch (error) {
          console.error("Error saving progress before logout:", error);
          // Continue with logout even if save fails
        }
      }
      
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container px-4">
        {/* Mobile Layout */}
        <div className="flex md:hidden flex-col gap-3 py-3">
          <div className="flex items-center justify-between">
            <img src={logo} alt="JL Marketing" className="h-8 object-contain" />
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="ml-2">{isLoggingOut ? "Guardando..." : "Salir"}</span>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-lg font-bold">JLMarketing</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="JL Marketing" className="h-10 object-contain" />
            <h1 className="text-lg font-bold">JLMarketing</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{userEmail}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              {isLoggingOut ? "Guardando progreso..." : "Cerrar Sesión"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
