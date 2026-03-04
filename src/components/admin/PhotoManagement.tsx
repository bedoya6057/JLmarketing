import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Search, Upload, ImagePlus, Wrench, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import { generateAdminPhotoFileName } from "@/lib/fileNaming";
import { uploadPhotoToS3 } from "@/lib/s3Upload";

interface Study {
  id: string;
  nombre: string;
  fecha: string;
}

interface ProductRecord {
  id: string;
  producto?: string;
  descripcion_producto?: string;
  cod_interno?: string;
  cod_producto?: string;
  tienda?: string;
  foto?: string | null;
}

export const PhotoManagement = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [studyType, setStudyType] = useState<"encarte" | "exhibicion" | "">("");
  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedStudy, setSelectedStudy] = useState("");
  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingStudies, setLoadingStudies] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [fixingPhotos, setFixingPhotos] = useState(false);
  const [validatingUrls, setValidatingUrls] = useState(false);
  const [validationProgress, setValidationProgress] = useState<{
    validated: number;
    valid: number;
    invalid: number;
    total: number;
  } | null>(null);
  const [invalidUrls, setInvalidUrls] = useState<Array<{ id: string; foto: string; cod_producto?: string; tienda?: string }>>([]);

  const handleFixPhotoUrls = async () => {
    setFixingPhotos(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-photo-urls', {
        method: 'POST',
      });

      if (error) throw error;

      const result = data as {
        base64Uploaded: number;
        brokenUrlsCleared: number;
        duplicatesFixed: number;
        errors: number;
      };

      toast.success(
        `Corrección completada: ${result.base64Uploaded} base64 subidas, ${result.brokenUrlsCleared} URLs rotas limpiadas, ${result.duplicatesFixed} duplicados corregidos${result.errors > 0 ? `, ${result.errors} errores` : ''}`
      );
    } catch (error: any) {
      console.error('Error fixing photos:', error);
      toast.error('Error al corregir fotos: ' + error.message);
    } finally {
      setFixingPhotos(false);
    }
  };

  const handleValidatePhotoUrls = async () => {
    setValidatingUrls(true);
    setValidationProgress({ validated: 0, valid: 0, invalid: 0, total: 0 });
    setInvalidUrls([]);

    try {
      // Get total count first
      const { count } = await supabase
        .from('respuestas_exhibicion')
        .select('*', { count: 'exact', head: true })
        .not('foto', 'is', null)
        .neq('foto', '');

      const total = count || 0;
      setValidationProgress(prev => prev ? { ...prev, total } : { validated: 0, valid: 0, invalid: 0, total });

      let offset = 0;
      const batchSize = 50;
      let allInvalid: Array<{ id: string; foto: string; cod_producto?: string; tienda?: string }> = [];
      let totalValid = 0;
      let totalInvalid = 0;

      while (offset < total) {
        // Fetch batch
        const { data: records, error } = await supabase
          .from('respuestas_exhibicion')
          .select('id, foto, cod_producto, tienda')
          .not('foto', 'is', null)
          .neq('foto', '')
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!records || records.length === 0) break;

        // Validate each URL in batch
        for (const record of records) {
          if (!record.foto) continue;

          try {
            const response = await fetch(record.foto, { method: 'HEAD' });
            if (response.ok) {
              totalValid++;
            } else {
              totalInvalid++;
              allInvalid.push({
                id: record.id,
                foto: record.foto,
                cod_producto: record.cod_producto || undefined,
                tienda: record.tienda || undefined
              });
            }
          } catch {
            totalInvalid++;
            allInvalid.push({
              id: record.id,
              foto: record.foto,
              cod_producto: record.cod_producto || undefined,
              tienda: record.tienda || undefined
            });
          }

          setValidationProgress({
            validated: offset + records.indexOf(record) + 1,
            valid: totalValid,
            invalid: totalInvalid,
            total
          });
        }

        offset += batchSize;

        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setInvalidUrls(allInvalid);

      if (allInvalid.length === 0) {
        toast.success(`Validación completada: ${totalValid} URLs válidas`);
      } else {
        toast.warning(`Validación completada: ${totalValid} válidas, ${totalInvalid} inválidas (404)`);
      }
    } catch (error: unknown) {
      console.error('Error validating URLs:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al validar URLs: ' + message);
    } finally {
      setValidatingUrls(false);
    }
  };

  const handleClearInvalidUrls = async () => {
    if (invalidUrls.length === 0) return;

    const confirmed = window.confirm(`¿Estás seguro de limpiar ${invalidUrls.length} URLs inválidas? Se pondrán en NULL.`);
    if (!confirmed) return;

    try {
      for (const item of invalidUrls) {
        await supabase
          .from('respuestas_exhibicion')
          .update({ foto: null })
          .eq('id', item.id);
      }

      toast.success(`${invalidUrls.length} URLs inválidas limpiadas`);
      setInvalidUrls([]);
      setValidationProgress(null);
    } catch (error: unknown) {
      console.error('Error clearing invalid URLs:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al limpiar URLs: ' + message);
    }
  };

  const handleStudyTypeChange = async (type: "encarte" | "exhibicion") => {
    setStudyType(type);
    setSelectedStudy("");
    setStores([]);
    setSelectedStore("");
    setProducts([]);
    setFilteredProducts([]);
    setSelectedProduct(null);
    setSearchTerm("");
    setLoadingStudies(true);

    try {
      if (type === "encarte") {
        const { data, error } = await supabase
          .from("encartes")
          .select("id, nombre, fecha")
          .order("fecha", { ascending: false });

        if (error) throw error;
        setStudies(data || []);
      } else {
        const { data, error } = await supabase
          .from("exhibiciones")
          .select("id, nombre, fecha")
          .order("fecha", { ascending: false });

        if (error) throw error;
        setStudies(data || []);
      }
    } catch (error: any) {
      toast.error("Error al cargar estudios: " + error.message);
    } finally {
      setLoadingStudies(false);
    }
  };

  const handleStudyChange = async (studyId: string) => {
    setSelectedStudy(studyId);
    setStores([]);
    setSelectedStore("");
    setProducts([]);
    setFilteredProducts([]);
    setSelectedProduct(null);
    setSearchTerm("");
    setLoadingStores(true);

    try {
      if (studyType === "encarte") {
        const { data, error } = await supabase
          .from("respuestas")
          .select("tienda")
          .eq("encarte_id", studyId)
          .not("tienda", "is", null);

        if (error) throw error;
        const uniqueStores = [...new Set((data || []).map((d) => d.tienda).filter(Boolean))] as string[];
        setStores(uniqueStores.sort());
      } else {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("tienda")
          .eq("exhibicion_id", studyId)
          .not("tienda", "is", null);

        if (error) throw error;
        const uniqueStores = [...new Set((data || []).map((d) => d.tienda).filter(Boolean))] as string[];
        setStores(uniqueStores.sort());
      }
    } catch (error: any) {
      toast.error("Error al cargar tiendas: " + error.message);
    } finally {
      setLoadingStores(false);
    }
  };

  const handleStoreChange = async (store: string) => {
    setSelectedStore(store);
    setProducts([]);
    setFilteredProducts([]);
    setSelectedProduct(null);
    setSearchTerm("");
    setLoadingProducts(true);

    try {
      if (studyType === "encarte") {
        const { data, error } = await supabase
          .from("respuestas")
          .select("id, producto, cod_interno, tienda, foto")
          .eq("encarte_id", selectedStudy)
          .eq("tienda", store)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProducts(data || []);
        setFilteredProducts(data || []);
      } else {
        const { data, error } = await supabase
          .from("respuestas_exhibicion")
          .select("id, descripcion_producto, cod_producto, tienda, foto")
          .eq("exhibicion_id", selectedStudy)
          .eq("tienda", store)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProducts(data || []);
        setFilteredProducts(data || []);
      }
    } catch (error: any) {
      toast.error("Error al cargar productos: " + error.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const lower = term.toLowerCase();
    const filtered = products.filter((p) => {
      const productName = (p.producto || p.descripcion_producto || "").toLowerCase();
      const code = (p.cod_interno || p.cod_producto || "").toLowerCase();
      const store = (p.tienda || "").toLowerCase();
      return productName.includes(lower) || code.includes(lower) || store.includes(lower);
    });
    setFilteredProducts(filtered);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const compressed = await compressImage(dataUrl, 1920, 1920, 0.8);
        setNewPhoto(compressed);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Error al procesar imagen: " + error.message);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedProduct || !newPhoto) return;

    setUploading(true);
    try {
      // Use new naming format: admin_tienda_cod_producto_timestamp.jpg
      const fileName = generateAdminPhotoFileName(
        selectedProduct.tienda,
        selectedProduct.cod_interno || selectedProduct.cod_producto
      );

      const photoUrl = await uploadPhotoToS3(newPhoto, fileName);
      if (!photoUrl) throw new Error("AWS S3 Upload Failed");

      // Update record
      if (studyType === "encarte") {
        const { error } = await supabase
          .from("respuestas")
          .update({ foto: photoUrl })
          .eq("id", selectedProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("respuestas_exhibicion")
          .update({ foto: photoUrl })
          .eq("id", selectedProduct.id);

        if (error) throw error;
      }

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct.id ? { ...p, foto: photoUrl } : p))
      );
      setFilteredProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct.id ? { ...p, foto: photoUrl } : p))
      );
      setSelectedProduct({ ...selectedProduct, foto: photoUrl });
      setNewPhoto(null);

      toast.success("Foto actualizada correctamente");
    } catch (error: any) {
      toast.error("Error al subir foto: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getProductDisplay = (p: ProductRecord) => {
    const name = p.producto || p.descripcion_producto || "Sin nombre";
    const code = p.cod_interno || p.cod_producto || "";
    const store = p.tienda || "";
    return `${code ? `[${code}] ` : ""}${name}${store ? ` - ${store}` : ""}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5" />
          Gestión de Fotos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsOpen(true)}>
            <Camera className="mr-2 h-4 w-4" />
            Insertar / Actualizar Foto
          </Button>

          <Button
            variant="secondary"
            onClick={handleFixPhotoUrls}
            disabled={fixingPhotos}
          >
            {fixingPhotos ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="mr-2 h-4 w-4" />
            )}
            {fixingPhotos ? "Corrigiendo..." : "Corregir URLs de Fotos"}
          </Button>

          <Button
            variant="outline"
            onClick={handleValidatePhotoUrls}
            disabled={validatingUrls}
          >
            {validatingUrls ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 h-4 w-4" />
            )}
            {validatingUrls ? "Validando..." : "Validar URLs (404)"}
          </Button>
        </div>

        {/* Validation Progress */}
        {validationProgress && (
          <div className="p-4 border rounded-md bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {validatingUrls ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : validationProgress.invalid > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              Validación de URLs
            </div>
            <div className="text-sm text-muted-foreground">
              Progreso: {validationProgress.validated} / {validationProgress.total}
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ Válidas: {validationProgress.valid}</span>
              <span className="text-destructive">✗ Inválidas: {validationProgress.invalid}</span>
            </div>
            {invalidUrls.length > 0 && !validatingUrls && (
              <div className="pt-2 space-y-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearInvalidUrls}
                >
                  Limpiar {invalidUrls.length} URLs Inválidas
                </Button>
                <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                  {invalidUrls.slice(0, 10).map(item => (
                    <div key={item.id} className="text-muted-foreground">
                      [{item.cod_producto}] {item.tienda}
                    </div>
                  ))}
                  {invalidUrls.length > 10 && (
                    <div className="text-muted-foreground">... y {invalidUrls.length - 10} más</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Insertar o Actualizar Foto</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Step 1: Study Type */}
              <div className="space-y-2">
                <Label>1. Tipo de Estudio</Label>
                <Select
                  value={studyType}
                  onValueChange={(v) => handleStudyTypeChange(v as "encarte" | "exhibicion")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo de estudio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="encarte">Encarte</SelectItem>
                    <SelectItem value="exhibicion">Exhibición</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Select Study */}
              {studyType && (
                <div className="space-y-2">
                  <Label>2. Seleccionar Estudio</Label>
                  <Select
                    value={selectedStudy}
                    onValueChange={handleStudyChange}
                    disabled={loadingStudies}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={loadingStudies ? "Cargando..." : "Selecciona estudio"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {studies.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nombre} - {s.fecha}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 3: Select Store */}
              {selectedStudy && (
                <div className="space-y-2">
                  <Label>3. Seleccionar Tienda</Label>
                  <Select
                    value={selectedStore}
                    onValueChange={handleStoreChange}
                    disabled={loadingStores}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={loadingStores ? "Cargando..." : "Selecciona tienda"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 4: Search Products */}
              {selectedStore && (
                <div className="space-y-2">
                  <Label>4. Buscar Producto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, código o tienda..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                      disabled={loadingProducts}
                    />
                  </div>

                  {loadingProducts ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Cargando productos...
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border rounded-md">
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {searchTerm ? "Sin resultados" : "No hay productos"}
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0 flex items-center justify-between ${selectedProduct?.id === p.id ? "bg-accent" : ""
                              }`}
                            onClick={() => {
                              setSelectedProduct(p);
                              setNewPhoto(null);
                            }}
                          >
                            <span className="truncate flex-1">{getProductDisplay(p)}</span>
                            {p.foto ? (
                              <span className="text-xs text-green-600 ml-2">✓ Foto</span>
                            ) : (
                              <span className="text-xs text-destructive ml-2">Sin foto</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: View/Update Photo */}
              {selectedProduct && (
                <div className="space-y-4 border-t pt-4">
                  <Label>5. Foto del Producto</Label>
                  <div className="text-sm font-medium">{getProductDisplay(selectedProduct)}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Foto Actual</Label>
                      {selectedProduct.foto ? (
                        <img
                          src={selectedProduct.foto}
                          alt="Foto actual"
                          className="w-full h-48 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-md border flex items-center justify-center text-muted-foreground">
                          Sin foto
                        </div>
                      )}
                    </div>

                    {/* New Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Nueva Foto</Label>
                      {newPhoto ? (
                        <img
                          src={newPhoto}
                          alt="Nueva foto"
                          className="w-full h-48 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-md border flex items-center justify-center text-muted-foreground">
                          Selecciona una foto
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Seleccionar Foto
                    </Button>
                    <Button
                      onClick={handleUploadPhoto}
                      disabled={!newPhoto || uploading}
                      className="flex-1"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Subiendo..." : "Guardar Foto"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
