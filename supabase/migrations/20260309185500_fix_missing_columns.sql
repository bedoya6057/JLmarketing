-- Add missing columns to respuestas table
ALTER TABLE public.respuestas ADD COLUMN IF NOT EXISTS cartel_tipo_legal TEXT;
ALTER TABLE public.respuestas ADD COLUMN IF NOT EXISTS motivo_ausencia TEXT;

COMMENT ON COLUMN public.respuestas.cartel_tipo_legal IS 'Tipo de legal del cartel (Cuenta con Legal / Sin Legal)';
COMMENT ON COLUMN public.respuestas.motivo_ausencia IS 'Causa por la que el producto no está presente';
