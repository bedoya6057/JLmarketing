-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view productos_exhibicion" ON public.productos_exhibicion;

-- Create simpler policy - all authenticated users can view
CREATE POLICY "Authenticated users can view productos_exhibicion" 
ON public.productos_exhibicion 
FOR SELECT 
TO authenticated
USING (true);