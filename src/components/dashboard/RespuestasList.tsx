import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Respuesta {
  id: string;
  encarte: string;
  producto: string;
  ciudad: string;
  bandera: string;
  tienda: string;
  presencia_producto: boolean | null;
  presencia_cartel: boolean | null;
  precio_ok: boolean | null;
  precio_encontrado: number | null;
  precio_encarte: number | null;
  observaciones: string | null;
  created_at: string;
}

interface RespuestaExhibicion {
  id: string;
  descripcion_producto: string;
  ciudad: string;
  bandera: string;
  tienda: string;
  presencia_exhibicion: string | null;
  ubicacion: string | null;
  observaciones: string | null;
  created_at: string;
}

export const RespuestasList = () => {
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [respuestasExhibicion, setRespuestasExhibicion] = useState<RespuestaExhibicion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRespuestas();
  }, []);

  const loadRespuestas = async () => {
    try {
      setLoading(true);

      // Load respuestas (encarte)
      const { data: respuestasData, error: respuestasError } = await supabase
        .from("respuestas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (respuestasError) throw respuestasError;
      setRespuestas(respuestasData || []);

      // Load respuestas_exhibicion
      const { data: exhibicionData, error: exhibicionError } = await supabase
        .from("respuestas_exhibicion")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (exhibicionError) throw exhibicionError;
      setRespuestasExhibicion(exhibicionData || []);

    } catch (error: any) {
      console.error("Error loading respuestas:", error);
      toast.error("Error al cargar respuestas");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBooleanBadge = (value: boolean | null) => {
    if (value === null) return <Badge variant="outline">N/A</Badge>;
    if (value) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros de Respuestas</CardTitle>
        <CardDescription>
          Últimos 100 registros de auditorías y exhibiciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="encarte" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="encarte">
              Encarte ({respuestas.length})
            </TabsTrigger>
            <TabsTrigger value="exhibicion">
              Exhibición ({respuestasExhibicion.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="encarte" className="mt-4">
            {respuestas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay registros de encarte</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Encarte</TableHead>
                      <TableHead className="min-w-[200px]">Producto</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Bandera</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead className="text-center">Producto</TableHead>
                      <TableHead className="text-center">Cartel</TableHead>
                      <TableHead className="text-center">Precio OK</TableHead>
                      <TableHead>Precio Enc.</TableHead>
                      <TableHead>Precio Enc.</TableHead>
                      <TableHead className="min-w-[150px]">Observaciones</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {respuestas.map((respuesta) => (
                      <TableRow key={respuesta.id}>
                        <TableCell className="font-medium">{respuesta.encarte}</TableCell>
                        <TableCell>{respuesta.producto}</TableCell>
                        <TableCell>{respuesta.ciudad}</TableCell>
                        <TableCell>{respuesta.bandera}</TableCell>
                        <TableCell>{respuesta.tienda}</TableCell>
                        <TableCell className="text-center">
                          {getBooleanBadge(respuesta.presencia_producto)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getBooleanBadge(respuesta.presencia_cartel)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getBooleanBadge(respuesta.precio_ok)}
                        </TableCell>
                        <TableCell>
                          {respuesta.precio_encarte ? `$${respuesta.precio_encarte.toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell>
                          {respuesta.precio_encontrado ? `$${respuesta.precio_encontrado.toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {respuesta.observaciones || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(respuesta.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="exhibicion" className="mt-4">
            {respuestasExhibicion.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay registros de exhibición</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Producto</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Bandera</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead>Presencia</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="min-w-[150px]">Observaciones</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {respuestasExhibicion.map((respuesta) => (
                      <TableRow key={respuesta.id}>
                        <TableCell className="font-medium">
                          {respuesta.descripcion_producto}
                        </TableCell>
                        <TableCell>{respuesta.ciudad}</TableCell>
                        <TableCell>{respuesta.bandera}</TableCell>
                        <TableCell>{respuesta.tienda}</TableCell>
                        <TableCell>
                          <Badge variant={respuesta.presencia_exhibicion === "Sí" ? "default" : "secondary"}>
                            {respuesta.presencia_exhibicion || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>{respuesta.ubicacion || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {respuesta.observaciones || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(respuesta.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
