import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Package } from "lucide-react";
import logo from "@/assets/jl-marketing-logo.jpg";

const EncuestadorSelection = () => {
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
        <div className="container px-4">
          {/* Mobile Layout */}
          <div className="flex md:hidden flex-col gap-3 py-3">
            <div className="flex items-center justify-between">
              <img src={logo} alt="JL Marketing" className="h-8 object-contain" />
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Salir
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-lg font-bold">Selección de Estudio</h1>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="JL Marketing" className="h-12 object-contain" />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">V.23.0</span>
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

      <main className="container px-4 py-6 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold">Escoje el estudio a realizar:</h2>
            <p className="text-sm md:text-base text-muted-foreground">Selecciona una opción para continuar</p>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 max-w-xl mx-auto">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/encuestador/encarte")}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-3 md:mb-4 w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <CardTitle className="text-xl md:text-2xl">Encarte</CardTitle>
                <CardDescription className="text-sm">
                  Realizar encuesta de productos en encartes promocionales
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <Button className="w-full">Iniciar Encarte</Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/encuestador/exhibicion")}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-3 md:mb-4 w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <CardTitle className="text-xl md:text-2xl">Exhibición</CardTitle>
                <CardDescription className="text-sm">
                  Realizar encuesta de exhibiciones en tienda
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <Button className="w-full">Iniciar Exhibición</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EncuestadorSelection;
