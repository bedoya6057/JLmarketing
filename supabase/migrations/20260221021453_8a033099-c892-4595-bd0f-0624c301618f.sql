
-- Add foto_salida_url to progreso_encuestador (per store exit photo)
ALTER TABLE public.progreso_encuestador 
ADD COLUMN foto_salida_url text;
