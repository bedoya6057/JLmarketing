-- Add cartel_tipo_legal column to respuestas table
ALTER TABLE public.respuestas ADD COLUMN cartel_tipo_legal TEXT;

-- Comment to describe the column
COMMENT ON COLUMN public.respuestas.cartel_tipo_legal IS 'Tipo de legal del cartel (Cuenta con Legal / Sin Legal)';
