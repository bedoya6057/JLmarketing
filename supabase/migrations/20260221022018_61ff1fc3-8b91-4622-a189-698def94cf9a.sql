
-- Fix unique constraint to be per store, not per encarte
-- This aligns with progreso_encuestador_exhibicion which already uses (user_id, exhibicion_id, tienda)
ALTER TABLE public.progreso_encuestador 
DROP CONSTRAINT IF EXISTS progreso_encuestador_user_id_encarte_id_key;

CREATE UNIQUE INDEX progreso_encuestador_user_encarte_tienda_key 
ON public.progreso_encuestador (user_id, encarte_id, tienda);
