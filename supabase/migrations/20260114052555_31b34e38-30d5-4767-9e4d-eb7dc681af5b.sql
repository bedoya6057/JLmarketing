-- Allow encuestadores to truly "Comenzar de nuevo" by deleting their own saved navigation progress

-- progreso_encuestador
ALTER TABLE public.progreso_encuestador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own progreso_encuestador" ON public.progreso_encuestador;
CREATE POLICY "Users can delete own progreso_encuestador"
ON public.progreso_encuestador
FOR DELETE
USING (auth.uid() = user_id);

-- progreso_encuestador_exhibicion
ALTER TABLE public.progreso_encuestador_exhibicion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own progreso_encuestador_exhibicion" ON public.progreso_encuestador_exhibicion;
CREATE POLICY "Users can delete own progreso_encuestador_exhibicion"
ON public.progreso_encuestador_exhibicion
FOR DELETE
USING (auth.uid() = user_id);
