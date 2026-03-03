import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

const CreateAdminUser = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const createUser = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: 'admin@encartescanner.com',
          password: 'Admin123!SecurePassword',
          full_name: 'Administrador'
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      
      if (error) throw error;
      
      toast.success("Usuario admin creado exitosamente");
      setSuccess(true);
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        toast.error("No tienes permisos para crear usuarios administradores");
      } else {
        toast.error("Error al crear usuario");
      }
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear Usuario Admin</CardTitle>
          <CardDescription>
            Ejecuta esta acción una sola vez para crear el usuario administrador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div className="space-y-2">
                <p className="font-semibold">¡Usuario creado!</p>
                <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                  <p><strong>Email:</strong> admin@encartescanner.com</p>
                  <p><strong>Contraseña:</strong> Admin123!</p>
                </div>
              </div>
              <Button onClick={() => window.location.href = '/login'} className="w-full">
                Ir al Login
              </Button>
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                <p className="font-semibold mb-2">Se creará el usuario:</p>
                <p><strong>Email:</strong> admin@encartescanner.com</p>
                <p><strong>Contraseña:</strong> Admin123!</p>
              </div>
              <Button onClick={createUser} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Usuario
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateAdminUser;
