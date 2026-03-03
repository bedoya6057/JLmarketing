CREATE POLICY "Encuestadores can view own respuestas"
ON public.respuestas
FOR SELECT
USING (auth.uid() = created_by);