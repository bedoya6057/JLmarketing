-- Add started_fresh column to track fresh starts
ALTER TABLE public.progreso_encuestador_exhibicion
ADD COLUMN started_fresh BOOLEAN DEFAULT false;

ALTER TABLE public.progreso_encuestador
ADD COLUMN started_fresh BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.progreso_encuestador_exhibicion.started_fresh IS 'True if user chose Comenzar de Nuevo - prevents loading old responses from DB';
COMMENT ON COLUMN public.progreso_encuestador.started_fresh IS 'True if user chose Comenzar de Nuevo - prevents loading old responses from DB';