-- Agregar columnas para guardar los IDs de productos respondidos y saltados
ALTER TABLE progreso_encuestador
ADD COLUMN IF NOT EXISTS responded_product_ids text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skipped_product_ids text[] DEFAULT '{}';