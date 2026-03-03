-- Drop the existing restrictive policy for viewing productos
DROP POLICY IF EXISTS "Users can view productos of their encartes" ON public.productos;

-- Create new policies that allow encuestadores to view all productos
CREATE POLICY "Encuestadores can view all productos"
ON public.productos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'encuestador'
  )
);

CREATE POLICY "Owners can view their productos"
ON public.productos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM encartes e
    WHERE e.id = productos.encarte_id 
    AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid() OR e.encargado_2 = auth.uid())
  )
);