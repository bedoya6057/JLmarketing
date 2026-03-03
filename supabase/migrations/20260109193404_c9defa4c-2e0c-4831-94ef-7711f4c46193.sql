-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create respuestas_exhibicion" ON public.respuestas_exhibicion;

-- Create a more permissive INSERT policy for authenticated users
-- The created_by will be set to the current user in the application code
CREATE POLICY "Authenticated users can create respuestas_exhibicion" 
ON public.respuestas_exhibicion 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure encuestadores can view their own responses
DROP POLICY IF EXISTS "Encuestadores can view own respuestas_exhibicion" ON public.respuestas_exhibicion;
CREATE POLICY "Encuestadores can view own respuestas_exhibicion" 
ON public.respuestas_exhibicion 
FOR SELECT 
USING (auth.uid() = created_by);