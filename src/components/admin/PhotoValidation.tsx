import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { ImageOff, RefreshCw } from "lucide-react";
import { usePhotoValidation } from "./photo-validation/usePhotoValidation";
import { StudyPhotoCard } from "./photo-validation/StudyPhotoCard";

export function PhotoValidation() {
  const {
    loading,
    validating,
    stats,
    missingRecords,
    brokenUrls,
    duplicates,
    missingIngreso,
    loadPhotoStats,
    loadMissingRecords,
    loadMissingIngresoPhotos,
    loadDuplicates,
    validateUrls,
  } = usePhotoValidation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ImageOff className="h-5 w-5" />
          Validación de Fotos
        </CardTitle>
        <Button onClick={loadPhotoStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Cargando..." : "Validar Fotos"}
        </Button>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Haz clic en "Validar Fotos" para analizar los estudios activos
          </p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {stats.map((study) => (
              <StudyPhotoCard
                key={study.id}
                study={study}
                validating={validating}
                missingRecords={missingRecords[study.id] || []}
                brokenUrls={brokenUrls[study.id] || []}
                duplicates={duplicates[study.id] || []}
                missingIngreso={missingIngreso[study.id] || []}
                onLoadMissingRecords={loadMissingRecords}
                onLoadMissingIngreso={loadMissingIngresoPhotos}
                onLoadDuplicates={loadDuplicates}
                onValidateUrls={validateUrls}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
