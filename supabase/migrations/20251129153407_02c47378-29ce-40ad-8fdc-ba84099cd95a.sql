-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can view productos_exhibicion" ON public.productos_exhibicion;

-- Create PERMISSIVE policy for all authenticated users
CREATE POLICY "All authenticated can view productos_exhibicion" 
ON public.productos_exhibicion 
FOR SELECT 
TO authenticated
USING (true);