-- Add RLS DELETE policies for encartes, productos, respuestas

-- Allow owners to delete their encartes
CREATE POLICY "Users can delete own encartes"
ON public.encartes
FOR DELETE
USING (auth.uid() = created_by);

-- Allow owners of encartes to delete productos belonging to their encartes
CREATE POLICY "Users can delete productos of their encartes"
ON public.productos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.encartes e
    WHERE e.id = productos.encarte_id AND e.created_by = auth.uid()
  )
);

-- Allow owners of encartes to delete respuestas belonging to their encartes
CREATE POLICY "Users can delete respuestas of their encartes"
ON public.respuestas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.encartes e
    WHERE e.id = respuestas.encarte_id AND e.created_by = auth.uid()
  )
);
