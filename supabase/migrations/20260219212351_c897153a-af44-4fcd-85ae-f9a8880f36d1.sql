
-- Allow owners to update their own productos (needed for microcategoria update)
CREATE POLICY "Users can update productos of their encartes"
ON public.productos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM encartes e
    WHERE e.id = productos.encarte_id
    AND e.created_by = auth.uid()
  )
);
