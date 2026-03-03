-- Drop the existing UNIQUE INDEX (not a constraint, so ON CONFLICT can't use it)
DROP INDEX IF EXISTS public.progreso_encuestador_user_encarte_tienda_key;

-- Create a proper UNIQUE CONSTRAINT (required for ON CONFLICT to work)
ALTER TABLE public.progreso_encuestador
ADD CONSTRAINT progreso_encuestador_user_encarte_tienda_unique
UNIQUE (user_id, encarte_id, tienda);