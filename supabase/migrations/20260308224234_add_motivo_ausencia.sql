-- Add motivo_ausencia column to respuestas table
ALTER TABLE public.respuestas ADD COLUMN motivo_ausencia TEXT;

-- Comment to describe the column
COMMENT ON COLUMN public.respuestas.motivo_ausencia IS 'Motivo de ausencia del producto cuando presencia_producto es falso';
