-- Drop the existing restrictive admin policy
DROP POLICY IF EXISTS "Admins can view all respuestas_exhibicion" ON public.respuestas_exhibicion;

-- Create a new PERMISSIVE policy for admins to view all records
CREATE POLICY "Admins can view all respuestas_exhibicion"
ON public.respuestas_exhibicion
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));