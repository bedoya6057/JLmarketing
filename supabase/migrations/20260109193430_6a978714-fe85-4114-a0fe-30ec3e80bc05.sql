-- Drop the overly permissive policy and create one that validates created_by OR allows authenticated insert with auto-set created_by
DROP POLICY IF EXISTS "Authenticated users can create respuestas_exhibicion" ON public.respuestas_exhibicion;

-- Create a policy that allows INSERT when created_by matches auth.uid() OR is null (will be set in app)
-- The key insight: the sync code needs to ensure created_by is set to the userId before upsert
CREATE POLICY "Users can insert own respuestas_exhibicion" 
ON public.respuestas_exhibicion 
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);