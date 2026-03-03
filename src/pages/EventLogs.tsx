import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EventLogViewer } from "@/components/admin/EventLogViewer";
import logo from "@/assets/jl-marketing-logo.jpg";

const EventLogs = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>();
  const [loading, setLoading] = useState(true);

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

    // Verificar que sea admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (userRole?.role !== "admin") {
      navigate("/dashboard");
      return;
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
              <img src={logo} alt="JL Marketing" className="h-8 object-contain" />
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Salir
              </Button>
            </div>
            <h1 className="text-lg font-bold text-center">Registro de Eventos</h1>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard Admin
              </Button>
              <img src={logo} alt="JL Marketing" className="h-10 object-contain" />
              <h1 className="text-2xl font-bold">Registro de Eventos</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{userEmail}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 md:py-8">
        <EventLogViewer />
      </main>
    </div>
  );
};

export default EventLogs;
