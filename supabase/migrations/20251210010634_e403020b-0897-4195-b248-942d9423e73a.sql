-- Add new fields for exhibition survey
ALTER TABLE public.respuestas_exhibicion 
ADD COLUMN IF NOT EXISTS presencia_cartel_con_tarjeta boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS precio_tarjeta numeric;