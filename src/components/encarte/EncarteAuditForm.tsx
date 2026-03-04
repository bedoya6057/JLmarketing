import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Camera, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { compressImageFile } from "@/lib/imageCompression";
import { uploadPhotoToS3 } from "@/lib/s3Upload";

interface Producto {
  id: string;
  descripcion_producto_carteleria: string;
  precio_encarte: number;
  macrocategoria: string;
  categoria: string;
  cod_interno: string;
  precio_regular: number;
  precio_promo: number;
}

interface Respuesta {
  producto_id: string;
  precio_encontrado: number;
  precio_tarjeta: number;
  presencia_producto: boolean;
  presencia_cartel: boolean;
  presencia_cartel_con_tarjeta: boolean;
  ubicacion_sku: string;
  observaciones: string;
  precio_ok: boolean;
  cumplimiento_carteles: boolean;
  obs_1: string;
  foto: string;
}

interface EncarteAuditFormProps {
  encarteId: string;
}

export const EncarteAuditForm = ({ encarteId }: EncarteAuditFormProps) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fotoRegistro, setFotoRegistro] = useState<string>();
  const [fotoProducto, setFotoProducto] = useState<string>();
  const [fotoRegistroFile, setFotoRegistroFile] = useState<File | null>(null);
  const [fotoProductoFile, setFotoProductoFile] = useState<File | null>(null);
  const [respuestas, setRespuestas] = useState<Map<string, Respuesta>>(new Map());

  const fotoRegistroRef = useRef<HTMLInputElement>(null);
  const fotoProductoRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Respuesta>>({
    precio_encontrado: 0,
    precio_tarjeta: 0,
    presencia_producto: false,
    presencia_cartel: false,
    presencia_cartel_con_tarjeta: false,
    ubicacion_sku: "",
    observaciones: "",
    precio_ok: false,
    cumplimiento_carteles: false,
    obs_1: "",
  });

  useEffect(() => {
    loadProductos();
  }, [encarteId]);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("encarte_id", encarteId)
        .order("descripcion_producto_carteleria");

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error("Error loading productos:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleFotoRegistro = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoRegistroFile(file); // Guardar archivo original
      try {
        const compressed = await compressImageFile(file);
        setFotoRegistro(compressed);
      } catch (error) {
        console.error("Error compressing image:", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoRegistro(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFotoProducto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoProductoFile(file); // Guardar archivo original
      try {
        const compressed = await compressImageFile(file);
        setFotoProducto(compressed);
      } catch (error) {
        console.error("Error compressing image:", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoProducto(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const uploadPhoto = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${encarteId}/${Date.now()}.${fileExt}`;

    const s3Url = await uploadPhotoToS3(file, fileName);
    if (!s3Url) throw new Error("AWS S3 Upload Failed");

    return s3Url;
  };

  const handleSave = async () => {
    if (!fotoProducto) {
      toast.error("Debes capturar una foto del producto");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const currentProducto = productos[currentIndex];

      // Upload foto de registro si es el primer producto
      let fotoRegistroUrl = "";
      if (currentIndex === 0 && fotoRegistroFile) {
        console.log("📸 Subiendo foto de registro...");
        fotoRegistroUrl = await uploadPhoto(fotoRegistroFile, user.id);
        console.log("✅ Foto de registro subida:", fotoRegistroUrl);

        // Update encarte with foto_registro
        await supabase
          .from("encartes")
          .update({ foto_registro: fotoRegistroUrl })
          .eq("id", encarteId);
      }

      // Upload foto del producto
      let fotoProductoUrl = "";
      if (fotoProductoFile) {
        console.log("📸 Subiendo foto del producto...");
        fotoProductoUrl = await uploadPhoto(fotoProductoFile, user.id);
        console.log("✅ Foto del producto subida:", fotoProductoUrl);
      } else {
        console.error("❌ No se encontró archivo de foto del producto");
      }

      // Calculate precio_ok
      const precioOk = formData.precio_encontrado === 0 ||
        formData.precio_encontrado === currentProducto.precio_encarte;

      // Preparar datos para insertar
      const respuestaData = {
        encarte_id: encarteId,
        producto_id: currentProducto.id,
        precio_encontrado: formData.precio_encontrado,
        precio_tarjeta: formData.precio_tarjeta,
        presencia_producto: formData.presencia_producto,
        presencia_cartel: formData.presencia_cartel,
        presencia_cartel_con_tarjeta: formData.presencia_cartel_con_tarjeta,
        ubicacion_sku: formData.ubicacion_sku,
        observaciones: formData.observaciones,
        precio_ok: precioOk,
        cumplimiento_carteles: formData.cumplimiento_carteles,
        obs_1: formData.obs_1,
        foto: fotoProductoUrl,
        foto_registro: fotoRegistroUrl || undefined,
        created_by: user.id,
      };

      console.log("💾 Guardando respuesta con datos:", respuestaData);

      // Save respuesta
      const { data: respuestaInsertada, error } = await supabase
        .from("respuestas")
        .insert(respuestaData)
        .select();

      if (error) {
        console.error("❌ Error al insertar respuesta:", error);
        throw error;
      }

      console.log("✅ Respuesta guardada exitosamente:", respuestaInsertada);

      // Mark as completed
      const newRespuestas = new Map(respuestas);
      newRespuestas.set(currentProducto.id, { ...formData, foto: fotoProductoUrl } as Respuesta);
      setRespuestas(newRespuestas);

      toast.success("Respuesta guardada");

      // Move to next product
      if (currentIndex < productos.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setFormData({
          precio_encontrado: 0,
          precio_tarjeta: 0,
          presencia_producto: false,
          presencia_cartel: false,
          presencia_cartel_con_tarjeta: false,
          ubicacion_sku: "",
          observaciones: "",
          precio_ok: false,
          cumplimiento_carteles: false,
          obs_1: "",
        });
        setFotoProducto(undefined);
        setFotoProductoFile(null);
      } else {
        // Mark encarte as completed
        await supabase
          .from("encartes")
          .update({ estado: "completado" })
          .eq("id", encarteId);

        toast.success("¡Encarte completado!");
      }
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay productos cargados</p>
      </div>
    );
  }

  const currentProducto = productos[currentIndex];
  const isCompleted = respuestas.has(currentProducto.id);
  const progress = (respuestas.size / productos.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Producto {currentIndex + 1} de {productos.length}
          </span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Foto de Registro (solo primer producto) */}
      {currentIndex === 0 && !fotoRegistro && (
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-sm">Foto de Registro Inicial</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => fotoRegistroRef.current?.click()}
              className="w-full gap-2"
            >
              <Camera className="h-4 w-4" />
              Capturar Foto Inicial
            </Button>
            <input
              ref={fotoRegistroRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFotoRegistro}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Current Product */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle>{currentProducto.descripcion_producto_carteleria}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {currentProducto.macrocategoria}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {currentProducto.categoria}
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  ${currentProducto.precio_encarte?.toFixed(2)}
                </Badge>
              </div>
            </div>
            {isCompleted && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Precios */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Precio Encontrado *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precio_encontrado}
                onChange={(e) =>
                  setFormData({ ...formData, precio_encontrado: parseFloat(e.target.value) || 0 })
                }
                placeholder="0 si no cambió"
              />
              <p className="text-xs text-muted-foreground">
                Coloca 0 si el precio es correcto
              </p>
            </div>

            <div className="space-y-2">
              <Label>Precio Tarjeta</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precio_tarjeta}
                onChange={(e) =>
                  setFormData({ ...formData, precio_tarjeta: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="grid gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="presencia_producto"
                checked={formData.presencia_producto}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, presencia_producto: checked as boolean })
                }
              />
              <Label htmlFor="presencia_producto" className="cursor-pointer">
                Presencia Producto
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="presencia_cartel"
                checked={formData.presencia_cartel}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, presencia_cartel: checked as boolean })
                }
              />
              <Label htmlFor="presencia_cartel" className="cursor-pointer">
                Presencia Cartel
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="presencia_cartel_con_tarjeta"
                checked={formData.presencia_cartel_con_tarjeta}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, presencia_cartel_con_tarjeta: checked as boolean })
                }
              />
              <Label htmlFor="presencia_cartel_con_tarjeta" className="cursor-pointer">
                Presencia Cartel con Tarjeta
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cumplimiento_carteles"
                checked={formData.cumplimiento_carteles}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, cumplimiento_carteles: checked as boolean })
                }
              />
              <Label htmlFor="cumplimiento_carteles" className="cursor-pointer">
                Cumplimiento Carteles
              </Label>
            </div>
          </div>

          {/* Text fields */}
          <div className="space-y-2">
            <Label>Ubicación SKU</Label>
            <Input
              value={formData.ubicacion_sku}
              onChange={(e) =>
                setFormData({ ...formData, ubicacion_sku: e.target.value })
              }
              placeholder="Ej: Pasillo 3, Estante B"
            />
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={formData.observaciones}
              onChange={(e) =>
                setFormData({ ...formData, observaciones: e.target.value })
              }
              placeholder="Observaciones generales..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>OBS 1</Label>
            <Textarea
              value={formData.obs_1}
              onChange={(e) =>
                setFormData({ ...formData, obs_1: e.target.value })
              }
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          {/* Foto del Producto */}
          <div className="space-y-2">
            <Label>Foto del Producto *</Label>
            <div className="flex gap-4 items-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => fotoProductoRef.current?.click()}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                Capturar Foto
              </Button>
              <input
                ref={fotoProductoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoProducto}
                className="hidden"
              />
              {fotoProducto && (
                <img
                  src={fotoProducto}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded-lg border"
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || !fotoProducto}
              className="flex-1"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentIndex < productos.length - 1 ? (
                <>
                  Guardar y Continuar
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                "Guardar y Finalizar"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
