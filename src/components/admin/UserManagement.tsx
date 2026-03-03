import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Pencil, Upload, Loader2, Key, Search, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import * as XLSX from "xlsx";

const userSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muy largo"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100, "Contraseña muy larga"),
  role: z.enum(["admin", "auditor", "encuestador"], { required_error: "Debe seleccionar un rol" }),
});

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export const UserManagement = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [uploadingUsers, setUploadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "encuestador",
  });
  const [resettingPasswords, setResettingPasswords] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter]);

  const filterUsers = () => {
    let filtered = [...users];
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        user => 
          user.email.toLowerCase().includes(term) ||
          user.full_name.toLowerCase().includes(term)
      );
    }
    
    // Filter by status
    if (statusFilter === "active") {
      filtered = filtered.filter(user => user.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(user => !user.is_active);
    }
    
    setFilteredUsers(filtered);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('list-users', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error("Error loading users:", error);
        toast.error("Error al cargar usuarios");
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    setTogglingUser(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: user.id,
          is_active: !user.is_active
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error("Error toggling user status:", error);
        toast.error("Error al cambiar estado del usuario");
        return;
      }

      toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'} exitosamente`);
      loadUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Error al cambiar estado del usuario");
    } finally {
      setTogglingUser(null);
    }
  };

  const handleSubmit = async () => {
    if (editingUser) {
      await handleUpdateUser();
    } else {
      await handleCreateUser();
    }
  };

  const handleCreateUser = async () => {
    // Validate input with zod schema
    const validation = userSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: validation.data.email,
          password: validation.data.password,
          role: validation.data.role,
          full_name: validation.data.email.split('@')[0],
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error("Function error:", error);
        if (error.message?.includes('401') || error.message?.includes('403')) {
          toast.error("No tienes permisos para crear usuarios");
        } else if (error.message?.includes('ya está registrado')) {
          toast.error("Este email ya está registrado");
        } else {
          toast.error("Error al crear usuario");
        }
        return;
      }

      toast.success(`Usuario ${validation.data.email} creado exitosamente`);
      setFormData({ email: "", password: "", role: "encuestador" });
      setOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error("Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    // For updates, password is optional
    const updateSchema = z.object({
      email: z.string().email("Email inválido").max(255, "Email muy largo"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100, "Contraseña muy larga").optional().or(z.literal("")),
      role: z.enum(["admin", "auditor", "encuestador"], { required_error: "Debe seleccionar un rol" }),
    });

    const validation = updateSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const body: any = {
        userId: editingUser.id,
        role: validation.data.role,
      };

      if (validation.data.email !== editingUser.email) {
        body.email = validation.data.email;
      }

      if (validation.data.password) {
        body.password = validation.data.password;
      }

      const { data, error } = await supabase.functions.invoke('update-user', {
        body,
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error("Function error:", error);
        toast.error("Error al actualizar usuario");
        return;
      }

      toast.success("Usuario actualizado exitosamente");
      setFormData({ email: "", password: "", role: "encuestador" });
      setEditingUser(null);
      setOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error("Error al actualizar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      role: user.role,
    });
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({ email: "", password: "", role: "encuestador" });
  };

  const handleResetPasswords = async () => {
    const targetEmails = [
      "carlos.palacios@jlmakergin.com",
      "cristina.de.la.torre@jlmakergin.com",
      "bertha.cespedes@jlmakergin.com",
      "jorge.arias@jlmakergin.com",
      "lilian.saldarriaga@jlmakergin.com",
      "carolina.pacco@jlmakergin.com",
      "maria.velasquez@jlmakergin.com",
      "celinda.velasquez@jlmakergin.com",
    ];

    setResettingPasswords(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke('reset-user-passwords', {
        body: { 
          emails: targetEmails,
          newPassword: "encarte11"
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error("Error reseteando contraseñas:", error);
        toast.error("Error al resetear contraseñas");
        return;
      }

      console.log("✅ Resultado reset:", result);
      
      if (result.results.success.length > 0) {
        toast.success(`${result.results.success.length} contraseñas actualizadas a "encarte11"`);
      }
      
      if (result.results.errors.length > 0) {
        toast.error(`${result.results.errors.length} errores: ${result.results.errors.map((e: any) => e.email).join(", ")}`);
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error al resetear contraseñas");
    } finally {
      setResettingPasswords(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx" && fileExtension !== "xls") {
      toast.error("Por favor sube un archivo Excel (.xlsx o .xls)");
      return;
    }

    setUploadingUsers(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const usersToCreate = jsonData.map((row: any) => ({
            nombre: row["Nombre"] || row.nombre || row["NOMBRE"] || "",
            email: row["Email"] || row.email || row["EMAIL"] || "",
            rol: row["Rol"] || row.rol || row["ROL"] || "encuestador",
            password: String(row["Password"] || row.password || row["PASSWORD"] || row["Contraseña"] || ""),
          })).filter((u: any) => u.email && u.password);

          console.log("📋 Usuarios del Excel:", {
            totalRows: jsonData.length,
            validUsers: usersToCreate.length,
            sample: usersToCreate[0]
          });

          if (usersToCreate.length === 0) {
            toast.error("No se encontraron usuarios válidos. El archivo debe tener: Nombre, Email, Rol, Password");
            setUploadingUsers(false);
            return;
          }

          const { data: { session } } = await supabase.auth.getSession();
          const { data: result, error } = await supabase.functions.invoke('bulk-create-users', {
            body: { users: usersToCreate },
            headers: {
              Authorization: `Bearer ${session?.access_token}`
            }
          });

          if (error) {
            console.error("Error en carga masiva:", error);
            toast.error("Error al crear usuarios");
            return;
          }

          console.log("✅ Resultado:", result);
          
          if (result.results.success.length > 0) {
            toast.success(`${result.results.success.length} usuarios creados exitosamente`);
          }
          
          if (result.results.errors.length > 0) {
            toast.error(`${result.results.errors.length} errores: ${result.results.errors.map((e: any) => e.email).join(", ")}`);
          }

          loadUsers();

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (err) {
          console.error("Error procesando archivo:", err);
          toast.error("Error al procesar el archivo Excel");
        } finally {
          setUploadingUsers(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error leyendo archivo:", err);
      toast.error("Error al leer el archivo");
      setUploadingUsers(false);
    }
  };

  const activeCount = users.filter(u => u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Usuarios</CardTitle>
        <CardDescription>
          Crea, edita y gestiona usuarios del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) handleCloseDialog();
            else setOpen(isOpen);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Generar Usuario
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Modifica los datos del usuario' : 'Ingresa los datos del nuevo usuario'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña {editingUser && '(dejar en blanco para no cambiar)'}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={editingUser ? "Dejar en blanco para no cambiar" : "Mínimo 8 caracteres"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="encuestador">Encuestador</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (editingUser ? "Actualizando..." : "Creando...") : (editingUser ? "Actualizar Usuario" : "Crear Usuario")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingUsers}
            className="gap-2"
          >
            {uploadingUsers ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando usuarios...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Carga Masiva
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleBulkUpload}
            className="hidden"
          />

          <Button
            variant="secondary"
            onClick={handleResetPasswords}
            disabled={resettingPasswords}
            className="gap-2"
          >
            {resettingPasswords ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reseteando...
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Reset 8 Usuarios (encarte11)
              </>
            )}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Para carga masiva, el archivo Excel debe contener: Nombre, Email, Rol, Password
        </p>

        {/* Search and Filter Section */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({users.length})</SelectItem>
                <SelectItem value="active">
                  <span className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    Activos ({activeCount})
                  </span>
                </SelectItem>
                <SelectItem value="inactive">
                  <span className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" />
                    Inactivos ({inactiveCount})
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats badges */}
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <UserCheck className="h-3 w-3 text-green-500" />
              {activeCount} activos
            </Badge>
            <Badge variant="outline" className="gap-1">
              <UserX className="h-3 w-3 text-red-500" />
              {inactiveCount} inactivos
            </Badge>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">
            Usuarios {searchTerm && `(${filteredUsers.length} resultados)`}
          </h3>
          {loadingUsers ? (
            <p className="text-muted-foreground">Cargando usuarios...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className={!user.is_active ? "opacity-60" : ""}>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => handleToggleActive(user)}
                          disabled={togglingUser === user.id}
                        />
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "No se encontraron usuarios con ese criterio" : "No hay usuarios"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
