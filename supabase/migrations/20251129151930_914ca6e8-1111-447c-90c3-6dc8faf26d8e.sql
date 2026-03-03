-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view assigned tiendas" ON public.tiendas;

-- Create new policy using auth.email() instead of jwt extraction
CREATE POLICY "Users can view assigned tiendas" 
ON public.tiendas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (lower(responsable) = lower(auth.email()))
);