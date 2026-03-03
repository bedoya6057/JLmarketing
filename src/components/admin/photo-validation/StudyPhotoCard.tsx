import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  ImageOff, 
  RefreshCw, 
  AlertTriangle, 
  ExternalLink,
  Copy,
  Camera
} from "lucide-react";
import type { 
  StudyPhotoStats, 
  MissingPhotoRecord, 
  DuplicatePhotoRecord,
  IngresoPhotoRecord 
} from "./types";

interface StudyPhotoCardProps {
  study: StudyPhotoStats;
  validating: string | null;
  missingRecords: MissingPhotoRecord[];
  brokenUrls: MissingPhotoRecord[];
  duplicates: DuplicatePhotoRecord[];
  missingIngreso: IngresoPhotoRecord[];
  onLoadMissingRecords: (study: StudyPhotoStats) => void;
  onLoadMissingIngreso: (study: StudyPhotoStats) => void;
  onLoadDuplicates: (study: StudyPhotoStats) => void;
  onValidateUrls: (study: StudyPhotoStats) => void;
}

export function StudyPhotoCard({
  study,
  validating,
  missingRecords,
  brokenUrls,
  duplicates,
  missingIngreso,
  onLoadMissingRecords,
  onLoadMissingIngreso,
  onLoadDuplicates,
  onValidateUrls,
}: StudyPhotoCardProps) {
  const getCompletionPercentage = () => {
    if (study.total_respuestas === 0) return 100;
    return Math.round((study.con_foto / study.total_respuestas) * 100);
  };

  const getStatusBadge = () => {
    const pct = getCompletionPercentage();
    if (pct === 100 && study.duplicados === 0 && study.sin_foto_ingreso === 0) {
      return <Badge className="bg-primary"><CheckCircle className="h-3 w-3 mr-1" /> 100%</Badge>;
    } else if (pct >= 90 && study.duplicados === 0) {
      return <Badge className="bg-accent text-accent-foreground"><AlertTriangle className="h-3 w-3 mr-1" /> {pct}%</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> {pct}%</Badge>;
    }
  };

  const isLoading = validating === study.id;

  return (
    <AccordionItem value={study.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            <Badge variant={study.tipo === "exhibicion" ? "default" : "secondary"}>
              {study.tipo === "exhibicion" ? "EXH" : "ENC"}
            </Badge>
            <span className="font-medium">{study.nombre}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-sm text-muted-foreground">
              {study.con_foto}/{study.total_respuestas} fotos
            </span>
            {study.sin_foto > 0 && (
              <Badge variant="destructive" className="text-xs">
                <ImageOff className="h-3 w-3 mr-1" />
                {study.sin_foto}
              </Badge>
            )}
            {study.sin_foto_ingreso > 0 && (
              <Badge variant="outline" className="text-xs border-accent text-accent-foreground">
                <Camera className="h-3 w-3 mr-1" />
                {study.sin_foto_ingreso} ingreso
              </Badge>
            )}
            {study.duplicados > 0 && (
              <Badge variant="destructive" className="text-xs">
                <Copy className="h-3 w-3 mr-1" />
                {study.duplicados} dup
              </Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLoadMissingRecords(study)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImageOff className="h-4 w-4 mr-2" />
              )}
              Sin foto producto
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLoadMissingIngreso(study)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Sin foto ingreso
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLoadDuplicates(study)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Duplicados
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onValidateUrls(study)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Validar URLs
            </Button>
          </div>

          {/* Missing product photos table */}
          {missingRecords && missingRecords.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-destructive">
                Registros sin foto de producto ({missingRecords.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Encargado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tienda}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.producto}</TableCell>
                      <TableCell>{record.fecha}</TableCell>
                      <TableCell>{record.encargado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Missing ingreso photos table */}
          {missingIngreso && missingIngreso.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-accent-foreground">
                Tiendas sin foto de ingreso ({missingIngreso.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingIngreso.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tienda}</TableCell>
                      <TableCell>{record.usuario}</TableCell>
                      <TableCell>{record.fecha}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Duplicates table */}
          {duplicates && duplicates.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-destructive">
                Fotos duplicadas ({duplicates.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Tiendas afectadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((dup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {dup.url.substring(dup.url.lastIndexOf("/") + 1)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{dup.count}x</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {dup.records.map(r => r.tienda).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Broken URLs table */}
          {brokenUrls && brokenUrls.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-muted-foreground">
                URLs rotas ({brokenUrls.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokenUrls.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tienda}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {record.producto}
                      </TableCell>
                      <TableCell>{record.fecha}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{record.encargado}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {brokenUrls?.length === 0 && duplicates?.length === 0 && 
           missingRecords?.length === 0 && missingIngreso?.length === 0 && (
            <p className="text-primary text-sm">✅ Todo validado correctamente</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
