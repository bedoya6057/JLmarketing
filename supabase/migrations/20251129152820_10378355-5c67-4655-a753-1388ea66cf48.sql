-- Drop the restrictive policies
DROP POLICY IF EXISTS "Encuestadores can view all productos_exhibicion" ON public.productos_exhibicion;
DROP POLICY IF EXISTS "Owners can view their productos_exhibicion" ON public.productos_exhibicion;

-- Create a single PERMISSIVE policy that allows either condition
CREATE POLICY "Users can view productos_exhibicion" 
ON public.productos_exhibicion 
FOR SELECT 
USING (
  has_role(auth.uid(), 'encuestador'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM exhibiciones e 
    WHERE e.id = productos_exhibicion.exhibicion_id 
    AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid())
  )
);