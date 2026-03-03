-- Make exhibicion progress store-specific
-- Drop the existing CONSTRAINT (which also drops the index)
ALTER TABLE public.progreso_encuestador_exhibicion
  DROP CONSTRAINT IF EXISTS progreso_encuestador_exhibicion_user_exhibicion_unique;

-- Create a new unique constraint on (user_id, exhibicion_id, tienda)
ALTER TABLE public.progreso_encuestador_exhibicion
  ADD CONSTRAINT progreso_encuestador_exhibicion_user_exhibicion_tienda_key
    UNIQUE (user_id, exhibicion_id, tienda);
