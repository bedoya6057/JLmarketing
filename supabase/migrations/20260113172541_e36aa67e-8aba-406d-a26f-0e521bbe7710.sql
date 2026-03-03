-- Drop existing INSERT policy for respuestas
DROP POLICY IF EXISTS "Users can create respuestas" ON public.respuestas;

-- Create a more permissive INSERT policy that allows any authenticated user to insert
-- This fixes sync issues where created_by in offline cache doesn't match current session
CREATE POLICY "Users can create respuestas"
ON public.respuestas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);