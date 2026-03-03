import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Pencil, Search, Download, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Tienda {
  id: string;
  bandera: string;
  tienda: string;
  distrito: string;
  ubigeo: string;
  responsable: string | null;
}

export const TiendasManagement = () => {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para el dialog de actualización
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Tienda[]>([]);
  const [selectedTienda, setSelectedTienda] = useState<Tienda | null>(null);
  const [newResponsable, setNewResponsable] = useState("");
  const [newTiendaNombre, setNewTiendaNombre] = useState("");
  const [updating, setUpdating] = useState(false);

  // Estados para nueva tienda manual
  const [newTiendaDialogOpen, setNewTiendaDialogOpen] = useState(false);
  const [newTiendaForm, setNewTiendaForm] = useState({
    bandera: "",
    tienda: "",
    distrito: "",
    ubigeo: "",
    responsable: "",
  });
  const [savingNewTienda, setSavingNewTienda] = useState(false);

  const loadTiendas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tiendas")
        .select("*")
        .order("bandera", { ascending: true })
        .order("tienda", { ascending: true });

      if (error) throw error;
      setTiendas(data || []);
    } catch (error: any) {
      toast.error("Error al cargar las tiendas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiendas();
  }, []);

  // Buscar tiendas en tiempo real
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    const filtered = tiendas.filter(t => 
      t.tienda.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.bandera.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.distrito && t.distrito.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10);
    
    setSearchResults(filtered);
  }, [searchQuery, tiendas]);

  const handleSelectTienda = (tienda: Tienda) => {
    setSelectedTienda(tienda);
    setNewResponsable(tienda.responsable || "");
    setNewTiendaNombre(tienda.tienda);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleUpdateTienda = async () => {
    if (!selectedTienda) return;
    if (!newTiendaNombre.trim()) {
      toast.error("El nombre de la tienda no puede estar vacío");
      return;
    }
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("tiendas")
        .update({ 
          tienda: newTiendaNombre.trim(),
          responsable: newResponsable || null 
        })
        .eq("id", selectedTienda.id);

      if (error) throw error;

      toast.success(`Tienda "${newTiendaNombre}" actualizada correctamente`);
      setSelectedTienda(null);
      setNewResponsable("");
      setNewTiendaNombre("");
      setUpdateDialogOpen(false);
      loadTiendas();
    } catch (error: any) {
      toast.error("Error al actualizar la tienda");
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNewTienda = async () => {
    if (!newTiendaForm.bandera.trim() || !newTiendaForm.tienda.trim()) {
      toast.error("Bandera y Tienda son obligatorios");
      return;
    }
    setSavingNewTienda(true);
    try {
      const { error } = await supabase.from("tiendas").insert({
        bandera: newTiendaForm.bandera.trim(),
        tienda: newTiendaForm.tienda.trim(),
        distrito: newTiendaForm.distrito.trim() || null,
        ubigeo: newTiendaForm.ubigeo.trim() || null,
        responsable: newTiendaForm.responsable.trim() || null,
      });
      if (error) throw error;
      toast.success(`Tienda "${newTiendaForm.tienda}" creada correctamente`);
      setNewTiendaForm({ bandera: "", tienda: "", distrito: "", ubigeo: "", responsable: "" });
      setNewTiendaDialogOpen(false);
      loadTiendas();
    } catch (error: any) {
      toast.error("Error al crear la tienda");
      console.error(error);
    } finally {
      setSavingNewTienda(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension !== "xlsx" && fileExtension !== "xls") {
      toast.error("Por favor sube un archivo Excel (.xlsx o .xls)");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const tiendasFromFile = jsonData.map((row: any) => ({
            bandera: String(row["Bandera"] || row.bandera || "").trim(),
            tienda: String(row["Tienda"] || row.tienda || "").trim(),
            distrito: row["DISTRITO"] || row.distrito || null,
            ubigeo: row["UBIGEO"] || row.ubigeo || null,
            responsable: row["Responsable"] || row.responsable ? String(row["Responsable"] || row.responsable).trim() : null,
          })).filter((t: any) => t.bandera && t.tienda);

          if (tiendasFromFile.length === 0) {
            toast.error("No se encontraron tiendas válidas en el archivo");
            return;
          }

          console.log(`Procesando ${tiendasFromFile.length} tiendas del archivo...`);

          // Actualizar tiendas existentes o insertar nuevas
          let updated = 0;
          let inserted = 0;
          let errors = 0;

          for (const tienda of tiendasFromFile) {
            // Buscar si la tienda ya existe
            const { data: existing } = await supabase
              .from("tiendas")
              .select("id")
              .eq("bandera", tienda.bandera)
              .eq("tienda", tienda.tienda)
              .maybeSingle();

            if (existing) {
              // Actualizar tienda existente
              const { error: updateError } = await supabase
                .from("tiendas")
                .update({
                  distrito: tienda.distrito,
                  ubigeo: tienda.ubigeo,
                  responsable: tienda.responsable,
                })
                .eq("id", existing.id);

              if (updateError) {
                console.error(`Error actualizando ${tienda.tienda}:`, updateError);
                errors++;
              } else {
                updated++;
              }
            } else {
              // Insertar nueva tienda
              const { error: insertError } = await supabase
                .from("tiendas")
                .insert(tienda);

              if (insertError) {
                console.error(`Error insertando ${tienda.tienda}:`, insertError);
                errors++;
              } else {
                inserted++;
              }
            }
          }

          const messages = [];
          if (updated > 0) messages.push(`${updated} actualizadas`);
          if (inserted > 0) messages.push(`${inserted} agregadas`);
          if (errors > 0) messages.push(`${errors} errores`);
          
          toast.success(`Tiendas procesadas: ${messages.join(", ")}`);
          loadTiendas();

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error: any) {
          toast.error("Error al procesar el archivo Excel");
          console.error(error);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast.error("Error al leer el archivo");
      console.error(error);
      setUploading(false);
    }
  };

  const handleDownloadAll = () => {
    if (tiendas.length === 0) {
      toast.error("No hay tiendas para descargar");
      return;
    }

    const dataToExport = tiendas.map(t => ({
      Bandera: t.bandera,
      Tienda: t.tienda,
      DISTRITO: t.distrito || "",
      UBIGEO: t.ubigeo || "",
      Responsable: t.responsable || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tiendas");
    XLSX.writeFile(wb, `tiendas_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${tiendas.length} tiendas descargadas`);
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from("tiendas")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      toast.success("Todas las tiendas han sido eliminadas");
      setTiendas([]);
    } catch (error: any) {
      toast.error("Error al eliminar las tiendas");
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Tiendas</CardTitle>
        <CardDescription>
          Carga el archivo Excel con las tiendas. Las nuevas tiendas se agregarán de forma incremental sin borrar las existentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Cargar Excel
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Botón nueva tienda manual */}
          <Dialog open={newTiendaDialogOpen} onOpenChange={(open) => {
            setNewTiendaDialogOpen(open);
            if (!open) setNewTiendaForm({ bandera: "", tienda: "", distrito: "", ubigeo: "", responsable: "" });
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Nueva Tienda
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva Tienda</DialogTitle>
                <DialogDescription>
                  Agrega una tienda manualmente ingresando sus datos.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-bandera">Bandera *</Label>
                  <Input
                    id="new-bandera"
                    placeholder="Ej: VEA, METRO, TOTTUS"
                    value={newTiendaForm.bandera}
                    onChange={(e) => setNewTiendaForm({ ...newTiendaForm, bandera: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-tienda">Nombre de Tienda *</Label>
                  <Input
                    id="new-tienda"
                    placeholder="Ej: PVEA San Isidro"
                    value={newTiendaForm.tienda}
                    onChange={(e) => setNewTiendaForm({ ...newTiendaForm, tienda: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-distrito">Distrito</Label>
                  <Input
                    id="new-distrito"
                    placeholder="Ej: San Isidro"
                    value={newTiendaForm.distrito}
                    onChange={(e) => setNewTiendaForm({ ...newTiendaForm, distrito: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-ubigeo">Ubigeo</Label>
                  <Input
                    id="new-ubigeo"
                    placeholder="Ej: 150131"
                    value={newTiendaForm.ubigeo}
                    onChange={(e) => setNewTiendaForm({ ...newTiendaForm, ubigeo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-responsable">Responsable</Label>
                  <Input
                    id="new-responsable"
                    placeholder="Email del responsable"
                    value={newTiendaForm.responsable}
                    onChange={(e) => setNewTiendaForm({ ...newTiendaForm, responsable: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveNewTienda} disabled={savingNewTienda}>
                  {savingNewTienda ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    "Crear Tienda"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Botón para actualización manual */}
          <Dialog open={updateDialogOpen} onOpenChange={(open) => {
            setUpdateDialogOpen(open);
            if (!open) {
              setSearchQuery("");
              setSearchResults([]);
              setSelectedTienda(null);
              setNewResponsable("");
              setNewTiendaNombre("");
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                Actualizar Tienda
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Actualizar Tienda</DialogTitle>
                <DialogDescription>
                  Busca la tienda y actualiza el nombre o responsable asignado.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {!selectedTienda ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="search">Buscar tienda</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Nombre de tienda, bandera o distrito..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {searchResults.map((tienda) => (
                          <button
                            key={tienda.id}
                            onClick={() => handleSelectTienda(tienda)}
                            className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-sm">{tienda.tienda}</div>
                            <div className="text-xs text-muted-foreground">
                              {tienda.bandera} • {tienda.distrito || "Sin distrito"}
                              {tienda.responsable && ` • Resp: ${tienda.responsable}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No se encontraron tiendas
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-muted rounded-md">
                      <div className="text-sm text-muted-foreground">
                        {selectedTienda.bandera} • {selectedTienda.distrito || "Sin distrito"}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="tiendaNombre">Nombre de Tienda</Label>
                      <Input
                        id="tiendaNombre"
                        placeholder="Nombre de la tienda"
                        value={newTiendaNombre}
                        onChange={(e) => setNewTiendaNombre(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="responsable">Responsable</Label>
                      <Input
                        id="responsable"
                        placeholder="Email del responsable"
                        value={newResponsable}
                        onChange={(e) => setNewResponsable(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedTienda(null);
                        setNewResponsable("");
                        setNewTiendaNombre("");
                      }}
                    >
                      ← Buscar otra tienda
                    </Button>
                  </>
                )}
              </div>
              
              <DialogFooter>
                {selectedTienda && (
                  <Button 
                    onClick={handleUpdateTienda} 
                    disabled={updating}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar Cambios"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {tiendas.length > 0 && (
            <>
              <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar Tiendas
              </Button>
              
              <Button variant="outline" onClick={loadTiendas} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cargando...
                  </>
                ) : (
                  "Actualizar Lista"
                )}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Eliminar Todas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará todas las tiendas de la base de datos. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          El archivo debe contener las columnas: Bandera, Tienda, DISTRITO, UBIGEO, Responsable
        </p>

        {tiendas.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bandera</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>Ubigeo</TableHead>
                  <TableHead>Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiendas.slice(0, 10).map((tienda) => (
                  <TableRow key={tienda.id}>
                    <TableCell className="font-medium">{tienda.bandera}</TableCell>
                    <TableCell>{tienda.tienda}</TableCell>
                    <TableCell>{tienda.distrito}</TableCell>
                    <TableCell>{tienda.ubigeo}</TableCell>
                    <TableCell>{tienda.responsable || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tiendas.length > 10 && (
              <div className="p-4 text-sm text-muted-foreground text-center border-t">
                Mostrando 10 de {tiendas.length} tiendas. Total en base de datos: {tiendas.length}
              </div>
            )}
          </div>
        )}

        {tiendas.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            No hay tiendas cargadas. Sube un archivo Excel para comenzar.
          </div>
        )}
      </CardContent>
    </Card>
  );
};