-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view tiendas" ON public.tiendas;

-- Create new policy: users only see tiendas where they are responsable
CREATE POLICY "Users can view assigned tiendas"
ON public.tiendas
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR LOWER(responsable) = LOWER(auth.jwt() ->> 'email')
);