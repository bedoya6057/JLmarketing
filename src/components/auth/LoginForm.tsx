import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logo from "@/assets/jl-marketing-logo.jpg";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

export const LoginForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const checkUserActive = async (accessToken: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('check-user-active', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (error) {
        console.error("Error checking user status:", error);
        return true; // Allow login if check fails
      }

      return data?.is_active ?? true;
    } catch (error) {
      console.error("Error checking user status:", error);
      return true; // Allow login if check fails
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    eventLogger.log(EventType.INFO, 'Intentando iniciar sesión', {
      context: { email: formData.email }
    });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Check if user is active
      const isActive = await checkUserActive(data.session?.access_token || '');
      
      if (!isActive) {
        // Sign out the user immediately
        await supabase.auth.signOut();
        
        eventLogger.log(EventType.AUTH_ERROR, 'Usuario inactivo intentó iniciar sesión', {
          context: { email: formData.email },
          severity: EventSeverity.ERROR
        });
        
        toast.error("Tu cuenta ha sido desactivada. Contacta al administrador.");
        setLoading(false);
        return;
      }
      
      eventLogger.log(EventType.LOGIN, 'Sesión iniciada exitosamente', {
        severity: EventSeverity.SUCCESS,
        context: { email: formData.email, userId: data.user?.id },
        userId: data.user?.id
      });
      
      toast.success("Sesión iniciada");
      navigate("/dashboard");
    } catch (error: any) {
      eventLogger.log(EventType.AUTH_ERROR, 'Error al iniciar sesión', {
        context: { email: formData.email, error: error.message },
        error
      });
      toast.error(error.message || "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="JL Marketing" className="h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Iniciar Sesión
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
