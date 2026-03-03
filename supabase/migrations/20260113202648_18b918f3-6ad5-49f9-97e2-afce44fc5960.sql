
-- Drop and recreate INSERT policy with correct role assignment
DROP POLICY IF EXISTS "Users can create respuestas" ON public.respuestas;

-- Create INSERT policy for public role (same as other policies)
CREATE POLICY "Users can create respuestas"
ON public.respuestas
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);
